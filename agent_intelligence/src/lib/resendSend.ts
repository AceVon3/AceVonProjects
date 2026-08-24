// Minimal Resend sender shared by the digest routes (raw fetch, no SDK —
// same pattern as /api/feedback). Returns null on success, else a short
// error string for the run report.

export async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "AgencyMan <digest@agencyman.ai>",
      // digest@ is send-only — replies land at a real, monitored inbox
      // (same one the feedback route delivers to). Ryan, 2026-08-24.
      reply_to: ["support@myproagency.com"],
      to: [to],
      subject,
      html,
    }),
  });
  if (r.ok) return null;
  return `resend ${r.status}: ${(await r.text()).slice(0, 200)}`;
}
