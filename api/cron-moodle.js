import webpush from "web-push";
import { getSupabase } from "./_supabase.js";

const MOODLE_BASE = "https://frt.cvg.utn.edu.ar";

const CURSOS = {
  9943:  "Álgebra y Geometría Analítica",
  10122: "Análisis de Sistemas de Información",
  10073: "Análisis Matemático I",
  9836:  "Física I",
  9940:  "Inglés I",
  9994:  "Lógica y Estructuras Discretas",
  10138: "Paradigmas de Programación",
  10208: "Sintaxis y Semántica de los Lenguajes",
  9949:  "Sistemas Operativos",
};

// Nombres parciales de foros de anuncios a monitorear
const FOROS_KEYWORDS = ["cartelera", "novedades", "avisos", "anuncios"];

function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

async function moodleFetch(token, fn, params = {}) {
  const qs = new URLSearchParams({
    wstoken: token,
    wsfunction: fn,
    moodlewsrestformat: "json",
    ...params,
  });
  const res = await fetch(`${MOODLE_BASE}/webservice/rest/server.php?${qs}`);
  return res.json();
}

async function getMoodleToken(user, pass) {
  const res = await fetch(`${MOODLE_BASE}/login/token.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&service=moodle_mobile_app`,
  });
  const data = await res.json();
  if (data.error) throw new Error(`Login Moodle: ${data.error}`);
  return data.token;
}

function extraerRecursos(sections) {
  const recursos = [];
  for (const sec of sections) {
    for (const mod of (sec.modules || [])) {
      const tipo = mod.modname;
      if (!["resource", "url", "page", "folder"].includes(tipo)) continue;
      const nombre = (mod.name || "Sin nombre").trim();
      let storage_path = mod.url || "";
      let ext = "LINK";
      if (tipo === "resource" && Array.isArray(mod.contents) && mod.contents.length > 0) {
        const file = mod.contents[0];
        storage_path = file.fileurl || mod.url || "";
        const rawExt = (file.filename || "").split(".").pop().toUpperCase();
        ext = ["PDF", "DOCX", "DOC", "PPTX", "PPT", "XLSX", "XLS", "ZIP", "MP4", "MP3"].includes(rawExt)
          ? rawExt
          : "LINK";
      }
      if (!storage_path) continue;
      recursos.push({ nombre, tipo: ext, storage_path });
    }
  }
  return recursos;
}

function extraerForos(sections) {
  const foros = [];
  for (const sec of sections) {
    for (const mod of (sec.modules || [])) {
      if (mod.modname !== "forum") continue;
      const n = norm(mod.name || "");
      if (FOROS_KEYWORDS.some(k => n.includes(k))) {
        // mod.instance es el ID real del foro (no el course module ID)
        foros.push({ id: mod.instance, nombre: mod.name });
      }
    }
  }
  return foros;
}

