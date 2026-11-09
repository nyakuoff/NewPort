/* the old desktop-style site registered a service worker here.
   this one removes itself so returning visitors aren't stuck with it. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function () { self.registration.unregister(); });
