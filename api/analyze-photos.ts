// Vercel serverless function — streams a vision request from Anthropic
// back to the browser as Server-Sent Events.
//
// Why streaming: the prior non-streaming version hit Vercel's gateway
// timeout (HTTP 504) when generation ran 20-30s, because nothing flowed
// back to the edge during that window. Streaming starts emitting bytes
// within ~1s, so the gateway stays happy regardless of total runtime.
//
// The client receives `progress` events while the model generates, then
// one final `complete` event carrying the parsed analysis JSON. Errors
// surface as `error` events.
//
// Configure: set ANTHROPIC_API_KEY in Vercel project env (Production +
// Preview). The 60s maxDuration is also pinned in vercel.json.

export const config = { runtime: 'nodejs', maxDuration: 60 };

type Slot = 'front' | 'side' | 'back';

interface AnalyzeRequest {
  photos: Array<{ slot: Slot; dataUrl: string }>;
  context: {
    sex?: 'female' | 'male' | 'other';
    age?: number;
    heightInches?: number;
    weightLbs?: number;
    goalWeightLbs?: number;
    goal?: string;
    trainingDaysPerWeek?: number;
    problemAreas?: string[];
    weeksTraining?: number;
    availableExercises?: string[];
  };
}

const ALLOWED_PRIORITIES = ['high', 'medium', 'low'] as const;

const PROMPT = `You are a supportive trainer reviewing progress photos. Identify which muscle groups would benefit from more training volume and recommend specific exercises.

Hard rules: No body-fat % estimates. Never body-shame — frame as "focus area," never "problem." No medical diagnosis. Pick exercises ONLY from the availableExercises list when provided. Keep rationales short (1 sentence each).

Return ONLY this JSON (no markdown, no prose):
{
  "summary": "2 sentences on what you see + highest-priority focus.",
  "whatsWorking": "1-2 sentences on visible strengths.",
  "focusAreas": [
    { "area": "Muscle group", "rationale": "1 sentence.", "priority": "high|medium|low" }
  ],
  "exerciseRecommendations": [
    { "name": "Exercise from list", "sets": "3-4", "reps": "8-12", "rationale": "1 sentence." }
  ],
  "caveats": "1 sentence on photo limits."
}

2-3 focus areas, 3-4 exercise recommendations, ordered by priority.`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sseError(
      'ANTHROPIC_API_KEY is not configured on the server. Set it in Vercel project environment variables.',
      500,
    );
  }

  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return sseError('Invalid JSON body', 400);
  }
  if (!body.photos?.length) {
    return sseError('No photos provided', 400);
  }

  // Build Anthropic content blocks from data URLs.
  const content: Array<Record<string, unknown>> = [];
  for (const photo of body.photos) {
    const match = photo.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) continue;
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: match[1], data: match[2] },
    });
    content.push({ type: 'text', text: `[${photo.slot} view]` });
  }
  if (content.length === 0) {
    return sseError('No valid image data found', 400);
  }
  content.push({
    type: 'text',
    text: `<user_context>\n${JSON.stringify(body.context ?? {}, null, 2)}\n</user_context>\n\n${PROMPT}`,
  });

  // Open a streaming Anthropic request.
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      stream: true,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!anthropicRes.ok || !anthropicRes.body) {
    const detail = await anthropicRes.text().catch(() => '');
    return sseError(`Vision API request failed: ${detail || anthropicRes.status}`, 502);
  }

  // Forward incremental progress to the client as SSE; parse the final
  // accumulated text into structured analysis at the end.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Initial heartbeat so the client + gateway both see bytes immediately.
      send({ type: 'start' });

      let accumulated = '';
      let model = 'unknown';
      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE frames split on blank lines.
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const evt = JSON.parse(payload) as {
                type?: string;
                delta?: { type?: string; text?: string };
                message?: { model?: string };
              };
              if (evt.type === 'message_start' && evt.message?.model) {
                model = evt.message.model;
              }
              if (
                evt.type === 'content_block_delta' &&
                evt.delta?.type === 'text_delta' &&
                typeof evt.delta.text === 'string'
              ) {
                accumulated += evt.delta.text;
                send({ type: 'progress', tokens: accumulated.length });
              }
            } catch {
              /* skip malformed chunks */
            }
          }
        }

        // Parse the accumulated text as JSON (peel a fenced block if any).
        const fence = accumulated.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const candidate = fence ? fence[1] : accumulated.trim();
        let parsed: unknown;
        try {
          parsed = JSON.parse(candidate);
        } catch {
          send({
            type: 'error',
            message: 'Model output was not valid JSON',
            raw: accumulated.slice(0, 500),
          });
          controller.close();
          return;
        }

        send({
          type: 'complete',
          analysis: sanitizeAnalysis(parsed),
          model,
        });
        controller.close();
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Stream error',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

function sseError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sanitizeAnalysis(input: unknown): Record<string, unknown> {
  const a = (input ?? {}) as Record<string, unknown>;
  return {
    summary: typeof a.summary === 'string' ? a.summary : '',
    whatsWorking: typeof a.whatsWorking === 'string' ? a.whatsWorking : '',
    focusAreas: Array.isArray(a.focusAreas)
      ? a.focusAreas
          .map((f) => {
            const fa = (f ?? {}) as Record<string, unknown>;
            const priority =
              typeof fa.priority === 'string' &&
              (ALLOWED_PRIORITIES as readonly string[]).includes(fa.priority)
                ? fa.priority
                : 'medium';
            return {
              area: typeof fa.area === 'string' ? fa.area : 'Focus area',
              rationale: typeof fa.rationale === 'string' ? fa.rationale : '',
              priority,
            };
          })
          .slice(0, 4)
      : [],
    exerciseRecommendations: Array.isArray(a.exerciseRecommendations)
      ? a.exerciseRecommendations
          .map((e) => {
            const er = (e ?? {}) as Record<string, unknown>;
            return {
              name: typeof er.name === 'string' ? er.name : '',
              sets: typeof er.sets === 'string' ? er.sets : '3',
              reps: typeof er.reps === 'string' ? er.reps : '8-12',
              rationale: typeof er.rationale === 'string' ? er.rationale : '',
            };
          })
          .filter((e) => e.name)
          .slice(0, 6)
      : [],
    caveats: typeof a.caveats === 'string' ? a.caveats : '',
  };
}
