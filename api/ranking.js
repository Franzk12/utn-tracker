import { err, checkMethod } from "./_utils.js";
import { getSupabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, "GET")) return;

  const sb = getSupabase();

  const [{ data: sessions, error: sessErr }, { data: profiles, error: profErr }] = await Promise.all([
    sb.from("quiz_sessions").select("user_id, correctas, total, materia_nombre, created_at"),
    sb.from("profiles").select("id, nickname, avatar_color"),
  ]);

  if (sessErr) return err(res, 500, sessErr.message);
  if (profErr) return err(res, 500, profErr.message);

  const profMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  // Aggregate per user, per materia
  const userStats = {};
  for (const s of sessions || []) {
    if (!userStats[s.user_id]) userStats[s.user_id] = { correctas: 0, total: 0, quizzes: 0, materias: {} };
    const u = userStats[s.user_id];
    u.correctas += s.correctas;
    u.total += s.total;
    u.quizzes++;

    if (!u.materias[s.materia_nombre]) u.materias[s.materia_nombre] = { correctas: 0, total: 0, quizzes: 0 };
    const m = u.materias[s.materia_nombre];
    m.correctas += s.correctas;
    m.total += s.total;
    m.quizzes++;
  }

  const toEntry = (uid, stats) => {
    const p = profMap[uid] || {};
    return {
      user_id: uid,
      nickname: p.nickname || "Anónimo",
      avatar_color: p.avatar_color || "#60a5fa",
      quizzes: stats.quizzes,
      pct: stats.total > 0 ? Math.round(stats.correctas / stats.total * 100) : 0,
    };
  };

  const rank = (arr) => arr.sort((a, b) => b.pct - a.pct || b.quizzes - a.quizzes);

  const global = rank(Object.entries(userStats).map(([uid, s]) => toEntry(uid, s)));

  // Per-materia rankings
  const materias = {};
  for (const [uid, stats] of Object.entries(userStats)) {
    for (const [matNombre, matStats] of Object.entries(stats.materias)) {
      if (!materias[matNombre]) materias[matNombre] = [];
      materias[matNombre].push(toEntry(uid, matStats));
    }
  }
  for (const arr of Object.values(materias)) rank(arr);

  return res.status(200).json({ global, materias });
}
