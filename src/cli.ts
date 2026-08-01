import path from "node:path";
import { collectEvidence } from "./collect.js";
import { loadConfig } from "./config.js";
import { analyzeWithCodex, verifyCodex } from "./codex.js";
import { sendEmail } from "./email.js";
import { buildHtmlReport, fallbackReport } from "./report.js";
import { ensureStorage, pruneStorage, readPending, readStored, removeStored, writeJson, writeReport } from "./storage.js";
import { installCron } from "./cron.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await operation(); } catch (error) { lastError = error; if (attempt < 2) await sleep(1_000 * 2 ** attempt); }
  }
  throw lastError;
}

function dateStamp(config: Awaited<ReturnType<typeof loadConfig>>): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: config.timezone }).format(new Date());
}

function runStamp(config: Awaited<ReturnType<typeof loadConfig>>): string {
  const now = new Date();
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: config.timezone,
    dateStyle: "short",
    timeStyle: "medium"
  }).format(now).replaceAll("/", "-").replaceAll(",", "").replaceAll(" ", "_").replaceAll(":", "-");
  return `${stamp}-${String(now.getMilliseconds()).padStart(3, "0")}`;
}

async function run(): Promise<void> {
  const config = await loadConfig();
  await ensureStorage(config);
  const stamp = dateStamp(config);
  const executionStamp = runStamp(config);
  const evidence = await retry(() => collectEvidence(config));
  const evidencePath = await writeJson(config, "evidence", `${stamp}.json`, evidence);
  let report: string;
  try { report = await retry(() => analyzeWithCodex(config, evidencePath)); }
  catch (error) { report = fallbackReport(evidence, String(error)); }
  const html = buildHtmlReport(report, evidence);
  const subject = `CronWatch — informe — ${executionStamp}`;
  const reportName = `${executionStamp}.txt`;
  await writeReport(config, reportName, report);
  if (!config.resendApiKey || !config.resendFrom || !config.reportTo.length) {
    await writeReport(config, reportName, `${report}\n\n[Correo no enviado: faltan RESEND_API_KEY, RESEND_FROM o REPORT_TO.]`, true);
    throw new Error("Faltan credenciales o destinatarios de Resend en .env.local.");
  }
  try {
    for (const pending of await readPending(config)) {
      await retry(async () => sendEmail(config.resendApiKey!, config.resendFrom!, config.reportTo, `CronWatch — informe pendiente — ${pending.replace(".txt", "")}`, await readStored(config, "pending", pending)));
      await removeStored(config, "pending", pending);
    }
    await retry(() => sendEmail(config.resendApiKey!, config.resendFrom!, config.reportTo, subject, report, html));
  } catch (error) {
    await writeReport(config, reportName, `${report}\n\n[Correo pendiente por fallo de Resend: ${String(error)}]`, true);
    throw error;
  } finally { await pruneStorage(config); }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "run";
  const config = await loadConfig();
  if (command === "collect") {
    await ensureStorage(config);
    const evidence = await collectEvidence(config);
    const file = await writeJson(config, "evidence", `${dateStamp(config)}-manual.json`, evidence);
    console.log(file);
    return;
  }
  if (command === "install-cron") { await ensureStorage(config); await installCron(config); console.log(`CronWatch instalado: ${config.schedule}`); return; }
  if (command === "verify-codex") { console.log(await verifyCodex(config)); return; }
  if (command === "run") { await run(); return; }
  throw new Error(`Comando desconocido: ${command}`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
