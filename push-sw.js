/* Cardiology Resident Training — Web Push service worker v1.0.125 */
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = { body: event.data?.text?.() || "" }; }
  const title = payload.title || "Cardiology Training";
  const options = {
    body: payload.body || "You have a new notification.",
    icon: "./apple-touch-icon.png",
    badge: "./apple-touch-icon.png",
    tag: payload.tag || payload.category || "cardiology-training",
    renotify: true,
    data: { route: payload.route || "#inbox" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification?.data?.route || "#inbox";
  const destination = new URL(`app.html${route}`, self.registration.scope).href;
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of list) {
      if ("focus" in client) {
        try { await client.navigate(destination); } catch (_) {}
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(destination);
  })());
});
