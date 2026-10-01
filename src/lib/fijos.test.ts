import { test } from "node:test";
import assert from "node:assert/strict";
import { estimadoMensual, ocurrenciasEnMes, textoFrecuencia } from "./fijos.ts";

test("mensual cae un día por mes, y el 31 se corre al último día", () => {
  assert.deepEqual(ocurrenciasEnMes({ frecuencia: "mensual", dia: 10, dias_semana: [] }, "2026-10"), ["2026-10-10"]);
  assert.deepEqual(ocurrenciasEnMes({ frecuencia: "mensual", dia: 31, dias_semana: [] }, "2026-02"), ["2026-02-28"]);
});

test("quincenal cae el día elegido y 15 días después", () => {
  assert.deepEqual(ocurrenciasEnMes({ frecuencia: "quincenal", dia: 5, dias_semana: [] }, "2026-10"), [
    "2026-10-05",
    "2026-10-20",
  ]);
  assert.deepEqual(ocurrenciasEnMes({ frecuencia: "quincenal", dia: 15, dias_semana: [] }, "2026-02"), [
    "2026-02-15",
    "2026-02-28",
  ]);
});

test("semanal cae en cada día de la semana elegido (1 = lunes)", () => {
  // Octubre 2026: lunes 5, 12, 19, 26 y miércoles 7, 14, 21, 28
  assert.deepEqual(ocurrenciasEnMes({ frecuencia: "semanal", dia: 1, dias_semana: [1, 3] }, "2026-10"), [
    "2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14",
    "2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28",
  ]);
});

test("el estimado del mes multiplica el monto por las veces que cae", () => {
  assert.equal(estimadoMensual({ frecuencia: "semanal", dia: 1, dias_semana: [1, 3], monto: 280000 }, "2026-10"), 2240000);
  assert.equal(estimadoMensual({ frecuencia: "quincenal", dia: 1, dias_semana: [], monto: 100000 }, "2026-10"), 200000);
});

test("describe la frecuencia en criollo", () => {
  assert.equal(textoFrecuencia({ frecuencia: "mensual", dia: 10, dias_semana: [] }), "Día 10 de cada mes");
  assert.equal(textoFrecuencia({ frecuencia: "quincenal", dia: 5, dias_semana: [] }), "Días 5 y 20");
  assert.equal(textoFrecuencia({ frecuencia: "semanal", dia: 1, dias_semana: [3, 1] }), "Lunes y miércoles");
  assert.equal(textoFrecuencia({ frecuencia: "semanal", dia: 1, dias_semana: [1, 3, 5] }), "Lunes, miércoles y viernes");
});
