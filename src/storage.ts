import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "./config.js";

export async function ensureStorage(config: Config): Promise<void> {
  await Promise.all(["evidence", "reports", "pending", "logs"].map((dir) => mkdir(path.join(config.varRoot, dir), { recursive: true, mode: 0o700 })));
}

export async function writeJson(config: Config, directory: string, name: string, value: unknown): Promise<string> {
  const file = path.join(config.varRoot, directory, name);
  await writeFile(file, JSON.stringify(value, null, 2), { mode: 0o600 });
  return file;
}

export async function writeReport(config: Config, name: string, text: string, pending = false): Promise<string> {
  const directory = pending ? "pending" : "reports";
  const file = path.join(config.varRoot, directory, name);
  await writeFile(file, text, { mode: 0o600 });
  return file;
}

export async function readPending(config: Config): Promise<string[]> {
  try { return (await readdir(path.join(config.varRoot, "pending"))).filter((name) => name.endsWith(".txt")).sort(); }
  catch { return []; }
}

export async function readStored(config: Config, directory: string, name: string): Promise<string> {
  return readFile(path.join(config.varRoot, directory, name), "utf8");
}

export async function removeStored(config: Config, directory: string, name: string): Promise<void> {
  await rm(path.join(config.varRoot, directory, name), { force: true });
}

export async function pruneStorage(config: Config): Promise<void> {
  const cutoff = Date.now() - config.retentionDays * 86_400_000;
  for (const directory of ["evidence", "reports", "pending", "logs"]) {
    const root = path.join(config.varRoot, directory);
    for (const name of await readdir(root)) {
      const file = path.join(root, name);
      const { mtimeMs } = await import("node:fs/promises").then((fs) => fs.stat(file));
      if (mtimeMs < cutoff) await rm(file, { force: true });
    }
  }
}
