import { requireAuth } from "./auth-guard.js";
import { getWorkoutsByMonth, getCardioByMonth, getRestDays,
  setRestDay, deleteRestDay,
  deleteWorkout, deleteCardio, updateWorkout,
  dateToStr, todayStr, formatNice } from "./store.js";
import { undoableAction } from "./ui.js";

let uid;
let viewDate = new Date(); viewDate.setDate(1);
let openDateStr = null;
let allRestDays = new Set(); // dateStr strings, all-time
// Cache fetched months so navigating back doesn't re-fetch
const monthCache = {}; // key "YYYY-MM" -> { workouts, cardio }

requireAuth(async (user) => {
  uid = user.uid;
  const rds = await getRestDays(uid);
  allRestDays = new Set(rds);
  await loadMonth();
  document.getElementById("prevMonth").addEventListener("click", async () => {
    viewDate.setMonth(viewDate.getMonth()-1);
    await loadMonth();
  });
  document.getElementById("nextMonth").addEventListener("click", async () => {
    viewDate.setMonth(viewDate.getMonth()+1);
    await loadMonth();
  });
});

function monthKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

async function loadMonth(){
  const key = monthKey(viewDate);
  showLoading(true);
  if (!monthCache[key]){
    const [workouts, cardio] = await Promise.all([
      getWorkoutsByMonth(uid, viewDate.getFullYear(), viewDate.getMonth()),
      getCardioByMonth(uid, viewDate.getFullYear(), viewDate.getMonth())
    ]);
    monthCache[key] = { workouts, cardio };
  }
  showLoading(false);
  renderCalendar();
  if (openDateStr) showDay(openDateStr);
}

function showLoading(on){
  let el = document.getElementById("calLoading");
  if (!el){
    el = document.createElement("div");
    el.id = "calLoading";
    el.className = "muted center";
    el.style.cssText = "padding:18px 0;font-size:13px;";
    el.textContent = "Loading…";
    document.getElementById("calDays").before(el);
  }
  el.style.display = on ? "block" : "none";
  document.getElementById("calDays").style.display = on ? "none" : "grid";
}

function current(){ return monthCache[monthKey(viewDate)] || { workouts:[], cardio:[] }; }

function entryFor(dateStr){
  const { workouts, cardio } = current();
  return { strength: workouts.filter(w => w.dateStr === dateStr), cardio: cardio.filter(c => c.dateStr === dateStr) };
}

function renderCalendar(){
  document.getElementById("monthLabel").textContent = viewDate.toLocaleDateString('en-US', { month:'long', year:'numeric' });
  const dow = document.getElementById("calDow");
  dow.innerHTML = ["S","M","T","W","T","F","S"].map(d => `<div class="cal-dow">${d}</div>`).join("");

  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = todayStr();

  let html = "";
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++){
    const dateStr = dateToStr(new Date(year, month, day));
    const entry = entryFor(dateStr);
    const isRestDay = allRestDays.has(dateStr);
    const hasWorkout = entry.strength.length > 0;
    const hasCardio = entry.cardio.length > 0;
    const muscles = hasWorkout ? [...new Set(entry.strength.flatMap(w => w.muscles||[]))].join(", ") : "";
    const cardioIndicator = hasCardio ? `<div class="cal-cardio-dot"></div>` : "";
    const muscleLabel = muscles ? `<div class="cal-muscles">${muscles}</div>` : "";
    const restLabel = isRestDay && !hasWorkout ? `<div class="cal-muscles" style="color:var(--teal);">Rest</div>` : "";
    html += `<div class="cal-day ${dateStr===today?'today':''} ${hasWorkout?'has-workout':''} ${isRestDay && !hasWorkout ? 'is-rest' : ''}" data-date="${dateStr}">
      <div class="cal-num">${day}</div>
      ${muscleLabel}${restLabel}
      ${cardioIndicator}
    </div>`;
  }
  document.getElementById("calDays").innerHTML = html;
  document.querySelectorAll(".cal-day[data-date]").forEach(el => el.addEventListener("click", () => showDay(el.dataset.date)));
}

