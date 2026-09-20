import { test } from "node:test";
import assert from "node:assert/strict";
import { sendEmail } from "../src/email.js";

const emailArgs: Parameters<typeof sendEmail> = ["test-api-key", "CronWatch <cronwatch@example.test>", ["recipient@example.test"], "Test report", "Report body"];

test("devuelve el ID de Resend cuando acepta el correo", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ id: "email-test-id" }), { status: 200 });

  try {
    const id = await sendEmail(...emailArgs);
    assert.equal(id, "email-test-id");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lanza un error cuando Resend responde con un estado no exitoso", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("request rejected", { status: 503 });

  try {
    await assert.rejects(
      sendEmail(...emailArgs),
      (error: unknown) => error instanceof Error
        && /Resend respondió 503/.test(error.message)
        && !error.message.includes("request rejected"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});