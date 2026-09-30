import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la secret key. Solo se usa en el servidor: nunca importarlo desde un componente "use client".
export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