async function sendPush(sb, userId, title, body, url = "/") {
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", userId);
  if (!subs?.length) return 0;

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (e) {
        if (e.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("endpoint", row.subscription.endpoint);
        }
      }
    })
  );
  return sent;
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const mainUserId = process.env.VITE_MAIN_USER_ID;
  const moodleUser = process.env.MOODLE_USER;
  const moodlePass = process.env.MOODLE_PASS;

  if (!mainUserId || !moodleUser || !moodlePass) {
    return res.status(500).json({ error: "Faltan VITE_MAIN_USER_ID, MOODLE_USER o MOODLE_PASS" });
  }

  const sb = getSupabase();

  const { data: materias } = await sb
    .from("materias")
    .select("id, nombre")
    .eq("user_id", mainUserId);

  let token;
  try {
    token = await getMoodleToken(moodleUser, moodlePass);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }

  // Posts de foro más nuevos que esto se consideran "recientes"
  const cutoff = Math.floor(Date.now() / 1000) - 9 * 60 * 60;

  const nuevosArchivos = [];
  const nuevosPosts = [];

  for (const [courseIdStr, nombreMoodle] of Object.entries(CURSOS)) {
    const courseId = parseInt(courseIdStr);

    let sections;
    try {
      const data = await moodleFetch(token, "core_course_get_contents", { courseid: courseId });
      if (!Array.isArray(data)) continue;
      sections = data;
    } catch {
      continue;
    }

    // ── Sync de archivos (incremental) ────────────────────────────────────
    const normMoodle = norm(nombreMoodle);
    const materia = (materias || []).find((m) => {
      const n = norm(m.nombre);
      return n === normMoodle || n.includes(normMoodle) || normMoodle.includes(n);
    });

    if (materia) {
      const desdeApi = extraerRecursos(sections);

      const { data: existentes } = await sb
        .from("archivos")
        .select("storage_path")
        .eq("materia_id", materia.id)
        .eq("user_id", mainUserId)
        .like("storage_path", `${MOODLE_BASE}%`);

      const existentesPaths = new Set((existentes || []).map((e) => e.storage_path));
      const apPaths = new Set(desdeApi.map((r) => r.storage_path));

      // Eliminar los que Moodle ya no tiene
      const aEliminar = [...existentesPaths].filter((p) => !apPaths.has(p));
      if (aEliminar.length > 0) {
        await sb
          .from("archivos")
          .delete()
          .eq("materia_id", materia.id)
          .eq("user_id", mainUserId)
          .in("storage_path", aEliminar);
      }

      // Insertar solo los verdaderamente nuevos
      const aInsertar = desdeApi.filter((r) => !existentesPaths.has(r.storage_path));
      if (aInsertar.length > 0) {
        await sb.from("archivos").insert(
          aInsertar.map((r) => ({
            user_id: mainUserId,
            materia_id: materia.id,
            carpeta_id: null,
            nombre: r.nombre,
            tipo: r.tipo,
            "tamaño": 0,
            storage_path: r.storage_path,
            es_publico: false,
          }))
        );
        nuevosArchivos.push({
          materia: nombreMoodle,
          count: aInsertar.length,
          nombres: aInsertar.map((r) => r.nombre),
        });
      }
    }

    // ── Monitoring de foros ───────────────────────────────────────────────
    const foros = extraerForos(sections);
    for (const foro of foros) {
      try {
        const data = await moodleFetch(token, "mod_forum_get_forum_discussions", {
          forumid: foro.id,
          page: 0,
          perpage: 10,
        });
        const discussions = data?.discussions || [];
        const recientes = discussions.filter((d) => d.timecreated > cutoff);
        if (recientes.length > 0) {
          nuevosPosts.push({
            materia: nombreMoodle,
            foro: foro.nombre,
            posts: recientes.map((d) => d.name),
          });
        }
      } catch {
        // foro sin acceso o API no disponible, ignorar
      }
    }
  }

  // ── Push notifications ────────────────────────────────────────────────
  let notifEnviadas = 0;

  if (nuevosArchivos.length > 0) {
    const total = nuevosArchivos.reduce((s, m) => s + m.count, 0);
    const resumen = nuevosArchivos
      .map((m) => `${m.materia.split(" ")[0]}: ${m.count} nuevo${m.count > 1 ? "s" : ""}`)
      .join(", ");
    notifEnviadas += await sendPush(
      sb,
      mainUserId,
      `${total} material${total > 1 ? "es nuevos" : " nuevo"} en Moodle`,
      resumen,
      "/?vista=archivos"
    );
  }

  for (const np of nuevosPosts) {
    const titulo = np.materia.split(" ")[0];
    const primerPost = np.posts[0];
    const extra = np.posts.length > 1 ? ` (+${np.posts.length - 1} más)` : "";
    notifEnviadas += await sendPush(
      sb,
      mainUserId,
      `Aviso en ${titulo} — ${np.foro}`,
      `${primerPost}${extra}`,
      "/?vista=archivos"
    );
  }

  console.log(
    `[cron-moodle] archivos nuevos: ${nuevosArchivos.length} materias, posts: ${nuevosPosts.length}, notif: ${notifEnviadas}`
  );

  return res.status(200).json({
    ok: true,
    nuevos_archivos: nuevosArchivos,
    nuevos_posts: nuevosPosts,
    notificaciones: notifEnviadas,
  });
}
