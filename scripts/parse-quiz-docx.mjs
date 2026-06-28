#!/usr/bin/env node
/**
 * Convierte un DOCX con banco de preguntas → JSON para el quiz Pomodoro.
 *
 * Uso:
 *   node scripts/parse-quiz-docx.mjs <archivo.docx> <slug-materia>
 *
 * Ejemplo:
 *   node scripts/parse-quiz-docx.mjs ~/Descargas/AMI.docx analisis-matematico-i
 *
 * Formato esperado en el DOCX (cada pregunta separada por línea en blanco o "---"):
 *
 *   ¿Qué es una derivada?
 *   A) La integral de una función
 *   *B) La tasa de cambio instantánea de una función
 *   C) El área bajo la curva
 *   D) El límite en el infinito
 *   Explicación: La derivada mide cómo cambia una función en cada punto.
 *
 * Reglas:
 *   - La línea con * al inicio marca la opción correcta (o puede ir al final de la opción: "opción *")
 *   - La línea "Explicación:" es opcional pero recomendada
 *   - Separar preguntas con una línea en blanco o "---"
 *   - Las opciones pueden tener prefijo A) B) C) D) o no
 */

import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUIZBANK = path.join(__dirname, '..', 'quizbank');

const [,, docxPath, slug] = process.argv;

if (!docxPath || !slug) {
  console.error('Uso: node scripts/parse-quiz-docx.mjs <archivo.docx> <slug-materia>');
  console.error('Ejemplo: node scripts/parse-quiz-docx.mjs ~/AMI.docx analisis-matematico-i');
  process.exit(1);
}

const resolved = path.resolve(docxPath);
if (!fs.existsSync(resolved)) {
  console.error(`No se encontró el archivo: ${resolved}`);
  process.exit(1);
}

const { value: rawText } = await mammoth.extractRawText({ path: resolved });

const bloques = rawText
  .split(/\n{2,}|^---+$/m)
  .map(b => b.trim())
  .filter(Boolean);

function parsearOpcion(linea) {
  // Quita prefijos tipo "A)", "a.", "A-" al inicio
  return linea.replace(/^[A-Da-d][).:\-]\s*/, '').replace(/\s*\*$/, '').trim();
}

function esOpcion(linea) {
  return /^[\*]?[A-Da-d][).:\-]\s/.test(linea) || /^[\*]/.test(linea);
}

const preguntas = [];
const errores = [];

for (let i = 0; i < bloques.length; i++) {
  const lineas = bloques[i].split('\n').map(l => l.trim()).filter(Boolean);
  if (lineas.length < 3) continue;

  // Primera línea que NO empiece con opción es la pregunta
  let preguntaIdx = 0;
  while (preguntaIdx < lineas.length && esOpcion(lineas[preguntaIdx])) preguntaIdx++;
  if (preguntaIdx >= lineas.length) { errores.push(`Bloque ${i + 1}: no se encontró pregunta`); continue; }

  const pregunta = lineas[preguntaIdx].replace(/^[?¿]/, '').trim();

  // Líneas de opciones: siguientes que sean opciones
  const opcionesLineas = lineas.slice(preguntaIdx + 1).filter(l => !/^explicaci[oó]n[:\s]/i.test(l));
  const explicacionLinea = lineas.find(l => /^explicaci[oó]n[:\s]/i.test(l));
  const explicacion = explicacionLinea
    ? explicacionLinea.replace(/^explicaci[oó]n[:\s]*/i, '').trim()
    : '';

  const opciones = [];
  let correcta = -1;

  for (const l of opcionesLineas) {
    if (opciones.length >= 4) break;
    const esCorrecta = l.startsWith('*') || l.endsWith('*');
    const texto = parsearOpcion(l.startsWith('*') ? l.slice(1) : l);
    if (!texto) continue;
    if (esCorrecta) correcta = opciones.length;
    opciones.push(texto);
  }

  if (opciones.length < 2) { errores.push(`Bloque ${i + 1}: menos de 2 opciones — se omite`); continue; }
  if (correcta === -1) { errores.push(`Bloque ${i + 1}: ninguna opción marcada con * — se omite`); continue; }

  preguntas.push({ pregunta, opciones, correcta, explicacion });
}

if (errores.length) {
  console.warn('\nAdvertencias:');
  errores.forEach(e => console.warn(' ·', e));
}

if (preguntas.length === 0) {
  console.error('\nNo se parseó ninguna pregunta válida. Verificá el formato del DOCX.');
  process.exit(1);
}

const safeName = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const outPath = path.join(QUIZBANK, `${safeName}.json`);
fs.mkdirSync(QUIZBANK, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(preguntas, null, 2));

console.log(`\n✓ ${preguntas.length} preguntas guardadas en quizbank/${safeName}.json`);
if (errores.length) console.log(`  (${errores.length} bloques con problemas — ver advertencias arriba)`);
