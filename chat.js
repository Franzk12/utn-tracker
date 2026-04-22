export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { system, messages, modelo = "claude" } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Faltan mensajes" });
  }

  try {
    let respuesta = "";

    // ── CLAUDE ────────────────────────────────────────────────────────────────
    if (modelo === "claude") {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return res.status(500).json({ error: "API key de Claude no configurada" });

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
      respuesta = data.content?.[0]?.text || "Sin respuesta.";
    }

    // ── GPT-4o mini ───────────────────────────────────────────────────────────
    else if (modelo === "gpt") {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return res.status(500).json({ error: "API key de OpenAI no configurada" });

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 2048,
          messages: [
            { role: "system", content: system },
            ...messages,
          ],
        }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      respuesta = data.choices?.[0]?.message?.content || "Sin respuesta.";
    }

    // ── GEMINI Flash ──────────────────────────────────────────────────────────
    else if (modelo === "gemini") {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return res.status(500).json({ error: "API key de Gemini no configurada" });

      // Convertir historial al formato de Gemini
      const geminiMessages = messages.map((m) => ({
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
      respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";
    }

    else {
      return res.status(400).json({ error: "Modelo no válido. Usá: claude, gpt o gemini" });
    }

    return res.status(200).json({ text: respuesta });

  } catch (err) {
    console.error("Error en /api/chat:", err.message);
    return res.status(500).json({ error: err.message || "Error interno del servidor" });
  }
}
