import { test } from "node:test";
import assert from "node:assert/strict";
import { backupCheckFromLog, timestampInLine } from "../src/collect.js";

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
