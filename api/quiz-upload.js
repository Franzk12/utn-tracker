import mammoth from "mammoth";
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

function parsearPreguntas(rawText) {
  const usaFormatoNro = /^N°\s*\d+/m.test(rawText);

  if (usaFormatoNro) {
    // Formato: N° X / Tema / ¿Pregunta? / A) ... / Respuesta correcta: B) explicación
    const chunks = rawText.split(/^N°\s*\d+\s*$/m).map(c => c.trim()).filter(Boolean);
    const preguntas = [];
    const opcionRe = /^([A-D])\)\s+(.+)/;
    const respuestaRe = /^Respuesta correcta:\s*([A-D])\)\s*/i;

    for (const chunk of chunks) {
      const lineas = chunk.split("\n").map(l => l.trim()).filter(Boolean);
      const opciones = [];
      const letraIdx = {};
      let pregunta = "";
      let correctaLetra = "";
      let explicacion = "";

      for (const l of lineas) {
        const opM = l.match(opcionRe);
        const respM = l.match(respuestaRe);
        if (opM) {
          letraIdx[opM[1]] = opciones.length;
          opciones.push(opM[2]);
        } else if (respM) {
          correctaLetra = respM[1];
          explicacion = l.replace(respuestaRe, "").trim();
        } else if (!pregunta && (l.includes("?") || l.includes("¿"))) {
          pregunta = l;
        }
      }

      const correcta = correctaLetra !== "" ? (letraIdx[correctaLetra] ?? -1) : -1;
      if (pregunta && opciones.length >= 2 && correcta !== -1) {
        preguntas.push({ pregunta, opciones, correcta, explicacion });
      }
    }
    return preguntas;
  }

  // Formato original: bloques separados por línea en blanco, *opción correcta
  const bloques = rawText.split(/\n{2,}|^---+$/m).map(b => b.trim()).filter(Boolean);
  function esOpcion(l) { return /^[\*]?[A-Da-d][).:\-]\s/.test(l) || l.startsWith("*"); }
  function limpiarOpcion(l) { return l.replace(/^[A-Da-d][).:\-]\s*/, "").replace(/\s*\*$/, "").trim(); }

  const preguntas = [];
  for (const bloque of bloques) {
    const lineas = bloque.split("\n").map(l => l.trim()).filter(Boolean);
    if (lineas.length < 3) continue;

    let pi = 0;
    while (pi < lineas.length && esOpcion(lineas[pi])) pi++;
    if (pi >= lineas.length) continue;

    const pregunta = lineas[pi];
    const resto = lineas.slice(pi + 1);
    const expLinea = resto.find(l => /^explicaci[oó]n[:\s]/i.test(l));
    const explicacion = expLinea ? expLinea.replace(/^explicaci[oó]n[:\s]*/i, "").trim() : "";
    const opcionesLineas = resto.filter(l => !/^explicaci[oó]n[:\s]/i.test(l));

    const opciones = [];
    let correcta = -1;
    for (const l of opcionesLineas) {
      if (opciones.length >= 4) break;
      const esCorrecta = l.startsWith("*");
      const texto = limpiarOpcion(esCorrecta ? l.slice(1) : l);
      if (!texto) continue;
      if (esCorrecta) correcta = opciones.length;
      opciones.push(texto);
    }

    if (opciones.length < 2 || correcta === -1) continue;
    preguntas.push({ pregunta, opciones, correcta, explicacion });
  }
  return preguntas;
}

export default async function handler(req, res) {
  if (!checkMethod(req, res, "POST")) return;
  if (!checkEnv(res, "SUPA_SERVICE_KEY")) return;

  const { materia_slug, materia_nombre, docx: docxBase64 } = req.body || {};

  if (!materia_slug || !materia_nombre || !docxBase64) {
    return err(res, 400, "Faltan campos: materia_slug, materia_nombre, docx (base64)");
  }

  let preguntas;
  try {
    const buffer = Buffer.from(docxBase64, "base64");
    const { value: rawText } = await mammoth.extractRawText({ buffer });
    preguntas = parsearPreguntas(rawText);
  } catch (e) {
    return err(res, 422, `Error al procesar el DOCX: ${e.message}`);
  }

  if (preguntas.length === 0) {
    return err(res, 422, "No se encontraron preguntas válidas en el DOCX. Verificá el formato.");
  }

  try {
    const sb = getSupabase();
    const slug = slugify(materia_slug);
    const { error } = await sb.from("quiz_banks").upsert({
      materia_slug: slug,
      materia_nombre,
      preguntas,
      preguntas_count: preguntas.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: "materia_slug" });

    if (error) throw error;
    return res.status(200).json({ ok: true, preguntas_count: preguntas.length, materia_slug: slug });
  } catch (e) {
    return err(res, 500, `Error guardando en base de datos: ${e.message}`);
  }
}
