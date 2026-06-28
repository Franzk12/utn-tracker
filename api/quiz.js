import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { err, checkMethod } from "./_utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUIZBANK = path.join(__dirname, "..", "quizbank");

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

  const { materia } = req.query;
  if (!materia) return err(res, 400, "Falta el parámetro 'materia'");

  const slug = slugify(materia);
  const filePath = path.join(QUIZBANK, `${slug}.json`);

  if (!fs.existsSync(filePath)) {
    return err(res, 404, `Sin banco de preguntas para "${materia}". Creá el DOCX y corré: node scripts/parse-quiz-docx.mjs <archivo.docx> ${slug}`);
  }

  let banco;
  try {
    banco = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return err(res, 500, "Error al leer el banco de preguntas");
  }

  if (!Array.isArray(banco) || banco.length === 0) {
    return err(res, 404, "El banco de preguntas está vacío");
  }

  const seleccionadas = shuffle(banco).slice(0, 5);
  return res.status(200).json({ preguntas: seleccionadas, total: banco.length });
}
