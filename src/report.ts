import type { Evidence } from "./types.js";

export function buildPrompt(evidencePath: string): string {
  return `Analiza en español el paquete de evidencias de CronWatch situado en ${evidencePath}.\n\n` +
    "Solo puedes leer y analizar ese archivo. No ejecutes comandos ni modifiques archivos.\n" +
    "Genera un informe breve de texto plano con: resumen ejecutivo, tareas correctas, fallos, anomalías, fuentes no accesibles y recomendaciones concretas. " +
    "Distingue claramente entre evidencia observada e inferencias. No inventes ejecuciones ni datos ausentes.";
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
