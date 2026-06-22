import { requireAuth } from "./auth-guard.js";
import {
  getExercises, addWorkout, getLastPerformance, getWorkouts, todayStr,
  saveDraftWorkout, getDraftWorkout, clearDraftWorkout
} from "./store.js";
import { MUSCLE_GROUPS } from "./exercises-data.js";
import { toast } from "./ui.js";

let uid, exercises = [];
let selectedMuscles = new Set();
let addedExercises = []; // { exerciseId, name, muscle, sets: [{weight,reps}], prev }
let isLoaded = false;
let autosaveTimer = null;
let saveStatusEl;

requireAuth(async (user) => {
  uid = user.uid;
  saveStatusEl = document.getElementById("saveStatus");

  exercises = await getExercises(uid);
  renderMuscleChips();
  wireTimeInputs();
  wireDropdown();

  await loadDraftIfAny();

  document.getElementById("repeatLastBtn").addEventListener("click", onRepeatLast);
  document.getElementById("saveBtn").addEventListener("click", onFinalize);
  document.getElementById("discardBtn").addEventListener("click", onDiscard);
  document.getElementById("dateInput").addEventListener("change", scheduleAutosave);
  document.getElementById("startTime").addEventListener("change", scheduleAutosave);
  document.getElementById("endTime").addEventListener("change", scheduleAutosave);

  isLoaded = true;
});

// ---------- draft load/save ----------
async function loadDraftIfAny(){
  const draft = await getDraftWorkout(uid);
  if (!draft || !draft.exercises || !draft.exercises.length){
    document.getElementById("dateInput").value = todayStr();
    return;
  }
  document.getElementById("dateInput").value = draft.dateStr || todayStr();
  document.getElementById("startTime").value = draft.startTime || "";
  document.getElementById("endTime").value = draft.endTime || "";
  selectedMuscles = new Set(draft.muscles || []);
  syncMuscleChipUI();

  addedExercises = await Promise.all(draft.exercises.map(async (e) => ({
    ...e, prev: await getLastPerformance(uid, e.exerciseId)
  })));
  renderExerciseList();
  document.getElementById("draftBanner").style.display = "flex";
}

function scheduleAutosave(){
  if (!isLoaded) return;
  setSaveStatus("Saving…");
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(doAutosave, 600);
}

async function doAutosave(){
  if (!addedExercises.length){ setSaveStatus(""); return; }
  try {
    await saveDraftWorkout(uid, {
      dateStr: document.getElementById("dateInput").value || todayStr(),
      startTime: document.getElementById("startTime").value || null,
      endTime: document.getElementById("endTime").value || null,
      muscles: [...selectedMuscles],
      exercises: addedExercises.map(e => ({ exerciseId: e.exerciseId, name: e.name, muscle: e.muscle, sets: e.sets }))
    });
    const t = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    setSaveStatus(`Synced ${t} ✓`);
  } catch (e) { setSaveStatus("Couldn't sync — check connection"); }
}

function setSaveStatus(text){ if (saveStatusEl) saveStatusEl.textContent = text; }

async function onDiscard(){
  if (!confirm("Discard everything logged so far for this in-progress workout?")) return;
  addedExercises = []; selectedMuscles = new Set();
  document.getElementById("dateInput").value = todayStr();
  document.getElementById("startTime").value = "";
  document.getElementById("endTime").value = "";
  syncMuscleChipUI();
  renderExerciseList();
  await clearDraftWorkout(uid);
  document.getElementById("draftBanner").style.display = "none";
  setSaveStatus("");
  toast("Draft discarded");
}

// ---------- repeat last workout ----------
async function onRepeatLast(){
  const all = await getWorkouts(uid);
  if (!all.length){ toast("No previous workout found"); return; }
  const last = all[0];
  selectedMuscles = new Set([...selectedMuscles, ...(last.muscles || [])]);
  syncMuscleChipUI();
  for (const e of (last.exercises || [])){
    if (addedExercises.find(x => x.exerciseId === e.exerciseId)) continue;
    const prev = await getLastPerformance(uid, e.exerciseId);
    addedExercises.push({ exerciseId: e.exerciseId, name: e.name, muscle: e.muscle, sets: e.sets.map(() => ({weight:"", reps:""})), prev });
  }
  renderExerciseList();
  scheduleAutosave();
  toast("Loaded last workout's exercises");
}

