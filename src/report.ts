import type { Evidence } from "./types.js";

export function buildPrompt(evidenceJson: string): string {
  return "Analiza en español el paquete de evidencias de CronWatch incluido entre las marcas EVIDENCE.\n\n" +
    "Solo puedes leer y analizar el contenido incluido. No ejecutes comandos ni modifiques archivos.\n" +
    "Genera un informe breve de texto plano con: resumen ejecutivo, tareas correctas, fallos, anomalías, fuentes no accesibles y recomendaciones concretas. " +
    "Distingue claramente entre evidencia observada e inferencias. No inventes ejecuciones ni datos ausentes.\n\n" +
    "--- BEGIN EVIDENCE ---\n" + evidenceJson + "\n--- END EVIDENCE ---";
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
