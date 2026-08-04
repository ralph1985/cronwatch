import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWindow, reportWindow } from "../src/time-window.js";

test("a las 08:00 analiza desde las 08:00 del día anterior hasta las 08:00 actuales", () => {
  const window = reportWindow(new Date("2026-08-04T06:00:00.000Z"), "Europe/Madrid");
  assert.equal(window.start.toISOString(), "2026-08-03T06:00:00.000Z");
  assert.equal(window.end.toISOString(), "2026-08-04T06:00:00.000Z");
  assert.match(formatWindow(window), /2026-08-03 08:00/);
});
