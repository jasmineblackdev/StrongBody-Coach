// Local exercise library. No external APIs.
// Coaching content emphasizes bracing, glute engagement, core control, and
// lower-back safety — the things that actually keep you healthy under load.

export interface ExerciseEntry {
  /** Canonical display name. */
  name: string;
  /** Alternate names that may show up in the plan or logs. */
  aliases?: string[];
  primaryMuscle: string;
  secondaryMuscles: string[];
  setupCues: string[];
  /** Step-by-step movement cues, in order. */
  formCues: string[];
  commonMistakes: string[];
  /** "What you should feel" — coaching language, not anatomy. */
  whatYouShouldFeel: string;
  videoUrl?: string;
  imageUrl?: string;
}

const LIBRARY: ExerciseEntry[] = [
  {
    name: 'Back Squat',
    aliases: ['Barbell Back Squat'],
    primaryMuscle: 'Quads',
    secondaryMuscles: ['Glutes', 'Hamstrings', 'Spinal erectors', 'Core'],
    setupCues: [
      'Bar on upper traps (high-bar) or rear delts (low-bar). Pick one and stick with it.',
      'Hands as close as your shoulders allow — tight grip = tight upper back.',
      'Stance roughly shoulder-width, toes slightly out. Find what lets you hit depth without pain.',
      'Before you unrack: big breath into the belly, brace 360° (front, sides, back).',
    ],
    formCues: [
      'Walk back in 2–3 steps. No more dancing.',
      'Take another big breath, brace hard, hold the air.',
      'Break at the hips and knees together. Drive your knees out as you sit between them.',
      'Hit depth (hip crease below knee) with control. Don\'t collapse.',
      'Out of the hole: drive the floor away, hips and shoulders rising together. Squeeze glutes at the top.',
    ],
    commonMistakes: [
      'Knees caving in — push them out the entire rep.',
      'Butt wink (lumbar tucking under at depth) — usually means too deep for your hip mobility, or no bracing.',
      'Looking up — keeps neck strained and hips shoot up. Look at a spot 6 ft in front of you.',
      'Letting the bar drift forward over your toes — keep it stacked over mid-foot.',
      'Losing your brace before the lift — exhale only after lockout.',
    ],
    whatYouShouldFeel:
      'Quads loading hard on the way down, glutes firing strong out of the hole, core like a steel cylinder the entire rep. Lower back should feel supported, never strained.',
  },

  {
    name: 'Paused Squat',
    aliases: ['Pause Squat', 'Paused Back Squat'],
    primaryMuscle: 'Quads',
    secondaryMuscles: ['Glutes', 'Core', 'Spinal erectors'],
    setupCues: [
      'Same setup as Back Squat. Use ~70–80% of your normal squat working weight.',
      'You\'ll need a bigger brace than usual — load more air.',
    ],
    formCues: [
      'Descend with control to depth.',
      'Pause for 2 full seconds at the bottom. Stay tight — no relaxing into the position.',
      'Maintain knees out, chest up, brace held the entire pause.',
      'Drive up explosively from the dead-stop position.',
    ],
    commonMistakes: [
      'Relaxing in the hole and bouncing out — defeats the purpose entirely.',
      'Going too heavy — paused work humbles you.',
      'Losing the brace during the pause — keep the air in.',
      'Letting knees collapse during the pause.',
    ],
    whatYouShouldFeel:
      'Massive bracing demand and pure leg work coming out of the bottom. This builds the bottom-end strength that lets you fix a stalling squat. Time under tension is the point.',
  },

  {
    name: 'Front Squat',
    aliases: ['Barbell Front Squat'],
    primaryMuscle: 'Quads',
    secondaryMuscles: ['Upper back', 'Core', 'Glutes'],
    setupCues: [
      'Bar across front delts, fingers under just to keep it on the shelf.',
      'Elbows pointed straight forward and HIGH. The shelf is your delts, not your hands.',
      'Stance roughly shoulder-width, toes slightly out. Most lifters squat narrower for fronts.',
      'Big breath, brace 360° before you unrack.',
    ],
    formCues: [
      'Stay upright — torso angle is much more vertical than back squat.',
      'Sit straight down between your knees, not back.',
      'Keep elbows up the entire rep. If they drop, the bar rolls.',
      'Drive up out of the hole through your heels and mid-foot.',
    ],
    commonMistakes: [
      'Dropping the elbows on the way up — most common cause of failed reps.',
      'Rounding the upper back — practice with empty bar to fix.',
      'Trying to squat low-bar style — torso angle is too forward.',
      'Wrist pain — improve front-rack mobility instead of grinding through it.',
    ],
    whatYouShouldFeel:
      'Quads working harder than back squats, upper back lit up holding the rack position, and almost no demand on lower back. This is the swap when your low back needs a break.',
  },

  {
    name: 'Bench Press',
    aliases: ['Barbell Bench Press', 'Flat Bench Press'],
    primaryMuscle: 'Chest',
    secondaryMuscles: ['Triceps', 'Front delts', 'Lats', 'Upper back'],
    setupCues: [
      'Eyes under the bar. Plant feet hard into the floor — leg drive matters.',
      'Slight arch in upper back. Ribs proud, butt stays on the bench.',
      'Pull shoulder blades down and together. Lock them there for the entire set.',
      'Grip width: bar across mid-palm, wrist stacked over forearm. Most lifters bench too wide.',
    ],
    formCues: [
      'Take a huge breath into the chest, brace.',
      'Unrack with straight arms, walk it out over your shoulders.',
      'Lower the bar to lower-chest / sternum line. Tuck elbows ~45°, not flared 90°.',
      'Touch and reverse — no bouncing on the chest.',
      'Drive bar up and slightly back over the shoulder. Squeeze chest and triceps at lockout.',
    ],
    commonMistakes: [
      'Flared elbows at 90° — wrecks shoulders, weakens the press.',
      'Letting butt rise off the bench — 4-point contact rule: head, upper back, butt, both feet.',
      'Bouncing the bar — turns it into a circus, masks weak points.',
      'Touching too high (collarbone) — overloads shoulders.',
      'Loose upper back — bar speed dies, no power transfer.',
    ],
    whatYouShouldFeel:
      'Chest stretching at the bottom, upper back tight as a coiled spring, triceps locking out at the top. Feet should feel planted like you\'re about to leg-press the floor.',
  },

  {
    name: 'Deadlift',
    aliases: ['Conventional Deadlift', 'Barbell Deadlift'],
    primaryMuscle: 'Posterior chain',
    secondaryMuscles: ['Glutes', 'Hamstrings', 'Lats', 'Traps', 'Grip', 'Quads'],
    setupCues: [
      'Bar over mid-foot, about 1 inch from your shins.',
      'Feet roughly hip-width, toes slightly out.',
      'Hinge at the hips to grip. Hands just outside the legs.',
      'Big air. Drop hips slightly, shoulders just in front of the bar.',
      'Pull slack out of the bar — bend the bar around you, lats engaged.',
    ],
    formCues: [
      'Wedge yourself into position — hips down, chest up, lats locked.',
      'Push the floor away with your legs. Don\'t pull with your arms — they\'re just hooks.',
      'Hips and shoulders rise at the same rate. Bar drags up your shins.',
      'Lock out by squeezing glutes — don\'t hyperextend by leaning back.',
      'Lower under control — same path, hinge at hips first, then bend knees.',
    ],
    commonMistakes: [
      'Rounding the lower back — back the weight off and rebuild bracing.',
      'Hips shooting up first while shoulders stay down — turns it into a stiff-leg with broken bracing.',
      'Jerking the bar off the floor — pull the slack out first, then push.',
      'Hyperextending at lockout — straight up, glutes tight, ribs over hips. Done.',
      'Letting the bar drift away from the body — costly leverage, brutal on the back.',
    ],
    whatYouShouldFeel:
      'Hamstrings and glutes loading at setup, lats locking the bar to your body, then a powerful leg drive followed by a sharp glute squeeze at lockout. Lower back should feel supported by the brace, never doing the lifting.',
  },

  {
    name: 'Romanian Deadlift',
    aliases: ['RDL', 'Barbell Romanian Deadlift', 'Dumbbell Romanian Deadlift'],
    primaryMuscle: 'Hamstrings',
    secondaryMuscles: ['Glutes', 'Lower back', 'Lats'],
    setupCues: [
      'Bar starts at hip level (rack pull start, or take it out of a deadlift).',
      'Feet hip-width, soft knees (not locked, not bent — just unlocked).',
      'Lats engaged, neutral spine. Tight grip on the bar.',
    ],
    formCues: [
      'Push hips straight back like you\'re closing a drawer with your butt.',
      'Bar slides down close to thighs and shins.',
      'Stop when you feel a strong stretch in the hamstrings — usually mid-shin to just below the knee.',
      'Reverse by driving hips forward. Squeeze glutes at lockout, ribs down.',
      'Knees stay soft and tracked the entire rep — don\'t turn it into a deadlift.',
    ],
    commonMistakes: [
      'Bending the knees instead of hinging — kills the hamstring stretch.',
      'Rounding the lower back chasing more depth — depth is set by your hamstring flexibility, not ego.',
      'Letting the bar drift away from the body — hits the back instead of the hams.',
      'Hyperextending at lockout — finish standing tall, not leaning back.',
    ],
    whatYouShouldFeel:
      'Deep, loaded stretch through your hamstrings on the way down. Glutes squeezing hard at the top. Lower back braced and stable, never the prime mover.',
  },

  {
    name: 'Hip Thrust',
    aliases: ['Barbell Hip Thrust', 'Hip Thrust Machine'],
    primaryMuscle: 'Glutes',
    secondaryMuscles: ['Hamstrings', 'Core'],
    setupCues: [
      'Upper back on a bench, just below the shoulder blades. Bench should not slide.',
      'Bar across hips with a thick pad. Roll it into the hip crease.',
      'Feet flat, shins roughly vertical at the top of the rep — find the right distance with empty bar first.',
      'Tuck the chin slightly. Ribs DOWN, not flared.',
    ],
    formCues: [
      'Brace hard, push through your heels and mid-foot.',
      'Drive hips up until thighs are parallel to floor — hip extension comes from glutes, not low back.',
      'At the top: pause for 1 second, glutes squeezed like you\'re crushing a walnut.',
      'Lower under control, ribs still pinned down.',
    ],
    commonMistakes: [
      'Hyperextending the lumbar spine at the top — biggest cause of low-back pain on this lift. Ribs DOWN.',
      'Leading the rep with the lower back instead of the glutes.',
      'Half-repping — drive all the way to full hip extension.',
      'Feet too close to butt — turns it into a quad exercise.',
      'Feet too far out — kills glute engagement.',
    ],
    whatYouShouldFeel:
      'Pure glute squeeze at the top. If you feel it in your lower back, your ribs are flaring or your form is hyperextending — fix that first, then add load. Glutes should feel cooked.',
  },

  {
    name: 'Bulgarian Split Squat',
    aliases: ['Rear-Foot Elevated Split Squat', 'BSS', 'Dumbbell Bulgarian Split Squat'],
    primaryMuscle: 'Quads / Glutes',
    secondaryMuscles: ['Hamstrings', 'Adductors', 'Core', 'Calves'],
    setupCues: [
      'Rear foot on a bench (laces down or toes — pick what your ankle prefers).',
      'Front foot far enough that knee tracks over mid-foot at the bottom.',
      'For glute bias: longer stride, slight forward torso lean.',
      'For quad bias: shorter stride, upright torso.',
      'Hold dumbbells at your sides, or a single goblet for upright variants.',
    ],
    formCues: [
      'Brace the core. Square your hips.',
      'Descend straight down — back knee toward the floor, front knee tracks over mid-foot.',
      'Pause briefly at the bottom (no resting on the bench).',
      'Drive through the front heel and mid-foot. Squeeze glute at the top.',
      'Stay grounded through the whole foot — don\'t come up on your toes.',
    ],
    commonMistakes: [
      'Wobbling — go lighter, plant the front foot. Stability comes from time under load.',
      'Front knee caving in — push it out toward your pinky toe.',
      'Leaning too far back — overloads front knee, kills glute work.',
      'Rear foot too active — it\'s a kickstand, not a load-bearer.',
    ],
    whatYouShouldFeel:
      'Front-leg quad and glute working together hard. Real balance demand on the standing leg\'s ankle and hip. The rear leg is just for support — it shouldn\'t feel like a lunge.',
  },

  {
    name: 'Pallof Press',
    aliases: ['Cable Pallof Press', 'Anti-Rotation Press'],
    primaryMuscle: 'Core (anti-rotation)',
    secondaryMuscles: ['Obliques', 'Deep abdominals', 'Glutes (stabilizing)'],
    setupCues: [
      'Cable or band at chest height.',
      'Stand perpendicular to the cable, feet shoulder-width.',
      'Both hands on the handle, pulled to your chest.',
      'Glutes squeezed, ribs down, brace 360°.',
    ],
    formCues: [
      'Press the handle straight out from your chest until arms are extended.',
      'The cable wants to rotate you toward it — RESIST. Stay square.',
      'Hold the extended position for 1–2 seconds, breathing normally.',
      'Pull back to your chest with control. Don\'t let it pull you in.',
      'Brace the entire set. Switch sides.',
    ],
    commonMistakes: [
      'Letting the torso rotate toward the cable — the whole point is to NOT rotate.',
      'Holding your breath — you should be able to breathe and brace at the same time.',
      'Going too heavy — you should feel deep abs, not strain.',
      'Hips shifting — keep them square to the front.',
    ],
    whatYouShouldFeel:
      'Deep ab and oblique tension on the side AWAY from the cable, fighting to keep you square. This is the bracing pattern that protects your spine under squats and deadlifts.',
  },

  {
    name: 'Dead Bug',
    aliases: ['Deadbug'],
    primaryMuscle: 'Core (anti-extension)',
    secondaryMuscles: ['Hip flexors', 'Deep abdominals', 'Diaphragm'],
    setupCues: [
      'Lie on your back, knees bent 90° in tabletop, arms straight up over shoulders.',
      'Press your lower back FLAT against the floor. There should be no space.',
      'Brace by exhaling all the air out, then breathe behind the brace.',
    ],
    formCues: [
      'Slowly lower your right arm overhead AND your left leg toward the floor at the same time.',
      'Keep your lower back glued to the floor the entire time. If it lifts, you went too far.',
      'Pause at the bottom range you can hold — could be just a few inches.',
      'Return to start with control. Switch sides.',
    ],
    commonMistakes: [
      'Lower back arching off the floor — biggest red flag. Reduce range until you can hold it.',
      'Holding your breath — breathe slow and steady through the rep.',
      'Rushing — slow is the entire point. 3 seconds out, 3 seconds back.',
      'Letting the legs flop — every part of the movement is controlled.',
    ],
    whatYouShouldFeel:
      'Deep core engagement, especially in your lower abs. Lower back should feel glued and supported — never strained. If your back lifts, your core lost.',
  },

  {
    name: 'Farmer Carry',
    aliases: ['Farmer\'s Walk', 'Farmer Walk'],
    primaryMuscle: 'Grip',
    secondaryMuscles: ['Forearms', 'Traps', 'Core', 'Upper back'],
    setupCues: [
      'Heavy dumbbells or trap bar at your sides. Heavier than you think.',
      'Stand tall — chest up, shoulders pulled back and down.',
      'Brace 360°. Ribs stacked over hips.',
    ],
    formCues: [
      'Pick the weight up like a deadlift — hinge to grip it.',
      'Stand fully tall before walking.',
      'Take controlled steps. Heel to mid-foot to toe. No shuffling.',
      'Keep ribs DOWN and shoulders pulled back the entire walk.',
      'Set down with the same hinge pattern. Don\'t drop them.',
    ],
    commonMistakes: [
      'Shrugging the weights — let traps load, don\'t actively shrug.',
      'Leaning forward to compensate for heavy load — go lighter or shorter distance.',
      'Fast steps — slow and grounded beats fast and sloppy.',
      'Lumbar hyperextending under load — fix the brace, drop the weight if needed.',
      'Using straps every set — defeats the grip benefit. Only strap the heaviest set.',
    ],
    whatYouShouldFeel:
      'Forearms screaming, traps loaded, core bracing the entire walk. By the end you should feel like your upper body went through a fight. This is the most underrated grip + core builder.',
  },

  {
    name: 'Dead Hang',
    aliases: ['Bar Hang'],
    primaryMuscle: 'Grip',
    secondaryMuscles: ['Lats', 'Shoulders', 'Forearms'],
    setupCues: [
      'Pull-up bar tall enough that your feet clear the ground.',
      'Step up so you don\'t jump into the position cold.',
      'Full grip, thumb wrapped under the bar.',
    ],
    formCues: [
      'Hang from the bar with arms straight.',
      'Shoulders mostly relaxed but not fully passive — keep some scap engagement so you\'re not just hanging from connective tissue.',
      'Breathe normally. Don\'t hold your breath.',
      'Hold for time — start at 20–30 seconds, build over weeks.',
      'Step down, don\'t drop.',
    ],
    commonMistakes: [
      'Fully passive (totally relaxed shoulders) under heavy bodyweight — can stress shoulder joints.',
      'Jerking off the bar — step down with control.',
      'Holding breath — relax and breathe, this is endurance work for your grip.',
      'Letting your hands slip mid-hang — drop down before you fail.',
    ],
    whatYouShouldFeel:
      'Grip burn building over time. Lats stretching gently. Some spinal decompression — feels great after squats and pulls.',
  },

  {
    name: 'Tricep Pushdown',
    aliases: ['Cable Pushdown', 'Cable Tricep Pushdown', 'Rope Pushdown'],
    primaryMuscle: 'Triceps',
    secondaryMuscles: [],
    setupCues: [
      'Cable at top setting. Rope or straight bar — both work.',
      'Stand close to the stack. Slight forward lean from the hips, not the upper back.',
      'Elbows pinned at your sides — they don\'t move during the rep.',
    ],
    formCues: [
      'Start with elbows bent 90°, hands at chest height.',
      'Press hands down by extending at the elbow only.',
      'Lock out fully — squeeze the triceps for a 1-count.',
      'Control the negative back to start. No momentum.',
    ],
    commonMistakes: [
      'Using shoulders to drive the weight down — the elbows should never move forward or back.',
      'Flaring elbows out — reduces tension on the triceps.',
      'Half-locking out — you lose the best part of the rep.',
      'Leaning over the bar to push it — your bodyweight isn\'t the muscle.',
    ],
    whatYouShouldFeel:
      'Triceps loading hard at the top of the rep, full burn at lockout. Should be isolated — almost no shoulder or chest involvement.',
  },

  {
    name: 'Close-Grip Bench',
    aliases: ['Close-Grip Bench Press', 'CGBP', 'Close Grip Bench'],
    primaryMuscle: 'Triceps',
    secondaryMuscles: ['Chest (inner)', 'Front delts'],
    setupCues: [
      'Same setup as bench press: arched upper back, foot plant, scaps locked down.',
      'Grip just inside shoulder width — wrist still stacked over forearm.',
      'Don\'t go too narrow — wrist pain isn\'t a feature.',
    ],
    formCues: [
      'Big breath, brace.',
      'Lower the bar to lower chest / sternum, elbows tucked closer to your sides than in regular bench (~30°).',
      'Touch and reverse — no bounce.',
      'Drive up by extending the elbows hard. Triceps do most of the work.',
      'Lock out fully, squeeze the triceps.',
    ],
    commonMistakes: [
      'Grip too narrow — causes wrist pain and bar instability. Just inside shoulder width is right.',
      'Flaring elbows — turns it into regular bench with bad mechanics.',
      'Touching too high (clavicle) — wrong line for triceps.',
      'Using bench-press weight — close-grip is naturally lighter. Drop ~15–20%.',
    ],
    whatYouShouldFeel:
      'Triceps doing most of the work, especially at the top half of the press. Some inner chest involvement. Almost no shoulder strain. This is the lift that fixes a stalling bench lockout.',
  },
];

// ─── Lookup ──────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, '') // strip parenthetical hints like "(2s)"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPrefixes(s: string): string {
  return s.replace(/^(barbell|dumbbell|machine|cable|bar)\s+/i, '').trim();
}

/**
 * Find an exercise by name with alias and prefix tolerance.
 * Returns undefined if no entry matches.
 */
export function findExercise(name: string): ExerciseEntry | undefined {
  if (!name) return undefined;
  const target = normalize(name);
  const targetStripped = normalize(stripPrefixes(name));

  for (const entry of LIBRARY) {
    const nameNorm = normalize(entry.name);
    if (nameNorm === target || nameNorm === targetStripped) return entry;
    if (entry.aliases?.some((a) => normalize(a) === target)) return entry;
  }
  return undefined;
}

export const exerciseLibrary = LIBRARY;
