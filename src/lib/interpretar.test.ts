import { test } from "node:test";
import assert from "node:assert/strict";
import { adivinarCategoria, interpretarFijos, interpretarGastos } from "./interpretar.ts";

const categorias = [
  { id: "flores", nombre: "Flores y plantas" },
  { id: "insumos", nombre: "Insumos" },
  { id: "packaging", nombre: "Packaging" },
  { id: "servicios", nombre: "Servicios" },
  { id: "alquiler", nombre: "Alquiler" },
  { id: "sueldos", nombre: "Sueldos" },
  { id: "transporte", nombre: "Transporte y envíos" },
  { id: "impuestos", nombre: "Impuestos" },
  { id: "mantenimiento", nombre: "Mantenimiento" },
  { id: "otros", nombre: "Otros" },
];
// Martes 29 de septiembre de 2026
const hoy = "2026-09-29";
const leer = (texto: string) => interpretarGastos(texto, { hoy, categorias });

test("un gasto simple con monto en número", () => {
  assert.deepEqual(leer("flores 45000"), [
    { descripcion: "Flores", monto: 45000, categoria_id: "flores", fecha: hoy },
  ]);
});

test("entiende cómo se dicen los montos", () => {
  const casos: [string, number][] = [
    ["nafta 20 mil", 20000],
    ["flete 12 lucas", 12000],
    ["cafe una luca", 1000],
    ["heladera 1,5 palos", 1500000],
    ["arreglo un palo", 1000000],
    ["papel 80.000", 80000],
    ["cintas $12.500", 12500],
    ["tijera 7,5 mil", 7500],
    ["macetas 2 millones", 2000000],
    ["gas 45k", 45000],
    ["espuma 1.250,50", 1251],
  ];
  for (const [texto, monto] of casos) {
    assert.equal(leer(texto)[0]?.monto, monto, texto);
  }
});

test("separa varios gastos y limpia la descripción", () => {
  assert.deepEqual(leer("Compré 50 rosas a 80 lucas y pagué el flete 12 mil"), [
    { descripcion: "50 rosas", monto: 80000, categoria_id: "flores", fecha: hoy },
    { descripcion: "Flete", monto: 12000, categoria_id: "transporte", fecha: hoy },
  ]);
});

test("una 'y' dentro de la descripción no parte el gasto", () => {
  assert.deepEqual(leer("rosas y claveles 50 mil, nafta 20 mil"), [
    { descripcion: "Rosas y claveles", monto: 50000, categoria_id: "flores", fecha: hoy },
    { descripcion: "Nafta", monto: 20000, categoria_id: "transporte", fecha: hoy },
  ]);
});

test("entiende fechas habladas y las saca de la descripción", () => {
  // hoy es martes 29/09/2026
  const fechas: [string, string][] = [
    ["ayer nafta 20 mil", "2026-09-28"],
    ["anteayer nafta 20 mil", "2026-09-27"],
    ["antes de ayer nafta 20 mil", "2026-09-27"],
    ["el viernes nafta 20 mil", "2026-09-25"],
    ["el lunes nafta 20 mil", "2026-09-28"],
    ["el martes nafta 20 mil", "2026-09-22"],
    ["hoy nafta 20 mil", "2026-09-29"],
  ];
  for (const [texto, fecha] of fechas) {
    assert.deepEqual(leer(texto), [{ descripcion: "Nafta", monto: 20000, categoria_id: "transporte", fecha }], texto);
  }
});

test("la fecha dicha al principio vale para los gastos que siguen", () => {
  assert.deepEqual(
    leer("ayer compré flores 50 mil y nafta 20 mil").map((g) => g.fecha),
    ["2026-09-28", "2026-09-28"],
  );
});

test("sin monto no inventa gastos", () => {
  assert.deepEqual(leer("hoy fui al mercado de flores"), []);
  assert.deepEqual(leer(""), []);
});

test("montos dichos con palabras", () => {
  assert.equal(leer("flete cincuenta mil")[0]?.monto, 50000);
  assert.equal(leer("alquiler doscientos mil")[0]?.monto, 200000);
  assert.equal(leer("empleada medio palo")[0]?.monto, 500000);
});

