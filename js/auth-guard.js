// =========================================================
// AUTH GUARD
// Import this at the top of every protected page's script.
// Calls back with the signed-in user, or bounces to login.html.
// =========================================================
import { auth, onAuthStateChanged, signOut } from "./firebase-init.js";
import { ensureSeeded } from "./store.js";

export function requireAuth(onReady){
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    await ensureSeeded(user.uid);
    wireUserChip(user);
    onReady(user);
  });
}

function wireUserChip(user){
  const chip = document.getElementById("userChip");
  if (!chip) return;
  const emailShort = user.displayName || (user.email || "").split("@")[0];
  chip.innerHTML = `<span>${emailShort}</span><button id="logoutBtn" title="Sign out">⏻</button>`;
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}
