import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  try {
    const { path, contentType, fileBase64 } = req.body;
    const buffer = Buffer.from(fileBase64, "base64");
    await s3.send(new PutObjectCommand({
      Bucket: "archivos",
      Key: path,
      Body: buffer,
      ContentType: contentType,
    }));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error upload R2:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
