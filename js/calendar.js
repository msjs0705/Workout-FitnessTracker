import { requireAuth } from "./auth-guard.js";
import { getWorkouts, getCardio, deleteWorkout, deleteCardio, dateToStr, todayStr, formatNice } from "./store.js";
import { toast } from "./ui.js";

let uid, workouts = [], cardio = [];
let viewDate = new Date(); viewDate.setDate(1);

requireAuth(async (user) => {
  uid = user.uid;
  [workouts, cardio] = await Promise.all([getWorkouts(uid), getCardio(uid)]);
  renderCalendar();
  document.getElementById("prevMonth").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth()-1); renderCalendar(); });
  document.getElementById("nextMonth").addEventListener("click", () => { viewDate.setMonth(viewDate.getMonth()+1); renderCalendar(); });
});

function renderCalendar(){
  document.getElementById("monthLabel").textContent = viewDate.toLocaleDateString('en-US', { month:'long', year:'numeric' });
  const dow = document.getElementById("calDow");
  dow.innerHTML = ["S","M","T","W","T","F","S"].map(d => `<div class="cal-dow">${d}</div>`).join("");

  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = todayStr();

  const byDate = {};
  for (const w of workouts) (byDate[w.dateStr] = byDate[w.dateStr] || {strength:[],cardio:[]}).strength.push(w);
  for (const c of cardio) (byDate[c.dateStr] = byDate[c.dateStr] || {strength:[],cardio:[]}).cardio.push(c);

  let html = "";
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++){
    const dateStr = dateToStr(new Date(year, month, day));
    const entry = byDate[dateStr];
    const dots = entry ? `<div class="dots">${entry.strength.length ? '<span class="dot strength"></span>' : ''}${entry.cardio.length ? '<span class="dot cardio"></span>' : ''}</div>` : '';
    html += `<div class="cal-day ${dateStr===today?'today':''}" data-date="${dateStr}">${day}${dots}</div>`;
  }
  document.getElementById("calDays").innerHTML = html;

  document.querySelectorAll(".cal-day[data-date]").forEach(el => el.addEventListener("click", () => showDay(el.dataset.date, byDate[el.dataset.date])));
}

function showDay(dateStr, entry){
  const panel = document.getElementById("dayDetail");
  panel.style.display = "block";
  document.getElementById("dayDetailTitle").textContent = formatNice(dateStr);
  const body = document.getElementById("dayDetailBody");

  if (!entry || (!entry.strength.length && !entry.cardio.length)){
    body.innerHTML = `<div class="empty"><div class="big">Rest day</div>Nothing logged on this date.</div>`;
    return;
  }

  let html = "";
  for (const w of entry.strength){
    html += `<div class="exercise-card">
      <div class="ex-head">
        <div><div class="ex-title">${(w.muscles||[]).join(", ") || "Workout"}</div><div class="ex-muscle">${w.durationMin ? w.durationMin+' min' : ''}</div></div>
        <button class="rm-ex" data-action="del-w" data-id="${w.id}">✕</button>
      </div>
      ${(w.exercises||[]).map(e => `<div style="margin-bottom:8px;">
        <div style="font-weight:600;font-size:13.5px;">${e.name}</div>
        <div class="mono muted" style="font-size:12px;">${(e.sets||[]).map(s=>`${s.weight}kg×${s.reps}`).join("  ·  ")}</div>
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

  body.querySelectorAll('[data-action="del-w"]').forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this workout?")) return;
    await deleteWorkout(uid, b.dataset.id);
    workouts = workouts.filter(w => w.id !== b.dataset.id);
    toast("Deleted"); renderCalendar(); panel.style.display = "none";
  }));
  body.querySelectorAll('[data-action="del-c"]').forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Delete this cardio session?")) return;
    await deleteCardio(uid, b.dataset.id);
    cardio = cardio.filter(c => c.id !== b.dataset.id);
    toast("Deleted"); renderCalendar(); panel.style.display = "none";
  }));
}