test("la cantidad no se confunde con el precio", () => {
  assert.deepEqual(leer("rosas x 24 $36.000"), [
    { descripcion: "Rosas x 24", monto: 36000, categoria_id: "flores", fecha: hoy },
  ]);
});

test("adivina la categoría por la descripción, o nada si no hay pista", () => {
  assert.equal(adivinarCategoria("Nafta camioneta", categorias), "transporte");
  assert.equal(adivinarCategoria("Papel kraft", categorias), "packaging");
  assert.equal(adivinarCategoria("Cosas varias", categorias), null);
});

test("miles con coma, como los escribe el dictado del iPhone", () => {
  assert.deepEqual(leer("50 rosas a 80,000 y el flete a 12,000"), [
    { descripcion: "50 rosas", monto: 80000, categoria_id: "flores", fecha: hoy },
    { descripcion: "Flete", monto: 12000, categoria_id: "transporte", fecha: hoy },
  ]);
  const casos: [string, number][] = [
    ["alquiler 1,500,000", 1500000],
    ["papel 1,250.50", 1251],
    ["nafta 1,5 mil", 1500],
    ["cintas 12,50", 13],
  ];
  for (const [texto, monto] of casos) assert.equal(leer(texto)[0]?.monto, monto, texto);
});

const fijo = (nombre: string, monto: number, categoria_id: string, regla: object) => ({
  nombre, monto, categoria_id, frecuencia: "mensual", dia: 1, dias_semana: [], ...regla,
});
const leerFijos = (texto: string) => interpretarFijos(texto, { categorias });

test("fijo dictado con días de la semana", () => {
  assert.deepEqual(leerFijos("flores lunes y miércoles 280 mil"), [
    fijo("Flores", 280000, "flores", { frecuencia: "semanal", dias_semana: [1, 3] }),
  ]);
});

test("varios fijos dictados juntos, con día del mes y quincenal", () => {
  assert.deepEqual(
    leerFijos("alquiler 1.370.000 el día 1, luz 160 mil el 10 y papelería cada 15 días 100 mil"),
    [
      fijo("Alquiler", 1370000, "alquiler", {}),
      fijo("Luz", 160000, "servicios", { dia: 10 }),
      fijo("Papelería", 100000, "packaging", { frecuencia: "quincenal" }),
    ],
  );
});

test("la lista pegada tal cual la mandó la florería", () => {
  const pegado = `Gastos estimados

Gasto	Frecuencia	Estimado
🌸 Flores	Lunes y miércoles — $280.000 cada día	$2.240.000/mes
🏠 Alquiler	Mensual	$1.370.000
🧾 Expensas	Mensual	$160.000
🚨 Prosegur	Mensual	$145.000
💡 Luz	Mensual	$160.000
📄 Insumos de papelería	Cada 15 días — $100.000	$200.000/mes
🎀 Insumos de cintas	Cada 15 días — $90.000	$180.000/mes
🚗 Delivery / movilidad para compras	Variable	A completar
🛒 Otros gastos de compras	Variable	A completar

Total mensual estimado hasta ahora: $4.455.000

Para las flores calculé 8 compras al mes (4 lunes + 4 miércoles × $280.000). Si algún mes tiene 5 lunes o miércoles, ese gasto subiría.`;
  assert.deepEqual(leerFijos(pegado), [
    fijo("Flores", 280000, "flores", { frecuencia: "semanal", dias_semana: [1, 3] }),
    fijo("Alquiler", 1370000, "alquiler", {}),
    fijo("Expensas", 160000, "alquiler", {}),
    fijo("Prosegur", 145000, "servicios", {}),
    fijo("Luz", 160000, "servicios", {}),
    fijo("Insumos de papelería", 100000, "packaging", { frecuencia: "quincenal" }),
    fijo("Insumos de cintas", 90000, "packaging", { frecuencia: "quincenal" }),
  ]);
});
