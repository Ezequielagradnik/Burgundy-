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
    "aysa", "cable", "posnet", "mercadopago", "prosegur", "alarma", "seguridad", "seguro",
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
const SEPARADOR = /(\s*(?:,(?!\d)|(?<!\d),|[;\n]|\.(?=\s))\s*|\s+(?:y|e|mas|más|tambien|también)\s+|\s*\+\s*)/i;

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

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};
const ES_DECENA = (n: number) => n >= 30 && n <= 90 && n % 10 === 0;
const MULT_PALABRA = /^(lucas?|palos?|k)$/;

/**
 * "doce mil" -> "12 mil", "un millón trescientos setenta mil" -> "1370 mil", "cincuenta rosas" -> "50 rosas".
 * Deja la palabra "mil"/"millones" para que el monto siga sonando a plata. "una" suelta ("una caja") no se toca.
 */
function numerosEnPalabras(texto: string) {
  const tokens = texto.match(/\p{L}+|[^\p{L}]+/gu) ?? [];
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    // La racha arranca en una palabra, nunca en el espacio de antes
    if (!/^\p{L}/u.test(tokens[i])) {
      out.push(tokens[i]);
      i++;
      continue;
    }
    // Junta una racha de palabras-número separadas solo por espacios
    let j = i;
    let total = 0;
    let actual = 0;
    let ultimo: "num" | "mil" | "millon" | null = null;
    let palabras = 0;
    let soloUn = true;
    let conNumero = false;
    let fin = i;
    while (j < tokens.length) {
      const w = normalizar(tokens[j]);
      if (/^\s+$/.test(tokens[j])) {
        j++;
        continue;
      }
      if (w in UNIDADES) {
        actual += UNIDADES[w];
        conNumero = true;
        if (!["un", "una", "uno"].includes(w)) soloUn = false;
        ultimo = "num";
      } else if (w === "y" && palabras && ES_DECENA(actual % 100) && normalizar(tokens[j + 2] ?? "") in UNIDADES) {
        // "noventa y cinco": la "y" solo une decena con unidad
      } else if (w === "mil") {
        total += (actual || 1) * 1000;
        actual = 0;
        soloUn = false;
        ultimo = "mil";
      } else if (w === "millon" || w === "millones") {
        total = (total + (actual || 1)) * 1_000_000;
        actual = 0;
        soloUn = false;
        ultimo = "millon";
      } else break;
      palabras++;
      fin = j + 1;
      j++;
    }
    if (!palabras) {
      out.push(tokens[i]);
      i++;
      continue;
    }
    const siguiente = normalizar(tokens.slice(fin).find((t) => !/^\s+$/.test(t)) ?? "");
    // "20 mil" ya tiene el número en dígitos: el "mil" suelto queda como está.
    // "una" sola solo es número si viene "luca", "palo"...: "una luca" sí, "una caja" no
    if (!conNumero || (soloUn && !MULT_PALABRA.test(siguiente))) {
      out.push(...tokens.slice(i, fin));
      i = fin;
      continue;
    }
    const valor = total + actual;
    out.push(
      ultimo === "mil" ? `${valor / 1000} mil` : ultimo === "millon" ? `${valor / 1_000_000} millones` : String(valor),
    );
    i = fin;
  }
  return out.join("");
}

