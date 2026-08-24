import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHtmlReport, buildPrompt, fallbackReport } from "../src/report.js";

const window = { start: "2026-07-03T06:00:00.000Z", end: "2026-08-03T06:00:00.000Z" };
const backups = [
  { project: "CronWatch", provider: "Copia del crontab", status: "AVISOS" as const, detail: "No hay una copia diaria." },
  { project: "Jucart", provider: "Supabase", status: "OK" as const, observedAt: "2026-08-03T04:00:01Z", detail: "Backup created" }
];

test("el prompt impide acciones y limita el paquete", () => {
  const prompt = buildPrompt('{"jobs":[]}');
  assert.match(prompt, /Solo puedes leer/);
  assert.match(prompt, /No ejecutes comandos/);
  assert.match(prompt, /BEGIN EVIDENCE/);
  assert.match(prompt, /\{"jobs":\[\]\}/);
});

test("genera informe parcial con avisos", () => {
  const report = fallbackReport({ collectedAt: "2026-07-31T08:00:00Z", timezone: "Europe/Madrid", window, jobs: [], sources: [], logs: [], context: [], backups, warnings: ["sin permisos"] }, "fallo");
  assert.match(report, /INFORME PARCIAL/);
  assert.match(report, /sin permisos/);
  assert.match(report, /fallo/);
});

test("genera informe HTML separado por proyectos", () => {
  const html = buildHtmlReport("## RESUMEN GENERAL\nTodo bien.\n\n## Jucart\nEstado: OK\nTareas correctas: Backup nocturno\nFallos y avisos: Ninguno\nRecomendaciones: Ninguna\n\n## Irati\nEstado: AVISOS\n\n## encuesta-simple\nEstado: OK\n\n## Kamikazes\nEstado: OK\n\n## loto-sync\nEstado: OK\n\n## Ofertas Radar\nEstado: OK\nTareas correctas: Backup PostgreSQL\nFallos y avisos: Ninguno\nRecomendaciones: Ninguna", {
    collectedAt: "2026-07-31T08:00:00Z", timezone: "Europe/Madrid", window, backups, jobs: [
      { id: "1", source: "user-crontab", schedule: "0 8 * * *", command: "/home/rafa/dev/jucart/scripts/run.sh", raw: "" }
    ], sources: [], logs: [], context: [], warnings: []
  });
  assert.match(html, /Informe diario de automatizaciones/);
  assert.match(html, /Jucart/);
  assert.match(html, /encuesta-simple/);
  assert.match(html, /Kamikazes/);
  assert.match(html, /loto-sync/);
  assert.match(html, /Ofertas Radar/);
  assert.match(html, /AVISOS/);
  assert.match(html, /Copias de seguridad nocturnas/);
  assert.match(html, /Jucart.*Supabase.*OK/s);
  assert.match(html, /CronWatch.*Copia del crontab.*AVISOS/s);
  assert.match(html, /<span class="status"[^>]*>AVISOS<\/span>/);
  assert.match(html, /Tareas correctas/);
  assert.match(html, /Backup nocturno/);
});
