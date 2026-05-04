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
  /**
   * Curated YouTube video ID (the 11-char code from the URL, not the full
   * watch URL). When set, the ExerciseDetailsModal renders an embedded
   * iframe player so the user can watch the demo without leaving the app.
   * When unset, the modal falls back to a YouTube search button using a
   * channel-specific query.
   */
  youtubeId?: string;
}

const LIBRARY: ExerciseEntry[] = [
  {
    name: 'Back Squat',
    aliases: ['Barbell Back Squat', 'Tempo Squat', 'Tempo Back Squat'],
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
    // Squat University — "How to Perform A Back Squat" (Aaron Horschig)
    youtubeId: '7v_V6xiA_AA',
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
    // Jeff Nippard — "HOW TO FRONT SQUAT: Build Bigger Quads & A Stronger Squat"
    youtubeId: 'v-mQm_droHg',
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
    // Jeff Nippard — "How To Get A Huge Bench Press with PERFECT Technique"
    youtubeId: 'vcBig73ojpE',
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
    // Jeff Nippard — "Build A Bigger Deadlift With Perfect Technique (Conventional Form)"
    youtubeId: 'VL5Ab0T07e4',
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
    // Squat University — "FIX Your RDL Form! (Ultimate Romanian Deadlift Tutorial)"
    youtubeId: '5bJEigM5iVg',
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
    // Jeff Nippard — "How To Build Great Glutes with Perfect Hip Thrust Technique (Fix Mistakes!)"
    youtubeId: 'xDmFkJxPzeM',
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
    // ATHLEAN-X — "Stop F*cking Up Bulgarian Split Squats (PROPER FORM!)"
    youtubeId: 'hiLF_pF3EJM',
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
    // Squat University — "Do THESE For Core Stability!" (covers Pallof Press)
    youtubeId: 'nEYBvvKeTHE',
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
    // Squat University — "Do THESE For Core Stability!" (covers dead bug variations)
    youtubeId: 'nEYBvvKeTHE',
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
    // Squat University — #AskSquatU "Side Bends or Suitcase Carry?" (Ep. 47)
    youtubeId: '7D96dK6oaP8',
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
    // ATHLEAN-X — "Do This EVERY Day for Better Posture (GUARANTEED!)" (dead-hang based)
    youtubeId: '3aRpAO6bfvA',
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
    // Renaissance Periodization — "Close Grip Bench Pressing For Maximum Growth | Targeting The Muscle"
    youtubeId: 'Cv5nS1AH_jE',
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
    // ATHLEAN-X — "Plank Progression - From Rookie to RIPPED ABS" (covers ball plank progression)
    youtubeId: 'xVrALzPc7dM',
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

  // Advanced core progression — only for trunk that's already braced.
  // The female engine + form risk routing point lower-back-flagged
  // sessions toward Stability Ball Plank / Dead Bug instead.
  {
    name: 'Ab Roller',
    aliases: ['Ab Wheel', 'Ab Wheel Rollout', 'Ab Roller Rollout'],
    primaryMuscles: ['Rectus abdominis'],
    secondaryMuscles: ['Obliques', 'Lats', 'Shoulders', 'Hip flexors'],
    feel:
      "Deep abdominal stretch through the eccentric, then a hard contraction in the rectus + obliques pulling you back. Lats engaged the entire time, holding tension on the wheel like you're pulling it back to your hips.",
    avoidFeel:
      "Lower-back arching, pinching, or compression. Hip flexors taking over instead of abs. Shoulders rolling forward into a collapsed position. If your low back feels ANY load — that's a hard stop, swap to Stability Ball Plank or Dead Bug.",
    setupCues: [
      'Knees on a soft surface (mat / folded towel). Wheel directly under shoulders.',
      'Grip wheel handles tight. Squeeze the handles like you\'re trying to crush them — that turns lats on.',
      'Brace 360° before you start: ribs down, posterior pelvic tilt (tuck your tailbone up toward ribs).',
      'Knees stay PINNED to the floor — they don\'t lift, they don\'t shift. Hips stay over knees at the start.',
    ],
    formSteps: [
      'Roll the wheel forward by extending arms + lats only. Hips stay over knees the entire descent.',
      'Stop where you can still hold a flat back — usually 60–80% of full extension on first sets.',
      'Pause 1 second at full extension. This is where most form failures happen — own the position.',
      'Pull the wheel back by contracting abs + lats together. Cue: "elbows toward hips."',
      'Finish at start position with abs still tight. No relax-rest between reps.',
    ],
    commonMistakes: [
      'Lower back arching at full extension (banana shape).',
      'Hips dropping forward / hip-flexor pull instead of ab pull.',
      'Going to full extension before the body is ready.',
      'Rolling the wheel out with arms only — no lat engagement.',
      'Holding breath through reps.',
    ],
    corrections: [
      'STOP the rep before the back arches. Cut range of motion until the brace holds. Build to full extension over 3–4 weeks. If pain persists, swap to Stability Ball Plank.',
      'Cue "tailbone tucked toward ribs." Reset the brace before each rep. Keep posterior pelvic tilt active throughout.',
      'Progression matters: start from elevated handles or roll only 50% of the range. Add 10% per week. Master the partial before the full.',
      'Squeeze the handles HARD. Cue "pull the wheel apart" — that wakes up the lats. Lats keep the spine safe.',
      'Inhale on the roll-out, exhale on the pull-back. Steady breathing = sustained brace.',
    ],
    difficultyLevel: 'advanced',
    // ATHLEAN-X — "The Ultimate Ab Rollout Progression (BEGINNER TO ADVANCED!)"
    youtubeId: '5I3LgiumTJM',
  },

  {
    name: 'Deficit Deadlift',
    aliases: ['Deficit Deadlift (1")', 'Deficit Deadlift 1in', '1in Deficit Deadlift'],
    primaryMuscles: ['Hamstrings', 'Glutes'],
    secondaryMuscles: ['Spinal erectors', 'Lats', 'Traps', 'Core'],
    feel:
      'Hamstrings and glutes loading harder than a regular deadlift right at the floor — that extra inch is doing the work. Lats locked in pulling the bar tight to your shins. Brace holding everything stacked.',
    avoidFeel:
      "Lower back rounding to reach the bar, knees collapsing in, bar drifting away from your shins. If you can't keep a flat back at the bottom of the deficit, drop the deficit height — don't compromise the spine.",
    setupCues: [
      'Stand on a 1–2" plate or platform. Start small — even 1 inch is meaningful.',
      'Bar over mid-foot. Hips slightly lower than a regular deadlift.',
      'Big breath, brace 360°, lats engaged before the bar leaves the floor.',
      'Hands just outside the legs, neutral grip or hook grip preferred at heavier loads.',
    ],
    formSteps: [
      'Hinge down with hips back, chest tall, shoulders slightly in front of the bar.',
      'Drop hips slightly to absorb the deeper start position. Maintain flat back.',
      'Press the floor away with the legs as the bar travels straight up your shins.',
      'Lock out hips and knees together. Glutes squeezed at the top — no hyperextension.',
      'Lower with control along the same path. Reset air and brace before the next rep.',
    ],
    commonMistakes: [
      'Lower back rounding to reach the bar from the deficit.',
      "Going too tall on the deficit before you've earned the depth.",
      'Bar drifting away from the shins on the way up.',
      'Hips shooting up first — turning the lift into a stiff-leg deadlift.',
      'Bouncing reps off the platform.',
    ],
    corrections: [
      'Drop the deficit height. Even 1" is enough to train the floor pull. Earn taller deficits with mobility and bracing.',
      'Start at 1". Add 0.5" only when you can pull 5 clean reps with a flat back.',
      'Cue "drag the bar up your shins." Engage lats before the pull starts.',
      'Push the floor away with your legs — bar and shoulders rise together.',
      'Pause 1 second on the floor between reps. Reset air, reset brace, then pull.',
    ],
    difficultyLevel: 'advanced',
    // Renaissance Periodization — "Deficit Deadlift"
    youtubeId: 'X-uKkAukJVA',
  },

  {
    name: 'Good Morning',
    aliases: ['Good Mornings', 'Barbell Good Morning'],
    primaryMuscles: ['Hamstrings', 'Glutes'],
    secondaryMuscles: ['Spinal erectors', 'Core'],
    feel:
      'Deep stretch through the hamstrings as you hinge — like an RDL with the bar on your back. Glutes firing hard to bring you back up. Spinal erectors holding a rigid, neutral spine the whole time.',
    avoidFeel:
      "Lower back rounding, sharp lumbar pinching, knees buckling under the load. The bar should never feel like it's compressing your spine — if it does, the load is too heavy or your brace failed.",
    setupCues: [
      'Bar on upper traps like a high-bar squat. Tight upper back, hands close.',
      'Stance shoulder-width, soft bend in the knees — not locked, not bent like a squat.',
      'Big breath, brace hard, ribs stacked over hips before you hinge.',
      'Start light. The good morning is humbling — most people overload it.',
    ],
    formSteps: [
      'Push your hips straight back. Keep that soft knee bend frozen.',
      'Hinge until your torso is roughly parallel to the floor — or where flexibility allows without losing flat back.',
      'Hamstrings should feel like they are the limit, not your low back.',
      'Drive hips forward to stand back up. Squeeze glutes at the top.',
      'Reset air and brace between reps. No bouncing through the bottom.',
    ],
    commonMistakes: [
      'Bending the knees mid-rep — turning it into a squat.',
      'Lower back rounding at the bottom.',
      'Going too heavy too soon.',
      'Hips and shoulders not moving together on the way up.',
      'Bar slipping up toward the neck.',
    ],
    corrections: [
      'Lock the knee angle at the start. Hinge from the hips only — knees stay where they started.',
      'Stop the descent the moment you feel your low back take over from your hamstrings. Build range with mobility work.',
      'Treat it like a technique lift. 3×8–10 in the 30–50% of squat 1RM range is plenty.',
      'Cue "chest and hips rise together." Keep the bar over mid-foot the whole rep.',
      'Squeeze the upper back hard — pull the bar into your traps. Tight grip helps.',
    ],
    difficultyLevel: 'intermediate',
    // Squat University — "How To Perform Good Mornings (STEP BY STEP TUTORIAL)"
    youtubeId: 'qxNuAQknYQI',
  },

  {
    name: 'Barbell Row',
    aliases: ['Bent-Over Barbell Row', 'Bent Over Row', 'Bent-Over Row'],
    primaryMuscles: ['Lats', 'Mid-back'],
    secondaryMuscles: ['Rhomboids', 'Rear delts', 'Biceps', 'Spinal erectors'],
    feel:
      'Lats and mid-back pulling the bar to your stomach. Strong squeeze between the shoulder blades at the top. Hips and core locked in like a hinge — torso angle holds steady through the whole set.',
    avoidFeel:
      "Lower back rounding, jerking with the hips to swing the weight up, biceps and forearms taking over instead of back. If your low back is the limiting factor, the load is too heavy.",
    setupCues: [
      'Hinge into ~45° torso angle. Knees softly bent, hips back.',
      'Bar over mid-foot, hands just outside the legs (overhand grip).',
      'Big breath, brace 360°. Ribs stacked over hips, neutral neck.',
      'Lats engaged before the row — pull your shoulders down and back.',
    ],
    formSteps: [
      'Pull the bar to your lower chest / upper stomach with your elbows leading.',
      'Squeeze shoulder blades together at the top. Pause 1 second.',
      'Lower with control along the same path — don\'t let the bar swing forward.',
      'Keep the torso angle frozen. If the torso rises, the load is too heavy.',
      'Reset air and brace between reps if needed.',
    ],
    commonMistakes: [
      'Hip-swinging / kipping the bar up.',
      'Bar pulled too high (toward the chin) — turning it into an upright row.',
      'Lower back rounding under load.',
      'Elbows flaring out wide instead of tracking back.',
      'Shrugging up with the traps instead of squeezing the shoulder blades.',
    ],
    corrections: [
      'Lighten the load. Cue "torso doesn\'t move." Pause 1 second at the top of every rep to kill momentum.',
      'Aim the bar at your belly button — not your chest. Drive elbows back, not up.',
      'Reset brace before every rep. If the back rounds at any point in the set, end the set.',
      'Cue "elbows toward the hips" — lats lead the pull, not the rear delts.',
      'Pull shoulder blades back and down before the row, not up. Traps stay quiet.',
    ],
    difficultyLevel: 'intermediate',
    // ATHLEAN-X — "How to do Barbell Rows PROPERLY for a Big Back (AVOID MISTAKES!)"
    youtubeId: 'T3N-TO4reLQ',
  },

  {
    name: 'Overhead Press',
    aliases: ['OHP', 'Standing Press', 'Military Press', 'Barbell Overhead Press', 'Strict Press'],
    primaryMuscles: ['Front delts'],
    secondaryMuscles: ['Triceps', 'Upper chest', 'Traps', 'Core'],
    feel:
      'Front delts and triceps pressing the bar straight overhead. Glutes and core locked in like a plank — no leaning back. Shoulders strong and stable through the lockout.',
    avoidFeel:
      "Lower back arching to compensate, shoulders shrugging up to avoid the press, sharp pain in the front of the shoulder. If the lift is happening from your low back, the load is too heavy.",
    setupCues: [
      'Bar resting on the front delts, elbows slightly in front of the bar.',
      'Hands just outside shoulder-width. Wrists stacked over elbows.',
      'Stance shoulder-width. Glutes and quads tight — full-body brace.',
      'Big breath, brace 360°, ribs DOWN — don\'t let the rib cage flare.',
    ],
    formSteps: [
      'Tuck the chin slightly so the bar can travel straight up past the face.',
      'Press the bar in a vertical line. As the bar passes your forehead, push your head through the window.',
      'Lock out overhead with the bar stacked over mid-foot. Elbows fully extended, traps engaged at the top.',
      'Lower the bar back to the front rack with control — same straight path.',
      'Reset brace and air before the next rep.',
    ],
    commonMistakes: [
      'Leaning back excessively — turning it into an incline bench.',
      'Bar pressed forward instead of straight up.',
      'Ribs flaring out — losing the brace.',
      'Soft glutes / soft core — energy leak.',
      'Failing to push the head through at lockout.',
    ],
    corrections: [
      'Lighten the load. Cue "ribs down, glutes tight." A small backward lean is normal; a big arch is not.',
      'Tuck the chin to clear the bar path. Cue "bar over mid-foot at lockout."',
      'Exhale partially before pressing. Maintain 360° brace through the full rep.',
      'Squeeze glutes hard before the press starts. Treat it like a standing plank.',
      'After the bar clears the forehead, actively shrug the traps and push the head forward under the bar.',
    ],
    difficultyLevel: 'intermediate',
    // Jeff Nippard — "Build Bigger Shoulders With Perfect Training Technique (The Overhead Press)"
    youtubeId: '_RlRDWO2jfg',
  },

  {
    name: 'Pull-Up',
    aliases: ['Pull Up', 'Pullup', 'Pull-Ups', 'Lat Pulldown', 'Pull-Up / Lat Pulldown'],
    primaryMuscles: ['Lats'],
    secondaryMuscles: ['Mid-back', 'Rear delts', 'Biceps', 'Core'],
    feel:
      'Lats pulling the elbows down to your sides — the prime mover. Mid-back squeezing at the top. Core engaged keeping the body straight, not swinging.',
    avoidFeel:
      "Shoulder pinching at the top, neck cranking forward to clear the bar, low back arching to swing yourself up. If the biceps and forearms burn out before the lats, the lats aren't doing their job.",
    setupCues: [
      'Grip just outside shoulder-width, overhand. Squeeze the bar like you\'re crushing it.',
      'Hang from the bar with shoulders packed down — not slumped up by the ears.',
      'Brace the core and squeeze the glutes. Body in a slight hollow position.',
      'Legs in front of the body, toes pointed down. No swinging.',
    ],
    formSteps: [
      'Initiate the pull by driving the elbows DOWN toward your back pockets.',
      'Pull until your chin clears the bar — chest reaching up to meet it.',
      'Squeeze shoulder blades together at the top. Pause 1 second.',
      'Lower with control to a full hang — arms straight but lats still engaged.',
      'Don\'t lose tension at the bottom. Stay packed, don\'t shrug up.',
    ],
    commonMistakes: [
      'Kipping / swinging the body to clear the bar.',
      'Pulling with the biceps instead of the lats.',
      'Not reaching full ROM at the bottom.',
      'Shoulders shrugging up to the ears at the bottom.',
      'Cranking the neck forward to clear the bar.',
    ],
    corrections: [
      'Use a band or assisted pulldown to lighten the load. Pause 1 second at the top of every rep to kill momentum.',
      'Cue "elbows down to the floor." Engage lats first — biceps just go along for the ride.',
      'Lower until arms are fully straight — but keep shoulders packed down, not relaxed.',
      'Pull shoulder blades down before initiating the pull. Cue "long neck."',
      'Lift the chest to the bar instead of dropping the chin. Keep neutral neck.',
    ],
    difficultyLevel: 'intermediate',
    // ATHLEAN-X — "The Official Pull-Up Checklist (AVOID MISTAKES!)"
    youtubeId: 'sIvJTfGxdFo',
  },

  {
    name: 'DB Lateral Raise',
    aliases: ['Lateral Raise', 'Dumbbell Lateral Raise', 'Side Lateral Raise', 'Side Raise'],
    primaryMuscles: ['Lateral delts'],
    secondaryMuscles: ['Front delts', 'Traps'],
    feel:
      'Lateral delts (the side caps of the shoulder) doing all the work — burning hard by the last few reps. Light weight, strict form, slow tempo. The pump should be in the side delt only.',
    avoidFeel:
      "Traps shrugging up to lift the dumbbells, momentum from the legs/back, sharp pain in the front of the shoulder, wrists collapsing. If the traps take over, the side delts are off the hook.",
    setupCues: [
      'Stand tall with a soft knee bend. Slight forward lean from the hips — not vertical.',
      'Dumbbells at your sides, palms facing inward. Light weight — leave ego out.',
      'Soft bend in the elbows that stays locked the whole rep — not a curl.',
      'Brace the core. Glutes tight to prevent body english.',
    ],
    formSteps: [
      'Lead with the elbows — raise the elbows out and slightly forward, NOT straight to the side.',
      'Stop when the upper arm is roughly parallel to the floor. Elbow slightly higher than the wrist.',
      'Pause 1 second at the top, feel the side delt contraction.',
      'Lower with a controlled tempo (2–3 seconds down). No flopping the weight down.',
      'Keep the body still — only the arms move.',
    ],
    commonMistakes: [
      'Going too heavy and using momentum to swing the weights up.',
      'Wrists higher than the elbows at the top — turning it into a front raise.',
      'Shrugging traps up to assist the lift.',
      'Locking out the elbows — overloading the elbow joint.',
      'Standing perfectly vertical — limits side delt range.',
    ],
    corrections: [
      'Lighten the dumbbells. Cue "if you have to swing, drop the weight." 8–15 reps with strict form.',
      'Cue "pour out a pitcher" — slight internal rotation at the top, elbow stays higher than wrist.',
      'Cue "keep the shoulders DOWN, away from the ears" the whole set. Pre-engage lats.',
      'Keep a soft 10–15° elbow bend frozen the whole rep. Locked-out arms are unsafe under load.',
      'Slight forward lean (5–10°) from the hips improves the side delt line of pull.',
    ],
    difficultyLevel: 'beginner',
    // Jeff Nippard — "The Lateral Raise Is The ONLY Must-Do Exercise (MY RESPONSE)"
    youtubeId: 'IdNOahFD450',
  },

  {
    name: 'DB Incline Press',
    aliases: ['Incline Dumbbell Press', 'Incline DB Press', 'DB Incline Bench Press'],
    primaryMuscles: ['Upper chest'],
    secondaryMuscles: ['Front delts', 'Triceps'],
    feel:
      'Upper chest stretch at the bottom, hard contraction at the top. Front delts assisting but not dominating. Each side has to do its own work — no barbell to compensate.',
    avoidFeel:
      "Front shoulder pinching at the bottom, wrists collapsing back, the press happening from the front delt instead of the chest. If your shoulders burn before your chest, the bench is too steep.",
    setupCues: [
      'Set bench to 30–45°. Steeper = more front delt, less chest.',
      'Sit back, drive shoulder blades down and into the bench. Slight arch.',
      'Dumbbells start at the lower chest with elbows tucked ~45° from the torso.',
      'Wrists stacked over elbows, knuckles pointed at the ceiling.',
    ],
    formSteps: [
      'Big breath, brace 360°. Press the dumbbells up and slightly inward toward each other.',
      'Stop just short of the dumbbells touching at the top. No hyperextended elbows.',
      'Squeeze the upper chest hard at the top.',
      'Lower with control until the dumbbells reach the upper chest — full stretch.',
      'Reset air and brace before the next rep.',
    ],
    commonMistakes: [
      'Bench too steep (60°+) — turns it into an overhead press.',
      'Elbows flared out at 90° — shoulder strain.',
      'Pressing the dumbbells away from each other at the top.',
      'Bouncing the dumbbells off the chest.',
      'Asymmetric press — one side leading the other.',
    ],
    corrections: [
      'Use 30–45°. If you want more upper chest, tweak grip and tempo first; don\'t go steeper than 45°.',
      'Tuck elbows to ~45°. Cue "show me the dumbbells, don\'t hide them."',
      'Cue "press the dumbbells together, not apart" — even an inch of inward squeeze recruits the chest more.',
      'Pause 1 second at the bottom of every rep. No bounce.',
      'Press both sides simultaneously. If one side lags, drop the weight until both move together.',
    ],
    difficultyLevel: 'intermediate',
    // Renaissance Periodization — "Incline Dumbbell Press BETTER | Targeting The Muscle Series"
    youtubeId: '0f6-uCUKqgA',
  },

  {
    name: 'Chest-Supported Row',
    aliases: ['Chest Supported Row', 'Chest-Supported T-Bar Row', 'Incline DB Row'],
    primaryMuscles: ['Mid-back', 'Lats'],
    secondaryMuscles: ['Rhomboids', 'Rear delts', 'Biceps'],
    feel:
      'Pure mid-back and lat contraction. No lower back, no hip swing — the bench takes the spine out of the equation. The squeeze between shoulder blades at the top is the entire point.',
    avoidFeel:
      "Chest peeling off the bench (loss of support), traps shrugging up, biceps and forearms taking over the row. If you have to lift your chest off the bench to finish the rep, the load is too heavy.",
    setupCues: [
      'Set bench to ~30–45° incline. Lie face-down with chest fully supported.',
      'Feet planted firmly. Body braced from head to feet.',
      'Dumbbells (or bar / T-bar handle) hanging straight down from your shoulders.',
      'Pre-engage lats — pull shoulders down and back before initiating the row.',
    ],
    formSteps: [
      'Row by driving the elbows up and back — toward the back pockets.',
      'Pull until upper arms are roughly parallel to the floor. Squeeze shoulder blades together at the top.',
      'Pause 1 second at the top. Feel the mid-back contraction.',
      'Lower with control to a full stretch — arms straight but lats still engaged.',
      'Keep the chest glued to the bench through the full set.',
    ],
    commonMistakes: [
      'Lifting the chest off the bench to add range.',
      'Shrugging the traps up to assist the pull.',
      'Pulling with biceps instead of mid-back.',
      'Going too heavy — turning a strict row into a body-english row.',
      'Insufficient range of motion at the bottom.',
    ],
    corrections: [
      "Cue \"chest stays glued to the bench.\" If you can't keep contact, lighten the load.",
      'Pull shoulder blades back and DOWN before the row. Cue "long neck."',
      'Cue "elbows lead, hands follow." Drive the elbows up — biceps just go along for the ride.',
      'Lighten the load until you can hit a 1-second pause at the top of every rep.',
      'Lower to full lat stretch. Arms fully straight but shoulders still packed down.',
    ],
    difficultyLevel: 'beginner',
    // Jeff Nippard — "A Better Way To Do Rows"
    youtubeId: 'fgSyNdEsqlM',
  },

  {
    name: 'Face Pulls',
    aliases: ['Face Pull', 'Cable Face Pull', 'Rope Face Pull'],
    primaryMuscles: ['Rear delts'],
    secondaryMuscles: ['Mid-traps', 'Rhomboids', 'Rotator cuff'],
    feel:
      'Rear delts and mid-traps pulling the rope toward your face. Rotator cuffs externally rotating the upper arms. A healthy "shoulder hygiene" feel — light, controlled, high-rep.',
    avoidFeel:
      "Lower back arching, traps shrugging up to the ears, momentum jerking the cable. If the front of your shoulder pinches, you've gone too heavy or rotated too aggressively.",
    setupCues: [
      'Cable at upper-chest / face height. Rope attachment, hands at the ends of the rope.',
      'Stand with a slight forward lean — staggered or square stance is fine.',
      'Light weight. Face pulls are a high-rep accessory, not a strength lift.',
      'Brace core, glutes tight. No body english.',
    ],
    formSteps: [
      'Pull the rope toward your face — separating the hands as you pull.',
      'Drive elbows HIGH (above shoulder height) and OUT to the sides.',
      'Externally rotate at the top — knuckles pointed back, thumbs back behind your ears.',
      'Pause 1 second at the top, feel the rear delt + rotator cuff squeeze.',
      'Return with control. Don\'t let the stack drop — earn the negative.',
    ],
    commonMistakes: [
      'Going too heavy — turning it into a low row.',
      'Elbows dropping below shoulders — losing the rear delt line of pull.',
      'Just rowing instead of rotating at the top.',
      'Using the lower back to throw the weight.',
      'Shrugging traps up to the ears.',
    ],
    corrections: [
      'Lighten the load. Face pulls in the 12–20 rep range are the sweet spot.',
      'Cue "elbows higher than wrists at the top." Drive elbows up and out, not back.',
      'Add the external rotation — finish with thumbs pointing behind your ears.',
      'Brace core, glutes squeezed. The cable should not move you backward.',
      'Cue "shoulders DOWN, away from ears" the entire set.',
    ],
    difficultyLevel: 'beginner',
    // ATHLEAN-X — "STOP Doing Face Pulls Like This! (I'M BEGGING YOU)"
    youtubeId: '8686PLZB_1Q',
  },

  {
    name: 'Walking Lunge',
    aliases: ['Walking Lunges', 'DB Walking Lunge', 'Dumbbell Walking Lunge'],
    primaryMuscles: ['Quadriceps', 'Glutes'],
    secondaryMuscles: ['Hamstrings', 'Adductors', 'Core'],
    feel:
      'Front-leg quad and glute loading hard each step. Glutes firing on the push-off. Core fighting to keep balance. By rep 8 each leg, the legs feel cooked.',
    avoidFeel:
      "Front knee caving inward, knee shooting forward over the toes, lower back arching from heavy dumbbells. If your balance is gone, drop the weight before form goes.",
    setupCues: [
      'Dumbbells at your sides (or none for bodyweight). Stand tall.',
      'Brace core, ribs over hips, eyes forward.',
      'Pick a long, straight path — at least 10 yards or whatever your space allows.',
    ],
    formSteps: [
      'Step forward with one leg into a long stride — knee tracks over mid-foot, not collapsing in.',
      'Lower the back knee toward the floor with control. Stop just above the floor.',
      'Push through the front foot to drive yourself UP and forward into the next step.',
      'Bring the trailing leg forward into the next lunge. Same form, opposite leg.',
      'Keep torso vertical — no leaning forward over the front knee.',
    ],
    commonMistakes: [
      'Knee caving inward on the front leg.',
      'Front knee shooting too far over the toes.',
      'Trailing knee slamming into the floor.',
      'Torso leaning forward.',
      'Stride too short — turning it into a half-rep.',
    ],
    corrections: [
      'Cue "knee tracks over mid-foot." Push the knee out toward the pinky toe.',
      'Take a longer stride — your shin should stay roughly vertical at the bottom.',
      'Lower the knee to within an inch of the floor — never bang it down.',
      'Cue "tall chest, eyes forward." Brace the core to stay upright.',
      'Long stride — front thigh roughly parallel to the floor at the bottom.',
    ],
    difficultyLevel: 'beginner',
    // Renaissance Periodization — "Dumbbell Walking Lunge"
    youtubeId: 'eFWCn5iEbTU',
  },

  {
    name: 'Single-Leg Hip Thrust',
    aliases: ['SL Hip Thrust', 'Single Leg Hip Thrust', 'One Leg Hip Thrust'],
    primaryMuscles: ['Glutes'],
    secondaryMuscles: ['Hamstrings', 'Core'],
    feel:
      'Working glute squeezing hard at the top of each rep — the pump is intense and isolated. Hamstrings assisting. Core holding everything stacked. The non-working side stays totally relaxed.',
    avoidFeel:
      "Lower back arching to push the hips up, opposite hip dropping, knee caving in. If the working glute can't drive the rep, drop to bodyweight only — this is a feel-and-form lift first.",
    setupCues: [
      'Upper back on a bench, working foot flat on the floor about a shin\'s length from your butt.',
      'Non-working leg extended straight out, knee straight, foot pointed.',
      'Hips and shoulders square — pelvis level, not tilted.',
      'Chin tucked slightly. Bracing core. Optional load: dumbbell or plate over the working hip.',
    ],
    formSteps: [
      'Drive through the working foot — heel pressing into the floor.',
      'Squeeze the glute as the hips rise. Pelvis stays level — non-working hip does NOT drop.',
      'Lock out at the top with hips fully extended. Pause 1 second, hard glute squeeze.',
      'Lower with control. Don\'t bounce off the bottom.',
      'Keep the non-working leg passive — it doesn\'t kick or push.',
    ],
    commonMistakes: [
      'Pelvis tilting — non-working hip dropping below working hip.',
      'Lower back arching to fake hip extension.',
      'Pushing through the toes instead of the heel.',
      'Going too fast / bouncing reps.',
      'Adding load before the bodyweight rep is clean.',
    ],
    corrections: [
      'Cue "level pelvis." Place a hand on the non-working hip to feel it stay up.',
      'Cue "ribs down, glutes squeezed." Hip extension comes from the glute, not the lumbar spine.',
      'Drive through the heel. The toes can lift slightly off the floor as a check.',
      'Pause 1 second at the top of every rep. Strict tempo or no progress.',
      'Master 3×12 bodyweight reps with level pelvis BEFORE adding load.',
    ],
    difficultyLevel: 'intermediate',
    // Renaissance Periodization — "Single Leg Hip Thrust"
    youtubeId: 'lzDgRRuBdqY',
  },

  {
    name: 'Seal Row',
    aliases: ['Seal Rows'],
    primaryMuscles: ['Mid-back', 'Lats'],
    secondaryMuscles: ['Rhomboids', 'Rear delts', 'Biceps'],
    feel:
      "Pure back contraction with zero help from the lower body. The bench takes hips and back out of the equation entirely — only your back can lift the bar. Mid-back fries fast.",
    avoidFeel:
      "Chest peeling off the bench, traps shrugging up, biceps overtaking the row. If you can't keep contact with the bench, the load is too heavy — there is no way to cheat a seal row.",
    setupCues: [
      'Lie face-down on a flat bench elevated on blocks (so the bar can hang free underneath).',
      'Bar directly under your shoulders. Hands at shoulder-width or slightly outside.',
      'Chest, hips, and quads pressed into the bench. Body fully supported.',
      'Pre-engage lats — pull shoulders down and back before the first rep.',
    ],
    formSteps: [
      'Row the bar straight up to the underside of the bench. Elbows lead.',
      'Squeeze shoulder blades together at the top. Pause 1 second.',
      'Lower with control to a dead hang — arms straight but shoulders still packed.',
      'Keep the chest glued to the bench. No body english.',
      'Reset and repeat. Strict, slow, hard squeezes.',
    ],
    commonMistakes: [
      'Lifting the chest off the bench to add range.',
      'Pulling with biceps instead of mid-back.',
      'Bouncing the bar off the bottom.',
      'Going too heavy — body english creeping in despite the bench.',
      'Insufficient ROM — failing to pull the bar all the way up.',
    ],
    corrections: [
      'Cue "stay glued to the bench." If you have to lift to pull, drop the weight.',
      'Cue "elbows up to the bench." Drive elbows, biceps go along for the ride.',
      'Pause 1 second at the bottom of every rep. Reset before pulling.',
      'Lighten the load. Seal rows expose form errors fast — strict reps or no progress.',
      'Pull until the bar touches the underside of the bench. That\'s the rep.',
    ],
    difficultyLevel: 'intermediate',
    // Renaissance Periodization — "Seal Row"
    youtubeId: '4H2ItXwUTp8',
  },

  {
    name: 'Incline DB Curl',
    aliases: ['Incline Dumbbell Curl', 'Incline Bicep Curl', 'Incline Curl'],
    primaryMuscles: ['Biceps'],
    secondaryMuscles: ['Forearms'],
    feel:
      'Deep biceps stretch at the bottom of every rep — that\'s the whole point of the incline. Strong contraction at the top. No shoulder swing, no momentum — strict tempo.',
    avoidFeel:
      "Elbows drifting forward (out of the stretch position), shoulders rolling forward, lower back arching off the bench. If the biceps don't get the brutal stretch, the bench is too upright.",
    setupCues: [
      'Bench at 45–60°. The arms must hang BEHIND your torso for the stretch.',
      'Sit back, shoulders pinned to the bench. Don\'t let them roll forward.',
      'Dumbbells at your sides, arms fully extended, palms forward (supinated).',
      'Light weight — incline curls are a stretch-focus exercise, not an ego lift.',
    ],
    formSteps: [
      'Curl the dumbbells up by contracting the biceps. Elbows STAY pinned to your sides.',
      'Stop short of the elbows drifting forward — that ends the tension on the biceps.',
      'Pause 1 second at the top. Hard squeeze.',
      'Lower with control over 2–3 seconds. Full extension at the bottom.',
      'Feel the deep biceps stretch at the bottom. That\'s the rep.',
    ],
    commonMistakes: [
      'Elbows drifting forward at the top — converting it into a regular curl.',
      'Shoulders rolling forward off the bench.',
      'Going too heavy and using shoulder swing.',
      'Cutting the bottom of the rep short — no stretch.',
      'Lower back arching off the bench.',
    ],
    corrections: [
      'Cue "elbows pinned to the sides." Stop the rep when the elbow wants to drift forward.',
      'Pull shoulder blades back and DOWN. Press the back of the shoulders into the bench.',
      'Lighten the load. 8–12 reps with strict form beats 6 reps with cheating every time.',
      'Lower to FULL extension every rep. Stretch the biceps hard at the bottom.',
      'Cue "low back to the bench." Brace core, ribs down.',
    ],
    difficultyLevel: 'beginner',
    // ATHLEAN-X — "Stop Screwing Up Incline Dumbbell Curls (PROPER FORM!)"
    youtubeId: 'DCe8f6vMe9A',
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
    .replace(/\b\d+-\d+-\d+\b/g, '') // strip tempo cadence like "3-1-1" / "2-0-1"
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPrefixes(s: string): string {
  return s.replace(/^(barbell|dumbbell|machine|cable|bar|tempo)\s+/i, '').trim();
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
