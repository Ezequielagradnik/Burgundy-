import { db } from "@/lib/supabase";
import { today } from "@/lib/format";

// Lo llama Vercel Cron todos los días (vercel.json). Anota los fijos que cayeron aunque nadie
// abra la app, y de paso mantiene activo el proyecto de Supabase: el plan gratuito lo pausa
// después de una semana sin actividad.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const { data, error } = await db().rpc("generar_gastos_fijos", { p_hasta: today() });
  if (error) {
    console.error("cron generar_gastos_fijos", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, anotados: data });
}
