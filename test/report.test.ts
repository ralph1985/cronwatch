import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, fallbackReport } from "../src/report.js";

test("el prompt impide acciones y limita el paquete", () => {
  const prompt = buildPrompt("/tmp/evidence.json");
  assert.match(prompt, /Solo puedes leer/);
  assert.match(prompt, /No ejecutes comandos/);
  assert.match(prompt, /\/tmp\/evidence.json/);
});

test("genera informe parcial con avisos", () => {
  const report = fallbackReport({ collectedAt: "2026-07-31T08:00:00Z", timezone: "Europe/Madrid", jobs: [], sources: [], logs: [], context: [], warnings: ["sin permisos"] }, "fallo");
  assert.match(report, /INFORME PARCIAL/);
  assert.match(report, /sin permisos/);
  assert.match(report, /fallo/);
});
