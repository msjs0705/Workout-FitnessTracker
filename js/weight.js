import { requireAuth } from "./auth-guard.js";
import { setBodyWeight, getBodyWeights, deleteBodyWeight, todayStr, formatNice } from "./store.js";
import { toast, undoableAction } from "./ui.js";

let uid, chart, cache = [];

requireAuth(async (user) => {
  uid = user.uid;
  document.getElementById("dateInput").value = todayStr();
  document.getElementById("saveBtn").addEventListener("click", onSave);
  cache = await getBodyWeights(uid);
  renderAll();
});

function renderAll(){
  renderChart(cache);
  renderHistory(cache);
  setSynced();
}

function setSynced(){
  const el = document.getElementById("lastSynced");
  if (el) el.textContent = `Last synced ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
}

async function onSave(){
  const dateStr = document.getElementById("dateInput").value || todayStr();
  const w = document.getElementById("weightInput").value;
  if (!w || Number(w) <= 0){ toast("Enter a valid weight"); return; }
  const btn = document.getElementById("saveBtn");
  btn.disabled = true;
  try {
    await setBodyWeight(uid, dateStr, w);
    const idx = cache.findIndex(x => x.dateStr === dateStr);
    const entry = { dateStr, weight: Number(w) };
    if (idx >= 0) cache[idx] = entry; else { cache.push(entry); cache.sort((a,b) => a.dateStr.localeCompare(b.dateStr)); }
    toast("Weight saved");
    document.getElementById("weightInput").value = "";
    renderAll();
  } catch(e){ toast("Couldn't save — check connection"); }
  btn.disabled = false;
}

function renderChart(weights){
  const ctx = document.getElementById("weightChart");
  const last = weights.slice(-60);
  const data = {
    labels: last.map(w => formatNice(w.dateStr)),
    datasets: [{ label:"Weight (kg)", data: last.map(w => w.weight), borderColor:"#E2722A", backgroundColor:"rgba(226,114,42,0.12)", pointBackgroundColor:"#1B2128", pointRadius:3, tension:0.3, fill:true }]
  };
  if (chart) { chart.data = data; chart.update(); return; }
  chart = new Chart(ctx, {
    type: "line", data,
    options: {
      responsive: true, plugins: { legend: { display:false } },
      scales: {
        x: { ticks: { maxTicksLimit:6, font: { family:"IBM Plex Mono", size:10 } }, grid: { display:false } },
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
      <button class="rm-ex" data-date="${w.dateStr}" title="Delete this entry" style="margin-left:10px;">✕</button>
    </div>`;
  }).join("");
  wrap.querySelectorAll("[data-date]").forEach(b => b.addEventListener("click", () => {
    const dateStr = b.dataset.date;
    const idx = cache.findIndex(x => x.dateStr === dateStr);
    if (idx === -1) return;
    const [removed] = cache.splice(idx, 1);
    renderAll();
    undoableAction("Weight entry deleted", {
      onUndo: () => { cache.splice(idx, 0, removed); renderAll(); },
      onCommit: () => deleteBodyWeight(uid, dateStr)
    });
  }));
}
