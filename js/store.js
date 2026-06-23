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
// ---------- rest days ----------
export async function setRestDay(uid, dateStr){
  return setDoc(doc(db, "users", uid, "restdays", dateStr), { dateStr, createdAt: Timestamp.now() });
}
export async function getRestDays(uid){
  const snap = await getDocs(collection(db, "users", uid, "restdays"));
  return snap.docs.map(d => d.id); // returns array of dateStr strings
}
export async function deleteRestDay(uid, dateStr){
  return deleteDoc(doc(db, "users", uid, "restdays", dateStr));
}
// ---------- streak ----------
// Consecutive days (counting back from today, or yesterday if today
// hasn't happened yet) with at least one workout or cardio session.
// ---------- streak ----------
// Consecutive days (counting back from today, or yesterday if today
// hasn't happened yet) with at least one workout, cardio, or rest session.
export function computeStreak(workouts, cardio, restDays = []){
  // 1. Include restDays in the Set and filter out any empties
  const days = new Set([
    ...workouts.map(w => w.dateStr), 
    ...cardio.map(c => c.dateStr),
    ...restDays
  ].filter(Boolean));

  const activityDates = Array.from(days).sort((a, b) => b.localeCompare(a));
  if (activityDates.length === 0) return 0;

  const latestActivityDate = activityDates[0];
  const today = todayStr();

  // 2. Timezone-safe difference calculation
  const [ty, tm, td] = today.split('-').map(Number);
  const [ly, lm, ld] = latestActivityDate.split('-').map(Number);
  const daysDiff = Math.floor((new Date(ty, tm - 1, td) - new Date(ly, lm - 1, ld)) / 86400000);

  let streak = 0;
  
  // If latest activity was today or yesterday, the streak is alive
  if (daysDiff <= 1) {
    streak = 1;
    let checkDate = new Date(ly, lm - 1, ld);

    // Walk backwards counting consecutive days
    while (true) {
      checkDate.setDate(checkDate.getDate() - 1);
      const checkDateStr = dateToStr(checkDate);
      if (days.has(checkDateStr)) {
        streak++;
      } else {
        break;
      }
    }
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
// ---------- gym photos (base64, 7-slot rolling queue) ----------

const PHOTO_SLOTS = 7;

// Compress + encode image to base64 JPEG
export function compressImage(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > h && w > MAX){ h = Math.round(h * MAX/w); w = MAX; }
      else if (h > w && h > MAX){ w = Math.round(w * MAX/h); h = MAX; }
      else if (w > MAX){ h = Math.round(h * MAX/w); w = MAX; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Get the queue metadata (which slot to write next)
async function getQueueMeta(uid){
  const snap = await getDoc(doc(db, "users", uid, "meta", "photoQueue"));
  return snap.exists() ? snap.data() : { nextSlot: 1 };
}

// Upload a compressed base64 image into the next slot
export async function uploadGymPhoto(uid, base64){
  const meta = await getQueueMeta(uid);
  const slot = meta.nextSlot || 1;
  const slotId = `slot_${slot}`;
  const dateStr = todayStr();
  // Write the photo document
  await setDoc(doc(db, "users", uid, "photoslots", slotId), {
    dateStr, base64, slot, uploadedAt: Timestamp.now()
  });
  // Advance the pointer (wraps 1-7)
  const nextSlot = slot >= PHOTO_SLOTS ? 1 : slot + 1;
  await setDoc(doc(db, "users", uid, "meta", "photoQueue"), {
    nextSlot, lastUploadDate: dateStr, lastUploadSlot: slot
  });
  return slotId;
}

// Get the most recent photo across all slots
export async function getLatestPhoto(uid){
  const snap = await getDocs(collection(db, "users", uid, "photoslots"));
  if (snap.empty) return null;
  const slots = snap.docs.map(d => d.data()).filter(d => d.base64);
  if (!slots.length) return null;
  slots.sort((a,b) => (b.uploadedAt?.seconds||0) - (a.uploadedAt?.seconds||0));
  return slots[0]; // { dateStr, base64, uploadedAt }
}

// Get today's photo specifically (for partner page "uploaded today" check)
export async function getTodaysPhoto(uid){
  const latest = await getLatestPhoto(uid);
  if (!latest) return null;
  return latest.dateStr === todayStr() ? latest : null;
}
// ---------- partner comment ----------
export async function getPartnerComment(uid){
  const snap = await getDoc(doc(db, "users", uid, "meta", "partnerComment"));
  return snap.exists() ? snap.data() : null;
}
