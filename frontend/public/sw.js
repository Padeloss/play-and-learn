// Service worker του Play and Learn: η εφαρμογή ανοίγει και χωρίς ίντερνετ.
// Πρώτα δοκιμάζει το δίκτυο (για να έρχονται πάντα οι νέες ερωτήσεις) και, αν δεν υπάρχει
// σύνδεση, δίνει ό,τι έχει κρατήσει από την τελευταία φορά. Η κατάταξη (/api) δεν κρατιέται.
const CACHE = "playandlearn-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.json", "/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("/") : undefined))
      )
  );
});
