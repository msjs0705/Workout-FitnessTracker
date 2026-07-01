import { requireAuth } from "./auth-guard.js";
import { getWorkouts, getCardio, getPRs, getRestDays, strToDate, dateToStr, computeStreak } from "./store.js";
import { MUSCLE_GROUPS } from "./exercises-data.js";

const MUSCLE_COLORS = {
  Chest:"#E2722A", Back:"#1F9E83", Shoulder:"#C9A227", Bicep:"#5B8FE2",
  Tricep:"#C84B3B", Legs:"#1B2128", Forearm:"#9A7FC9", Abs:"#56B6A8"
};

requireAuth(async (user) => {
  const uid = user.uid;
  const [workouts, cardio, prs, restDays] = await Promise.all([getWorkouts(uid), getCardio(uid), getPRs(uid), getRestDays(uid)]);
  renderStreak(workouts, cardio, restDays);
  renderHeatmap(workouts, cardio, restDays);
  renderCardioChart(cardio);
  renderMuscleChart(workouts);
  renderPRs(prs,workouts);
});

function renderStreak(workouts, cardio, restDays = []){
  const streak = computeStreak(workouts, cardio, restDays);
  document.getElementById("streakLabel").textContent = streak > 0 ? `🔥 ${streak} day streak` : "";
}

function renderHeatmap(workouts, cardio, restDays = []){
  const flags = {};
  for (const w of workouts) flags[w.dateStr] = (flags[w.dateStr]||0) | 1;
  for (const c of cardio) flags[c.dateStr] = (flags[c.dateStr]||0) | 2;
  for (const r of restDays) flags[r] = flags[r] || 3; // gold = rest day
  const totalDays = 98;
  const today = new Date();
  let html = "";
  for (let i = totalDays - 1; i >= 0; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = dateToStr(d);
    html += `<div class="heat-cell level-${flags[ds]||0}" title="${ds}"></div>`;
  }
  document.getElementById("heatmap").innerHTML = html;
}

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
  for (const w of workouts) for (const m of (w.muscles||[])) counts[m] = (counts[m]||0) + 1;
  const labels = MUSCLE_GROUPS.filter(m => counts[m]);
  const wrap = document.getElementById("muscleChart").parentElement.parentElement;
  if (!labels.length){
    wrap.innerHTML = `<div class="empty" style="border:none;width:100%;"><div class="big">No workouts logged yet</div>Log a workout to see your muscle split.</div>`;
    return;
  }
  new Chart(document.getElementById("muscleChart"), {
    type: "doughnut",
    data: { labels, datasets: [{ data: labels.map(m => counts[m]), backgroundColor: labels.map(m => MUSCLE_COLORS[m]) }] },
    options: {
      plugins: {
        legend: { position:"bottom", labels: { font: { family:"Inter", size:11 }, boxWidth:10, padding:12 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}x` } }
      }
    }
  });
}

function renderPRs(prs, workouts){
  const wrap = document.getElementById("prList");
  const entries = Object.entries(prs).map(([id, data]) => ({ id, ...data })).sort((a,b) => a.exerciseName.localeCompare(b.exerciseName));

  if (!entries.length){
    wrap.innerHTML = `<div class="empty" style="border:none;"><div class="big">No PRs yet</div>Log a few workouts and your records will show up here.</div>`;
    return;
  }

  // Calculate historical progression for all exercises
  const exerciseMap = {}; 
  for (const w of [...workouts].reverse()){
    for (const e of (w.exercises||[])){
      const maxW = Math.max(...(e.sets||[]).map(s => Number(s.weight)||0), 0);
      if (!maxW) continue;
      if (!exerciseMap[e.exerciseId]) exerciseMap[e.exerciseId] = { points: [] };
      exerciseMap[e.exerciseId].points.push({ dateStr: w.dateStr, maxWeight: maxW });
    }
  }

  // Render rows with hidden canvas containers
  wrap.innerHTML = entries.map(e => `
    <div class="pr-row-container" style="border-bottom: 1px solid var(--line);">
      <div class="feed-row pr-row" data-id="${e.id}" style="border-bottom:none; cursor:pointer; padding: 14px 4px;">
        <div class="body">
          <div class="title" style="display:flex; justify-content:space-between; align-items:center;">
            ${e.exerciseName}
            <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-faint); transition: transform 0.2s;"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="meta">est. 1RM ${e.est1rm.toFixed(1)} kg · ${e.dateStr}</div>
        </div>
        <div class="pill gold" style="margin:0 0 0 10px;">${e.maxWeight} kg</div>
      </div>
      <div class="pr-chart-wrap" id="chart-wrap-${e.id}" style="display:none; padding: 0 4px 16px 4px;">
        <div style="height: 180px; width: 100%; position: relative;">
           <canvas id="canvas-${e.id}"></canvas>
        </div>
      </div>
    </div>
  `).join("");

  // Manage click state and chart rendering
  let activeChart = null;
  let activeId = null;

  wrap.querySelectorAll(".pr-row").forEach(row => {
    row.addEventListener("click", () => {
      const id = row.dataset.id;
      const wrapDiv = document.getElementById(`chart-wrap-${id}`);
      const chevron = row.querySelector(".chevron");

      if (activeId === id) {
         wrapDiv.style.display = "none";
         chevron.style.transform = "rotate(0deg)";
         activeId = null;
         return;
      }

      if (activeId) {
         document.getElementById(`chart-wrap-${activeId}`).style.display = "none";
         document.querySelector(`.pr-row[data-id="${activeId}"] .chevron`).style.transform = "rotate(0deg)";
      }

      wrapDiv.style.display = "block";
      chevron.style.transform = "rotate(180deg)";
      activeId = id;

      if (activeChart) { activeChart.destroy(); }
      
      const ctx = document.getElementById(`canvas-${id}`);
      const data = exerciseMap[id];
      if (!data || !data.points.length) return;

      activeChart = new Chart(ctx, {
        type:"line", 
        data: {
          labels: data.points.map(p => p.dateStr),
          datasets: [{ 
            label:"Top weight (kg)", 
            data: data.points.map(p => p.maxWeight), 
            borderColor:"#C9A227", 
            backgroundColor:"rgba(201,162,39,0.12)", 
            pointBackgroundColor:"#1B2128", 
            tension:0.25, 
            fill:true 
          }]
        },
        options: { 
          responsive: true,
          maintainAspectRatio: false,
          plugins:{ legend:{ display:false } }, 
          scales: {
            x: { ticks:{ font:{family:"IBM Plex Mono", size:10}, maxTicksLimit:6 }, grid:{display:false} },
            y: { ticks:{ font:{family:"IBM Plex Mono", size:10} }, grid:{color:"#E1DDD2"} }
          }
        }
      });
    });
  });
}
