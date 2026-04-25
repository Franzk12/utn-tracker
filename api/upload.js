import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { err, checkMethod, checkEnv, readRawBody, setCors } from "./_utils.js";

export const config = { api: { bodyParser: false } };

const BUCKET = "archivos";

function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight CORS
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!checkEnv(res, "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")) return;

  const R2 = getR2Client();

  // ── SUBIR ──────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const contentType = req.headers["content-type"] || "application/octet-stream";
      const fileName    = decodeURIComponent(req.headers["x-file-name"] || "archivo");
      const userId      = req.headers["x-user-id"] || "unknown";

      if (!fileName || fileName === "archivo") {
        return err(res, 400, "El header x-file-name es requerido");
      }

      const key  = `${userId}/${Date.now()}_${fileName}`;
      const body = await readRawBody(req);

      if (body.length === 0) {
        return err(res, 400, "El archivo está vacío");
      }

      await R2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));

      return res.status(200).json({ key, nombre: fileName, tamaño: body.length });
    } catch (e) {
      return err(res, 500, e.message);
    }
  }

  // ── URL FIRMADA PARA DESCARGAR ─────────────────────────────────────────────
  if (req.method === "GET") {
    const { key } = req.query;
    if (!key) return err(res, 400, "El parámetro 'key' es requerido");

    try {
      const url = await getSignedUrl(
        R2,
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
        { expiresIn: 3600 }
      );
      return res.status(200).json({ url });
    } catch (e) {
      return err(res, 500, e.message);
    }
  }

  // ── ELIMINAR ───────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { key } = req.query;
    if (!key) return err(res, 400, "El parámetro 'key' es requerido");

    try {
      await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      return res.status(200).json({ ok: true });
    } catch (e) {
      return err(res, 500, e.message);
    }
  }

  return err(res, 405, "Método no permitido");
}