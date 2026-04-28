import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { err, checkMethod, checkEnv } from "./_utils.js";

// Configurar VAPID
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Supabase server-side (usa service role si tenés, sino anon)
const sb = createClient(
  process.env.VITE_SUPA_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPA_ANON
);

export default async function handler(req, res) {
  if (!checkEnv(res, "VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL")) return;

  // ── GUARDAR SUSCRIPCIÓN ───────────────────────────────────────────────────
  if (req.method === "POST" && req.query.action === "subscribe") {
    const { subscription, userId } = req.body;
    if (!subscription || !userId) return err(res, 400, "Faltan subscription o userId");

    const { error } = await sb.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      subscription: subscription,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });

    if (error) return err(res, 500, error.message);
    return res.status(200).json({ ok: true });
  }

  // ── ELIMINAR SUSCRIPCIÓN ──────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { endpoint } = req.body;
    if (!endpoint) return err(res, 400, "Falta endpoint");

    await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
    return res.status(200).json({ ok: true });
  }

  // ── ENVIAR NOTIFICACIÓN (uso interno/admin) ───────────────────────────────
  if (req.method === "POST" && req.query.action === "send") {
    const { userId, title, body, url = "/" } = req.body;
    if (!userId || !title) return err(res, 400, "Faltan userId y title");

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, msg: "Sin suscripciones" });
    }

    const payload = JSON.stringify({ title, body, url });
    let sent = 0, failed = 0;

    await Promise.all(subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (e) {
        failed++;
        // Si la suscripción expiró, la eliminamos
        if (e.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", row.subscription.endpoint);
        }
      }
    }));

    return res.status(200).json({ ok: true, sent, failed });
  }

  return err(res, 405, "Método no permitido o action inválida");
}
