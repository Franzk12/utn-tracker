// ─── HELPER DE ESCRITURAS A SUPABASE ─────────────────────────────────────────
// Centraliza el manejo de errores de red y permisos para todas las operaciones
// de escritura. Devuelve { data } en éxito, o { error: <mensaje claro> } si falla.

// Traduce errores técnicos de Postgres/Supabase a algo que un humano entienda.
export function traducirError(error) {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("duplicate") || msg.includes("unique")) return "Ya existe un registro igual.";
  if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("permission") || msg.includes("not allowed"))
    return "No tenés permiso para hacer esto.";
  if (msg.includes("network") || msg.includes("failed to fetch")) return "Problema de conexión. Revisá tu internet.";
  return error?.message || "Ocurrió un error inesperado.";
}

// Ejecuta una query de Supabase de forma segura.
// Corta antes si el navegador está sin conexión y atrapa cualquier excepción de red.
export async function ejecutar(query) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { error: "Necesitás conexión a internet para guardar cambios." };
  }
  try {
    const { data, error } = await query;
    if (error) return { error: traducirError(error) };
    return { data };
  } catch {
    return { error: "No se pudo conectar. Revisá tu internet e intentá de nuevo." };
  }
}
