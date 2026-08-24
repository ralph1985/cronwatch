import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHtmlReport, buildTextReport } from "../src/report.js";

const window = { start: "2026-08-02T06:00:00.000Z", end: "2026-08-03T06:00:00.000Z" };
const evidence = {
  collectedAt: "2026-08-03T08:00:00Z",
  timezone: "Europe/Madrid",
  window,
  jobs: [],
  sources: [],
  logs: [],
  context: [],
  backups: [
  { project: "CronWatch", provider: "Copia del crontab", status: "AVISOS" as const, detail: "No hay una copia diaria." },
  { project: "Jucart", provider: "Supabase", status: "OK" as const, observedAt: "2026-08-03T04:00:01Z", detail: "Backup created" }
  ],
  warnings: []
};

test("genera texto solo con la tabla de copias", () => {
  const report = buildTextReport(evidence);
  assert.match(report, /COPIAS DE SEGURIDAD/);
  assert.match(report, /CronWatch \| Copia del crontab \| AVISOS/);
  assert.match(report, /Jucart \| Supabase \| OK/);
  assert.doesNotMatch(report, /Tareas detectadas|Recomendaciones|Codex/);
});

test("genera HTML solo con la tabla de copias", () => {
  const html = buildHtmlReport(evidence);
  assert.match(html, /Copias de seguridad nocturnas/);
  assert.match(html, /Jucart.*Supabase.*OK/s);
  assert.match(html, /CronWatch.*Copia del crontab.*AVISOS/s);
  assert.match(html, /<span class="status"[^>]*>AVISOS<\/span>/);
  assert.doesNotMatch(html, /Resumen general|Tareas correctas|Recomendaciones|Informe diario de automatizaciones/);
});
