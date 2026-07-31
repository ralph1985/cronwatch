import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCrontab } from "../src/cron.js";

const config = { projectRoot: "/home/rafa/dev/cronwatch", varRoot: "/home/rafa/dev/cronwatch/var", schedule: "0 8 * * *" } as never;

test("construye un bloque cron idempotente", () => {
  const first = buildCrontab("MAILTO=me@example.com\n", config);
  const second = buildCrontab(first, config);
  assert.equal(second, first);
  assert.match(first, /# BEGIN CRONWATCH/);
  assert.match(first, /0 8 \* \* \* cd '\/home\/rafa\/dev\/cronwatch'/);
});
