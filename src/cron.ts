import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Config } from "./config.js";

const exec = promisify(execFile);
const BEGIN = "# BEGIN CRONWATCH";
const END = "# END CRONWATCH";

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
  const withoutBlock = existing.replace(new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`, "g"), "");
  const command = `cd ${shellQuote(config.projectRoot)} && /usr/bin/env PATH=/home/rafa/.local/bin:/home/rafa/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin pnpm start >> ${shellQuote(config.varRoot + "/logs/cronwatch.cron.log")} 2>&1`;
  return `${withoutBlock.trimEnd()}${withoutBlock.trim() ? "\n\n" : ""}${BEGIN}\n${config.schedule} ${command}\n${END}\n`;
}

function shellQuote(value: string): string { return `'${value.replaceAll("'", "'\\''")}'`; }
