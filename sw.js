const VERSION = "v1"; // bump this number every time you push changes
const CACHE = "ironlog-" + VERSION;

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([
    "./", "./index.html", "./css/style.css",
    "./js/dashboard.js", "./js/store.js", "./js/firebase-init.js",
    "./js/firebase-config.js", "./js/auth-guard.js", "./js/ui.js",
    "./js/exercises-data.js"
  ])));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fresh = fetch(e.request).then(r => {
        caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      });
      return cached || fresh;
    })
  );
});
