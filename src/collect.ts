import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Config } from "./config.js";
import { limitText } from "./redaction.js";
import type { BackupCheck, Evidence, ScheduledJob, JobSource } from "./types.js";
import { formatWindow, inWindow, reportWindow, type ReportWindow } from "./time-window.js";

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

const BACKUP_SOURCES = [
  { project: "Jucart", provider: "Supabase", log: "/home/rafa/dev/jucart/var/log/supabase-backup.cron.log" },
  { project: "Irati", provider: "Supabase", log: "/home/rafa/dev/irati-app/var/log/supabase-backup.cron.log" },
  { project: "encuesta-simple", provider: "Neon", log: "/home/rafa/dev/encuesta-simple/var/log/neon-backup.log" },
  { project: "Kamikazes", provider: "Neon", log: "/home/rafa/dev/kamikazes-app/var/log/neon-backup.log" },
  { project: "loto-sync", provider: "Vercel Postgres", log: "/home/rafa/dev/loto-sync/backups/backup-cron.log" },
  { project: "Ofertas Radar", provider: "Prisma Postgres", log: "/home/rafa/dev/ofertas-radar/var/log/prisma-postgres-backup.log" },
  { project: "A Punto", provider: "PostgreSQL", log: "/home/rafa/dev/a-punto/var/log/postgres-backup.cron.log" },
  { project: "Mis Facturas", provider: "PostgreSQL", log: "/home/rafa/dev/mis-facturas/var/log/postgres-backup.cron.log" },
  { project: "Obsidian", provider: "Copia local", log: "/home/rafa/dev/backup-offsite/var/log/obsidian-backup.log" },
  { project: "Google Drive", provider: "Copia externa", log: "/home/rafa/dev/backup-offsite/var/log/google-drive-backup.log" }
] as const;

export function timestampInLine(line: string): Date | undefined {
  const utc = line.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  if (utc) return new Date(`${utc[1]}-${utc[2]}-${utc[3]}T${utc[4]}:${utc[5]}:${utc[6]}Z`);
  const iso = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))/);
  if (iso) return new Date(iso[1]);
  const local = line.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (local) return new Date(`${local[1]}-${local[2]}-${local[3]}T${local[4]}:${local[5]}:${local[6]}Z`);
  return undefined;
}

function filterLog(text: string, window: ReportWindow): string {
  let active: Date | undefined;
  return text.split(/\r?\n/).filter((line) => {
    const timestamp = timestampInLine(line);
    if (timestamp) active = timestamp;
    return Boolean(active && inWindow(active, window));
  }).join("\n").trim();
}

export function backupCheckFromLog(content: string, project: string, provider: string, window: ReportWindow): BackupCheck {
  const lines = content.split(/\r?\n/);
  const runs = lines.map((line) => ({ line, timestamp: timestampInLine(line) }))
    .filter((run): run is { line: string; timestamp: Date } => Boolean(run.timestamp && inWindow(run.timestamp, window)));
  type BackupEvent = { line: string; timestamp: Date; kind: "success" | "failure"; index: number };
  const events: BackupEvent[] = [];
  runs.forEach((run, index) => {
    if (/failed|failure|error|could not|no se pudo/i.test(run.line)) {
      events.push({ ...run, kind: "failure", index });
    } else if (/backup created|backup SQL creado|^Local backup ready:|^OK:|Copia y comprobación finalizadas correctamente/i.test(run.line)) {
      events.push({ ...run, kind: "success", index });
    }
  });
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.index - b.index);
  const latestSuccess = [...events].reverse().find((event) => event.kind === "success");
  const latestEvent = events.at(-1);
  const status = latestEvent?.kind === "failure" ? "FALLO" : latestEvent ? "OK" : "SIN EVIDENCIA";
  return {
    project,
    provider,
    status,
    observedAt: latestSuccess?.timestamp.toISOString(),
    detail: latestEvent?.line ?? `No hay ejecuciones en ${formatWindow(window)}.`,
  };
}

async function collectBackups(config: Config, window: ReportWindow): Promise<BackupCheck[]> {
  return Promise.all(BACKUP_SOURCES.map(async ({ project, provider, log }) => {
    try {
      const content = await readFile(log, "utf8");
      return backupCheckFromLog(content, project, provider, window);
    } catch (error) {
      return { project, provider, status: "SIN EVIDENCIA", detail: `No se pudo leer el log de backup: ${String(error)}` };
    }
  }));
}

async function collectCrontabBackup(config: Config, window: ReportWindow): Promise<BackupCheck> {
  const directory = path.join(config.varRoot, "backups", "crontab");
  try {
    const candidates = (await readdir(directory)).filter((name) => /^crontab-.*\.txt$/.test(name));
    const files = await Promise.all(candidates.map(async (name) => {
      const file = path.join(directory, name);
      return { name, file, metadata: await stat(file) };
    }));
    const recent = files
      .filter(({ metadata }) => inWindow(new Date(metadata.mtimeMs), window))
      .sort((a, b) => b.metadata.mtimeMs - a.metadata.mtimeMs)[0];
    if (!recent) {
      return { project: "CronWatch", provider: "Copia del crontab", status: "AVISOS", detail: `No hay una copia diaria en ${formatWindow(window)}.` };
    }
    return { project: "CronWatch", provider: "Copia del crontab", status: "OK", observedAt: recent.metadata.mtime.toISOString(), detail: `Copia disponible: ${recent.name}` };
  } catch (error) {
    return { project: "CronWatch", provider: "Copia del crontab", status: "AVISOS", detail: `No se pudo leer el directorio de copias: ${String(error)}` };
  }
}

export async function collectEvidence(config: Config): Promise<Evidence> {
  const window = reportWindow(new Date(), config.timezone);
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

  const journal = await commandText("journalctl", ["--since", window.start.toISOString(), "--until", window.end.toISOString(), "--no-pager", "-n", "500"]);
  logs.push({ source: `journalctl ${formatWindow(window)}`, ...limitText(journal.text, config.logMaxBytes) });
  if (!journal.ok) warnings.push("No se pudo leer journalctl.");

  const paths = new Set<string>();
  for (const job of jobs) {
    for (const match of job.command.matchAll(/(?:^|\s)(\/home\/rafa\/dev\/[^\s;&|]+)/g)) paths.add(match[1].replace(/["')]+$/, ""));
  }
  for (const file of paths) {
    try {
      const stat = await readFile(file, "utf8");
      const content = /\/var\/log\/|\.log$/.test(file) ? filterLog(stat, window) : stat;
      context.push({ path: file, ...limitText(content, config.logMaxBytes) });
    } catch { warnings.push(`No se pudo leer contexto relacionado: ${file}`); }
  }
  const externalJobs = jobs.filter((job) => !job.command.includes(config.projectRoot));
  return { collectedAt: new Date().toISOString(), timezone: config.timezone, window: { start: window.start.toISOString(), end: window.end.toISOString() }, jobs: externalJobs, sources, logs, context, backups: [await collectCrontabBackup(config, window), ...(await collectBackups(config, window))], warnings };
}
