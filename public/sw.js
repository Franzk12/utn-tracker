// ─── SERVICE WORKER — UTN TRACKER ────────────────────────────────────────────
// CACHE y PRECACHE son inyectados por el plugin de build (vite.config.js) con
// la lista real de assets con hash. Estos valores son el fallback para dev.
const CACHE = "utn-tracker-dev";
const PRECACHE = ["/", "/index.html", "/favicon.svg", "/manifest.webmanifest"];

// Instalar: precachear el app shell COMPLETO (incluye el bundle JS con hash)
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

// Activar: limpiar cachés viejos y tomar control inmediatamente
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Estrategia de fetch: navegación offline + assets cacheados
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Solo mismo origen: nunca interceptamos /api, Supabase ni R2
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;

  // Abrir la app: red primero, y si no hay conexión servimos el shell cacheado
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Assets estáticos (JS/CSS/imágenes): stale-while-revalidate
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
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
