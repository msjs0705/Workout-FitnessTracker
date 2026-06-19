import { requireAuth } from "./auth-guard.js";
import { getWorkouts, getCardio, getPRs, strToDate, dateToStr } from "./store.js";
import { MUSCLE_GROUPS } from "./exercises-data.js";

const MUSCLE_COLORS = {
  Chest:"#E2722A", Back:"#1F9E83", Shoulder:"#C9A227", Bicep:"#5B8FE2",
  Tricep:"#C84B3B", Legs:"#1B2128", Forearm:"#9A7FC9", Abs:"#56B6A8"
};

requireAuth(async (user) => {
  const uid = user.uid;
  const [workouts, cardio, prs] = await Promise.all([getWorkouts(uid), getCardio(uid), getPRs(uid)]);

  renderCardioChart(cardio);
  renderMuscleChart(workouts);
  renderProgression(workouts);
  renderPRs(prs);
});

function isoWeekKey(dateStr){
  const d = strToDate(dateStr);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

function renderCardioChart(cardio){
  const byWeek = {};
  for (const c of cardio){
    const key = isoWeekKey(c.dateStr);
    byWeek[key] = (byWeek[key] || 0) + (Number(c.distanceKm) || 0);
  }
  const weeks = Object.keys(byWeek).sort().slice(-12);
  new Chart(document.getElementById("cardioChart"), {
    type: "bar",
    data: { labels: weeks, datasets: [{ label:"km", data: weeks.map(w => +byWeek[w].toFixed(1)), backgroundColor: "#1F9E83", borderRadius: 6 }] },
    options: {
      plugins: { legend: { display:false } },
      scales: {
        x: { ticks: { font:{ family:"IBM Plex Mono", size:10 } }, grid: { display:false } },
        y: { ticks: { font:{ family:"IBM Plex Mono", size:10 } }, grid: { color:"#E1DDD2" } }
      }
    }
  });
  if (!weeks.length){
    document.getElementById("cardioChart").parentElement.insertAdjacentHTML("beforeend", `<div class="empty mt-16" style="border:none;">No cardio logged yet.</div>`);
  }
}

function renderMuscleChart(workouts){
  const counts = {};
  for (const w of workouts) for (const e of (w.exercises||[])) counts[e.muscle] = (counts[e.muscle]||0) + (e.sets||[]).length;
  const labels = MUSCLE_GROUPS.filter(m => counts[m]);
  const wrap = document.getElementById("muscleChart").parentElement.parentElement;
  if (!labels.length){
    wrap.innerHTML = `<div class="empty" style="border:none;width:100%;"><div class="big">No sets logged yet</div>Log a workout to see your muscle split.</div>`;
    return;
  }
  new Chart(document.getElementById("muscleChart"), {
    type: "doughnut",
    data: { labels, datasets: [{ data: labels.map(m => counts[m]), backgroundColor: labels.map(m => MUSCLE_COLORS[m]) }] },
    options: { plugins: { legend: { position:"bottom", labels: { font: { family:"Inter", size:11 }, boxWidth:10, padding:12 } } } }
  });
}

let progressChart;
function renderProgression(workouts){
  const sel = document.getElementById("progressExercise");
  const exerciseMap = {}; // id -> { name, points: [{dateStr, maxWeight}] }
  for (const w of [...workouts].reverse()){ // ascending date order for the chart
    for (const e of (w.exercises||[])){
      const maxW = Math.max(...(e.sets||[]).map(s => Number(s.weight)||0), 0);
      if (!maxW) continue;
      if (!exerciseMap[e.exerciseId]) exerciseMap[e.exerciseId] = { name: e.name, points: [] };
      exerciseMap[e.exerciseId].points.push({ dateStr: w.dateStr, maxWeight: maxW });
    }
  }
  const ids = Object.keys(exerciseMap).sort((a,b) => exerciseMap[a].name.localeCompare(exerciseMap[b].name));
  if (!ids.length){
    sel.style.display = "none";
    document.getElementById("progressChart").parentElement.insertAdjacentHTML("beforeend", `<div class="empty" style="border:none;">No exercise data yet.</div>`);
    return;
  }
  sel.innerHTML = ids.map(id => `<option value="${id}">${exerciseMap[id].name}</option>`).join("");
  sel.addEventListener("change", () => draw(sel.value));
  draw(ids[0]);

  function draw(id){
    const data = exerciseMap[id];
    const ctx = document.getElementById("progressChart");
    const chartData = {
      labels: data.points.map(p => p.dateStr),
      datasets: [{ label:"Top weight (kg)", data: data.points.map(p => p.maxWeight), borderColor:"#E2722A", backgroundColor:"rgba(226,114,42,0.12)", pointBackgroundColor:"#1B2128", tension:0.25, fill:true }]
    };
    if (progressChart){ progressChart.data = chartData; progressChart.update(); return; }
    progressChart = new Chart(ctx, {
      type:"line", data: chartData,
      options: { plugins:{ legend:{ display:false } }, scales: {
        x: { ticks:{ font:{family:"IBM Plex Mono", size:10}, maxTicksLimit:6 }, grid:{display:false} },
        y: { ticks:{ font:{family:"IBM Plex Mono", size:10} }, grid:{color:"#E1DDD2"} }
      }}
    });
  }
}

function renderPRs(prs){
  const wrap = document.getElementById("prList");
  const entries = Object.values(prs).sort((a,b) => a.exerciseName.localeCompare(b.exerciseName));
  if (!entries.length){
    wrap.innerHTML = `<div class="empty" style="border:none;"><div class="big">No PRs yet</div>Log a few workouts and your records will show up here.</div>`;
    return;
  }
  wrap.innerHTML = entries.map(e => `
    <div class="feed-row">
      <div class="body"><div class="title">${e.exerciseName}</div><div class="meta">est. 1RM ${e.est1rm.toFixed(1)} kg · ${e.dateStr}</div></div>
      <div class="pill gold">${e.maxWeight} kg</div>
    </div>
  `).join("");
}
