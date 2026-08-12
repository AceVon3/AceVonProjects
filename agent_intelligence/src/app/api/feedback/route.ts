import { NextResponse } from "next/server";

// POST /api/feedback — send a data-feedback report to support, server-side.
//
// Called by FeedbackFab. Sends via the Resend REST API (raw fetch — no SDK
// dependency) from FEEDBACK_FROM to SUPPORT_TO. Dormant-by-config like the
// auth stack: with no RESEND_API_KEY the route answers 501 and the widget
// falls back to its original mailto: behavior, so shipping this before the
// Resend account exists changes nothing for users.
//
// Deliberately unauthenticated (the widget must work for signed-out /
// dormant-auth sessions) but bounded: message capped, context capped, and a
// small per-instance rate limit so the route can't be used as a spam relay.

const SUPPORT_TO = "support@myproagency.com";
const FROM = process.env.FEEDBACK_FROM ?? "Agencyman feedback <feedback@agencyman.ai>";

const MAX_MESSAGE = 4000;
const MAX_CONTEXT = 1500;

// Per-instance sliding-window rate limit (serverless instances are
// short-lived; this is a nuisance bound, not a security boundary).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
let hits: number[] = [];

export async function POST(req: Request): Promise<NextResponse> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "email sending not configured" },
      { status: 501 },
    );
  }

  const now = Date.now();
  hits = hits.filter(t => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "too many reports, try again shortly" }, { status: 429 });
  }
  hits.push(now);

  let body: { message?: unknown; context?: unknown; subjectTag?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";
  const context = typeof body.context === "string" ? body.context.trim().slice(0, MAX_CONTEXT) : "";
  const subjectTag =
    body.subjectTag === "[HR/compliance]" ? "[HR/compliance]" : "[Rate data]";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [SUPPORT_TO],
      subject: `${subjectTag} In-app report`,
      text: `${message}\n\n---\nContext (auto-included):\n${context}`,
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    console.error("feedback send failed:", r.status, detail.slice(0, 300));
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
