// Pen & Paper's service worker: only the daily Thought of the Day
// notification. It caches nothing (every page is signed-in and live).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Your thought for today is ready", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Your thought for today is ready";
  event.waitUntil(
    (async () => {
      // Open on screen already: let the page greet with the card and the signature sound instead.
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = open.find((c) => c.visibilityState === "visible");
      if (visible) {
        visible.postMessage({ type: "pp-today" });
        return;
      }
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag || "pp-today",
        icon: "/pwa/icon/192",
        badge: "/pwa/icon/192",
        data: { url: data.url || "/drop?today=1" },
        // One a day: a new one replaces yesterday's instead of piling up.
        renotify: false,
        silent: data.sound === false,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/drop?today=1", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = open.find((c) => new URL(c.url).origin === self.location.origin);
      if (same) {
        await same.focus();
        same.postMessage({ type: "pp-today" });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
