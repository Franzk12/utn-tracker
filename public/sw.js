// ─── SERVICE WORKER — UTN TRACKER ────────────────────────────────────────────
const CACHE_NAME = "utn-tracker-v1";

// Instalar service worker
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

// Activar y tomar control inmediatamente
self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

// Recibir notificación push
self.addEventListener("push", (e) => {
  if (!e.data) return;

  let data = {};
  try {
    data = e.data.json();
  } catch {
    data = { title: "UTN Tracker", body: e.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
    actions: [
      { action: "open", title: "Ver" },
      { action: "close", title: "Cerrar" },
    ],
    requireInteraction: false,
  };

  e.waitUntil(
    self.registration.showNotification(data.title || "UTN Tracker", options)
  );
});

// Click en la notificación
self.addEventListener("notificationclick", (e) => {
  e.notification.close();

  if (e.action === "close") return;

  const url = e.notification.data?.url || "/";

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Si no hay ventana, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