// ---------- muscle chips ----------
function renderMuscleChips(){
  const wrap = document.getElementById("muscleChips");
  wrap.innerHTML = MUSCLE_GROUPS.map(m =>
    `<button type="button" class="pill muscle-chip" data-muscle="${m}" style="cursor:pointer;border:1px solid var(--line);">${m}</button>`
  ).join("");
  wrap.querySelectorAll(".muscle-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.muscle;
      if (selectedMuscles.has(m)) selectedMuscles.delete(m); else selectedMuscles.add(m);
      syncMuscleChipUI();
      scheduleAutosave();
    });
  });
}
function syncMuscleChipUI(){
  document.querySelectorAll(".muscle-chip").forEach(btn => {
    const on = selectedMuscles.has(btn.dataset.muscle);
    btn.classList.toggle("amber", on);
    btn.style.borderColor = on ? "var(--amber)" : "var(--line)";
  });
  if (document.getElementById("exerciseSelect")) renderDropdown();
}

// ---------- exercise search ----------
function wireDropdown(){
  renderDropdown();
  document.getElementById("addExerciseBtn").addEventListener("click", () => {
    const id = document.getElementById("exerciseSelect").value;
    if (id) addExerciseById(id);
  });
}
function renderDropdown(){
  const sel = document.getElementById("exerciseSelect");
  const groups = {};
  for (const ex of exercises){
    if (selectedMuscles.size && !selectedMuscles.has(ex.muscle)) continue;
    (groups[ex.muscle] = groups[ex.muscle]||[]).push(ex);
  }
  const useGroups = Object.keys(groups).length ? groups : groupAll();
  sel.innerHTML = Object.entries(useGroups).map(([muscle, list]) =>
    `<optgroup label="${muscle}">${list.map(ex => `<option value="${ex.id}">${ex.name}</option>`).join("")}</optgroup>`
  ).join("");
}
async function addExerciseById(id){
  if (addedExercises.find(e => e.exerciseId === id)){ toast("Already added"); return; }
  const ex = exercises.find(e => e.id === id);
  if (!ex) return;
  selectedMuscles.add(ex.muscle);
  syncMuscleChipUI();
  renderDropdown();
  const prev = await getLastPerformance(uid, id);
  addedExercises.push({ exerciseId: id, name: ex.name, muscle: ex.muscle, sets:[{weight:"",reps:""}], prev });
  renderExerciseList();
  scheduleAutosave();
}

// ---------- exercise / set list ----------
function renderExerciseList(){
  const list = document.getElementById("exerciseList");
  document.getElementById("noExercises").style.display = addedExercises.length ? "none" : "block";
  list.innerHTML = addedExercises.map((ex, exIdx) => {
    const prevText = ex.prev ? `Previous (${ex.prev.dateStr}): ${ex.prev.sets.map(s=>`${s.weight}kg×${s.reps}`).join(", ")}` : "No previous data yet";
    return `
    <div class="exercise-card" data-idx="${exIdx}">
      <div class="ex-head">
        <div>
          <div class="ex-title">${ex.name}</div>
          <div class="ex-muscle">${ex.muscle}</div>
        </div>
        <button class="rm-ex" data-action="rm-ex" data-idx="${exIdx}" title="Delete this exercise">✕</button>
      </div>
      <div class="prev-hint">${prevText}</div>
      <div class="set-rows" data-idx="${exIdx}">
        ${ex.sets.map((s, sIdx) => setRowHtml(exIdx, sIdx, s)).join("")}
      </div>
      <button class="btn btn-ghost btn-sm" data-action="add-set" data-idx="${exIdx}">+ Add set</button>
    </div>`;
  }).join("");

  list.querySelectorAll('[data-action="rm-ex"]').forEach(b => b.addEventListener("click", () => {
    addedExercises.splice(Number(b.dataset.idx), 1);
    renderExerciseList(); scheduleAutosave();
  }));
  list.querySelectorAll('[data-action="add-set"]').forEach(b => b.addEventListener("click", () => {
    addedExercises[Number(b.dataset.idx)].sets.push({weight:"", reps:""});
    renderExerciseList(); scheduleAutosave();
  }));
  list.querySelectorAll('[data-action="rm-set"]').forEach(b => b.addEventListener("click", () => {
    const exIdx = Number(b.dataset.exidx), sIdx = Number(b.dataset.sidx);
    addedExercises[exIdx].sets.splice(sIdx, 1);
    if (!addedExercises[exIdx].sets.length) addedExercises[exIdx].sets.push({weight:"",reps:""});
    renderExerciseList(); scheduleAutosave();
  }));
  list.querySelectorAll('[data-action="step"]').forEach(b => b.addEventListener("click", () => {
    const exIdx = Number(b.dataset.exidx), sIdx = Number(b.dataset.sidx), field = b.dataset.field, delta = Number(b.dataset.delta);
    const cur = Number(addedExercises[exIdx].sets[sIdx][field]) || 0;
    let next = cur + delta;
    if (next < 0) next = 0;
    next = field === 'weight' ? Math.round(next*10)/10 : Math.round(next);
    addedExercises[exIdx].sets[sIdx][field] = next;
    renderExerciseList(); scheduleAutosave();
  }));
  list.querySelectorAll('input[data-field]').forEach(inp => inp.addEventListener("input", () => {
    const exIdx = Number(inp.dataset.exidx), sIdx = Number(inp.dataset.sidx), field = inp.dataset.field;
    addedExercises[exIdx].sets[sIdx][field] = inp.value;
    scheduleAutosave();
  }));
}

