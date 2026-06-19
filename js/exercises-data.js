// =========================================================
// DEFAULT EXERCISE LIBRARY
// Seeded into Firestore the first time a user logs in.
// Edit/add/delete afterwards from the Exercises page —
// this file is only the starting point.
// =========================================================

export const MUSCLE_GROUPS = [
  "Chest", "Back", "Shoulder", "Bicep", "Tricep", "Legs", "Forearm", "Abs"
];

// How many rest days before a muscle counts as "ready" again.
// Source: your answer #22. Tricep grouped with Bicep (2 days, not
// specified separately — adjust here if you want it different).
// Forearm/Abs were "1-2 days" — set to 1 here, bump to 2 if that
// feels too aggressive once you're using it for real.
export const RECOVERY_DAYS = {
  Chest: 2,
  Back: 3,
  Shoulder: 2,
  Bicep: 2,
  Tricep: 2,
  Legs: 3,
  Forearm: 1,
  Abs: 1
};

export const DEFAULT_EXERCISES = [
  // ---- Chest ----
  { name: "Barbell Bench Press", muscle: "Chest" },
  { name: "Incline Barbell Bench Press", muscle: "Chest" },
  { name: "Decline Barbell Bench Press", muscle: "Chest" },
  { name: "Pec Deck", muscle: "Chest" },
  { name: "Cable Crossover", muscle: "Chest" },
  { name: "Decline Dumbbell Bench Press", muscle: "Chest" },
  { name: "Dumbbell Bench Press", muscle: "Chest" },
  { name: "Incline Dumbbell Chest Press", muscle: "Chest" },
  { name: "Dips - Chest Version", muscle: "Chest" },
  { name: "Push-Ups - Normal", muscle: "Chest" },
  { name: "Push-Ups - Close-Grip", muscle: "Chest" },

  // ---- Tricep ----
  { name: "Bench Tricep Dips", muscle: "Tricep" },
  { name: "Tricep Pushdown", muscle: "Tricep" },
  { name: "Overhead Rope Tricep Extension", muscle: "Tricep" },
  { name: "Dips - Triceps Version", muscle: "Tricep" },
  { name: "Overhead Dumbbell Triceps Extension", muscle: "Tricep" },
  { name: "Dumbbell Overhead Triceps Extension", muscle: "Tricep" },
  { name: "Push-Ups - Close Tricep Position", muscle: "Tricep" },
  { name: "One-Arm Dumbbell Triceps Extension", muscle: "Tricep" },
  { name: "One Arm Cable Tricep Kickback", muscle: "Tricep" },

  // ---- Bicep ----
  { name: "Alternate Dumbbell Hammer Curl", muscle: "Bicep" },
  { name: "Alternate Incline Dumbbell Curl", muscle: "Bicep" },
  { name: "Incline Dumbbell Curl", muscle: "Bicep" },
  { name: "Preacher Curl", muscle: "Bicep" },
  { name: "One Arm Dumbbell Preacher Curl", muscle: "Bicep" },
  { name: "Chin-Up", muscle: "Bicep" },
  { name: "EZ Bar Curl", muscle: "Bicep" },
  { name: "Seated Concentration Curls", muscle: "Bicep" },
  { name: "Dumbbell Double Hammer Curls", muscle: "Bicep" },
  { name: "Cross Body Hammer Curl", muscle: "Bicep" },
  { name: "Alternate Dumbbell Arm Curl", muscle: "Bicep" },
  { name: "Dumbbell Double Bicep Curl", muscle: "Bicep" },
  { name: "Standing Cable Arm Curl", muscle: "Bicep" },

  // ---- Back ----
  { name: "Hyperextensions (Back Extensions)", muscle: "Back" },
  { name: "Wide-Grip Pull-Ups", muscle: "Back" },
  { name: "Wide-Grip Lat Pulldowns", muscle: "Back" },
  { name: "Close-Grip Lat Pulldown", muscle: "Back" },
  { name: "One-Arm Dumbbell Rows", muscle: "Back" },
  { name: "Seated Cable Row Wide Grip", muscle: "Back" },
  { name: "Seated Cable Row Close Grip", muscle: "Back" },
  { name: "Barbell Deadlifts", muscle: "Back" },
  { name: "T-Bar Row", muscle: "Back" },

  // ---- Shoulder ----
  { name: "Front Dumbbell Raise", muscle: "Shoulder" },
  { name: "Front Plate Raise", muscle: "Shoulder" },
  { name: "Front Two Arm Alternate Dumbbell Raise", muscle: "Shoulder" },
  { name: "Machine Shoulder Press", muscle: "Shoulder" },
  { name: "Seated Dumbbell Shoulder Press", muscle: "Shoulder" },
  { name: "Seated Dumbbell Lateral Raise", muscle: "Shoulder" },
  { name: "Standing Dumbbell Lateral Raise", muscle: "Shoulder" },
  { name: "Standing Cable Lateral Raise", muscle: "Shoulder" },
  { name: "Rear Delt Machine Fly", muscle: "Shoulder" },
  { name: "Cable Rear Delt Pull", muscle: "Shoulder" },
  { name: "Standing Dumbbell Shrug", muscle: "Shoulder" },

  // ---- Legs ----
  { name: "Machine Leg Press", muscle: "Legs" },
  { name: "Standing Calf Raises", muscle: "Legs" },
  { name: "Seated Calf Raises", muscle: "Legs" },
  { name: "Free Squat", muscle: "Legs" },
  { name: "Dumbbell Squat", muscle: "Legs" },
  { name: "Leg Extensions", muscle: "Legs" },
  { name: "Leg Curls", muscle: "Legs" },

  // ---- Forearm (rough starter set — edit freely) ----
  { name: "Barbell Wrist Curl", muscle: "Forearm" },
  { name: "Reverse Barbell Wrist Curl", muscle: "Forearm" },
  { name: "Dumbbell Wrist Curl", muscle: "Forearm" },
  { name: "Reverse Grip Cable Curl", muscle: "Forearm" },
  { name: "Farmer's Walk", muscle: "Forearm" },

  // ---- Abs (rough starter set — edit freely) ----
  { name: "Cable Crunch", muscle: "Abs" },
  { name: "Hanging Leg Raise", muscle: "Abs" },
  { name: "Plank", muscle: "Abs" },
  { name: "Crunches", muscle: "Abs" },
  { name: "Russian Twist", muscle: "Abs" },
  { name: "Bicycle Crunch", muscle: "Abs" }
];
