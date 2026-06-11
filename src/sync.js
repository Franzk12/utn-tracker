// ─── COLA DE ESCRITURA OFFLINE ───────────────────────────────────────────────
// Permite crear/editar/borrar sin internet: la operación se aplica al instante
// en la UI y se encola; al volver la conexión se reenvía a Supabase en orden.
import { sb } from "./supabase";
import { traducirError } from "./db";

const KEY = (uid) => `utn_sync_queue_v1:${uid}`;

export function getQueue(uid) {
  try { return JSON.parse(localStorage.getItem(KEY(uid))) || []; } catch { return []; }
}
function setQueue(uid, ops) {
  try { localStorage.setItem(KEY(uid), JSON.stringify(ops)); } catch { /* storage lleno */ }
}
export function pendingCount(uid) { return getQueue(uid).length; }

function enqueue(uid, op) { const q = getQueue(uid); q.push(op); setQueue(uid, q); }
function nuevoTempId() {
  const r = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
  return "tmp_" + r;
}

// Ejecuta una mutación. Online la manda ya; offline (o si se cae la red) la encola
// y devuelve una fila optimista para pintar la UI al instante.
// op: "insert" | "update" | "delete". Para update/delete pasar rowId.
export async function mutar({ uid, table, op, payload, rowId }) {
  const encolar = () => {
    if (op === "insert") {
      const tempId = nuevoTempId();
      enqueue(uid, { type: "insert", table, payload, tempId });
      return { data: { ...payload, id: tempId }, queued: true };
    }
    enqueue(uid, { type: op, table, payload, rowId });
    return { data: payload || null, queued: true };
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) return encolar();

  try {
    let res;
    if (op === "insert") res = await sb.from(table).insert(payload).select().single();
    else if (op === "update") res = await sb.from(table).update(payload).eq("id", rowId).select().single();
    else res = await sb.from(table).delete().eq("id", rowId);
    if (res.error) return { error: traducirError(res.error) };
    return { data: res.data ?? payload ?? null };
  } catch {
    // Se cayó la red durante la operación: la encolamos para reintentar.
    return encolar();
  }
}

// Reenvía la cola en orden. Para al primer error de red (conserva el resto).
// Los errores reales (permiso, validación) se descartan para no trabar la cola.
// Al insertar, remapea los IDs temporales a los reales en las operaciones siguientes.
export async function flushQueue(uid) {
  const q = getQueue(uid);
  if (!q.length) return;
  for (let i = 0; i < q.length; i++) {
    const op = q[i];
    try {
      if (op.type === "insert") {
        const { data, error } = await sb.from(op.table).insert(op.payload).select().single();
        if (error) continue;
        if (op.tempId && data) {
          for (let j = i + 1; j < q.length; j++) if (q[j].rowId === op.tempId) q[j].rowId = data.id;
        }
      } else if (op.type === "update") {
        const { error } = await sb.from(op.table).update(op.payload).eq("id", op.rowId);
        if (error) continue;
      } else {
        const { error } = await sb.from(op.table).delete().eq("id", op.rowId);
        if (error) continue;
      }
    } catch {
      setQueue(uid, q.slice(i)); // error de red: guardar lo que falta (ya remapeado) y reintentar luego
      return;
    }
  }
  setQueue(uid, []);
}
