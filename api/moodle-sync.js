import { err, checkMethod, checkEnv } from "./_utils.js";
import { getSupabase } from "./_supabase.js";

const MOODLE_BASE = "https://frt.cvg.utn.edu.ar";

// Moodle course ID → nombre normalizado para matching con Supabase
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

function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

async function getMoodleToken(user, pass) {
  const res = await fetch(`${MOODLE_BASE}/login/token.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&service=moodle_mobile_app`,
  });
  const data = await res.json();
  if (data.error) throw new Error(`Login Moodle falló: ${data.error}`);
  return data.token;
}

async function getCourseContents(token, courseId) {
  const url = `${MOODLE_BASE}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_course_get_contents&moodlewsrestformat=json&courseid=${courseId}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data?.exception) throw new Error(data.message || "Error en Moodle API");
  if (!Array.isArray(data)) throw new Error("Respuesta inesperada de Moodle API");
  return data;
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
        ext = ["PDF", "DOCX", "DOC", "PPTX", "PPT", "XLSX", "XLS", "ZIP", "MP4", "MP3"].includes(rawExt) ? rawExt : "LINK";
      }

      if (!storage_path) continue;
      recursos.push({ nombre, tipo: ext, storage_path });
    }
  }
  return recursos;
}

export default async function handler(req, res) {
  if (!checkMethod(req, res, "POST")) return;
  if (!checkEnv(res, "SUPA_SERVICE_KEY", "MOODLE_USER", "MOODLE_PASS")) return;

  const mainUserId = process.env.VITE_MAIN_USER_ID;
  const { user_id } = req.body || {};

  if (!mainUserId || user_id !== mainUserId) {
    return err(res, 403, "Solo el usuario principal puede sincronizar Moodle");
  }

  const sb = getSupabase();

  // Cargar materias del usuario desde Supabase
  const { data: materias, error: matErr } = await sb
    .from("materias")
    .select("id, nombre")
    .eq("user_id", mainUserId);

  if (matErr) return err(res, 500, `Error cargando materias: ${matErr.message}`);

  // Autenticar en Moodle
  let token;
  try {
    token = await getMoodleToken(process.env.MOODLE_USER, process.env.MOODLE_PASS);
  } catch (e) {
    return err(res, 502, `No se pudo conectar a Moodle: ${e.message}`);
  }

  const resultados = [];

  for (const [courseIdStr, nombreMoodle] of Object.entries(CURSOS)) {
    const courseId = parseInt(courseIdStr);
    const normMoodle = norm(nombreMoodle);

    // Buscar materia coincidente en Supabase por nombre normalizado
    const materia = materias.find(m => {
      const normSupa = norm(m.nombre);
      return normSupa === normMoodle || normSupa.includes(normMoodle) || normMoodle.includes(normSupa);
    });

    if (!materia) {
      resultados.push({ curso: nombreMoodle, ok: false, razon: "Materia no encontrada — agregala en Mis Materias" });
      continue;
    }

    try {
      const sections = await getCourseContents(token, courseId);
      const recursos = extraerRecursos(sections);

      // Borrar archivos Moodle anteriores de esta materia
      await sb.from("archivos")
        .delete()
        .eq("materia_id", materia.id)
        .eq("user_id", mainUserId)
        .like("storage_path", `${MOODLE_BASE}%`);

      if (recursos.length > 0) {
        const inserts = recursos.map(r => ({
          user_id: mainUserId,
          materia_id: materia.id,
          carpeta_id: null,
          nombre: r.nombre,
          tipo: r.tipo,
          "tamaño": 0,
          storage_path: r.storage_path,
          es_publico: false,
        }));

        const { error: insErr } = await sb.from("archivos").insert(inserts);
        if (insErr) throw insErr;
      }

      resultados.push({ curso: nombreMoodle, ok: true, count: recursos.length });
    } catch (e) {
      resultados.push({ curso: nombreMoodle, ok: false, razon: e.message });
    }
  }

  const ok = resultados.filter(r => r.ok).length;
  const total = recursos => recursos.filter(r => r.ok).reduce((s, r) => s + r.count, 0);

  return res.status(200).json({
    ok: true,
    sincronizadas: ok,
    total_recursos: resultados.filter(r => r.ok).reduce((s, r) => s + (r.count || 0), 0),
    resultados,
  });
}
