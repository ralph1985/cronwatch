export async function sendEmail(apiKey: string, from: string, to: string[], subject: string, text: string, html?: string): Promise<string> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, ...(html ? { html } : {}) })
  });
  if (!response.ok) throw new Error(`Resend respondió ${response.status}`);
  const payload = await response.json() as { id?: unknown };
  if (typeof payload.id !== "string" || !payload.id) throw new Error("Resend respondió sin ID de correo");
  return payload.id;
}
