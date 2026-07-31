import type { Evidence } from "./types.js";

export const INCLUDED_PROJECTS = [
  { key: "jucart", name: "Jucart", root: "/home/rafa/dev/jucart" },
  { key: "irati", name: "Irati", root: "/home/rafa/dev/irati-app" },
  { key: "encuesta-simple", name: "encuesta-simple", root: "/home/rafa/dev/encuesta-simple" }
] as const;

export function buildPrompt(evidenceJson: string): string {
  return "Analiza en español el paquete de evidencias de CronWatch incluido entre las marcas EVIDENCE.\n\n" +
    "Solo puedes leer y analizar el contenido incluido. No ejecutes comandos ni modifiques archivos.\n" +
    "Limita el análisis exclusivamente a estos proyectos y sus automatizaciones: Jucart, Irati y encuesta-simple. " +
    "Ignora avisos generales del sistema que no estén relacionados con esos proyectos.\n" +
    "Genera texto usando exactamente estas secciones: RESUMEN GENERAL, Jucart, Irati y encuesta-simple. " +
    "En cada proyecto incluye Estado (OK, AVISOS o FALLO), Tareas correctas, Fallos y avisos y Recomendaciones. " +
    "Mantén los éxitos resumidos y describe completamente los fallos y avisos. Distingue evidencia observada e inferencias. " +
    "No inventes ejecuciones ni datos ausentes.\n\n" +
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

export function buildHtmlReport(report: string, evidence: Evidence): string {
  const general = sectionText(report, "RESUMEN GENERAL") || report.split(/^#+\s*(?:Jucart|Irati|encuesta-simple)\s*$/im)[0].trim();
  const cards = INCLUDED_PROJECTS.map((project) => {
    const section = sectionText(report, project.name);
    const status = statusFor(section, evidence, project.root);
    const jobs = evidence.jobs.filter((job) => job.command.includes(project.root)).length;
    const color = status === "OK" ? "#15803d" : status === "FALLO" ? "#b91c1c" : "#b45309";
    const content = section || `No hay análisis específico disponible para ${project.name}. Tareas detectadas: ${jobs}.`;
    return `<section class="card"><div class="card-head"><h2>${escapeHtml(project.name)}</h2><span class="status" style="color:${color};border-color:${color}">${status}</span></div><p class="meta">${jobs} automatización${jobs === 1 ? "" : "es"} detectada${jobs === 1 ? "" : "s"}</p><div>${renderText(content)}</div></section>`;
  }).join("\n");
  const overall = INCLUDED_PROJECTS.map((project) => statusFor(sectionText(report, project.name), evidence, project.root));
  const overallStatus = overall.includes("FALLO") ? "FALLO" : overall.includes("AVISOS") ? "AVISOS" : "OK";
  const overallColor = overallStatus === "OK" ? "#15803d" : overallStatus === "FALLO" ? "#b91c1c" : "#b45309";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CronWatch</title></head><body style="margin:0;background:#f3f4f6;color:#172033;font-family:Arial,Helvetica,sans-serif"><main style="max-width:760px;margin:0 auto;padding:24px 14px"><header style="background:#172033;color:#fff;border-radius:18px;padding:24px;margin-bottom:16px"><p style="margin:0 0 8px;color:#b8c7e6;font-size:12px;letter-spacing:.12em;text-transform:uppercase">CronWatch</p><h1 style="margin:0 0 14px;font-size:26px">Informe diario de automatizaciones</h1><span class="status" style="color:${overallColor};border-color:${overallColor};background:#fff">${overallStatus}</span></header><section class="card" style="background:#fff;border-radius:16px;padding:20px;margin-bottom:14px;box-shadow:0 2px 10px #17203312"><h2 style="margin-top:0">Resumen general</h2><div>${renderText(general)}</div></section>${cards}<footer style="color:#667085;font-size:12px;padding:12px 4px">Informe generado por CronWatch. Las conclusiones distinguen entre evidencia observada e inferencias.</footer></main><style>.card{background:#fff;border-radius:16px;padding:20px;margin-bottom:14px;box-shadow:0 2px 10px #17203312}.card-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.card h2{margin:0 0 8px;font-size:20px}.status{display:inline-block;border:1px solid;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;background:#fff}.meta{margin:0 0 16px;color:#667085;font-size:13px}ul{padding-left:20px}li{margin:5px 0}</style></body></html>`;
}

export function fallbackReport(evidence: Evidence, error?: string): string {
  const failed = evidence.warnings.length + evidence.sources.filter((source) => !source.ok).length;
  return [
    "CRONWATCH — INFORME PARCIAL",
    `Fecha de recopilación: ${evidence.collectedAt}`,
    `Tareas detectadas: ${evidence.jobs.length}`,
    `Fuentes con incidencias: ${failed}`,
    "",
    "Avisos:",
    ...(evidence.warnings.length ? evidence.warnings.map((warning) => `- ${warning}`) : ["- No hay avisos de recopilación."]),
    ...(error ? [`- Codex no pudo generar el diagnóstico: ${error}`] : []),
    "",
    "Este informe contiene únicamente datos recopilados localmente."
  ].join("\n");
}
