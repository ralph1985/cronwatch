import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { Config } from "./config.js";

const exec = promisify(execFile);
const BEGIN = "# BEGIN CRONWATCH";
const END = "# END CRONWATCH";
const BACKUP_BEGIN = "# BEGIN CRONWATCH CRONTAB BACKUP";
const BACKUP_END = "# END CRONWATCH CRONTAB BACKUP";

export async function installCron(config: Config): Promise<void> {
  let existing = "";
  try { existing = (await exec("crontab", ["-l"])).stdout; } catch { /* no existing user crontab */ }
  const content = buildCrontab(existing, config);
  const child = await import("node:child_process");
  await new Promise<void>((resolve, reject) => {
    const process = child.spawn("crontab", ["-"], { stdio: ["pipe", "ignore", "pipe"] });
    let error = "";
    process.stderr.on("data", (chunk) => { error += chunk; });
    process.on("error", reject);
    process.on("close", (code) => code === 0 ? resolve() : reject(new Error(error || `crontab terminó con código ${code}`)));
    process.stdin.end(content);
  });
}

export function buildCrontab(existing: string, config: Config): string {
  const withoutBlocks = existing
    .replace(new RegExp(`${BACKUP_BEGIN}[\\s\\S]*?${BACKUP_END}\\n?`, "g"), "")
    .replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`, "g"), "");
  // Cron does not load the interactive shell, so PATH-based pnpm resolution
  // breaks when Node is installed through nvm. Pin the package-manager shim
  // next to the Node executable used to install this crontab entry.
  const pnpmBin = path.join(path.dirname(process.execPath), "pnpm");
  const command = `cd ${shellQuote(config.projectRoot)} && ${shellQuote(pnpmBin)} start >> ${shellQuote(config.varRoot + "/logs/cronwatch.cron.log")} 2>&1`;
  const backupScript = path.join(config.projectRoot, "scripts", "backup-crontab.sh");
  const backupCommand = `/usr/bin/flock -n /tmp/cronwatch-crontab-backup.lock ${shellQuote(backupScript)} >> ${shellQuote(config.varRoot + "/logs/cronwatch-crontab-backup.log")} 2>&1`;
  const base = withoutBlocks.trimEnd();
  return `${base}${base ? "\n\n" : ""}${BACKUP_BEGIN}\nCRON_TZ=Europe/Madrid\n0 1 * * * ${backupCommand}\n${BACKUP_END}\n\n${BEGIN}\n${config.schedule} ${command}\n${END}\n`;
}

function shellQuote(value: string): string { return `'${value.replaceAll("'", "'\\''")}'`; }
