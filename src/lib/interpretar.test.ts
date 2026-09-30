import { test } from "node:test";
import assert from "node:assert/strict";
import { adivinarCategoria, interpretarGastos } from "./interpretar.ts";

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
