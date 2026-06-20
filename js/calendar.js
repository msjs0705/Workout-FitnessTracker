import { requireAuth } from "./auth-guard.js";
import { getWorkouts, getCardio, deleteWorkout, deleteCardio, updateWorkout, dateToStr, todayStr, formatNice } from "./store.js";
import { undoableAction } from "./ui.js";

let uid, workouts = [], cardio = [];
let viewDate = new Date(); viewDate.setDate(1);
let openDateStr = null;

requireAuth(async (user) => {
  uid = user.uid;
  [workouts, cardio] = await Promise.all([getWorkouts(uid), getCardio(uid)]);
  renderCalendar();
  document.getElementById("prevMonth").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth()-1); renderCalendar(); });
  document.getElementById("nextMonth").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth()+1); renderCalendar(); });
});

function entryFor(dateStr){
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
    const dots = (entry.strength.length || entry.cardio.length) ? `<div class="dots">${entry.strength.length ? '<span class="dot strength"></span>' : ''}${entry.cardio.length ? '<span class="dot cardio"></span>' : ''}</div>` : '';
    html += `<div class="cal-day ${dateStr===today?'today':''}" data-date="${dateStr}">${day}${dots}</div>`;
  }
  document.getElementById("calDays").innerHTML = html;
  document.querySelectorAll(".cal-day[data-date]").forEach(el => el.addEventListener("click", () => showDay(el.dataset.date)));
  if (openDateStr) showDay(openDateStr);
}

function showDay(dateStr){
  openDateStr = dateStr;
  const entry = entryFor(dateStr);
  const panel = document.getElementById("dayDetail");
  panel.style.display = "block";
  document.getElementById("dayDetailTitle").textContent = formatNice(dateStr);
  const body = document.getElementById("dayDetailBody");

  if (!entry.strength.length && !entry.cardio.length){
    body.innerHTML = `<div class="empty"><div class="big">Rest day</div>Nothing logged on this date.</div>`;
    return;
  }

  let html = "";
  for (const w of entry.strength){
    html += `<div class="exercise-card">
      <div class="ex-head">
        <div><div class="ex-title">${(w.muscles||[]).join(", ") || "Workout"}</div><div class="ex-muscle">${w.durationMin ? w.durationMin+' min' : ''}</div></div>
        <button class="rm-ex" data-action="del-w" data-id="${w.id}" title="Delete entire workout">Delete workout</button>
      </div>
      ${(w.exercises||[]).map((e, exIdx) => `<div class="flex-between" style="margin-bottom:10px;align-items:flex-start;">
        <div>
          <div style="font-weight:600;font-size:13.5px;">${e.name}</div>
          <div class="mono muted" style="font-size:12px;">${(e.sets||[]).map(s=>`${s.weight}kg×${s.reps}`).join("  ·  ")}</div>
        </div>
        <button class="rm-ex" data-action="del-ex" data-wid="${w.id}" data-exidx="${exIdx}" title="Delete just this exercise">✕</button>
      </div>`).join("")}
    </div>`;
  }
  for (const c of entry.cardio){
    html += `<div class="feed-row cardio">
      <div class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg></div>
      <div class="body"><div class="title">${c.cardioType}</div><div class="meta">${c.distanceKm} km · ${c.durationMin} min${c.speedKmh ? ' · '+c.speedKmh+' km/h' : ''}</div></div>
      <button class="rm-ex" data-action="del-c" data-id="${c.id}" title="Delete">✕</button>
    </div>`;
  }
  body.innerHTML = html;

  body.querySelectorAll('[data-action="del-w"]').forEach(b => b.addEventListener("click", () => {
    const idx = workouts.findIndex(w => w.id === b.dataset.id);
    if (idx === -1) return;
    const [removed] = workouts.splice(idx, 1);
    renderCalendar();
    undoableAction("Workout deleted", {
      onUndo: () => { workouts.splice(idx, 0, removed); renderCalendar(); },
      onCommit: () => deleteWorkout(uid, removed.id)
    });
  }));

  body.querySelectorAll('[data-action="del-ex"]').forEach(b => b.addEventListener("click", () => {
    const w = workouts.find(x => x.id === b.dataset.wid);
    if (!w) return;
    const exIdx = Number(b.dataset.exidx);
    const prevExercises = w.exercises, prevMuscles = w.muscles;
    const newExercises = w.exercises.filter((_, i) => i !== exIdx);
    const newMuscles = [...new Set(newExercises.map(e => e.muscle))];
    const willEmpty = !newExercises.length;
    let removedFromList = null;
    w.exercises = newExercises; w.muscles = newMuscles;
    if (willEmpty){
      const idx = workouts.findIndex(x => x.id === w.id);
      if (idx !== -1) [removedFromList] = workouts.splice(idx, 1);
    }
    renderCalendar();
    undoableAction("Exercise deleted", {
      onUndo: () => {
        w.exercises = prevExercises; w.muscles = prevMuscles;
        if (willEmpty && !workouts.find(x => x.id === w.id)) workouts.push(removedFromList || w);
        renderCalendar();
      },
      onCommit: async () => {
        if (willEmpty) await deleteWorkout(uid, w.id);
        else await updateWorkout(uid, w.id, { exercises: newExercises, muscles: newMuscles });
      }
    });
  }));

  body.querySelectorAll('[data-action="del-c"]').forEach(b => b.addEventListener("click", () => {
    const idx = cardio.findIndex(c => c.id === b.dataset.id);
    if (idx === -1) return;
    const [removed] = cardio.splice(idx, 1);
    renderCalendar();
    undoableAction("Cardio session deleted", {
      onUndo: () => { cardio.splice(idx, 0, removed); renderCalendar(); },
      onCommit: () => deleteCardio(uid, removed.id)
    });
  }));
}
