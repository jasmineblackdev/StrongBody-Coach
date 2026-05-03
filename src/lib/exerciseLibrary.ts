// Local exercise library. No external APIs.
// Coaching content emphasizes bracing, glute engagement, core control, and
// lower-back safety — the things that actually keep you healthy under load.
//
// Structured around the kind of cues an ISSA-credentialed trainer would give
// in person: what to feel, what to NOT feel, common mistakes paired 1:1 with
// corrections, and a difficulty marker so we can scale progression.

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface ExerciseEntry {
  /** Canonical display name. */
  name: string;
  /** Alternate names that may show up in the plan or logs. */
  aliases?: string[];
  /** Primary movers (1–3 muscles). */
  primaryMuscles: string[];
  /** Synergists / stabilizers worth naming. */
  secondaryMuscles: string[];
  /** What the user SHOULD feel (correct muscle engagement). */
  feel: string;
  /**
   * Pain or wrong engagement that should NOT happen. Surfaced as a warning
   * badge in the UI when it mentions joints (low back, knees, shoulders).
   */
  avoidFeel: string;
  setupCues: string[];
  /** Step-by-step movement cues, in order. */
  formSteps: string[];
  /** Common mistakes — paired 1:1 with `corrections` by index. */
  commonMistakes: string[];
  /** Quick fixes for each mistake (same index as `commonMistakes`). */
  corrections: string[];
  difficultyLevel: DifficultyLevel;
  videoUrl?: string;
  imageUrl?: string;
}