function setRowHtml(exIdx, sIdx, s){
  return `<div class="set-row">
    <div class="set-num">${sIdx+1}</div>
    <div class="stepper">
      <button type="button" class="step-btn" data-action="step" data-exidx="${exIdx}" data-sidx="${sIdx}" data-field="weight" data-delta="-2.5">−</button>
      <input type="number" inputmode="decimal" placeholder="kg" value="${s.weight}" data-exidx="${exIdx}" data-sidx="${sIdx}" data-field="weight">
      <button type="button" class="step-btn" data-action="step" data-exidx="${exIdx}" data-sidx="${sIdx}" data-field="weight" data-delta="2.5">+</button>
    </div>
    <div class="stepper">
      <button type="button" class="step-btn" data-action="step" data-exidx="${exIdx}" data-sidx="${sIdx}" data-field="reps" data-delta="-1">−</button>
      <input type="number" inputmode="numeric" placeholder="reps" value="${s.reps}" data-exidx="${exIdx}" data-sidx="${sIdx}" data-field="reps">
      <button type="button" class="step-btn" data-action="step" data-exidx="${exIdx}" data-sidx="${sIdx}" data-field="reps" data-delta="1">+</button>
    </div>
    <button class="rm" data-action="rm-set" data-exidx="${exIdx}" data-sidx="${sIdx}">✕</button>
  </div>`;
}

// ---------- time / duration ----------
function wireTimeInputs(){
  const start = document.getElementById("startTime"), end = document.getElementById("endTime");
  const update = () => {
    const lbl = document.getElementById("durationLabel");
    if (start.value && end.value){
      const [sh,sm] = start.value.split(":").map(Number), [eh,em] = end.value.split(":").map(Number);
      let mins = (eh*60+em) - (sh*60+sm);
      if (mins < 0) mins += 24*60;
      lbl.textContent = `Duration: ${mins} min`;
    } else { lbl.textContent = "Duration: —"; }
  };
  start.addEventListener("input", update);
  end.addEventListener("input", update);
}
function getDurationMin(){
  const start = document.getElementById("startTime").value, end = document.getElementById("endTime").value;
  if (!start || !end) return null;
  const [sh,sm] = start.split(":").map(Number), [eh,em] = end.split(":").map(Number);
  let mins = (eh*60+em) - (sh*60+sm);
  if (mins < 0) mins += 24*60;
  return mins;
}

// ---------- finalize ----------
async function onFinalize(){
  const dateStr = document.getElementById("dateInput").value || todayStr();
  if (!addedExercises.length){ toast("Add at least one exercise"); return; }
  const cleanExercises = addedExercises.map(e => ({
    exerciseId: e.exerciseId, name: e.name, muscle: e.muscle,
    sets: e.sets.filter(s => s.weight !== "" && s.reps !== "").map(s => ({ weight: Number(s.weight), reps: Number(s.reps) }))
  })).filter(e => e.sets.length);

  if (!cleanExercises.length){ toast("Fill in weight & reps for at least one set"); return; }

  const muscles = [...new Set(cleanExercises.map(e => e.muscle))];
  const btn = document.getElementById("saveBtn");
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    await addWorkout(uid, {
      dateStr,
      startTime: document.getElementById("startTime").value || null,
      endTime: document.getElementById("endTime").value || null,
      durationMin: getDurationMin(),
      muscles,
      exercises: cleanExercises
    });
    await clearDraftWorkout(uid);
    toast("Workout saved");
    setTimeout(() => window.location.href = "index.html", 600);
  } catch (err){
    toast("Couldn't save — check connection");
    btn.disabled = false; btn.textContent = "Save workout";
  }
}
