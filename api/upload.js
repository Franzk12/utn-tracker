import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = "archivos";

export const config = { api: { bodyParser: false } };

// Leer body raw como buffer
function leerBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  // ── SUBIR ──────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const contentType = req.headers["content-type"] || "application/octet-stream";
      const fileName    = decodeURIComponent(req.headers["x-file-name"] || "archivo");
      const userId      = req.headers["x-user-id"] || "unknown";
      const key         = `${userId}/${Date.now()}_${fileName}`;

      const body = await leerBody(req);

      await R2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));

      return res.status(200).json({ key, nombre: fileName, tamaño: body.length });
    } catch (err) {
      console.error("R2 upload error:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── URL FIRMADA PARA DESCARGAR ─────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: "Falta key" });

      const url = await getSignedUrl(
        R2,
        new GetObjectCommand({ Bucket: BUCKET, Key: key }),
        { expiresIn: 3600 }
      );
      return res.status(200).json({ url });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── ELIMINAR ───────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    try {
      const { key } = req.query;
      if (!key) return res.status(400).json({ error: "Falta key" });

      await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Método no permitido" });
}