const LIBRARY: ExerciseEntry[] = [
  {
    name: 'Back Squat',
    aliases: ['Barbell Back Squat'],
    primaryMuscles: ['Quadriceps'],
    secondaryMuscles: ['Glutes', 'Hamstrings', 'Spinal erectors', 'Core'],
    feel:
      'Quads loading hard on the way down, glutes firing strong out of the hole, core like a steel cylinder the entire rep. Lower back should feel supported, never strained.',
    avoidFeel:
      "Sharp lower-back pain or pinching, knees caving inward, pressure in the front of your knees. If your low back takes over before your legs do, stop the set.",
    setupCues: [
      'Bar on upper traps (high-bar) or rear delts (low-bar). Pick one and stick with it.',
      'Hands as close as your shoulders allow — tight grip = tight upper back.',
      'Stance roughly shoulder-width, toes slightly out. Find what lets you hit depth without pain.',
      'Before you unrack: big breath into the belly, brace 360° (front, sides, back).',
    ],
    formSteps: [
      'Walk back in 2–3 steps. No more dancing.',
      'Take another big breath, brace hard, hold the air.',
      'Break at the hips and knees together. Drive your knees out as you sit between them.',
      "Hit depth (hip crease below knee) with control. Don't collapse.",
      'Out of the hole: drive the floor away, hips and shoulders rising together. Squeeze glutes at the top.',
    ],
    commonMistakes: [
      'Knees caving in (valgus collapse).',
      'Butt wink — lumbar tucking under at depth.',
      'Looking straight up — neck strained, hips shoot up.',
      'Bar drifting forward over toes.',
      'Losing your brace before the lift.',
    ],
    corrections: [
      'Cue "spread the floor" with your feet — push knees out toward your pinky toes the entire descent and ascent.',
      "Stop the rep an inch above your butt-wink point. If it's mobility, drill ankle dorsiflexion + 90/90 hips. If it's bracing, take more air.",
      'Pick a spot on the floor 6 ft in front of you and lock your gaze there for the whole set.',
      'Keep weight on mid-foot. Cue: "feel the heel and the ball of the big toe equally."',
      'Exhale only after lockout. Take a fresh brace before each rep — never reuse air across reps.',
    ],
    difficultyLevel: 'intermediate',
  },

  {
    name: 'Paused Squat',
    aliases: ['Pause Squat', 'Paused Back Squat'],
    primaryMuscles: ['Quadriceps'],
    secondaryMuscles: ['Glutes', 'Core', 'Spinal erectors'],
    feel:
      'Massive bracing demand and pure leg work coming out of the bottom. Builds the bottom-end strength that fixes a stalling squat.',
    avoidFeel:
      "Lower-back pinching, the bar feeling like it's collapsing forward, or any joint pain in the bottom position.",
    setupCues: [
      'Same setup as Back Squat. Use ~70–80% of your normal squat working weight.',
      "You'll need a bigger brace than usual — load more air.",
    ],
    formSteps: [
      'Descend with control to depth.',
      'Pause for 2 full seconds at the bottom. Stay tight — no relaxing.',
      'Maintain knees out, chest up, brace held the entire pause.',
      'Drive up explosively from the dead-stop position.',
    ],
    commonMistakes: [
      'Relaxing in the hole and bouncing out.',
      'Going too heavy.',
      'Losing the brace during the pause.',
      'Knees collapsing during the pause.',
    ],
    corrections: [
      'Stay rigid through the pause. Treat it like a static lift — every muscle still working.',
      'Drop 15–20% from your normal squat weight. Paused work humbles you.',
      'Keep the air in. Exhale only after lockout, never during the pause.',
      'Cue "knees over pinky toes" the entire pause; keep tension actively pushing them out.',
    ],
    difficultyLevel: 'intermediate',
  },

  {
    name: 'Front Squat',
    aliases: ['Barbell Front Squat'],
    primaryMuscles: ['Quadriceps'],
    secondaryMuscles: ['Upper back', 'Core', 'Glutes'],
    feel:
      'Quads working harder than back squats, upper back lit up holding the rack, almost no demand on lower back. The swap when your low back needs a break.',
    avoidFeel:
      'Wrist pain, neck or throat pressure from the bar choking you, lower back rounding at depth.',
    setupCues: [
      'Bar across front delts, fingers under just to keep it on the shelf.',
      'Elbows pointed straight forward and HIGH. The shelf is your delts, not your hands.',
      'Stance roughly shoulder-width, toes slightly out. Most lifters squat narrower for fronts.',
      'Big breath, brace 360° before you unrack.',
    ],
    formSteps: [
      'Stay upright — torso angle is much more vertical than back squat.',
      'Sit straight down between your knees, not back.',
      'Keep elbows up the entire rep. If they drop, the bar rolls.',
      'Drive up out of the hole through your heels and mid-foot.',
    ],
    commonMistakes: [
      'Dropping the elbows on the way up.',
      'Rounding the upper back.',
      'Trying to squat low-bar style with a forward torso.',
      'Wrist pain.',
    ],
    corrections: [
      'Cue "elbows to the ceiling" through the entire ascent. If they drop, the bar rolls and the rep dies.',
      'Drill thoracic extension — empty bar fronts, foam roller t-spine work, dead-hang scap retractions before sets.',
      "Re-set torso angle: chest tall, not chest forward. Stance can narrow if you've got good ankle mobility.",
      'Improve front-rack mobility (lat / lat-stretch / wrist circles) instead of grinding. Strap the bar if mobility is the limit.',
    ],
    difficultyLevel: 'intermediate',
  },

  {
    name: 'Bench Press',
    aliases: ['Barbell Bench Press', 'Flat Bench Press'],
    primaryMuscles: ['Chest'],
    secondaryMuscles: ['Triceps', 'Front delts', 'Lats', 'Upper back'],
    feel:
      "Chest stretching at the bottom, upper back tight as a coiled spring, triceps locking out at the top. Feet should feel planted like you're about to leg-press the floor.",
    avoidFeel:
      'Sharp shoulder pain (especially front of shoulder), wrist pain, neck strain. If you feel the press in your shoulder before your chest, fix the setup.',
    setupCues: [
      'Eyes under the bar. Plant feet hard into the floor — leg drive matters.',
      'Slight arch in upper back. Ribs proud, butt stays on the bench.',
      'Pull shoulder blades down and together. Lock them there for the entire set.',
      'Grip width: bar across mid-palm, wrist stacked over forearm. Most lifters bench too wide.',
    ],
    formSteps: [
      'Take a huge breath into the chest, brace.',
      'Unrack with straight arms, walk it out over your shoulders.',
      'Lower the bar to lower-chest / sternum line. Tuck elbows ~45°, not flared 90°.',
      'Touch and reverse — no bouncing on the chest.',
      'Drive bar up and slightly back over the shoulder. Squeeze chest and triceps at lockout.',
    ],
    commonMistakes: [
      'Flared elbows at 90°.',
      'Butt rising off the bench.',
      'Bouncing the bar off the chest.',
      'Touching too high (collarbone).',
      'Loose upper back — bar speed dies.',
    ],
    corrections: [
      'Cue "tuck elbows ~45° from torso." Picture trying to bend the bar in half on the way down.',
      '4-point contact rule: head, upper back, butt, both feet. If your butt comes up, plant feet harder and use less weight.',
      'Pause every rep on the chest for a 1-count. If you can\'t do that, the weight\'s controlling you.',
      'Touch lower-chest / sternum line. Cue: "bar to my heart." High touch = shoulder dominant.',
      'Pull the bar apart with your hands and drive shoulder blades into the bench. Locked-down upper back = power transfer.',
    ],
    difficultyLevel: 'intermediate',
  },

  {
    name: 'Deadlift',
    aliases: ['Conventional Deadlift', 'Barbell Deadlift'],
    primaryMuscles: ['Posterior chain', 'Glutes', 'Hamstrings'],
    secondaryMuscles: ['Lats', 'Traps', 'Grip', 'Quads', 'Spinal erectors'],
    feel:
      'Hamstrings and glutes loading at setup, lats locking the bar to your body, then a powerful leg drive followed by a sharp glute squeeze at lockout. Lower back should feel supported by the brace, never doing the lifting.',
    avoidFeel:
      'Sharp lower-back pain, lumbar rounding under load, knee pain. The lift should feel like a leg drive with a brace — never a back lift.',
    setupCues: [
      'Bar over mid-foot, about 1 inch from your shins.',
      'Feet roughly hip-width, toes slightly out.',
      'Hinge at the hips to grip. Hands just outside the legs.',
      'Big air. Drop hips slightly, shoulders just in front of the bar.',
      'Pull slack out of the bar — bend the bar around you, lats engaged.',
    ],
    formSteps: [
      'Wedge yourself into position — hips down, chest up, lats locked.',
      "Push the floor away with your legs. Don't pull with your arms — they're just hooks.",
      'Hips and shoulders rise at the same rate. Bar drags up your shins.',
      "Lock out by squeezing glutes — don't hyperextend by leaning back.",
      'Lower under control — same path, hinge at hips first, then bend knees.',
    ],
    commonMistakes: [
      'Lower back rounding under the bar.',
      'Hips shooting up first while shoulders stay down (stiff-leg).',
      'Jerking the bar off the floor.',
      'Hyperextending at lockout (leaning back).',
      'Bar drifting away from the body.',
    ],
    corrections: [
      "STOP the set. Drop the weight 15–20%. Rebuild bracing with paused-below-knee deadlifts and Pallof Press until you can hold neutral spine through the lift.",
      'Cue "chest up, push the floor away." Drill tempo deadlifts (3-second eccentric) to fix hip-shoot timing.',
      'Pull the slack out of the bar BEFORE pulling. Take 2 seconds to wedge in, then push.',
      'Finish standing tall: glutes tight, ribs over hips, shoulders directly above bar. No leaning.',
      'Keep lats engaged — cue "armpits down, oranges in your armpits squeezed." Bar should drag up shins, lightly.',
    ],
    difficultyLevel: 'advanced',
  },

  {
    name: 'Romanian Deadlift',
    aliases: ['RDL', 'Barbell Romanian Deadlift', 'Dumbbell Romanian Deadlift'],
    primaryMuscles: ['Hamstrings'],
    secondaryMuscles: ['Glutes', 'Spinal erectors', 'Lats'],
    feel:
      'Deep, loaded stretch through your hamstrings on the way down. Glutes squeezing hard at the top. Lower back braced and stable, never the prime mover.',
    avoidFeel:
      'Lower-back ache, lumbar rounding, knees taking over the movement. The hamstrings should be screaming long before your back is.',
    setupCues: [
      'Bar starts at hip level.',
      'Feet hip-width, soft knees (not locked, not bent — just unlocked).',
      'Lats engaged, neutral spine. Tight grip.',
    ],
    formSteps: [
      "Push hips straight back like you're closing a drawer with your butt.",
      'Bar slides down close to thighs and shins.',
      'Stop when you feel a strong stretch in the hamstrings — usually mid-shin to just below the knee.',
      'Reverse by driving hips forward. Squeeze glutes at lockout, ribs down.',
      "Knees stay soft and tracked the entire rep — don't turn it into a deadlift.",
    ],
    commonMistakes: [
      'Bending knees instead of hinging.',
      'Rounding lower back chasing depth.',
      'Bar drifting away from body.',
      'Hyperextending at lockout.',
    ],
    corrections: [
      'Cue "push the wall behind you with your butt." Knees stay where they started — only hips move.',
      'Stop where your hams feel stretched, NOT where you "should" go. Mobility builds; spinal flexion under load doesn\'t.',
      'Brush the bar against your legs the entire rep. Cue "drag the bar down."',
      'Finish standing tall — ribs over hips, glutes tight, no leaning back.',
    ],
    difficultyLevel: 'beginner',
  },

  {
    name: 'Hip Thrust',
    aliases: ['Barbell Hip Thrust', 'Hip Thrust Machine'],
    primaryMuscles: ['Glutes'],
    secondaryMuscles: ['Hamstrings', 'Core'],
    feel:
      "Pure glute squeeze at the top. Glutes should feel cooked. If you feel it in your lower back, your ribs are flaring — fix that first, then add load.",
    avoidFeel:
      'Lower-back pinching at the top of the rep, hip-flexor strain, neck pressure. Lower back is the #1 risk on this lift — ribs DOWN saves you.',
    setupCues: [
      'Upper back on a bench, just below the shoulder blades. Bench should not slide.',
      'Bar across hips with a thick pad. Roll it into the hip crease.',
      'Feet flat, shins roughly vertical at the top of the rep.',
      'Tuck the chin slightly. Ribs DOWN, not flared.',
    ],
    formSteps: [
      'Brace hard, push through your heels and mid-foot.',
      'Drive hips up until thighs are parallel to floor.',
      "At the top: pause 1 second, glutes squeezed like you're crushing a walnut.",
      'Lower under control, ribs still pinned down.',
    ],
    commonMistakes: [
      'Hyperextending lumbar at the top.',
      'Leading the rep with the lower back instead of glutes.',
      'Half-repping — not driving to full hip extension.',
      'Feet too close to butt (quad-dominant).',
      'Feet too far out (kills glute engagement).',
    ],
    corrections: [
      'Cue "ribs DOWN, chin tucked, posterior pelvic tilt at the top." Stop driving when your hips are level with your shoulders, not above.',
      'Pre-squeeze glutes BEFORE the rep starts. Your butt initiates, not your low back.',
      'Drive to thighs parallel — get full hip extension before lowering. Half reps = half results.',
      'Move feet 2-3 inches farther out. Shins should be vertical at lockout.',
      'Move feet closer in toward butt. If knees push past toes, you\'re too close — back off slightly.',
    ],
    difficultyLevel: 'beginner',
  },

  {
    name: 'Bulgarian Split Squat',
    aliases: ['Rear-Foot Elevated Split Squat', 'BSS', 'Dumbbell Bulgarian Split Squat'],
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Adductors', 'Core', 'Calves'],
    feel:
      "Front-leg quad and glute working hard. Real balance demand on the standing leg. The rear leg is just a kickstand — it shouldn't feel like a lunge.",
    avoidFeel:
      'Front knee pain (especially front of the knee), rear hip-flexor strain, lower-back rounding.',
    setupCues: [
      'Rear foot on a bench (laces down or toes — whichever your ankle prefers).',
      'Front foot far enough that knee tracks over mid-foot at the bottom.',
      'For glute bias: longer stride, slight forward torso lean.',
      'For quad bias: shorter stride, upright torso.',
      'Hold dumbbells at your sides, or a single goblet for upright variants.',
    ],
    formSteps: [
      'Brace the core. Square your hips.',
      'Descend straight down — back knee toward the floor, front knee tracks over mid-foot.',
      'Pause briefly at the bottom (no resting on the bench).',
      'Drive through the front heel and mid-foot. Squeeze glute at the top.',
      "Stay grounded through the whole foot — don't come up on your toes.",
    ],
    commonMistakes: [
      'Wobbling through the rep.',
      'Front knee caving in.',
      'Leaning too far back — overloads front knee.',
      "Rear foot too active — it's a kickstand, not a load-bearer.",
    ],
    corrections: [
      'Drop the weight 30%, plant the front foot, do 5 slow reps unloaded. Stability builds with reps, not load.',
      'Cue "knee toward pinky toe." If it still caves, get an empty barbell on your back as a stability check.',
      "Lean forward slightly (5–10°) for glute bias OR stay upright for quads. Don't lean BACK — that overloads the front knee.",
      'Take 80% of your weight on the front leg. Rear is just balance support.',
    ],
    difficultyLevel: 'intermediate',
  },

  {
    name: 'Pallof Press',
    aliases: ['Cable Pallof Press', 'Anti-Rotation Press'],
    primaryMuscles: ['Core', 'Obliques'],
    secondaryMuscles: ['Deep abdominals', 'Glutes'],
    feel:
      'Deep ab and oblique tension on the side AWAY from the cable, fighting to keep you square. This is the bracing pattern that protects your spine under squats and deadlifts.',
    avoidFeel:
      'Lower-back strain, hip shifting side-to-side, breath-holding. The work is pure anti-rotation — nothing should hurt.',
    setupCues: [
      'Cable or band at chest height.',
      'Stand perpendicular to the cable, feet shoulder-width.',
      'Both hands on the handle, pulled to your chest.',
      'Glutes squeezed, ribs down, brace 360°.',
    ],
    formSteps: [
      'Press the handle straight out from your chest until arms are extended.',
      'The cable wants to rotate you toward it — RESIST. Stay square.',
      'Hold the extended position for 1–2 seconds, breathing normally.',
      "Pull back to your chest with control. Don't let it pull you in.",
      'Brace the entire set. Switch sides.',
    ],
    commonMistakes: [
      'Letting the torso rotate toward the cable.',
      'Holding your breath.',
      'Going too heavy.',
      'Hips shifting toward the cable.',
    ],
    corrections: [
      'Drop the weight if you can\'t hold square. The point is NOT to rotate.',
      'Practice "breathing behind the brace" — slow inhale through nose, slow exhale, abs stay tight throughout.',
      'You should feel deep abs working, not strain. If you\'re grunting, drop a plate.',
      'Cue "hips facing forward" the entire set. If they shift, restart.',
    ],
    difficultyLevel: 'beginner',
  },

  {
    name: 'Dead Bug',
    aliases: ['Deadbug'],
    primaryMuscles: ['Core'],
    secondaryMuscles: ['Hip flexors', 'Deep abdominals', 'Diaphragm'],
    feel:
      'Deep core engagement, especially in your lower abs. Lower back should feel glued and supported — never strained. If your back lifts, your core lost.',
    avoidFeel:
      'Lower-back arching off the floor, hip-flexor cramping. Reduce range until your back stays glued.',
    setupCues: [
      'Lie on your back, knees bent 90° in tabletop, arms straight up over shoulders.',
      'Press your lower back FLAT against the floor. There should be no space.',
      'Brace by exhaling all the air out, then breathe behind the brace.',
    ],
    formSteps: [
      'Slowly lower your right arm overhead AND your left leg toward the floor at the same time.',
      'Keep your lower back glued to the floor the entire time.',
      'Pause at the bottom range you can hold — could be just a few inches.',
      'Return to start with control. Switch sides.',
    ],
    commonMistakes: [
      'Lower back arching off the floor.',
      'Holding breath.',
      'Rushing reps.',
      'Letting legs flop.',
    ],
    corrections: [
      'Reduce range. If your back lifts, you went too far. Tiny range with rigid back > full range with arched back.',
      'Slow exhale on the way down, slow inhale on the return. Breath supports the brace.',
      'Tempo: 3 seconds out, 1 second hold, 3 seconds back. The slowness is the point.',
      'Every inch is controlled. If your foot drops fast, it\'s using gravity, not your core.',
    ],
    difficultyLevel: 'beginner',
  },

  {
    name: 'Farmer Carry',
    aliases: ["Farmer's Walk", 'Farmer Walk'],
    primaryMuscles: ['Grip', 'Forearms'],
    secondaryMuscles: ['Traps', 'Core', 'Upper back'],
    feel:
      'Forearms screaming, traps loaded, core bracing the entire walk. By the end your upper body should feel like it went through a fight.',
    avoidFeel:
      'Lower-back hyperextension, shoulders pulled forward, neck strain.',
    setupCues: [
      'Heavy dumbbells or trap bar at your sides. Heavier than you think.',
      'Stand tall — chest up, shoulders pulled back and down.',
      'Brace 360°. Ribs stacked over hips.',
    ],
    formSteps: [
      'Pick the weight up like a deadlift — hinge to grip it.',
      'Stand fully tall before walking.',
      'Take controlled steps. Heel to mid-foot to toe. No shuffling.',
      'Keep ribs DOWN and shoulders pulled back the entire walk.',
      "Set down with the same hinge pattern. Don't drop them.",
    ],
    commonMistakes: [
      'Shrugging the weights actively.',
      'Leaning forward under heavy load.',
      'Fast, shuffling steps.',
      'Lumbar hyperextending under load.',
      'Using straps on every set.',
    ],
    corrections: [
      'Let traps load passively — don\'t shrug. Shoulders stay packed down.',
      'Drop the weight or shorten the distance. Posture > load.',
      'Slow grounded steps. Heel-mid-toe pattern. The walk should look like a march, not a jog.',
      'Re-brace every few steps. Cue "ribs down, glutes squeezed."',
      'Strap only the heaviest set per session. Carries are a grip lift first.',
    ],
    difficultyLevel: 'beginner',
  },

  {
    name: 'Dead Hang',
    aliases: ['Bar Hang'],
    primaryMuscles: ['Grip', 'Forearms'],
    secondaryMuscles: ['Lats', 'Shoulders'],
    feel:
      'Grip burn building over time. Lats stretching gently. Some spinal decompression — feels great after squats and pulls.',
    avoidFeel:
      'Sharp shoulder pain, elbow pain. If your shoulders feel pulled out of socket, you\'re fully passive — engage the scaps lightly.',
    setupCues: [
      'Pull-up bar tall enough that your feet clear the ground.',
      "Step up so you don't jump into the position cold.",
      'Full grip, thumb wrapped under the bar.',
    ],
    formSteps: [
      'Hang from the bar with arms straight.',
      "Shoulders mostly relaxed but not fully passive — keep some scap engagement.",
      "Breathe normally. Don't hold your breath.",
      'Hold for time — start at 20–30 seconds, build over weeks.',
      "Step down, don't drop.",
    ],
    commonMistakes: [
      'Fully passive shoulders under heavy bodyweight.',
      'Jerking off the bar.',
      'Holding breath.',
      'Letting hands slip mid-hang.',
    ],
    corrections: [
      'Engage scaps lightly — pull shoulder blades a bit toward your back pockets. Not a full pull-up; just not floppy.',
      'Step up to mount, step down to dismount. Never drop.',
      'Slow nasal breathing the whole hang.',
      'Drop down before you fully fail. Failing on a hang means scraped palms and a tweaked shoulder.',
    ],
    difficultyLevel: 'beginner',
  },

  {
    name: 'Tricep Pushdown',
    aliases: ['Cable Pushdown', 'Cable Tricep Pushdown', 'Rope Pushdown'],
    primaryMuscles: ['Triceps'],
    secondaryMuscles: [],
    feel:
      'Triceps loading hard at the top of the rep, full burn at lockout. Should be isolated — almost no shoulder or chest involvement.',
    avoidFeel:
      'Elbow pain, shoulder strain, lower-back ache from leaning over the bar.',
    setupCues: [
      'Cable at top setting. Rope or straight bar — both work.',
      'Stand close to the stack. Slight forward lean from the hips, not the upper back.',
      "Elbows pinned at your sides — they don't move during the rep.",
    ],
    formSteps: [
      'Start with elbows bent 90°, hands at chest height.',
      'Press hands down by extending at the elbow only.',
      'Lock out fully — squeeze the triceps for a 1-count.',
      'Control the negative back to start. No momentum.',
    ],
    commonMistakes: [
      'Using shoulders to drive the weight down.',
      'Flaring elbows out.',
      'Half-locking out.',
      'Leaning over the bar to push.',
    ],
    corrections: [
      'Pin elbows to your ribs. If they move forward or back, drop the weight 20%.',
      'Cue "elbows squeezed against sides" the entire set.',
      'Lock out fully every rep. Squeeze the triceps for 1 count at the bottom.',
      'Stand tall, light forward hip-hinge only. Your bodyweight isn\'t the muscle.',
    ],
    difficultyLevel: 'beginner',
  },

  {
    name: 'Close-Grip Bench',
    aliases: ['Close-Grip Bench Press', 'CGBP', 'Close Grip Bench'],
    primaryMuscles: ['Triceps'],
    secondaryMuscles: ['Chest', 'Front delts'],
    feel:
      'Triceps doing most of the work, especially at the top half of the press. Some inner chest involvement. Almost no shoulder strain. Fixes a stalling bench lockout.',
    avoidFeel:
      'Wrist pain (most common — from going too narrow), shoulder pain, elbow pinching.',
    setupCues: [
      'Same setup as bench press: arched upper back, foot plant, scaps locked down.',
      'Grip just inside shoulder width — wrist still stacked over forearm.',
      "Don't go too narrow — wrist pain isn't a feature.",
    ],
    formSteps: [
      'Big breath, brace.',
      'Lower the bar to lower chest / sternum, elbows tucked closer to your sides than in regular bench (~30°).',
      'Touch and reverse — no bounce.',
      'Drive up by extending the elbows hard. Triceps do most of the work.',
      'Lock out fully, squeeze the triceps.',
    ],
    commonMistakes: [
      'Grip too narrow (wrist pain).',
      'Flaring elbows.',
      'Touching too high (clavicle).',
      'Using bench-press weight.',
    ],
    corrections: [
      'Move grip 1-2 inches wider. Pinky on the smooth ring or just inside is the right distance for most lifters.',
      'Cue "elbows tucked at 30°." Tighter than regular bench, not wider.',
      'Touch lower chest / sternum. Cue: "bar to my lower ribs."',
      'Drop weight 15-20% from your bench number. Close-grip is naturally lighter — chasing matched weight kills the lift.',
    ],
    difficultyLevel: 'intermediate',
  },

  // ─── Stability ball variants ────────────────────────────────────────────
  // The user has a flat-top stability ball. These four entries cover the
  // typical home-core repertoire and serve as lower-back-safe alternates
  // when pain is flagged.

  {
    name: 'Stability Ball Plank',
    aliases: ['Swiss Ball Plank', 'Ball Plank'],
    primaryMuscles: ['Core', 'Trunk stabilizers'],
    secondaryMuscles: ['Shoulders', 'Glutes'],
    feel:
      "Deep core working hard to keep the ball still. The instability forces the trunk to brace 360° — abs, obliques, and low-back stabilizers all firing together.",
    avoidFeel:
      "Lower-back compression or pinching. Hips sagging toward the ground means the core has tapped out — drop it before form breaks down.",
    setupCues: [
      'Forearms on the ball, elbows under shoulders.',
      "Feet hip-width on the floor, body in one straight line.",
      "Squeeze glutes hard before you start the timer — they hold the pelvis level.",
      'Keep the ball steady. Any wobble is core inefficiency, not effort.',
    ],
    formSteps: [
      'Hold the line: head → ribs → hips → heels.',
      'Brace 360° — imagine someone about to push you sideways.',
      'Breathe in shallow nasal breaths through the diaphragm; never hold air longer than 5 seconds.',
      'When the ball starts moving more than your control allows, end the set — quality > duration.',
    ],
    commonMistakes: [
      'Hips sag toward the ground.',
      'Hips pike up (tent shape).',
      'Holding breath the entire set.',
      "Ball wobbles wildly — too unstable a starting point.",
    ],
    corrections: [
      "Squeeze glutes harder. Cue: \"tuck the tailbone toward the rib cage by 10°.\"",
      "Drop the hips back to neutral. Cue: \"long line from head to heels.\"",
      'Inhale through the nose for 2s, exhale gently for 2s. Bracing ≠ holding breath.',
      'Move the ball closer to a wall or bench so the hands can stabilize. Build to free-form over 4 weeks.',
    ],
    difficultyLevel: 'intermediate',
  },

  {
    name: 'Stability Ball Crunch',
    aliases: ['Swiss Ball Crunch', 'Ball Crunch'],
    primaryMuscles: ['Rectus abdominis'],
    secondaryMuscles: ['Obliques', 'Hip flexors'],
    feel:
      'Full upper-ab contraction with the lower back fully supported by the ball. The extra range of motion (compared to a floor crunch) hits the abs through their entire shortening pattern.',
    avoidFeel:
      "Neck strain or any low-back pinching. If the ball rolls forward as you crunch, you're using hip flexors instead of abs — reset.",
    setupCues: [
      "Sit on the ball, then walk feet forward until shoulder blades and lower back are supported on the ball.",
      'Feet flat, knees at 90°, slightly wider than hips for a stable base.',
      'Hands light at the temples; do NOT pull on the neck.',
      "Eyes up at the ceiling — keeps the cervical spine neutral.",
    ],
    formSteps: [
      'Drop the upper back over the ball to get a slight stretch through the abs.',
      'Exhale and crunch up by shortening the abs — chest toward pelvis.',
      "Pause 1s at the top with abs squeezed.",
      'Lower under control through the full range. No bouncing off the ball.',
    ],
    commonMistakes: [
      'Pulling on the neck.',
      "Limited range — only crunching halfway up.",
      'Ball rolling forward each rep.',
      'Holding breath at the top.',
    ],
    corrections: [
      "Hands hover at temples, fingertips barely touching. Cue: \"chin off chest, eyes at the ceiling.\"",
      "Drop into a slight extension at the bottom — let the abs stretch. Then crunch all the way up.",
      "Anchor the feet harder. Imagine pushing them through the floor.",
      "Exhale on the crunch up. \"Forced exhale\" actually helps the abs contract harder.",
    ],
    difficultyLevel: 'beginner',
  },

  {
    name: 'Stability Ball Knee Tuck',
    aliases: ['Swiss Ball Knee Tuck', 'Ball Pike Knee Tuck'],
    primaryMuscles: ['Lower abs', 'Hip flexors'],
    secondaryMuscles: ['Shoulders', 'Trunk stabilizers'],
    feel:
      'Lower abs hauling the legs in toward the chest. Shoulders work as anti-protraction stabilizers. The dynamic part is the abs; the plank position is the bracing.',
    avoidFeel:
      "Lower-back rounding or arching as the ball comes in. Shoulders rolling forward into the ball.",
    setupCues: [
      'Plank position with shins on the ball, hands directly under shoulders.',
      'Body straight from head to feet.',
      'Glutes squeezed, ribs down, neutral spine before the first rep.',
    ],
    formSteps: [
      'Initiate by pulling the knees toward the chest using the lower abs — not the hip flexors alone.',
      'The ball rolls forward as the knees tuck; back stays flat.',
      "Pause 1s with knees fully tucked under the hips.",
      'Reverse slowly — control the eccentric back to plank.',
    ],
    commonMistakes: [
      'Hips piking too high.',
      'Lower-back sag at the start position.',
      'Using momentum — bouncing the ball in.',
      'Shoulders rounding forward.',
    ],
    corrections: [
      'Keep hips at the same height as shoulders during the tuck. Cue: "knees come to ribs, hips stay put."',
      'Squeeze glutes harder before the rep. Brace 360° before initiating the tuck.',
      "Slow the eccentric — 2s back to start. Momentum cheats the lower abs.",
      'Push the floor away with straight arms. Cue: "long arms, proud chest."',
    ],
    difficultyLevel: 'intermediate',
  },

  {
    name: 'Stability Ball Back Extension',
    aliases: ['Swiss Ball Back Extension', 'Ball Hyperextension'],
    primaryMuscles: ['Spinal erectors', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Lower back stabilizers'],
    feel:
      "Spinal erectors lengthening then contracting. Glutes finishing the rep. This is a low-load, high-control movement that builds spinal endurance — exactly what protects the low back during heavy squats and deadlifts.",
    avoidFeel:
      "Sharp pinching anywhere in the spine. Hyper-arching at the top. This should feel like a controlled stretch + contract, never a snap.",
    setupCues: [
      'Lay face-down on the ball with hips supported.',
      'Feet anchored against a wall or under something heavy for stability.',
      "Hands behind the head or arms extended (easier).",
      'Start with a slight forward bend over the ball — let the back lengthen first.',
    ],
    formSteps: [
      'Brace the core lightly — not max effort.',
      'Lift the upper body by squeezing the glutes and lower-back muscles together.',
      "Stop when the body is in a straight line; do NOT hyper-extend.",
      'Lower under control to a slight rounded position. Pause 1s.',
    ],
    commonMistakes: [
      'Hyper-extending at the top (overshooting straight line).',
      'Using arm momentum.',
      'Going too fast.',
      "Holding breath through reps.",
    ],
    corrections: [
      "Stop at neutral. Cue: \"shoulders, hips, ankles in a line — no further.\"",
      'Hands stay behind the head or at chest. No throwing.',
      "Tempo: 2s up, 1s pause, 2s down.",
      "Exhale on the way up; inhale on the way down. Steady breathing keeps tension safe.",
    ],
    difficultyLevel: 'beginner',
  },
];

// ─── Coaching helpers ────────────────────────────────────────────────────────

const JOINT_KEYWORDS = [
  'lower back',
  'low back',
  'lumbar',
  'knee',
  'shoulder',
  'rotator',
  'wrist',
  'elbow',
  'neck',
] as const;

/**
 * Returns true when the entry's `avoidFeel` mentions a joint — used by the UI
 * to render a warning badge ("Stop if you feel pain outside target muscles").
 */
export function hasJointWarning(entry: ExerciseEntry): boolean {
  const text = entry.avoidFeel.toLowerCase();
  return JOINT_KEYWORDS.some((k) => text.includes(k));
}

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
