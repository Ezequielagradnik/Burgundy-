import { gateway, generateText, Output, transcribe } from "ai";
import { z } from "zod";
import { aiEnabled } from "@/lib/ai";
import { getCategorias } from "@/lib/data";
import { today } from "@/lib/format";
import { interpretarFijos, interpretarGastos } from "@/lib/interpretar";

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

const extraccionFijos = z.object({
  fijos: z.array(
    z.object({
      nombre: z.string().describe("Nombre corto con mayúscula inicial. Ej: 'Alquiler', 'Flores'"),
      monto: z.number().describe("Monto en pesos de CADA vez que se paga, no el total del mes"),
      categoria: z.string().describe("Nombre exacto de una de las categorías disponibles"),
      frecuencia: z.enum(["mensual", "quincenal", "semanal"]),
      dia: z.number().int().describe("Mensual: día del mes (1-31). Quincenal: primer día (1-15). Semanal: 1"),
      dias_semana: z.array(z.number().int()).describe("Solo semanal: 1=lunes ... 7=domingo. Si no, vacío"),
    }),
  ),
});

export async function POST(request: Request) {
  const form = await request.formData();
  const audio = form.get("audio");
  const tipo = form.get("tipo") === "fijos" ? "fijos" : "gastos";
  let texto = String(form.get("texto") ?? "").trim();

  if (audio instanceof File && audio.size > 0) {
    if (!aiEnabled()) {
      return Response.json(
        { error: "El audio todavía no está activado. Usá el micrófono del teclado para dictar." },
        { status: 400 },
      );
    }
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
  const porReglas = () =>
    tipo === "fijos"
      ? Response.json({ texto, fijos: interpretarFijos(texto, { categorias }), modo: "reglas" })
      : Response.json({ texto, gastos: interpretarGastos(texto, { hoy, categorias }), modo: "reglas" });

  if (!aiEnabled()) return porReglas();

  const porNombre = new Map(categorias.map((c) => [c.nombre.toLowerCase(), c.id]));
  const otros = porNombre.get("otros") ?? null;

  if (tipo === "fijos") {
    try {
      const { output } = await generateText({
        model: PARSER_MODEL,
        output: Output.object({ schema: extraccionFijos }),
        system: [
          "Sos el asistente contable de Burgundy, una florería en Argentina.",
          "El dueño te dice sus gastos fijos (los que se repiten) y tenés que extraer cada uno.",
          "- Montos en pesos argentinos. '50 lucas' o '50 mil' = 50000. '1,5 palos' = 1500000.",
          "- monto es lo que se paga cada vez. 'Flores lunes y miércoles 280 mil cada día' = 280000, semanal, [1, 3].",
          "- 'Cada 15 días' o 'quincenal' = quincenal. Si no dice día, dia = 1.",
          "- Si no dice frecuencia, es mensual. Si no dice día del mes, dia = 1.",
          `- Categorías disponibles: ${categorias.map((c) => c.nombre).join(", ")}. Si ninguna encaja, usá "Otros".`,
          "- Ignorá totales, sumas y aclaraciones. No inventes montos.",
        ].join("\n"),
        prompt: texto,
      });
      const fijos = output.fijos
        .filter((f) => f.monto > 0 && (f.frecuencia !== "semanal" || f.dias_semana.length > 0))
        .map((f) => ({
          nombre: f.nombre,
          monto: Math.round(f.monto),
          categoria_id: porNombre.get(f.categoria.toLowerCase()) ?? otros,
          frecuencia: f.frecuencia,
          dia: Math.min(Math.max(f.dia, 1), f.frecuencia === "quincenal" ? 15 : 31),
          dias_semana: f.frecuencia === "semanal" ? f.dias_semana.filter((d) => d >= 1 && d <= 7) : [],
        }));
      return Response.json({ texto, fijos, modo: "ia" });
    } catch (error) {
      console.error("parse fijos", error);
      return porReglas();
    }
  }

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

    const gastos = output.gastos
      .filter((g) => g.monto > 0)
      .map((g) => ({
        descripcion: g.descripcion,
        monto: Math.round(g.monto),
        categoria_id: porNombre.get(g.categoria.toLowerCase()) ?? otros,
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(g.fecha) && g.fecha <= hoy ? g.fecha : hoy,
      }));

    return Response.json({ texto, gastos, modo: "ia" });
  } catch (error) {
    // Si la IA falla (sin crédito, caída, etc.) usamos las reglas para no dejarlo sin anotar
    console.error("parse", error);
    return porReglas();
  }
}
