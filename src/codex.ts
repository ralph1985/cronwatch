import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { Config } from "./config.js";
import { buildPrompt } from "./report.js";

export async function analyzeWithCodex(config: Config, evidencePath: string): Promise<string> {
  const evidenceJson = await readFile(evidencePath, "utf8");
  const prompt = buildPrompt(evidenceJson);
  return new Promise((resolve, reject) => {
    const child = spawn(config.codexBin, ["exec", "-s", "read-only", "-C", config.projectRoot, "-"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("Codex superó el tiempo máximo de 5 minutos.")); }, 300_000);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0 && stdout.trim()) resolve(stdout.trim());
      else reject(new Error((stderr || `Codex terminó con código ${code}`).trim()));
    });
    child.stdin.end(prompt);
  });
}

export async function verifyCodex(config: Config): Promise<string> {
  const result = await new Promise<string>((resolve, reject) => {
    const child = spawn(config.codexBin, ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`No se pudo ejecutar Codex (${code}).`)));
  });
  return result;
}
