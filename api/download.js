import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  try {
    const { path } = req.body;
    const url = await getSignedUrl(s3, new GetObjectCommand({
      Bucket: "archivos",
      Key: path,
    }), { expiresIn: 60 });
    return res.status(200).json({ url });
  } catch (err) {
    console.error("Error download R2:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
