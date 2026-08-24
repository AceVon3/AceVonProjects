// Monthly digest send run. Invoked by the Vercel cron (vercel.json) or
// manually with the same bearer secret.
//
// Auth: Authorization: Bearer <CRON_SECRET>. Vercel attaches this header
// automatically to cron invocations when the CRON_SECRET env var exists;
// DIGEST_SECRET is accepted as a fallback so a manual test run doesn't need
// both values.
//
// Test controls (query params):
//   ?dryRun=1   build everything, send NOTHING, persist NOTHING; returns the
//               per-user report with subjects + counts.
//   ?limit=N    process at most N profiles (after opt-out filtering).
//   ?to=email   redirect EVERY send to this address (test inbox) — sends
//               real email but does NOT persist state, so the real run
//               still behaves as a first send.
//
// Per user: Neon profile -> Clerk email -> buildDigest (with the prior
// compliance snapshot from digest_state) -> inject signed unsubscribe link
// -> Resend. State (last_sent + new snapshot) persists only on a real,
// non-redirected send, so partial failures retry naturally next run.

import { NextRequest, NextResponse } from "next/server";

import { buildDigest, complianceSnapshot, type DigestProfile } from "@/lib/digest";
import { getDigestStates, isDigestDbConfigured, recordSend, unsubscribeToken } from "@/lib/digestDb";
import type { AgentProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // a full send loop is many Resend calls

const APP_URL = "https://agencyman.ai";

type PerUser = {
  user: string;
  email?: string;
  status: "sent" | "dry-run" | "skipped" | "failed";
  reason?: string;
  subject?: string;
  counts?: { mine: number; competitors: number; hrStates: number };
};

function authorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  const ok = (expected?: string) => Boolean(expected) && token === expected;
  return ok(process.env.CRON_SECRET) || ok(process.env.DIGEST_SECRET);
}

async function clerkEmail(userId: string): Promise<string | null> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) return null;
  const r = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const u = await r.json();
  const primaryId = u.primary_email_address_id;
  const all: { id: string; email_address: string }[] = u.email_addresses ?? [];
  return (all.find(e => e.id === primaryId) ?? all[0])?.email_address ?? null;
}

// Stored profile (src/lib/profile.ts flat shape) -> the digest's profile.
// The query builders take the filings discriminated union, where a captive
// carries captive_brand — same construction the app's pages use
// (authorized_brands[0] is the captive's brand by the profile validator).
function toDigestProfile(p: AgentProfile): DigestProfile {
  const agent =
    p.agent_type === "captive"
      ? {
          agent_type: "captive" as const,
          captive_brand: p.authorized_brands[0],
          authorized_brands: p.authorized_brands,
          licensed_states: p.licensed_states,
        }
      : {
          agent_type: "independent" as const,
          authorized_brands: p.authorized_brands,
          licensed_states: p.licensed_states,
        };
  return {
    agent,
    employee_count: p.employee_count,
    employee_states: p.employee_states,
    first_name: p.full_name?.split(/\s+/)[0],
    office_state: p.offices?.[0]?.state,
    remote_count: p.remote_count,
    pay_type: p.pay_type,
  };
}

async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "AgencyMan <digest@agencyman.ai>",
      to: [to],
      subject,
      html,
    }),
  });
  if (r.ok) return null;
  return `resend ${r.status}: ${(await r.text()).slice(0, 200)}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDigestDbConfigured()) {
    return NextResponse.json({ error: "profiles DB not configured" }, { status: 503 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  // A dry run never sends, so it may run without the Resend key (local dev).
  if (!dryRun && !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 503 });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "0") || Infinity;
  const redirectTo = req.nextUrl.searchParams.get("to");
  const runDate = new Date().toISOString().slice(0, 10);

  // Profiles straight from Neon (same table /api/profile writes).
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "");
  const profileRows = await sql`SELECT user_id, data FROM profiles ORDER BY created_at`;
  const states = await getDigestStates();

  const report: PerUser[] = [];
  let processed = 0;

  for (const row of profileRows) {
    const userId = row.user_id as string;
    const state = states.get(userId);
    if (state?.unsubscribed_at) {
      report.push({ user: userId, status: "skipped", reason: "unsubscribed" });
      continue;
    }
    if (processed >= limit) {
      report.push({ user: userId, status: "skipped", reason: "limit" });
      continue;
    }
    processed++;

    try {
      const profile = row.data as AgentProfile;
      const digest = buildDigest(toDigestProfile(profile), {
        runDate,
        priorCompliance: state?.prior_compliance ?? undefined,
      });
      const unsubUrl = `${APP_URL}/api/digest/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
      const html = digest.html.split("{{{unsubscribe_url}}}").join(unsubUrl);

      if (dryRun) {
        report.push({ user: userId, status: "dry-run", subject: digest.subject, counts: digest.counts });
        continue;
      }

      const email = redirectTo ?? (await clerkEmail(userId));
      if (!email) {
        report.push({ user: userId, status: "failed", reason: "no email from Clerk" });
        continue;
      }
      const sendErr = await sendEmail(email, digest.subject, html);
      if (sendErr) {
        report.push({ user: userId, email, status: "failed", reason: sendErr });
        continue;
      }
      // Persist only on a REAL send: a ?to= test must not consume the
      // "first send" state or advance anyone's snapshot.
      if (!redirectTo) {
        await recordSend(userId, runDate, complianceSnapshot(profile.employee_states));
      }
      report.push({ user: userId, email, status: "sent", subject: digest.subject, counts: digest.counts });
    } catch (e) {
      report.push({ user: userId, status: "failed", reason: String(e).slice(0, 300) });
    }
  }

  const tally = {
    total: profileRows.length,
    sent: report.filter(r => r.status === "sent").length,
    dryRun: report.filter(r => r.status === "dry-run").length,
    skipped: report.filter(r => r.status === "skipped").length,
    failed: report.filter(r => r.status === "failed").length,
  };
  return NextResponse.json({ runDate, dryRun, redirectTo: redirectTo ?? null, tally, report });
}
