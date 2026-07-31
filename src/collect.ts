import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "./config.js";
import { limitText } from "./redaction.js";
import type { Evidence, ScheduledJob, JobSource } from "./types.js";

const exec = promisify(execFile);
const CRON_RE = /^(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/;

function parseCron(text: string, source: JobSource, file?: string): ScheduledJob[] {
  return text.split(/\r?\n/).flatMap((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || /^(SHELL|PATH|MAILTO|HOME)=/.test(trimmed)) return [];
    const match = trimmed.match(CRON_RE);
    if (!match) return [];
    let schedule = match[1];
    let command = match[2];
    let user: string | undefined;
    if ((source === "system-crontab" || source === "cron.d") && match[2].includes(" ")) {
      const parts = match[2].split(/\s+/);
      if (parts.length > 1 && /^[a-z_][a-z0-9_-]*$/i.test(parts[0])) {
        user = parts.shift();
        command = parts.join(" ");
      }
    }
    return [{ id: `${source}:${file ?? "user"}:${index + 1}`, source, schedule, command, user, file, raw: line }];
  });
}

async function commandText(command: string, args: string[]): Promise<{ ok: boolean; text: string }> {
  try {
    const result = await exec(command, args, { timeout: 15_000, maxBuffer: 2_000_000 });
    return { ok: true, text: `${result.stdout}${result.stderr}`.trim() };
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return { ok: false, text: `${e.stdout ?? ""}${e.stderr ?? e.message ?? ""}`.trim() };
  }
}

export async function collectEvidence(config: Config): Promise<Evidence> {
  const jobs: ScheduledJob[] = [];
  const sources: Evidence["sources"] = [];
  const warnings: string[] = [];
  const logs: Evidence["logs"] = [];
  const context: Evidence["context"] = [];

  const user = await commandText("crontab", ["-l"]);
  sources.push({ source: "crontab del usuario", ok: user.ok, detail: user.text });
  if (user.ok) jobs.push(...parseCron(user.text, "user-crontab")); else warnings.push("No se pudo leer el crontab del usuario.");

  for (const file of ["/etc/crontab"]) {
    try { jobs.push(...parseCron(await readFile(file, "utf8"), "system-crontab", file)); sources.push({ source: file, ok: true }); }
    catch (error) { sources.push({ source: file, ok: false, detail: String(error) }); warnings.push(`No se pudo leer ${file}.`); }
  }
  try {
    for (const name of await readdir("/etc/cron.d")) {
      const file = path.join("/etc/cron.d", name);
      try { jobs.push(...parseCron(await readFile(file, "utf8"), "cron.d", file)); }
      catch (error) { warnings.push(`No se pudo leer ${file}: ${String(error)}`); }
    }
    sources.push({ source: "/etc/cron.d", ok: true });
  } catch (error) { sources.push({ source: "/etc/cron.d", ok: false, detail: String(error) }); warnings.push("No se pudo leer /etc/cron.d."); }

  for (const scope of [[], ["--user"]]) {
    const result = await commandText("systemctl", [...scope, "list-timers", "--all", "--no-legend", "--no-pager"]);
    const source = scope.length ? "systemd user timers" : "systemd timers";
    sources.push({ source, ok: result.ok, detail: result.text });
    if (!result.ok) warnings.push(`No se pudieron leer ${source}.`);
    for (const line of result.text.split(/\r?\n/).filter(Boolean)) {
      const match = line.match(/^\S+\s+\S+\s+\S+\s+\S+\s+(\S+)\s+(\S+)\s+(\S+)/);
      if (match) jobs.push({ id: `${source}:${match[1]}`, source: "systemd", schedule: `${match[1]} ${match[2]}`, command: match[3], raw: line });
    }
  }

  const journal = await commandText("journalctl", ["--since", "24 hours ago", "--no-pager", "-n", "500"]);
  logs.push({ source: "journalctl últimas 24 horas", ...limitText(journal.text, config.logMaxBytes) });
  if (!journal.ok) warnings.push("No se pudo leer journalctl.");

  const paths = new Set<string>();
  for (const job of jobs) {
    for (const match of job.command.matchAll(/(?:^|\s)(\/home\/rafa\/dev\/[^\s;&|]+)/g)) paths.add(match[1].replace(/["')]+$/, ""));
  }
  for (const file of paths) {
    try {
      const stat = await readFile(file, "utf8");
      context.push({ path: file, ...limitText(stat, config.logMaxBytes) });
    } catch { warnings.push(`No se pudo leer contexto relacionado: ${file}`); }
  }
  const externalJobs = jobs.filter((job) => !job.command.includes(config.projectRoot));
  return { collectedAt: new Date().toISOString(), timezone: config.timezone, jobs: externalJobs, sources, logs, context, warnings };
}
