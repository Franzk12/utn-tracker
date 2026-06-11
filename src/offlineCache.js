// ─── CACHÉ OFFLINE DE DATOS ──────────────────────────────────────────────────
// Guarda la última carga de datos por usuario para poder ver la app sin internet.
// Se cachea por user_id para que dos cuentas en el mismo navegador no se mezclen.
const KEY = (uid) => `utn_offline_data_v1:${uid}`;

export function loadCache(uid) {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(KEY(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCache(uid, data) {
  if (!uid) return;
  try {
    localStorage.setItem(KEY(uid), JSON.stringify(data));
  } catch {
    // Sin espacio o storage no disponible: ignoramos, no es crítico.
  }
}
