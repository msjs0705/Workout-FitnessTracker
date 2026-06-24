import { requireAuth } from "./auth-guard.js";
import { getPartnerComment } from "./store.js";

requireAuth(async (user) => {
  const comment = await getPartnerComment(user.uid);
  const wrap = document.getElementById("notifWrap");

  if (!comment || !comment.text) {
    wrap.innerHTML = `<div class="empty" style="border:none;"><div class="big">No notifications</div>You're all caught up.</div>`;
    return;
  }

  localStorage.setItem('lastSeenComment', comment.timestamp);

  const date = new Date(comment.timestamp);
  const dateStr = date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

  wrap.innerHTML = `
    <div class="card-dark" style="background:var(--teal); color:white;">
      <div class="label" style="color:var(--teal-dim); margin-bottom:12px;">💬 Note from your partner</div>
      <div style="font-size:16px; font-weight:600; line-height:1.5;">"${comment.text}"</div>
      <div style="font-family:var(--font-mono); font-size:11px; color:var(--teal-dim); margin-top:14px; text-align:right;">${dateStr}</div>
    </div>`;
});