/** Parte la frase en un pedazo por gasto. Un pedazo sin monto se pega al siguiente ("rosas y claveles 50 mil"). */
function separarGastos(texto: string, tieneMonto = (t: string) => encontrarMontos(t).length > 0) {
  const partes = texto.split(SEPARADOR);
  const segmentos: string[] = [];
  let acumulado = "";
  for (let i = 0; i < partes.length; i += 2) {
    acumulado += partes[i];
    if (tieneMonto(acumulado)) {
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

function limpiarDescripcion(texto: string, ruidoExtra: Set<string> = new Set()) {
  const palabras = texto.replace(/[.,;:!?¿¡]/g, " ").split(/\s+/).filter(Boolean);
  const esRuido = (p: string, set: Set<string>) => set.has(normalizar(p)) || ruidoExtra.has(normalizar(p));
  while (palabras.length && esRuido(palabras[0], RELLENO_INICIO)) palabras.shift();
  while (palabras.length && esRuido(palabras[palabras.length - 1], RELLENO_FIN)) palabras.pop();
  const limpio = palabras.filter((p) => normalizar(p) !== "pesos").join(" ");
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

export function interpretarGastos(
  entrada: string,
  { hoy, categorias }: { hoy: string; categorias: CategoriaRef[] },
): GastoInterpretado[] {
  const gastos: GastoInterpretado[] = [];
  let fecha = hoy;
  for (let segmento of separarGastos(numerosEnPalabras(entrada.normalize("NFC").trim()))) {
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

// Gastos fijos ------------------------------------------------------------

export type FijoInterpretado = {
  nombre: string;
  monto: number;
  categoria_id: string | null;
  frecuencia: "mensual" | "quincenal" | "semanal";
  dia: number;
  dias_semana: number[];
};

const DIAS_ISO = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const DIA_SEMANA_RE = new RegExp(String.raw`\b(${DIAS_ISO.join("|")})s?\b`, "g");
const QUINCENAL_RE =
  /\b(?:cada\s+(?:15|quince|14|catorce)\s+dias|quincenal(?:es|mente)?|cada\s+dos\s+semanas|dos\s+veces\s+(?:al|por)\s+mes)\b/g;
const SEMANAL_RE = /\b(?:semanal(?:es|mente)?|por\s+semana|cada\s+semana|todas\s+las\s+semanas)\b/g;
const MENSUAL_RE = /\b(?:mensual(?:es|mente)?|por\s+mes|al\s+mes|cada\s+mes|todos\s+los\s+meses)\b|\/\s*mes\b/g;
// "el día 10", "día 10", "el 10" (pero no "el 1.370.000" ni "el 10 mil")
const DIA_MES_RE = /\b(?:el\s+)?dia\s+(\d{1,2})\b|\bel\s+(\d{1,2})\b(?![.,]\d)(?!\s*(?:mil|lucas?|k|palos?|millon))/g;
const OTRO_RUIDO_RE = /\bcada\s+(?:dia|vez|uno)\b|\bc\/u\b|\bvariable\b|\bestimado\b/g;
const RUIDO_FIJO = new Set([
  "cada", "dia", "dias", "todos", "todas", "los", "las", "o", "y", "es", "son", "sale", "cuesta", "pago", "compro",
]);

/** Tapa con espacios lo que matchea, para no mover las posiciones del resto del texto. */
function tapar(texto: string, re: RegExp) {
  return texto.replace(re, (m) => " ".repeat(m.length));
}

/** El segmento sin frases de frecuencia ni de día ("cada 15 días", "el día 5"): los números que quedan son plata. */
function sinFrecuencias(segmento: string) {
  const n = normalizar(segmento);
  let limpio = segmento;
  for (const re of [QUINCENAL_RE, SEMANAL_RE, MENSUAL_RE, DIA_MES_RE, DIA_SEMANA_RE, OTRO_RUIDO_RE]) {
    const tapado = tapar(normalizar(limpio), re);
    limpio = [...limpio].map((c, i) => (tapado[i] === " " && n[i] !== " " ? " " : c)).join("");
  }
  return limpio;
}

/**
 * Lee gastos fijos dictados o pegados: "flores lunes y miércoles 280 mil, alquiler 1.370.000 el día 1,
 * papelería cada 15 días 100 mil". También acepta una lista pegada, una línea por gasto.
 */
export function interpretarFijos(entrada: string, { categorias }: { categorias: CategoriaRef[] }): FijoInterpretado[] {
  const fijos: FijoInterpretado[] = [];
  const sinEmojis = numerosEnPalabras(entrada.normalize("NFC")).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, " ");

  for (const linea of sinEmojis.split(/\n+/)) {
    if (/^\s*total\b/.test(normalizar(linea))) continue;

    for (const segmento of separarGastos(linea.trim(), (t) => encontrarMontos(sinFrecuencias(t)).length > 0)) {
      const n = normalizar(segmento);
      const dias = [...new Set([...n.matchAll(DIA_SEMANA_RE)].map((m) => DIAS_ISO.indexOf(m[1]) + 1))].sort(
        (a, b) => a - b,
      );
      const diaMes = [...n.matchAll(DIA_MES_RE)].map((m) => Number(m[1] ?? m[2])).find((d) => d >= 1 && d <= 31);
      const frecuencia = new RegExp(QUINCENAL_RE.source).test(n)
        ? "quincenal"
        : dias.length || new RegExp(SEMANAL_RE.source).test(n)
          ? "semanal"
          : "mensual";

      const limpio = sinFrecuencias(segmento);
      const montos = encontrarMontos(limpio);
      const monto = montos.find((m) => m.seguro) ?? elegirMonto(montos);
      // Un fijo de menos de $1.000 no existe: es un número suelto de una oración
      if (!monto || monto.valor < 1000) continue;

      let resto = limpio;
      for (const m of montos) resto = resto.slice(0, m.desde) + " ".repeat(m.hasta - m.desde) + resto.slice(m.hasta);
      resto = resto.replace(/[—–\-/()×$*|]/g, " ");
      const nombre = limpiarDescripcion(resto, RUIDO_FIJO);
      // Más de 5 palabras es una oración, no el nombre de un gasto
      if (!nombre || nombre.split(/\s+/).length > 5) continue;

      fijos.push({
        nombre,
        monto: monto.valor,
        categoria_id: categoriaDe(nombre, categorias),
        frecuencia,
        dia: frecuencia === "quincenal" ? Math.min(diaMes ?? 1, 15) : (diaMes ?? 1),
        dias_semana: frecuencia === "semanal" ? dias : [],
      });
    }
  }
  return fijos;
}
