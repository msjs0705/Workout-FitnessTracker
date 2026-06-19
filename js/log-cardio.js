import { requireAuth } from "./auth-guard.js";
import { addCardio, getCardio, deleteCardio, todayStr, formatNice } from "./store.js";
import { toast } from "./ui.js";

let uid;

requireAuth(async (user) => {
  uid = user.uid;
  document.getElementById("dateInput").value = todayStr();

  const dur = document.getElementById("duration"), dist = document.getElementById("distance");
  [dur, dist].forEach(el => el.addEventListener("input", updateSpeed));

  document.getElementById("saveBtn").addEventListener("click", onSave);
  await renderRecent();
});

function updateSpeed(){
  const mins = Number(document.getElementById("duration").value);
  const km = Number(document.getElementById("distance").value);
  const lbl = document.getElementById("speedLabel");
  if (mins > 0 && km > 0){
    const speedKmh = km / (mins/60);
    const paceMinPerKm = mins / km;
    const paceMin = Math.floor(paceMinPerKm), paceSec = Math.round((paceMinPerKm - paceMin) * 60);
    lbl.textContent = `Pace / speed: ${speedKmh.toFixed(1)} km/h · ${paceMin}:${String(paceSec).padStart(2,'0')} /km`;
  } else {
    lbl.textContent = "Pace / speed: —";
  }
}

async function onSave(){
  const dateStr = document.getElementById("dateInput").value || todayStr();
  const cardioType = document.getElementById("cardioType").value;
  const durationMin = Number(document.getElementById("duration").value) || 0;
  const distanceKm = Number(document.getElementById("distance").value) || 0;
  if (!durationMin && !distanceKm){ toast("Add a duration or distance"); return; }
  const speedKmh = (durationMin && distanceKm) ? +(distanceKm / (durationMin/60)).toFixed(2) : null;

  const btn = document.getElementById("saveBtn");
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    await addCardio(uid, { dateStr, cardioType, durationMin, distanceKm, speedKmh });
    toast("Cardio session saved");
    document.getElementById("duration").value = "";
    document.getElementById("distance").value = "";
    updateSpeed();
    await renderRecent();
  } catch(e){
    toast("Couldn't save — check connection");
  }
  btn.disabled = false; btn.textContent = "Save cardio session";
}

async function renderRecent(){
  const all = await getCardio(uid);
  const recent = all.slice(0, 8);
  const wrap = document.getElementById("recentCardio");
  if (!recent.length){
    wrap.innerHTML = `<div class="empty" style="border:none;"><div class="big">No cardio logged yet</div>Your sessions will show up here.</div>`;
    return;
  }
  wrap.innerHTML = recent.map(c => `
    <div class="feed-row cardio">
      <div class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg></div>
      <div class="body">
        <div class="title">${c.cardioType}</div>
        <div class="meta">${formatNice(c.dateStr)} · ${c.distanceKm} km · ${c.durationMin} min${c.speedKmh ? ' · '+c.speedKmh+' km/h' : ''}</div>
      </div>
      <button class="rm-ex" data-id="${c.id}" title="Delete">✕</button>
    </div>
  `).join("");
  wrap.querySelectorAll("[data-id]").forEach(b => b.addEventListener("click", async () => {
    await deleteCardio(uid, b.dataset.id);
    toast("Deleted");
    renderRecent();
  }));
}