function showDay(dateStr){
  openDateStr = dateStr;
  const entry = entryFor(dateStr);
  const panel = document.getElementById("dayDetail");
  panel.style.display = "block";
  document.getElementById("dayDetailTitle").textContent = formatNice(dateStr);
  const body = document.getElementById("dayDetailBody");
  const isRest = allRestDays.has(dateStr);
  const restBtn = document.getElementById("restDayBtn");
  restBtn.textContent = isRest ? "✕ Remove rest day" : "＋ Mark as rest day";
  restBtn.style.background = isRest ? "var(--red-dim)" : "var(--teal-dim)";
  restBtn.style.color = isRest ? "var(--red)" : "var(--teal)";
  restBtn.onclick = async () => {
    if (allRestDays.has(dateStr)){
      await deleteRestDay(uid, dateStr);
      allRestDays.delete(dateStr);
    } else {
      await setRestDay(uid, dateStr);
      allRestDays.add(dateStr);
    }
    renderCalendar();
    showDay(dateStr);
  };
  if (!entry.strength.length && !entry.cardio.length){
    body.innerHTML = `<div class="empty"><div class="big">Rest day</div>Nothing logged on this date.</div>`;
    return;
  }

  let html = "";
  for (const w of entry.strength){
    html += `<div class="exercise-card">
      <div class="ex-head">
        <div><div class="ex-title">${(w.muscles||[]).join(", ") || "Workout"}</div><div class="ex-muscle">${w.durationMin ? w.durationMin+' min' : ''}</div></div>
        <button class="rm-ex" data-action="del-w" data-id="${w.id}">Delete workout</button>
      </div>
      ${(w.exercises||[]).map((e, exIdx) => `<div class="flex-between" style="margin-bottom:10px;align-items:flex-start;">
        <div>
          <div style="font-weight:600;font-size:13.5px;">${e.name}</div>
          <div class="mono muted" style="font-size:12px;">${(e.sets||[]).map(s=>`${s.weight}kg×${s.reps}`).join("  ·  ")}</div>
        </div>
        <button class="rm-ex" data-action="del-ex" data-wid="${w.id}" data-exidx="${exIdx}">✕</button>
      </div>`).join("")}
    </div>`;
  }
  for (const c of entry.cardio){
    html += `<div class="feed-row cardio">
      <div class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg></div>
      <div class="body"><div class="title">${c.cardioType}</div><div class="meta">${c.distanceKm} km · ${c.durationMin} min${c.speedKmh ? ' · '+c.speedKmh+' km/h' : ''}</div></div>
      <button class="rm-ex" data-action="del-c" data-id="${c.id}">✕</button>
    </div>`;
  }
  body.innerHTML = html;

  body.querySelectorAll('[data-action="del-w"]').forEach(b => b.addEventListener("click", () => {
    const key = monthKey(viewDate);
    const arr = monthCache[key].workouts;
    const idx = arr.findIndex(w => w.id === b.dataset.id);
    if (idx === -1) return;
    const [removed] = arr.splice(idx, 1);
    renderCalendar(); showDay(dateStr);
    undoableAction("Workout deleted", {
      onUndo: () => { arr.splice(idx, 0, removed); renderCalendar(); showDay(dateStr); },
      onCommit: () => deleteWorkout(uid, removed.id)
    });
  }));

  body.querySelectorAll('[data-action="del-ex"]').forEach(b => b.addEventListener("click", () => {
    const key = monthKey(viewDate);
    const arr = monthCache[key].workouts;
    const w = arr.find(x => x.id === b.dataset.wid);
    if (!w) return;
    const exIdx = Number(b.dataset.exidx);
    const prevExercises = [...w.exercises], prevMuscles = [...(w.muscles||[])];
    const newExercises = w.exercises.filter((_, i) => i !== exIdx);
    const newMuscles = [...new Set(newExercises.map(e => e.muscle))];
    const willEmpty = !newExercises.length;
    let removedWorkout = null;
    w.exercises = newExercises; w.muscles = newMuscles;
    if (willEmpty){ const i = arr.indexOf(w); if (i>-1) [removedWorkout] = arr.splice(i,1); }
    renderCalendar(); showDay(dateStr);
    undoableAction("Exercise deleted", {
      onUndo: () => {
        w.exercises = prevExercises; w.muscles = prevMuscles;
        if (willEmpty && !arr.find(x => x.id === w.id)) arr.push(removedWorkout || w);
        renderCalendar(); showDay(dateStr);
      },
      onCommit: async () => {
        if (willEmpty) await deleteWorkout(uid, w.id);
        else await updateWorkout(uid, w.id, { exercises: newExercises, muscles: newMuscles });
      }
    });
  }));

  body.querySelectorAll('[data-action="del-c"]').forEach(b => b.addEventListener("click", () => {
    const key = monthKey(viewDate);
    const arr = monthCache[key].cardio;
    const idx = arr.findIndex(c => c.id === b.dataset.id);
    if (idx === -1) return;
    const [removed] = arr.splice(idx, 1);
    renderCalendar(); showDay(dateStr);
    undoableAction("Cardio session deleted", {
      onUndo: () => { arr.splice(idx, 0, removed); renderCalendar(); showDay(dateStr); },
      onCommit: () => deleteCardio(uid, removed.id)
    });
  }));
}
