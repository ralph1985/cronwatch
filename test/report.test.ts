import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHtmlReport, buildPrompt, fallbackReport } from "../src/report.js";

test("el prompt impide acciones y limita el paquete", () => {
  const prompt = buildPrompt('{"jobs":[]}');
  assert.match(prompt, /Solo puedes leer/);
  assert.match(prompt, /No ejecutes comandos/);
  assert.match(prompt, /BEGIN EVIDENCE/);
  assert.match(prompt, /\{"jobs":\[\]\}/);
});

test("genera informe parcial con avisos", () => {
  const report = fallbackReport({ collectedAt: "2026-07-31T08:00:00Z", timezone: "Europe/Madrid", jobs: [], sources: [], logs: [], context: [], warnings: ["sin permisos"] }, "fallo");
  assert.match(report, /INFORME PARCIAL/);
  assert.match(report, /sin permisos/);
  assert.match(report, /fallo/);
});

test("genera informe HTML separado por proyectos", () => {
  const html = buildHtmlReport("## RESUMEN GENERAL\nTodo bien.\n\n## Jucart\nEstado: OK\n\n## Irati\nEstado: AVISOS\n\n## encuesta-simple\nEstado: OK", {
    collectedAt: "2026-07-31T08:00:00Z", timezone: "Europe/Madrid", jobs: [
      { id: "1", source: "user-crontab", schedule: "0 8 * * *", command: "/home/rafa/dev/jucart/scripts/run.sh", raw: "" }
    ], sources: [], logs: [], context: [], warnings: []
  });
  assert.match(html, /Informe diario de automatizaciones/);
  assert.match(html, /Jucart/);
  assert.match(html, /encuesta-simple/);
  assert.match(html, /AVISOS/);
});
