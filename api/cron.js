import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Configurar VAPID
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const sb = createClient(
  process.env.VITE_SUPA_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Enviar notificación push a un usuario
async function notificar(userId, title, body, url = "/") {
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url });

  await Promise.all(subs.map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, payload);
    } catch (e) {
      // Suscripción expirada — limpiar
      if (e.statusCode === 410) {
        await sb.from("push_subscriptions")
          .delete()
          .eq("endpoint", row.subscription.endpoint);
      }
    }
  }));
}

export default async function handler(req, res) {
  // Verificar que sea llamado por Vercel Cron
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const hoy = new Date();
  const hoyStr = hoy.toISOString().split("T")[0];

  // Calcular fechas relevantes
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);
  const mananaStr = manana.toISOString().split("T")[0];

  const en3dias = new Date(hoy);
  en3dias.setDate(en3dias.getDate() + 3);
  const en3diasStr = en3dias.toISOString().split("T")[0];

  const diasSem = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const diaHoy = diasSem[hoy.getDay()];

  let totalEnviadas = 0;

  try {
    // Obtener todos los usuarios con suscripciones activas
    const { data: suscripciones } = await sb
      .from("push_subscriptions")
      .select("user_id")
      .order("user_id");

    if (!suscripciones || suscripciones.length === 0) {
      return res.status(200).json({ ok: true, enviadas: 0 });
    }

    // IDs únicos de usuarios
    const userIds = [...new Set(suscripciones.map(s => s.user_id))];

    for (const userId of userIds) {
      // ── Materias de hoy ───────────────────────────────────────────────────
      const { data: materias } = await sb
        .from("materias")
        .select("nombre, horarios, horario, dias")
        .eq("user_id", userId)
        .in("estado", ["cursando", "regular"]);

      const materiasHoy = (materias || []).filter(m => m.dias?.includes(diaHoy));

      if (materiasHoy.length > 0) {
        const lista = materiasHoy
          .map(m => {
            const hora = m.horarios?.[diaHoy] || m.horario || "";
            return hora ? `${hora} ${m.nombre}` : m.nombre;
          })
          .join(", ");

        await notificar(
          userId,
          `Clases hoy — ${diaHoy}`,
          lista,
          "/"
        );
        totalEnviadas++;
      }

      // ── Eventos de mañana ─────────────────────────────────────────────────
      const { data: eventosManana } = await sb
        .from("eventos")
        .select("titulo, tipo, hora")
        .eq("user_id", userId)
        .eq("fecha", mananaStr);

      for (const ev of (eventosManana || [])) {
        const tipoLabel = { parcial:"Parcial", final:"Final", tp:"TP", otro:"Evento" }[ev.tipo] || "Evento";
        await notificar(
          userId,
          `Mañana: ${tipoLabel}`,
          `${ev.titulo}${ev.hora ? ` a las ${ev.hora}` : ""}`,
          "/?vista=eventos"
        );
        totalEnviadas++;
      }

      // ── Eventos en 3 días ─────────────────────────────────────────────────
      const { data: eventosEn3 } = await sb
        .from("eventos")
        .select("titulo, tipo, hora")
        .eq("user_id", userId)
        .eq("fecha", en3diasStr)
        .in("tipo", ["parcial", "final"]);

      for (const ev of (eventosEn3 || [])) {
        const tipoLabel = { parcial:"Parcial", final:"Final" }[ev.tipo];
        await notificar(
          userId,
          `En 3 días: ${tipoLabel}`,
          `${ev.titulo}${ev.hora ? ` a las ${ev.hora}` : ""}`,
          "/?vista=eventos"
        );
        totalEnviadas++;
      }

      // ── Evento hoy ────────────────────────────────────────────────────────
      const { data: eventosHoy } = await sb
        .from("eventos")
        .select("titulo, tipo, hora")
        .eq("user_id", userId)
        .eq("fecha", hoyStr);

      for (const ev of (eventosHoy || [])) {
        const tipoLabel = { parcial:"Parcial", final:"Final", tp:"TP", otro:"Evento" }[ev.tipo] || "Evento";
        await notificar(
          userId,
          `Hoy: ${tipoLabel}`,
          `${ev.titulo}${ev.hora ? ` a las ${ev.hora}` : ""}`,
          "/?vista=eventos"
        );
        totalEnviadas++;
      }
    }

    return res.status(200).json({ ok: true, enviadas: totalEnviadas, usuarios: userIds.length });
  } catch (e) {
    console.error("Cron error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
