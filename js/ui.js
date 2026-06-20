// =========================================================
// UI HELPERS
// =========================================================
export function toast(msg){
  let el = document.getElementById("toast");
  if (!el){
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

export function muscleColorVar(status){
  if (status === 'ready') return 'ready';
  if (status === 'never') return 'ready';
  return 'due';
}

// An optimistic "deleted — UNDO" toast. Caller has already removed the
// item from the UI before calling this; onCommit fires (the real
// Firestore delete) only if the window passes without Undo being tapped.
export function undoableAction(message, { onUndo, onCommit, delay = 4000 } = {}){
  const el = document.createElement("div");
  el.className = "toast show undo-toast";
  el.innerHTML = `<span>${message}</span><button class="undo-btn" type="button">UNDO</button>`;
  document.body.appendChild(el);
  let settled = false;
  const timer = setTimeout(async () => {
    if (settled) return;
    settled = true;
    el.remove();
    try { await onCommit(); } catch (e) { /* offline — the optimistic removal stands locally */ }
  }, delay);
  el.querySelector(".undo-btn").addEventListener("click", () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    el.remove();
    if (onUndo) onUndo();
  });
}
