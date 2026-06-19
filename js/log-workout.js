import { requireAuth } from "./auth-guard.js";
import { getExercises, addWorkout, getLastPerformance, todayStr } from "./store.js";
import { MUSCLE_GROUPS } from "./exercises-data.js";
import { toast } from "./ui.js";

let uid, exercises = [];
let selectedMuscles = new Set();
let addedExercises = []; // { exerciseId, name, muscle, sets: [{weight,reps}] }

requireAuth(async (user) => {
  uid = user.uid;
  document.getElementById("dateInput").value = todayStr();

  exercises = await getExercises(uid);
  renderMuscleChips();
  renderExerciseSelect();
  wireTimeInputs();

  document.getElementById("addExerciseBtn").addEventListener("click", onAddExercise);
  document.getElementById("saveBtn").addEventListener("click", onSave);
});

function renderMuscleChips(){
  const wrap = document.getElementById("muscleChips");
  wrap.innerHTML = MUSCLE_GROUPS.map(m =>
    `<button type="button" class="pill muscle-chip" data-muscle="${m}" style="cursor:pointer;border:1px solid var(--line);">${m}</button>`
  ).join("");
  wrap.querySelectorAll(".muscle-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const m = btn.dataset.muscle;
      if (selectedMuscles.has(m)) { selectedMuscles.delete(m); btn.classList.remove("amber"); btn.style.borderColor = "var(--line)"; }
      else { selectedMuscles.add(m); btn.classList.add("amber"); btn.style.borderColor = "var(--amber)"; }
      renderExerciseSelect();
    });
  });
}

function renderExerciseSelect(){
  const sel = document.getElementById("exerciseSelect");
  const groups = {};
  for (const ex of exercises){
    if (selectedMuscles.size && !selectedMuscles.has(ex.muscle)) continue;
    (groups[ex.muscle] = groups[ex.muscle] || []).push(ex);
  }
  // if nothing matches the filter (e.g. no muscles selected yet), show everything
  const useGroups = Object.keys(groups).length ? groups : groupAll();
  sel.innerHTML = Object.entries(useGroups).map(([muscle, list]) =>
    `<optgroup label="${muscle}">${list.map(ex => `<option value="${ex.id}">${ex.name}</option>`).join("")}</optgroup>`
  ).join("");
}
function groupAll(){
  const groups = {};
  for (const ex of exercises) (groups[ex.muscle] = groups[ex.muscle] || []).push(ex);
  return groups;
}

async function onAddExercise(){
  const sel = document.getElementById("exerciseSelect");
  const id = sel.value;
  if (!id) return;
  if (addedExercises.find(e => e.exerciseId === id)) { toast("Already added"); return; }
  const ex = exercises.find(e => e.id === id);
  if (!ex) return;
  selectedMuscles.add(ex.muscle);
  syncMuscleChipUI();
  const prev = await getLastPerformance(uid, id);
  addedExercises.push({ exerciseId: id, name: ex.name, muscle: ex.muscle, sets: [{weight:"", reps:""}], prev });
  renderExerciseList();
}

function syncMuscleChipUI(){
  document.querySelectorAll(".muscle-chip").forEach(btn => {
    const on = selectedMuscles.has(btn.dataset.muscle);
    btn.classList.toggle("amber", on);
    btn.style.borderColor = on ? "var(--amber)" : "var(--line)";
  });
  renderExerciseSelect();
}

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
        <button class="rm-ex" data-action="rm-ex" data-idx="${exIdx}">✕</button>
      </div>
      <div class="prev-hint">${prevText}</div>
      <div class="set-rows" data-idx="${exIdx}">
        ${ex.sets.map((s, sIdx) => setRowHtml(exIdx, sIdx, s)).join("")}
      </div>
      <button class="btn btn-ghost btn-sm" data-action="add-set" data-idx="${exIdx}">+ Add set</button>
    </div>`;
  }).join("");

  // wire events (re-render rebuilds DOM each time, so re-bind each time)
  list.querySelectorAll('[data-action="rm-ex"]').forEach(b => b.addEventListener("click", () => {
    addedExercises.splice(Number(b.dataset.idx), 1);
    renderExerciseList();
  }));
  list.querySelectorAll('[data-action="add-set"]').forEach(b => b.addEventListener("click", () => {
    addedExercises[Number(b.dataset.idx)].sets.push({weight:"", reps:""});
    renderExerciseList();
  }));
  list.querySelectorAll('[data-action="rm-set"]').forEach(b => b.addEventListener("click", () => {
    const exIdx = Number(b.dataset.exidx), sIdx = Number(b.dataset.sidx);
    addedExercises[exIdx].sets.splice(sIdx, 1);
    if (!addedExercises[exIdx].sets.length) addedExercises[exIdx].sets.push({weight:"",reps:""});
    renderExerciseList();
  }));
  list.querySelectorAll('input[data-field]').forEach(inp => inp.addEventListener("input", () => {
    const exIdx = Number(inp.dataset.exidx), sIdx = Number(inp.dataset.sidx), field = inp.dataset.field;
    addedExercises[exIdx].sets[sIdx][field] = inp.value;
  }));
}

function setRowHtml(exIdx, sIdx, s){
  return `<div class="set-row">
    <div class="set-num">${sIdx+1}</div>
    <input type="number" inputmode="decimal" placeholder="kg" value="${s.weight}" data-exidx="${exIdx}" data-sidx="${sIdx}" data-field="weight">
    <input type="number" inputmode="numeric" placeholder="reps" value="${s.reps}" data-exidx="${exIdx}" data-sidx="${sIdx}" data-field="reps">
    <button class="rm" data-action="rm-set" data-exidx="${exIdx}" data-sidx="${sIdx}">✕</button>
  </div>`;
}

function wireTimeInputs(){
  const start = document.getElementById("startTime"), end = document.getElementById("endTime");
  const update = () => {
    const lbl = document.getElementById("durationLabel");
    if (start.value && end.value){
      const [sh,sm] = start.value.split(":").map(Number), [eh,em] = end.value.split(":").map(Number);
      let mins = (eh*60+em) - (sh*60+sm);
      if (mins < 0) mins += 24*60;
      lbl.textContent = `Duration: ${mins} min`;
    } else {
      lbl.textContent = "Duration: —";
    }
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

async function onSave(){
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
    toast("Workout saved");
    setTimeout(() => window.location.href = "index.html", 600);
  } catch (err){
    toast("Couldn't save — check connection");
    btn.disabled = false; btn.textContent = "Save workout";
  }
}
