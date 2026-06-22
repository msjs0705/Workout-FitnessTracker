// =========================================================
// DATA STORE
// Thin wrapper around Firestore. Every page imports from here
// instead of touching Firestore directly, so the data model
// only lives in one place.
//
// Firestore layout (per user, uid-scoped so rules can lock
// each person to their own data):
//   users/{uid}/exercises/{id}   { name, muscle, custom, createdAt }
//   users/{uid}/workouts/{id}    { dateStr, startTime, endTime,
//                                  durationMin, muscles[], exercises[],
//                                  createdAt }
//   users/{uid}/cardio/{id}      { dateStr, type, durationMin,
//                                  distanceKm, speedKmh, createdAt }
//   users/{uid}/bodyweight/{dateStr} { weight, createdAt }
//   users/{uid}/meta/seed        { seeded: true }
// =========================================================

import {
  db, collection, doc, setDoc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, orderBy, where, Timestamp
} from "./firebase-init.js";
import { DEFAULT_EXERCISES, RECOVERY_DAYS } from "./exercises-data.js";

// ---------- date helpers ----------
export function todayStr(){ return dateToStr(new Date()); }
export function dateToStr(d){
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
export function strToDate(s){ const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
export function daysAgo(dateStr){
  const a = strToDate(dateStr), b = strToDate(todayStr());
  return Math.round((b - a) / 86400000);
}
export function formatNice(dateStr){
  return strToDate(dateStr).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
}

// ---------- seeding ----------
export async function ensureSeeded(uid){
  const seedRef = doc(db, "users", uid, "meta", "seed");
  const snap = await getDoc(seedRef);
  if (snap.exists()) return;
  const exRef = collection(db, "users", uid, "exercises");
  for (const ex of DEFAULT_EXERCISES) {
    await addDoc(exRef, { ...ex, custom: false, createdAt: Timestamp.now() });
  }
  await setDoc(seedRef, { seeded: true, seededAt: Timestamp.now() });
}

// ---------- exercises ----------
export async function getExercises(uid){
  const snap = await getDocs(query(collection(db, "users", uid, "exercises"), orderBy("name")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function addExercise(uid, { name, muscle }){
  return addDoc(collection(db, "users", uid, "exercises"), { name, muscle, custom: true, createdAt: Timestamp.now() });
}
export async function updateExercise(uid, id, data){
  return updateDoc(doc(db, "users", uid, "exercises", id), data);
}
export async function deleteExercise(uid, id){
  return deleteDoc(doc(db, "users", uid, "exercises", id));
}

// ---------- workouts (strength) ----------
export async function addWorkout(uid, workout){
  return addDoc(collection(db, "users", uid, "workouts"), { ...workout, createdAt: Timestamp.now() });
}
export async function getWorkouts(uid){
  const snap = await getDocs(query(collection(db, "users", uid, "workouts"), orderBy("dateStr", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
// Fetch only a single month — used by calendar to avoid loading entire history
export async function getWorkoutsByMonth(uid, year, month){
  const y = String(year), m = String(month+1).padStart(2,'0');
  const snap = await getDocs(query(
    collection(db, "users", uid, "workouts"),
    where("dateStr", ">=", `${y}-${m}-01`),
    where("dateStr", "<=", `${y}-${m}-31`)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getCardioByMonth(uid, year, month){
  const y = String(year), m = String(month+1).padStart(2,'0');
  const snap = await getDocs(query(
    collection(db, "users", uid, "cardio"),
    where("dateStr", ">=", `${y}-${m}-01`),
    where("dateStr", "<=", `${y}-${m}-31`)
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function deleteWorkout(uid, id){
  return deleteDoc(doc(db, "users", uid, "workouts", id));
}
export async function updateWorkout(uid, id, data){
  return updateDoc(doc(db, "users", uid, "workouts", id), data);
}

// ---------- in-progress workout draft ----------
// Lets you log a few exercises, leave the page (check stats, even log
// out), and come back to find everything still there. Only turns into
// a real, stats-visible workout once you tap "Save workout".
const DRAFT_DOC = "workout";
export async function saveDraftWorkout(uid, draft){
  return setDoc(doc(db, "users", uid, "drafts", DRAFT_DOC), { ...draft, updatedAt: Timestamp.now() });
}
export async function getDraftWorkout(uid){
  const snap = await getDoc(doc(db, "users", uid, "drafts", DRAFT_DOC));
  return snap.exists() ? snap.data() : null;
}
export async function clearDraftWorkout(uid){
  return deleteDoc(doc(db, "users", uid, "drafts", DRAFT_DOC));
}

// Last performed sets for a given exercise (for the "previous: 60kg x 8" hint)
export async function getLastPerformance(uid, exerciseId){
  const workouts = await getWorkouts(uid); // already desc by date
  for (const w of workouts){
    const match = (w.exercises || []).find(e => e.exerciseId === exerciseId);
    if (match) return { dateStr: w.dateStr, sets: match.sets };
  }
  return null;
}

// Personal records: heaviest weight + best estimated 1RM (Epley) per exercise
export async function getPRs(uid){
  const workouts = await getWorkouts(uid);
  const prs = {}; // exerciseId -> { maxWeight, est1rm, dateStr, exerciseName }
  for (const w of workouts){
    for (const e of (w.exercises || [])){
      for (const s of (e.sets || [])){
        const weight = Number(s.weight) || 0, reps = Number(s.reps) || 0;
        if (weight <= 0 || reps <= 0) continue;
        const est1rm = weight * (1 + reps/30);
        const cur = prs[e.exerciseId];
        if (!cur || weight > cur.maxWeight) {
          prs[e.exerciseId] = {
            exerciseName: e.name,
            maxWeight: cur ? Math.max(cur.maxWeight, weight) : weight,
            est1rm: cur ? Math.max(cur.est1rm, est1rm) : est1rm,
            dateStr: w.dateStr
          };
        } else if (est1rm > cur.est1rm) {
          cur.est1rm = est1rm;
        }
      }
    }
  }
  return prs;
}

// ---------- cardio ----------
export async function addCardio(uid, cardio){
  return addDoc(collection(db, "users", uid, "cardio"), { ...cardio, createdAt: Timestamp.now() });
}
export async function getCardio(uid){
  const snap = await getDocs(query(collection(db, "users", uid, "cardio"), orderBy("dateStr", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function deleteCardio(uid, id){
  return deleteDoc(doc(db, "users", uid, "cardio", id));
}

// ---------- bodyweight ----------
export async function setBodyWeight(uid, dateStr, weight){
  return setDoc(doc(db, "users", uid, "bodyweight", dateStr), { weight: Number(weight), createdAt: Timestamp.now() });
}
export async function getBodyWeights(uid){
  const snap = await getDocs(query(collection(db, "users", uid, "bodyweight"), orderBy("__name__")));
  return snap.docs.map(d => ({ dateStr: d.id, ...d.data() }));
}
export async function deleteBodyWeight(uid, dateStr){
  return deleteDoc(doc(db, "users", uid, "bodyweight", dateStr));
}

// ---------- streak ----------
// Consecutive days (counting back from today, or yesterday if today
// hasn't happened yet) with at least one workout or cardio session.
export function computeStreak(workouts, cardio){
  const days = new Set([...workouts.map(w => w.dateStr), ...cardio.map(c => c.dateStr)]);
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dateToStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dateToStr(cursor))){
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------- muscle recovery ----------
// Returns { Chest: { lastDateStr, daysSince, status }, ... }
// status: 'ready' | 'due' | 'never'  (ready = fully recovered & trainable,
// due = still within its recovery window, i.e. don't train yet)
export function computeRecovery(workouts, muscleGroups){
  const lastTrained = {};
  for (const w of workouts){
    for (const m of (w.muscles || [])){
      if (!lastTrained[m] || w.dateStr > lastTrained[m]) lastTrained[m] = w.dateStr;
    }
  }
  const result = {};
  for (const m of muscleGroups){
    const last = lastTrained[m];
    if (!last){ result[m] = { lastDateStr: null, daysSince: null, status: 'never', target: RECOVERY_DAYS[m] ?? 2 }; continue; }
    const since = daysAgo(last);
    const target = RECOVERY_DAYS[m] ?? 2;
    const status = since >= target ? 'ready' : 'due';
    result[m] = { lastDateStr: last, daysSince: since, status, target };
  }
  return result;
}
