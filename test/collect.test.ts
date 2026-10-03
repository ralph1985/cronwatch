import { test } from "node:test";
import assert from "node:assert/strict";
import { BACKUP_SOURCES, backupCheckFromLog, timestampInLine } from "../src/collect.js";

const window = {
  start: new Date("2026-09-11T22:00:00Z"),
  end: new Date("2026-09-12T22:00:00Z"),
  timezone: "Europe/Madrid",
};

test("reconoce marcas ISO con desplazamiento horario", () => {
  const timestamp = timestampInLine("[2026-08-30T21:30:00+02:00] Copia y comprobación finalizadas correctamente");
  assert.equal(timestamp?.toISOString(), "2026-08-30T19:30:00.000Z");
});

test("reconoce el backup local de Obsidian como correcto", () => {
  const result = backupCheckFromLog(
    "[2026-09-12T00:30:01+02:00] Backup created: obsidian-varememorycloud.tar.gz",
    "Obsidian",
    "Copia local",
    window,
  );

  assert.equal(result.status, "OK");
  assert.equal(result.project, "Obsidian");
});

test("marca como fallo un error posterior del backup", () => {
  const result = backupCheckFromLog(
    "[2026-09-12T00:30:01+02:00] Backup created: obsidian-varememorycloud.tar.gz\n[2026-09-12T00:31:01+02:00] ERROR: no se pudo crear el archivo comprimido",
    "Obsidian",
    "Copia local",
    window,
  );

  assert.equal(result.status, "FALLO");
});

test("marca como correcto un backup posterior al fallo", () => {
  const result = backupCheckFromLog(
    "[2026-09-12T00:30:01+02:00] ERROR: no se pudo resolver el host\n[2026-09-12T00:31:01+02:00] Backup created: obsidian-varememorycloud.tar.gz",
    "Obsidian",
    "Copia local",
    window,
  );

  assert.equal(result.status, "OK");
  assert.match(result.detail, /Backup created/);
  assert.equal(result.observedAt, "2026-09-11T22:31:01.000Z");
});

test("marca sin evidencia un log sin ejecuciones en la ventana", () => {
  const result = backupCheckFromLog(
    "[2026-09-10T00:30:01+02:00] Backup created: antiguo.tar.gz",
    "Obsidian",
    "Copia local",
    window,
  );

  assert.equal(result.status, "SIN EVIDENCIA");
});

test("reconoce el backup PostgreSQL de Mis Facturas como correcto", () => {
  const result = backupCheckFromLog(
    "[2026-09-20T01:30:01+02:00] OK: backup SQL creado en /home/rafa/dev/mis-facturas/var/backups/postgres/mis-facturas-20260919T233001Z.dump",
    "Mis Facturas",
    "PostgreSQL",
    {
      start: new Date("2026-09-19T22:00:00Z"),
      end: new Date("2026-09-20T22:00:00Z"),
      timezone: "Europe/Madrid",
    },
  );

  assert.equal(result.status, "OK");
  assert.equal(result.project, "Mis Facturas");
  assert.equal(result.provider, "PostgreSQL");
});

test("marca como fallo un ERROR posterior del backup PostgreSQL de Mis Facturas", () => {
  const result = backupCheckFromLog(
    "[2026-09-20T01:30:01+02:00] OK: backup SQL creado en /home/rafa/dev/mis-facturas/var/backups/postgres/mis-facturas-20260919T233001Z.dump\n[2026-09-20T01:31:01+02:00] ERROR: no se pudo crear el backup SQL",
    "Mis Facturas",
    "PostgreSQL",
    {
      start: new Date("2026-09-19T22:00:00Z"),
      end: new Date("2026-09-20T22:00:00Z"),
      timezone: "Europe/Madrid",
    },
  );

  assert.equal(result.status, "FALLO");
  assert.equal(result.project, "Mis Facturas");
  assert.equal(result.provider, "PostgreSQL");
});

test("incluye TickTick entre las fuentes de copias", () => {
  assert.deepEqual(BACKUP_SOURCES.find((source) => source.project === "TickTick"), {
    project: "TickTick",
    provider: "Copia local",
    log: "/home/rafa/dev/ticktick-backup/var/log/ticktick-backup.cron.log",
    schedule: {
      kind: "weekly",
      description: "los domingos a las 06:15",
      daysOfWeek: [0],
      hour: 6,
      minute: 15,
      timezone: "Europe/Madrid",
    },
    timestampFallback: "mtime",
  });
});

test("reconoce una copia correcta de TickTick usando la fecha del log", () => {
  const source = BACKUP_SOURCES.find((candidate) => candidate.project === "TickTick");
  const result = backupCheckFromLog(
    "Copia correcta: /home/rafa/dev/ticktick-backup/var/backups/2026-09-12_04-15-01\nProyectos: 3; tareas: 12; subtareas: 4",
    "TickTick",
    "Copia local",
    window,
    source?.schedule,
    new Date("2026-09-12T21:00:00.000Z"),
  );

  assert.equal(result.status, "OK");
  assert.equal(result.project, "TickTick");
  assert.equal(result.observedAt, "2026-09-12T21:00:00.000Z");
});

test("explica la ausencia de loto-sync y calcula la próxima copia", () => {
  const source = BACKUP_SOURCES.find((candidate) => candidate.project === "loto-sync");
  const result = backupCheckFromLog("", "loto-sync", "Vercel Postgres", window, source?.schedule);

  assert.equal(result.status, "SIN EVIDENCIA");
  assert.match(result.detail, /no se ejecuta a diario/);
  assert.match(result.detail, /domingos, martes y viernes/);
  assert.match(result.detail, /13\/9\/26, 4:30/);
});

test("explica la próxima ejecución de un backup semanal nuevo", () => {
  const source = BACKUP_SOURCES.find((candidate) => candidate.project === "Ofertas Radar");
  const result = backupCheckFromLog("", "Ofertas Radar", "Prisma Postgres", window, source?.schedule);

  assert.equal(result.status, "SIN EVIDENCIA");
  assert.match(result.detail, /lunes a las 02:30/);
  assert.match(result.detail, /14\/9\/26, 2:30/);
});

test("explica la próxima ejecución de un backup mensual nuevo", () => {
  const source = BACKUP_SOURCES.find((candidate) => candidate.project === "Kamikazes");
  const result = backupCheckFromLog("", "Kamikazes", "Neon", window, source?.schedule);

  assert.equal(result.status, "SIN EVIDENCIA");
  assert.match(result.detail, /día 1 de cada mes a las 02:00/);
  assert.match(result.detail, /1\/10\/26, 2:00/);
});

test("explica los días alternos de Jucart al calcular la próxima copia", () => {
  const source = BACKUP_SOURCES.find((candidate) => candidate.project === "Jucart");
  const result = backupCheckFromLog("", "Jucart", "Supabase", window, source?.schedule);

  assert.equal(result.status, "SIN EVIDENCIA");
  assert.match(result.detail, /días alternos del calendario a las 03:30/);
  assert.match(result.detail, /13\/9\/26, 3:30/);
});

test("reinicia el patrón de días alternos de Jucart al cambiar de mes", () => {
  const source = BACKUP_SOURCES.find((candidate) => candidate.project === "Jucart");
  const result = backupCheckFromLog(
    "",
    "Jucart",
    "Supabase",
    { start: new Date("2026-09-29T22:00:00Z"), end: new Date("2026-09-30T22:00:00Z"), timezone: "Europe/Madrid" },
    source?.schedule,
  );

  assert.match(result.detail, /1\/10\/26, 3:30/);
});
