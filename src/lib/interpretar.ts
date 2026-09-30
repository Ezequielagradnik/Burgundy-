// Interpreta gastos dictados o escritos, sin IA. Ej: "flores 45 mil y el flete 12 mil".
// Sin imports: corre igual en el servidor y en los tests de Node.

type CategoriaRef = { id: string; nombre: string };

export type GastoInterpretado = {
  descripcion: string;
  monto: number;
  categoria_id: string | null;
  fecha: string;
};

// Raíces de palabra -> categoría. Se busca en orden: gana la primera que aparece.
const PALABRAS_CATEGORIA: Record<string, string[]> = {
  "Flores y plantas": [
    "flor", "rosa", "planta", "tulipan", "girasol", "lilium", "clavel", "gerbera", "astromelia",
    "alstroemeria", "hortensia", "orquidea", "follaje", "eucalipto", "paniculata", "gypso", "lisianthus",
    "margarita", "crisantemo", "suculenta", "cactus", "helecho", "ruscus", "jazmin", "peonia", "ramo",
  ],
  Packaging: [
    "papel", "kraft", "celofan", "cinta", "caja", "bolsa", "mono", "envoltorio", "packaging", "tarjeta",
    "etiqueta", "sticker", "canasta", "florero",
  ],
  Insumos: [
    "espuma", "oasis", "alambre", "tijera", "maceta", "tierra", "sustrato", "fertilizante", "insumo",
    "pistola", "silicona", "precinto", "guante", "limpieza", "lavandina", "detergente",
  ],
  Servicios: [
    "luz", "gas", "agua", "internet", "wifi", "telefono", "celular", "edenor", "edesur", "metrogas",
    "aysa", "cable", "posnet", "mercadopago",
  ],
  Alquiler: ["alquiler", "expensa"],
  Sueldos: ["sueldo", "empleado", "empleada", "aguinaldo", "jornal", "vacaciones", "cargas"],
  "Transporte y envíos": [
    "flete", "nafta", "combustible", "gasoil", "envio", "cadete", "moto", "uber", "taxi", "remis",
    "peaje", "estacionamiento", "colectivo", "cabify", "didi", "correo",
  ],
  Impuestos: ["monotributo", "afip", "arca", "iibb", "ingresos", "impuesto", "abl", "tasa", "rentas"],
  Mantenimiento: [
    "arreglo", "reparacion", "plomero", "electricista", "pintura", "mantenimiento", "heladera",
    "camara", "cerrajero", "vidrio",
  ],
};

const RELLENO_INICIO = new Set([
  "compre", "pague", "gaste", "saque", "puse", "di", "le", "les", "me", "cobraron", "salio", "costo",
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "en", "por", "a", "al", "y",
  "tambien", "otro", "otra",
]);
const RELLENO_FIN = new Set(["a", "al", "por", "de", "del", "en", "el", "la", "x", "que", "me", "salio", "costo", "y"]);

// La coma entre dígitos ("1,5 palos") es decimal, no separa
const SEPARADOR = /(\s*(?:,(?!\d)|(?<!\d),|[;\n])\s*|\s+(?:y|e|mas|más|tambien|también)\s+|\s*\+\s*)/i;

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Categoría según palabras clave ("nafta" -> Transporte). Null si no hay ninguna pista. */
export function adivinarCategoria(texto: string, categorias: CategoriaRef[]) {
  const palabras = normalizar(texto).split(/[^a-zñ]+/);
  for (const [nombre, raices] of Object.entries(PALABRAS_CATEGORIA)) {
    if (palabras.some((p) => raices.some((r) => p.startsWith(r)))) {
      return categorias.find((c) => c.nombre === nombre)?.id ?? null;
    }
  }
  return null;
}

function categoriaDe(texto: string, categorias: CategoriaRef[]) {
  return adivinarCategoria(texto, categorias) ?? categorias.find((c) => c.nombre === "Otros")?.id ?? null;
}

const NUMEROS_EN_PALABRAS: Record<string, number> = {
  un: 1, una: 1, uno: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
  doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600,
  setecientos: 700, ochocientos: 800, novecientos: 900,
};

const MULTIPLICADORES: [RegExp, number][] = [
  [/^(mil|lucas?|k)$/, 1_000],
  [/^(palos?|millon|millones)$/, 1_000_000],
];

type Monto = { valor: number; desde: number; hasta: number; seguro: boolean };

/**
 * Miles con punto ("80.000", "1.250,50") o con coma, como escribe el dictado del iPhone
 * ("80,000", "1,250.50"). Coma o punto con 1 o 2 dígitos detrás es decimal ("1,5", "12,50").
 */
function leerNumero(raw: string) {
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) return Number(raw.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) return Number(raw.replace(/,/g, ""));
  return Number(raw.replace(",", "."));
}

const MONTO_RE = new RegExp(
  String.raw`(\$\s*)?(\d+(?:[.,]\d+)*|\b(?:${Object.keys(NUMEROS_EN_PALABRAS).sort((a, b) => b.length - a.length).join("|")})\b)\s*(mil|lucas?|k|palos?|millon(?:es)?)?\b(\s*pesos)?`,
  "gi",
);

