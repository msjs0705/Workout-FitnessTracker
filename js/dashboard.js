import { requireAuth } from "./auth-guard.js";
import { getWorkouts, getCardio, getBodyWeights, getRestDays, computeRecovery, computeStreak, todayStr, strToDate, formatNice, getPartnerComment } from "./store.js";
import { MUSCLE_GROUPS } from "./exercises-data.js";

requireAuth(async (user) => {
  startClock();

  const [workouts, cardio, weights, restDays, partnerComment] = await Promise.all([
    getWorkouts(user.uid), getCardio(user.uid), getBodyWeights(user.uid), getRestDays(user.uid), getPartnerComment(user.uid)
  ]);
  
  if (partnerComment && partnerComment.timestamp) {
    const lastSeen = localStorage.getItem('lastSeenComment');
    if (!lastSeen || new Date(partnerComment.timestamp) > new Date(lastSeen)) {
      document.getElementById("notifBadge").style.display = "block";
    }
  }

  renderStreak(workouts, cardio, restDays);
  renderRecommendation(workouts);
  renderRecovery(workouts);
  renderWeekStats(workouts, cardio, weights);
  renderFeed(workouts, cardio);
});

function startClock(){
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("dateLine");
  const tick = () => {
    clockEl.textContent = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
  };
  tick();
  setInterval(tick, 15000);
}

function renderStreak(workouts, cardio, restDays = []){
  const streak = computeStreak(workouts, cardio, restDays);
  const badge = document.getElementById("streakBadge");
  if (streak > 0){
    badge.style.display = "inline-flex";
    badge.textContent = `🔥 ${streak} day streak`;
  }
}
let recommendOffset = 0;
let readyMuscles = [];

function renderRecommendation(workouts){
  const rec = computeRecovery(workouts, MUSCLE_GROUPS);
  readyMuscles = Object.entries(rec).filter(([,r]) => r.status === 'ready' || r.status === 'never');
  readyMuscles.sort((a,b) => (b[1].daysSince ?? 999) - (a[1].daysSince ?? 999));
  updateRecommendUI();
}

function updateRecommendUI(){
  const wrap = document.getElementById("recommendWrap");
  if (!readyMuscles.length){
    wrap.innerHTML = `<div class="recommend-card"><div><div class="rc-label">Recovery status</div><div class="rc-muscle">Everything's still recovering</div></div></div>`;
    return;
  }
  
  const top3 = [];
  for (let i = 0; i < Math.min(3, readyMuscles.length); i++) {
    top3.push(readyMuscles[(recommendOffset + i) % readyMuscles.length]);
  }

  const musclesHtml = top3.map(([muscle, info]) => {
    const sub = info.status === 'never' ? "Never trained" : `Trained ${info.daysSince}d ago`;
    return `<div style="flex:1; min-width:80px;"><div class="rc-muscle">${muscle}</div><div class="label" style="text-transform:none; margin-top:4px;">${sub}</div></div>`;
  }).join("");

  wrap.innerHTML = `
    <div class="recommend-card" style="flex-direction:column; align-items:flex-start; gap:12px;">
      <div class="rc-label" style="width:100%; border-bottom:1px solid rgba(154, 90, 34, 0.2); padding-bottom:8px; margin-bottom:2px; display:flex; justify-content:space-between; align-items:center;">
        Recommended today
        <button id="skipRecommendBtn" class="btn btn-ghost btn-sm" style="padding:4px 8px; font-size:10px; height:auto; min-width:auto; color:var(--amber); border-color:rgba(226,114,42,0.3);">Skip ↻</button>
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; width:100%; justify-content:space-between;">
        ${musclesHtml}
      </div>
    </div>`;

  document.getElementById("skipRecommendBtn").addEventListener("click", () => {
    recommendOffset++;
    updateRecommendUI();
  });
}


function renderRecovery(workouts){
  const rec = computeRecovery(workouts, MUSCLE_GROUPS);
  const strip = document.getElementById("recoveryStrip");
  strip.innerHTML = "";
  for (const m of MUSCLE_GROUPS){
    const r = rec[m];
    const status = r.status === 'never' ? 'ready' : r.status;
    const el = document.createElement("div");
    el.className = `gauge ${status}`;
    const dayLabel = r.daysSince === null ? "—" : r.daysSince;
    const statusLabel = r.status === 'never' ? "Never trained" : r.status === 'ready' ? "Ready" : `Due in ${r.target - r.daysSince}d`;
    el.innerHTML = `<div class="muscle-name">${m}</div><div class="days">${dayLabel}</div><div class="status">${statusLabel}</div>`;
    strip.appendChild(el);
  }
}

function renderWeekStats(workouts, cardio, weights){
  const sinceDate = new Date(); sinceDate.setDate(sinceDate.getDate() - 6);
  const weekWorkouts = workouts.filter(w => strToDate(w.dateStr) >= sinceDate);
  const weekCardio = cardio.filter(c => strToDate(c.dateStr) >= sinceDate);
  const totalKm = weekCardio.reduce((s,c) => s + (Number(c.distanceKm)||0), 0);
  const totalSets = weekWorkouts.reduce((s,w) => s + (w.exercises||[]).reduce((s2,e) => s2 + (e.sets||[]).length, 0), 0);
  const latestWeight = weights.length ? weights[weights.length-1].weight : null;

  const tiles = document.querySelectorAll("#weekStats .stat-tile .val");
  // Total active sessions (Workouts + Cardio) - strictly excludes Rest Days
  tiles[0].textContent = weekWorkouts.length + weekCardio.length;
  tiles[1].textContent = totalKm.toFixed(1);
  tiles[2].textContent = totalSets;
  tiles[3].textContent = latestWeight !== null ? latestWeight : "—";
}

function renderFeed(workouts, cardio){
  const items = [
    ...workouts.map(w => ({ kind:'strength', ...w })),
    ...cardio.map(c => ({ kind:'cardio', ...c }))
  ].sort((a,b) => b.dateStr.localeCompare(a.dateStr) || (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)).slice(0,3);

  const feed = document.getElementById("recentFeed");
  if (!items.length){
    feed.innerHTML = `<div class="empty" style="border:none;"><div class="big">No activity yet</div>Log your first workout or run to see it here.</div>`;
    return;
  }
  feed.innerHTML = items.map(it => {
    if (it.kind === 'strength'){
      const muscles = (it.muscles||[]).join(", ");
      const exCount = (it.exercises||[]).length;
      return `<div class="feed-row">
        <div class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7v10M18 7v10M2 10v4M22 10v4M6 12h12"/></svg></div>
        <div class="body">
          <div class="title">${muscles || 'Workout'}</div>
          <div class="meta">${formatNice(it.dateStr)} · ${exCount} exercise${exCount!==1?'s':''}${it.durationMin ? ' · '+it.durationMin+' min' : ''}</div>
        </div>
      </div>`;
    } else {
      return `<div class="feed-row cardio">
        <div class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg></div>
        <div class="body">
          <div class="title">${it.cardioType || 'Cardio'}</div>
          <div class="meta">${formatNice(it.dateStr)} · ${(it.distanceKm||0)} km · ${it.durationMin||0} min</div>
        </div>
      </div>`;
    }
  }).join("");
}
