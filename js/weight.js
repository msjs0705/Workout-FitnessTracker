import { requireAuth } from "./auth-guard.js";
import { setBodyWeight, getBodyWeights, todayStr, formatNice } from "./store.js";
import { toast } from "./ui.js";

let uid, chart;

requireAuth(async (user) => {
  uid = user.uid;
  document.getElementById("dateInput").value = todayStr();
  document.getElementById("saveBtn").addEventListener("click", onSave);
  await refresh();
});

async function onSave(){
  const dateStr = document.getElementById("dateInput").value || todayStr();
  const w = document.getElementById("weightInput").value;
  if (!w || Number(w) <= 0){ toast("Enter a valid weight"); return; }
  const btn = document.getElementById("saveBtn");
  btn.disabled = true;
  try {
    await setBodyWeight(uid, dateStr, w);
    toast("Weight saved");
    document.getElementById("weightInput").value = "";
    await refresh();
  } catch(e){ toast("Couldn't save — check connection"); }
  btn.disabled = false;
}

async function refresh(){
  const weights = await getBodyWeights(uid); // ascending by date
  renderChart(weights);
  renderHistory(weights);
}

function renderChart(weights){
  const ctx = document.getElementById("weightChart");
  const last = weights.slice(-60); // last 60 entries keeps the chart readable
  const data = {
    labels: last.map(w => formatNice(w.dateStr)),
    datasets: [{
      label: "Weight (kg)",
      data: last.map(w => w.weight),
      borderColor: "#E2722A",
      backgroundColor: "rgba(226,114,42,0.12)",
      pointBackgroundColor: "#1B2128",
      pointRadius: 3,
      tension: 0.3,
      fill: true
    }]
  };
  if (chart) { chart.data = data; chart.update(); return; }
  chart = new Chart(ctx, {
    type: "line",
    data,
    options: {
      responsive: true,
      plugins: { legend: { display:false } },
      scales: {
        x: { ticks: { maxTicksLimit: 6, font: { family:"IBM Plex Mono", size:10 } }, grid: { display:false } },
        y: { ticks: { font: { family:"IBM Plex Mono", size:10 } }, grid: { color:"#E1DDD2" } }
      }
    }
  });
}

function renderHistory(weights){
  const wrap = document.getElementById("weightHistory");
  const recent = [...weights].reverse().slice(0, 14);
  if (!recent.length){
    wrap.innerHTML = `<div class="empty" style="border:none;"><div class="big">No entries yet</div>Log today's weight above to start your trend.</div>`;
    return;
  }
  wrap.innerHTML = recent.map((w, i) => {
    const prev = recent[i+1];
    let diff = "";
    if (prev) {
      const d = +(w.weight - prev.weight).toFixed(1);
      diff = d === 0 ? `<span class="muted mono">±0</span>` : d > 0 ? `<span class="mono" style="color:var(--red)">+${d}</span>` : `<span class="mono" style="color:var(--teal)">${d}</span>`;
    }
    return `<div class="feed-row">
      <div class="body"><div class="title">${w.weight} kg</div><div class="meta">${formatNice(w.dateStr)}</div></div>
      ${diff}
    </div>`;
  }).join("");
}