function encontrarMontos(texto: string): Monto[] {
  const montos: Monto[] = [];
  for (const m of normalizar(texto).matchAll(MONTO_RE)) {
    const [completo, pesos, numero, mult, palabraPesos] = m;
    const esPalabra = numero in NUMEROS_EN_PALABRAS;
    // "una" sola no es un monto ("una caja"); necesita "luca", "palo", etc.
    if (esPalabra && !mult) continue;
    // Que el número no sea parte de una palabra ("h2o", "4x4")
    const antes = texto[m.index - 1];
    if (antes && /[a-z]/i.test(antes)) continue;

    let valor = esPalabra ? NUMEROS_EN_PALABRAS[numero] : leerNumero(numero);
    const factor = mult ? MULTIPLICADORES.find(([re]) => re.test(mult))?.[1] ?? 1 : 1;
    valor *= factor;
    montos.push({
      valor: Math.round(valor),
      desde: m.index,
      hasta: m.index + completo.length,
      seguro: !!(pesos || mult || palabraPesos),
    });
  }
  return montos;
}

/** Si hay varios números ("50 rosas a 80 lucas"), gana el que suena a plata; si no, el más alto. */
function elegirMonto(montos: Monto[]) {
  const seguros = montos.filter((m) => m.seguro);
  const candidatos = seguros.length ? seguros : montos;
  return candidatos.reduce<Monto | null>((max, m) => (!max || m.valor > max.valor ? m : max), null);
}

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const FECHA_RE = new RegExp(String.raw`\b(?:(antes de ayer|anteayer|ayer|hoy)|(?:el\s+)?(${DIAS.join("|")}))\b`, "i");

function restarDias(fecha: string, dias: number) {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - dias)).toISOString().slice(0, 10);
}

/** Busca "ayer", "el viernes", etc. Devuelve la fecha y el texto sin esa parte. */
function extraerFecha(texto: string, hoy: string) {
  const m = normalizar(texto).match(FECHA_RE);
  if (!m || m.index === undefined) return null;
  const [completo, relativo, dia] = m;
  let fecha = hoy;
  if (relativo === "ayer") fecha = restarDias(hoy, 1);
  else if (relativo === "anteayer" || relativo === "antes de ayer") fecha = restarDias(hoy, 2);
  else if (dia) {
    const [y, mo, d] = hoy.split("-").map(Number);
    const diaHoy = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    // "el martes" dicho un martes es el de la semana pasada
    fecha = restarDias(hoy, (diaHoy - DIAS.indexOf(dia) + 7) % 7 || 7);
  }
  return { fecha, resto: texto.slice(0, m.index) + " " + texto.slice(m.index + completo.length) };
}

/** Parte la frase en un pedazo por gasto. Un pedazo sin monto se pega al siguiente ("rosas y claveles 50 mil"). */
function separarGastos(texto: string) {
  const partes = texto.split(SEPARADOR);
  const segmentos: string[] = [];
  let acumulado = "";
  for (let i = 0; i < partes.length; i += 2) {
    acumulado += partes[i];
    if (encontrarMontos(acumulado).length) {
      segmentos.push(acumulado);
      acumulado = "";
    } else if (i + 1 < partes.length) {
      acumulado += partes[i + 1];
    }
  }
  // Lo que sobra al final sin monto ("... 12 mil y listo") se pega al último gasto
  if (acumulado.trim() && segmentos.length) segmentos[segmentos.length - 1] += ` ${acumulado}`;
  return segmentos;
}

function limpiarDescripcion(texto: string) {
  const palabras = texto.replace(/[.,;:!?¿¡]/g, " ").split(/\s+/).filter(Boolean);
  while (palabras.length && RELLENO_INICIO.has(normalizar(palabras[0]))) palabras.shift();
  while (palabras.length && RELLENO_FIN.has(normalizar(palabras[palabras.length - 1]))) palabras.pop();
  const limpio = palabras.filter((p) => normalizar(p) !== "pesos").join(" ");
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

export function interpretarGastos(
  entrada: string,
  { hoy, categorias }: { hoy: string; categorias: CategoriaRef[] },
): GastoInterpretado[] {
  const gastos: GastoInterpretado[] = [];
  let fecha = hoy;
  for (let segmento of separarGastos(entrada.normalize("NFC").trim())) {
    // La fecha dicha vale para este gasto y los que siguen, hasta que se nombre otra
    const conFecha = extraerFecha(segmento, hoy);
    if (conFecha) ({ fecha, resto: segmento } = conFecha);
    const monto = elegirMonto(encontrarMontos(segmento));
    if (!monto || monto.valor <= 0) continue;
    const resto = segmento.slice(0, monto.desde) + " " + segmento.slice(monto.hasta);
    const categoria_id = categoriaDe(resto, categorias);
    const descripcion =
      limpiarDescripcion(resto) || categorias.find((c) => c.id === categoria_id)?.nombre || "Gasto";
    gastos.push({ descripcion, monto: monto.valor, categoria_id, fecha });
  }
  return gastos;
}
