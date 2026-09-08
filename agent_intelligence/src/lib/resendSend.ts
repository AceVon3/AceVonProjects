// Minimal Resend sender shared by the digest routes (raw fetch, no SDK —
// same pattern as /api/feedback). Returns null on success, else a short
// error string for the run report.

export async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  const body = JSON.stringify({
    from: "AgencyMan <digest@agencyman.ai>",
    // digest@ is send-only — replies land at a real, monitored inbox
    // (same one the feedback route delivers to). Ryan, 2026-08-24.
    reply_to: ["support@myproagency.com"],
    to: [to],
    subject,
    html,
  });
  // Resend caps at 10 requests/second. The digest loop throttles under that,
  // but if a 429 still slips through, wait out the window (honoring
  // Retry-After when present) and retry a few times before reporting it —
  // so a momentary burst doesn't drop a recipient (observed 2026-09-08: 15 of
  // 149 sends 429'd on the first unthrottled batch).
  for (let attempt = 0; ; attempt++) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (r.ok) return null;
    if (r.status === 429 && attempt < 4) {
      const retryAfter = Number(r.headers.get("retry-after")) || 1;
      await new Promise((res) => setTimeout(res, retryAfter * 1000 + 250));
      continue;
    }
    return `resend ${r.status}: ${(await r.text()).slice(0, 200)}`;
  }
}
