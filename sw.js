/* adds cross-origin isolation headers (COOP/COEP) to this site's pages,
   since github pages can't. needed by web games that use SharedArrayBuffer.
   registered from js/desktop.js only in browsers with credentialless iframes. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).then(function (res) {
    if (res.type === "opaqueredirect" || res.status === 0) return res;
    var h = new Headers(res.headers);
    h.set("Cross-Origin-Opener-Policy", "same-origin");
    h.set("Cross-Origin-Embedder-Policy", "credentialless");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }));
});
