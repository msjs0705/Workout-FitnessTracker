import { requireAuth } from "./auth-guard.js";
import { getExercises, addExercise, updateExercise, deleteExercise } from "./store.js";
import { MUSCLE_GROUPS } from "./exercises-data.js";
import { toast } from "./ui.js";

let uid;

requireAuth(async (user) => {
  uid = user.uid;
  document.getElementById("newMuscle").innerHTML = MUSCLE_GROUPS.map(m => `<option>${m}</option>`).join("");
  document.getElementById("addBtn").addEventListener("click", onAdd);
  await render();
});

async function onAdd(){
  const name = document.getElementById("newName").value.trim();
  const muscle = document.getElementById("newMuscle").value;
  if (!name){ toast("Enter a name"); return; }
  await addExercise(uid, { name, muscle });
  document.getElementById("newName").value = "";
  toast("Exercise added");
  await render();
}

async function render(){
  const exercises = await getExercises(uid);
  const groups = {};
  for (const ex of exercises) (groups[ex.muscle] = groups[ex.muscle] || []).push(ex);

  const wrap = document.getElementById("groupsWrap");
  wrap.innerHTML = MUSCLE_GROUPS.filter(m => groups[m]?.length).map(m => `
    <div class="section-head"><h2>${m}</h2><span class="label">${groups[m].length} exercise${groups[m].length!==1?'s':''}</span></div>
    <div class="card mt-8" style="padding:6px 14px;margin-bottom:24px;">
      ${groups[m].map(ex => `
        <div class="feed-row" data-id="${ex.id}">
          <div class="body">
            <input type="text" class="ex-name-input mono" value="${ex.name}" data-original-name="${ex.name}" style="border:none;background:none;font-family:var(--font-body);font-weight:600;font-size:14.5px;width:100%;padding:4px 0;">
          </div>
          <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${ex.id}">Delete</button>
        </div>
      `).join("")}
    </div>
  `).join("");

  wrap.querySelectorAll('[data-action="delete"]').forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Delete this exercise? Past logged sets that used it will keep their data, but you won't be able to pick it again.")) return;
    await deleteExercise(uid, btn.dataset.id);
    toast("Deleted");
    await render();
  }));

  wrap.querySelectorAll(".ex-name-input").forEach(inp => {
    inp.addEventListener("blur", async () => {
      const row = inp.closest("[data-id]");
      const newName = inp.value.trim();
      if (!newName) { inp.value = inp.dataset.originalName; return; }
      if (newName === inp.dataset.originalName) return;
      await updateExercise(uid, row.dataset.id, { name: newName });
      toast("Renamed");
    });
  });
}
