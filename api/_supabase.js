import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  const url = process.env.VITE_SUPA_URL || process.env.SUPA_URL;
  const key = process.env.SUPA_SERVICE_KEY;
  if (!url || !key) throw new Error("Faltan VITE_SUPA_URL o SUPA_SERVICE_KEY");
  return createClient(url, key);
}
