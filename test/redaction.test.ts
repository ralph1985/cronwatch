import { test } from "node:test";
import assert from "node:assert/strict";
import { limitText, redactSecrets } from "../src/redaction.js";

test("redacta secretos comunes", () => {
  const result = redactSecrets("token=abc123 Authorization: Bearer xyz postgres://user:pass@example.com/db");
  assert.match(result, /token=\[REDACTED\]/);
  assert.match(result, /Bearer \[REDACTED\]/);
  assert.match(result, /user:\[REDACTED\]@/);
  assert.doesNotMatch(result, /abc123|xyz|pass/);
});

test("conserva extremos y marca logs grandes", () => {
  const result = limitText("inicio-" + "x".repeat(100) + "-final", 30);
  assert.equal(result.truncated, true);
  assert.match(result.content, /inicio/);
  assert.match(result.content, /final/);
  assert.match(result.content, /RECORTADO/);
});
