// ─── UTILS COMPARTIDOS PARA API ───────────────────────────────────────────────

/**
 * Respuesta de error estandarizada
 */
export function err(res, status, message) {
  console.error(`[API Error ${status}]:`, message);
  return res.status(status).json({ error: message });
}

/**
 * Verificar que el método HTTP sea el esperado
 */
export function checkMethod(req, res, ...methods) {
  if (!methods.includes(req.method)) {
    err(res, 405, `Método ${req.method} no permitido. Usá: ${methods.join(", ")}`);
    return false;
  }
  return true;
}

/**
 * Verificar que existan variables de entorno requeridas
 */
export function checkEnv(res, ...keys) {
  const missing = keys.filter(k => !process.env[k]);
  if (missing.length > 0) {
    err(res, 500, `Variables de entorno faltantes: ${missing.join(", ")}`);
    return false;
  }
  return true;
}

/**
 * Leer body raw como buffer (para uploads sin bodyParser)
 */
export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * CORS headers para desarrollo local
 */
export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-file-name, x-user-id");
}
