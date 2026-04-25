import { err, checkMethod, checkEnv } from "./_utils.js";

// Modelos soportados y sus configuraciones
const MODELOS = {
  claude: {
    envKey: "ANTHROPIC_API_KEY",
    call: async (key, system, messages) => {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system,
          messages,
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text || "Sin respuesta.";
    },
  },
  gpt: {
    envKey: "OPENAI_API_KEY",
    call: async (key, system, messages) => {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 2048,
          messages: [{ role: "system", content: system }, ...messages],
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices?.[0]?.message?.content || "Sin respuesta.";
    },
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    call: async (key, system, messages) => {
      const geminiMessages = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: geminiMessages,
            generationConfig: { maxOutputTokens: 2048 },
          }),
        }
      );
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";
    },
  },
};

export default async function handler(req, res) {
  if (!checkMethod(req, res, "POST")) return;

  const { system, messages, modelo = "claude" } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return err(res, 400, "El campo 'messages' es requerido y debe ser un array no vacío");
  }

  const config = MODELOS[modelo];
  if (!config) {
    return err(res, 400, `Modelo no válido. Opciones: ${Object.keys(MODELOS).join(", ")}`);
  }

  if (!checkEnv(req, res, config.envKey)) return; // checkEnv usa req solo para contexto
  const key = process.env[config.envKey];
  if (!key) return err(res, 500, `API key de ${modelo} no configurada`);

  try {
    const text = await config.call(key, system || "", messages);
    return res.status(200).json({ text });
  } catch (e) {
    return err(res, 500, e.message || "Error interno del servidor");
  }
}