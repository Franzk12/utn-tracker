import { createClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPA_URL;
const SUPA_ANON = import.meta.env.VITE_SUPA_ANON;
export const sb = createClient(SUPA_URL, SUPA_ANON);
