import type { Evidence } from "./types.js";

export const INCLUDED_PROJECTS = [
  { key: "jucart", name: "Jucart", root: "/home/rafa/dev/jucart" },
  { key: "irati", name: "Irati", root: "/home/rafa/dev/irati-app" },
  { key: "encuesta-simple", name: "encuesta-simple", root: "/home/rafa/dev/encuesta-simple" },
  { key: "kamikazes", name: "Kamikazes", root: "/home/rafa/dev/kamikazes-app" },
  { key: "loto-sync", name: "loto-sync", root: "/home/rafa/dev/loto-sync" },
  { key: "ofertas-radar", name: "Ofertas Radar", root: "/home/rafa/dev/ofertas-radar" }
] as const;

export function buildPrompt(evidenceJson: string): string {
  return "Analiza en español el paquete de evidencias de CronWatch incluido entre las marcas EVIDENCE.\n\n" +
    "Solo puedes leer y analizar el contenido incluido. No ejecutes comandos ni modifiques archivos.\n" +
    "Limita el análisis exclusivamente a estos proyectos y sus automatizaciones: Jucart, Irati, encuesta-simple, Kamikazes, loto-sync y Ofertas Radar. " +
    "Ignora avisos generales del sistema que no estén relacionados con esos proyectos.\n" +
    "Genera texto usando exactamente estas secciones: RESUMEN GENERAL, Jucart, Irati, encuesta-simple, Kamikazes, loto-sync y Ofertas Radar. " +
    "En cada proyecto incluye Estado (OK, AVISOS o FALLO), Tareas correctas, Fallos y avisos y Recomendaciones. " +
    "Mantén los éxitos resumidos y describe completamente los fallos y avisos. Distingue evidencia observada e inferencias. " +
    "No inventes ejecuciones ni datos ausentes. Da prioridad a la tabla backups de la evidencia: su estado es determinista y debe aparecer reflejado en el resumen general. La fila CronWatch / Copia del crontab es una comprobación operativa y debe tratarse como AVISOS si falta, sin inventar una tarjeta de proyecto. Respeta la ventana temporal indicada en evidence.window y no uses logs fuera de ella.\n\n" +
    "--- BEGIN EVIDENCE ---\n" + evidenceJson + "\n--- END EVIDENCE ---";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function sectionText(report: string, heading: string): string {
  const headings = ["RESUMEN GENERAL", ...INCLUDED_PROJECTS.map((project) => project.name)];
  const start = report.search(new RegExp(`^#+\\s*${heading}\\s*$`, "im"));
  if (start < 0) return "";
  const remainder = report.slice(start).replace(/^#+\s*[^\n]+\n?/i, "");
  const next = headings.filter((candidate) => candidate !== heading).map((candidate) => remainder.search(new RegExp(`^#+\\s*${candidate}\\s*$`, "im"))).filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return (next === undefined ? remainder : remainder.slice(0, next)).trim();
}

function statusFor(section: string, evidence: Evidence, root: string): "OK" | "AVISOS" | "FALLO" {
  const relevantJobs = evidence.jobs.filter((job) => job.command.includes(root));
  const text = section.toLowerCase();
  if (/\bfallo\b|\bfailed\b|\berror\b|http 4\d\d|no se pudo/.test(text)) return "FALLO";
  if (/\bavisos?\b|pendiente|sin evidencia|no hay evidencia/.test(text) || !relevantJobs.length) return "AVISOS";
  return "OK";
}

function renderText(text: string): string {
  return escapeHtml(text).replace(/^[-*] (.+)$/gm, "<li>$1</li>").replace(/(<li>.*<\/li>\n?)+/g, (items) => `<ul>${items}</ul>`).replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
}

const PROJECT_FIELDS = [
  { label: "Tareas correctas", pattern: "Tareas correctas" },
  { label: "Fallos y avisos", pattern: "Fallos y avisos" },
  { label: "Recomendaciones", pattern: "Recomendaciones" }
] as const;

function fieldText(section: string, pattern: string): string {
  const labels = ["Estado(?:\\s*\\([^\\n]*\\))?", ...PROJECT_FIELDS.map((field) => field.pattern)]
    .filter((candidate) => candidate !== pattern).join("|");
  const match = section.match(new RegExp(`(?:^|\\n)\\s*${pattern}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${labels})\\s*:|$)`, "i"));
  return match?.[1]?.trim() || "—";
}

function projectDetailsTable(section: string, status: "OK" | "AVISOS" | "FALLO", jobs: number): string {
  const color = status === "OK" ? "#15803d" : status === "FALLO" ? "#b91c1c" : "#b45309";
  const rows = [
    `<tr><th>Estado</th><td><span class="status" style="color:${color};border-color:${color}">${status}</span></td></tr>`,
    `<tr><th>Automatizaciones detectadas</th><td>${jobs}</td></tr>`,
    ...PROJECT_FIELDS.map((field) => `<tr><th>${field.label}</th><td>${renderText(fieldText(section, field.pattern))}</td></tr>`)
  ].join("");
  return `<div class="table-wrap"><table class="project-table"><tbody>${rows}</tbody></table></div>`;
}

function backupRows(evidence: Evidence): string {
  const backupRows = evidence.backups.map((backup) => {
    const color = backup.status === "OK" ? "#15803d" : backup.status === "FALLO" ? "#b91c1c" : "#b45309";
    const observed = backup.observedAt ? new Intl.DateTimeFormat("es-ES", { timeZone: evidence.timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(backup.observedAt)) : "—";
    return `<tr><td>${escapeHtml(backup.project)}</td><td>${escapeHtml(backup.provider)}</td><td><span class="status" style="color:${color};border-color:${color}">${backup.status}</span></td><td>${observed}</td><td>${escapeHtml(backup.detail)}</td></tr>`;
  }).join("");
  return backupRows;
}

export function buildTextReport(evidence: Evidence): string {
  const windowLabel = new Intl.DateTimeFormat("es-ES", { timeZone: evidence.timezone, dateStyle: "short", timeStyle: "short" });
  const windowText = `${windowLabel.format(new Date(evidence.window.start))} → ${windowLabel.format(new Date(evidence.window.end))}`;
  const rows = evidence.backups.map((backup) => `- ${backup.project} | ${backup.provider} | ${backup.status} | ${backup.observedAt ? windowLabel.format(new Date(backup.observedAt)) : "—"} | ${backup.detail}`);
  return ["CRONWATCH — COPIAS DE SEGURIDAD", `Ventana analizada: ${windowText}`, "", "Proyecto | Servicio | Estado | Última correcta | Evidencia", ...rows].join("\n");
}

export function buildHtmlReport(evidence: Evidence): string {
  const overall = evidence.backups.map((backup) => backup.status);
  const overallStatus = overall.includes("FALLO") ? "FALLO" : overall.includes("AVISOS") || overall.includes("SIN EVIDENCIA") ? "AVISOS" : "OK";
  const overallColor = overallStatus === "OK" ? "#15803d" : overallStatus === "FALLO" ? "#b91c1c" : "#b45309";
  const rows = backupRows(evidence);
  const windowLabel = new Intl.DateTimeFormat("es-ES", { timeZone: evidence.timezone, dateStyle: "short", timeStyle: "short" });
  const windowText = `${windowLabel.format(new Date(evidence.window.start))} → ${windowLabel.format(new Date(evidence.window.end))}`;
  const backupTable = `<section class="card"><h2>Copias de seguridad nocturnas</h2><p class="meta">Ventana analizada: ${windowText}</p><div class="table-wrap"><table><thead><tr><th>Proyecto</th><th>Servicio</th><th>Estado</th><th>Última correcta</th><th>Evidencia</th></tr></thead><tbody>${rows || `<tr><td colspan="5">No hay datos de copias.</td></tr>`}</tbody></table></div></section>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CronWatch</title></head><body style="margin:0;background:#f3f4f6;color:#172033;font-family:Arial,Helvetica,sans-serif"><main style="max-width:900px;margin:0 auto;padding:24px 14px"><header style="background:#172033;color:#fff;border-radius:18px;padding:24px;margin-bottom:16px"><p style="margin:0 0 8px;color:#b8c7e6;font-size:12px;letter-spacing:.12em;text-transform:uppercase">CronWatch</p><h1 style="margin:0 0 14px;font-size:26px">Copias de seguridad nocturnas</h1><span class="status" style="color:${overallColor};border-color:${overallColor};background:#fff">${overallStatus}</span></header>${backupTable}<footer style="color:#667085;font-size:12px;padding:12px 4px">Informe generado por CronWatch.</footer></main><style>.card{background:#fff;border-radius:16px;padding:20px;margin-bottom:14px;box-shadow:0 2px 10px #17203312}.status{display:inline-block;border:1px solid;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;background:#fff}.meta{margin:0 0 16px;color:#667085;font-size:13px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;vertical-align:top;padding:10px 8px;border-bottom:1px solid #e5e7eb}th{color:#667085;font-size:11px;text-transform:uppercase;letter-spacing:.04em}</style></body></html>`;
}

export function fallbackReport(evidence: Evidence, error?: string): string {
  const failed = evidence.warnings.length + evidence.sources.filter((source) => !source.ok).length;
  return [
    "CRONWATCH — INFORME PARCIAL",
    `Fecha de recopilación: ${evidence.collectedAt}`,
    `Ventana analizada: ${evidence.window.start} → ${evidence.window.end}`,
    `Tareas detectadas: ${evidence.jobs.length}`,
    `Fuentes con incidencias: ${failed}`,
    "",
    "Avisos:",
    "",
    "Copias de seguridad:",
    ...evidence.backups.map((backup) => `- ${backup.project} (${backup.provider}): ${backup.status} — ${backup.detail}`),
    ...(evidence.warnings.length ? evidence.warnings.map((warning) => `- ${warning}`) : ["- No hay avisos de recopilación."]),
    ...(error ? [`- Codex no pudo generar el diagnóstico: ${error}`] : []),
    "",
    "Este informe contiene únicamente datos recopilados localmente."
  ].join("\n");
}
