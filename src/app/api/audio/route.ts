import { gateway, generateText, Output, transcribe } from "ai";
import { z } from "zod";
import { getCategorias } from "@/lib/data";
import { today } from "@/lib/format";

export const maxDuration = 60;

const TRANSCRIPTION_MODEL = "openai/gpt-4o-mini-transcribe";
const PARSER_MODEL = "anthropic/claude-haiku-4.5";
const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // límite de body de Vercel: 4.5 MB

const extraccion = z.object({
  gastos: z.array(
    z.object({
      descripcion: z.string().describe("Descripción corta, en español, con mayúscula inicial. Ej: 'Rosas rojas x 50'"),
      monto: z.number().describe("Monto en pesos argentinos, número sin símbolos"),
      categoria: z.string().describe("Nombre exacto de una de las categorías disponibles"),
      fecha: z.string().describe("Fecha YYYY-MM-DD"),
    }),
  ),
});

export async function POST(request: Request) {
  const form = await request.formData();
  const audio = form.get("audio");
  let texto = String(form.get("texto") ?? "").trim();

  if (audio instanceof File && audio.size > 0) {
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "El audio es muy largo. Probá con uno de menos de 2 minutos." }, { status: 413 });
    }
    try {
      const { text } = await transcribe({
        model: gateway.transcription(TRANSCRIPTION_MODEL),
        audio: new Uint8Array(await audio.arrayBuffer()),
        providerOptions: { openai: { language: "es" } },
      });
      texto = text.trim();
    } catch (error) {
      console.error("transcribe", error);
      return Response.json({ error: "No pude escuchar el audio. Probá de nuevo." }, { status: 502 });
    }
  }

  if (!texto) {
    return Response.json({ error: "No se escuchó nada. Probá de nuevo más cerca del micrófono." }, { status: 400 });
  }

  const categorias = await getCategorias();
  const hoy = today();

  try {
    const { output } = await generateText({
      model: PARSER_MODEL,
      output: Output.object({ schema: extraccion }),
      system: [
        "Sos el asistente contable de Burgundy, una florería en Argentina.",
        "Te paso lo que dijo o escribió el dueño y tenés que extraer cada gasto que menciona.",
        "Reglas:",
        "- Montos en pesos argentinos. '50 lucas' o '50 mil' = 50000. 'Una luca' = 1000. '1,5 palos' o '1.5 millones' = 1500000.",
        "- Si menciona varios gastos, devolvé uno por cada uno.",
        `- Hoy es ${hoy}. 'Ayer', 'el lunes', etc. se calculan desde hoy. Si no dice fecha, usá hoy.`,
        `- Categorías disponibles: ${categorias.map((c) => c.nombre).join(", ")}. Si ninguna encaja, usá "Otros".`,
        "- Si no hay ningún gasto con monto claro, devolvé la lista vacía. No inventes montos.",
      ].join("\n"),
      prompt: texto,
    });

    const porNombre = new Map(categorias.map((c) => [c.nombre.toLowerCase(), c.id]));
    const otros = porNombre.get("otros") ?? null;
    const gastos = output.gastos
      .filter((g) => g.monto > 0)
      .map((g) => ({
        descripcion: g.descripcion,
        monto: Math.round(g.monto),
        categoria_id: porNombre.get(g.categoria.toLowerCase()) ?? otros,
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(g.fecha) && g.fecha <= hoy ? g.fecha : hoy,
      }));

    return Response.json({ texto, gastos });
  } catch (error) {
    console.error("parse", error);
    return Response.json({ texto, gastos: [], error: "No pude entender los gastos. Cargalos a mano." }, { status: 200 });
  }
}
