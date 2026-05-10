// Vercel serverless function — proxies a vision request to Anthropic's
// Messages API. Keeps the ANTHROPIC_API_KEY off the client. Photos are
// forwarded once, not stored.
//
// Configure: set ANTHROPIC_API_KEY in Vercel project env (Production +
// Preview). No other env is required.

// maxDuration raises the function timeout from the 10s Hobby default to
// 60s — Sonnet/Haiku vision + JSON generation can run 15–25s on cold
// requests, so the lower limit was timing out before the response landed.
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
    /** Names from the local exercise library so the model picks real entries. */
    availableExercises?: string[];
  };
}

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  model: string;
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
    return new Response(
      JSON.stringify({
        error:
          'ANTHROPIC_API_KEY is not configured on the server. Set it in Vercel project environment variables.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body.photos?.length) {
    return new Response(JSON.stringify({ error: 'No photos provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Convert each data URL into an Anthropic image content block + label.
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
    return new Response(JSON.stringify({ error: 'No valid image data found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  content.push({
    type: 'text',
    text: `<user_context>\n${JSON.stringify(body.context ?? {}, null, 2)}\n</user_context>\n\n${PROMPT}`,
  });

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      // Haiku 4.5 is ~3× faster than Sonnet for this prompt shape and
      // handles vision well enough for physique focus-area reads. Swap
      // to claude-sonnet-4-6 if the analysis quality ever feels thin.
      model: 'claude-haiku-4-5-20251001',
      // Tighter cap — the prompt is now structured for ~600-800 output
      // tokens, so 1024 is enough headroom and cuts max generation time.
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text();
    return new Response(
      JSON.stringify({ error: 'Vision API request failed', detail }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const data = (await anthropicRes.json()) as AnthropicResponse;
  const textOut = data.content?.find((c) => c.type === 'text')?.text ?? '';

  // The prompt asks for raw JSON, but defensively peel out a code fence if
  // the model wraps it.
  const fence = textOut.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fence ? fence[1] : textOut.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return new Response(
      JSON.stringify({
        error: 'Could not parse analysis JSON',
        raw: textOut.slice(0, 500),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Light validation so the client gets something well-typed.
  const safeAnalysis = sanitizeAnalysis(parsed);

  return new Response(
    JSON.stringify({ analysis: safeAnalysis, model: data.model }),
    { headers: { 'Content-Type': 'application/json' } },
  );
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
