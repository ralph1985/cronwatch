import { test } from "node:test";
import assert from "node:assert/strict";
import { timestampInLine } from "../src/collect.js";

test("reconoce marcas ISO con desplazamiento horario", () => {
  const timestamp = timestampInLine("[2026-08-30T21:30:00+02:00] Copia y comprobación finalizadas correctamente");
  assert.equal(timestamp?.toISOString(), "2026-08-30T19:30:00.000Z");
});
