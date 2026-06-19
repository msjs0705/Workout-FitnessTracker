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
