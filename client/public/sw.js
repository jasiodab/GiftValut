const CACHE = "gift-vault-shell-v2";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache private API responses or uploaded images.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) return;

  const isNavigation =
    req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    // Network-first keeps the app shell fresh; fall back to the cached shell offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put("/index.html", copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(async () => {
          return (
            (await caches.match("/index.html")) ||
            (await caches.match("/")) ||
            Response.error()
          );
        })
    );
    return;
  }

  // Static build assets are content-hashed, so serve them from cache and refresh
  // in the background (stale-while-revalidate).
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
