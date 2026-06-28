import { err, checkMethod, checkEnv } from "./_utils.js";
import { getSupabase } from "./_supabase.js";

function slugify(nombre) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function handler(req, res) {
  if (!checkMethod(req, res, "GET")) return;
  if (!checkEnv(res, "SUPA_SERVICE_KEY")) return;

  const { materia } = req.query;
  if (!materia) return err(res, 400, "Falta el parámetro 'materia'");

  const slug = slugify(materia);

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("quiz_banks")
      .select("preguntas, preguntas_count")
      .eq("materia_slug", slug)
      .single();

    if (error || !data) {
      return err(res, 404, `Sin banco de preguntas para "${materia}". Subí un DOCX desde tu perfil.`);
    }

    const banco = data.preguntas;
    if (!Array.isArray(banco) || banco.length === 0) {
      return err(res, 404, "El banco de preguntas está vacío.");
    }

    const seleccionadas = shuffle(banco).slice(0, 5);
    return res.status(200).json({ preguntas: seleccionadas, total: banco.length });
  } catch (e) {
    return err(res, 500, e.message);
  }
}
