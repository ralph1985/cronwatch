export async function sendEmail(apiKey: string, from: string, to: string[], subject: string, text: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text })
  });
  if (!response.ok) throw new Error(`Resend respondió ${response.status}: ${(await response.text()).slice(0, 500)}`);
}
