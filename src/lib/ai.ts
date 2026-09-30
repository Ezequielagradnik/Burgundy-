import "server-only";

// Se prende con AI_ENABLED=true en Vercel, una vez habilitado el AI Gateway.
// Apagado: sin audio, el texto dictado se interpreta con reglas (src/lib/interpretar.ts).
export const aiEnabled = () => process.env.AI_ENABLED === "true";
