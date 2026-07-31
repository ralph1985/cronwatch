import { readFile } from "node:fs/promises";
import path from "node:path";

export interface Config {
  projectRoot: string;
  devRoot: string;
  varRoot: string;
  timezone: string;
  schedule: string;
  retentionDays: number;
  logMaxBytes: number;
  resendApiKey?: string;
  resendFrom?: string;
  reportTo: string[];
  codexBin: string;
}

function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

export async function loadConfig(projectRoot = process.env.CRONWATCH_PROJECT_ROOT ?? process.cwd()): Promise<Config> {
  let fileValues: Record<string, string> = {};
  try {
    fileValues = parseEnv(await readFile(path.join(projectRoot, ".env.local"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const value = (key: string, fallback?: string) => process.env[key] ?? fileValues[key] ?? fallback;
  const devRoot = value("CRONWATCH_DEV_ROOT", "/home/rafa/dev")!;
  return {
    projectRoot,
    devRoot,
    varRoot: path.join(projectRoot, "var"),
    timezone: value("CRONWATCH_TIMEZONE", "Europe/Madrid")!,
    schedule: value("CRONWATCH_SCHEDULE", "0 8 * * *")!,
    retentionDays: Number(value("CRONWATCH_RETENTION_DAYS", "30")),
    logMaxBytes: Number(value("CRONWATCH_LOG_MAX_BYTES", "200000")),
    resendApiKey: value("RESEND_API_KEY"),
    resendFrom: value("RESEND_FROM"),
    reportTo: (value("REPORT_TO", "") ?? "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
    codexBin: value("CRONWATCH_CODEX_BIN", "/home/rafa/.local/bin/codex")!
  };
}
