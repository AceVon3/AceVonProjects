// Digest STAGING run — MANUAL-ONLY, nothing automated and nothing is sent
// to users from here (Ryan's decisions, 2026-08-24: no cron; he triggers a
// batch himself and approves every send). There is deliberately NO
// vercel.json cron entry pointing here.
//
// What a staging run does: build every subscribed user's digest (with their
// prior compliance snapshot), resolve their Clerk email, inject the signed
// unsubscribe link, store the finished emails in digest_runs, and send the
// REVIEWER a notification with a signed link to /api/digest/review — where
// every staged email can be read and the batch approved or discarded.
// /api/digest/approve sends exactly the stored HTML.
//
// Auth, either of:
//   - Authorization: Bearer <CRON_SECRET or DIGEST_SECRET>  (curl/testing)
//   - ?t=<triggerToken>  (Ryan's bookmarkable browser link; on success the
//     response REDIRECTS to the review page so trigger → review is one click)
// Test controls (bearer only):
//   ?dryRun=1  build + report only; stores nothing, notifies nobody.
//   ?to=email  ONE-OFF: send every built email to this test inbox right now,
//              bypassing staging entirely; persists nothing.

import { NextRequest, NextResponse } from "next/server";

import { buildDigest, complianceSnapshot, type DigestProfile } from "@/lib/digest";
import {
  getDigestStates,
  isDigestDbConfigured,
  runToken,
  stageRun,
  unsubscribeToken,
  verifyTriggerToken,
  type StagedItem,
} from "@/lib/digestDb";
import type { AgentProfile } from "@/lib/profile";
import { sendEmail } from "@/lib/resendSend";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const APP_URL = "https://agencyman.ai";
const REVIEW_EMAIL = process.env.DIGEST_REVIEW_EMAIL ?? "ryanchristy32@gmail.com";

function authorized(req: NextRequest): boolean {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
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
// Captives carry captive_brand (authorized_brands[0] per the validator).
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

export async function GET(req: NextRequest) {
  // Browser trigger link (?t=) or bearer secret — either authorizes.
  const viaTrigger = verifyTriggerToken(req.nextUrl.searchParams.get("t") ?? "");
  if (!viaTrigger && !authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDigestDbConfigured()) {
    return NextResponse.json({ error: "profiles DB not configured" }, { status: 503 });
  }

  // Test controls stay bearer-only; the trigger link always stages.
  const dryRun = !viaTrigger && req.nextUrl.searchParams.get("dryRun") === "1";
  const redirectTo = viaTrigger ? null : req.nextUrl.searchParams.get("to");
  const limit = viaTrigger ? Infinity : Number(req.nextUrl.searchParams.get("limit") ?? "0") || Infinity;
  const runDate = new Date().toISOString().slice(0, 10);

  if (!dryRun && !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY missing" }, { status: 503 });
  }

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "");
  const profileRows = await sql`SELECT user_id, data FROM profiles ORDER BY created_at`;
  const states = await getDigestStates();

  const items: StagedItem[] = [];
  const report: { user: string; status: string; reason?: string; subject?: string }[] = [];
  let processed = 0;

  for (const row of profileRows) {
    const userId = row.user_id as string;
    if (states.get(userId)?.unsubscribed_at) {
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
        priorCompliance: states.get(userId)?.prior_compliance ?? undefined,
      });
      const unsubUrl = `${APP_URL}/api/digest/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
      const html = digest.html.split("{{{unsubscribe_url}}}").join(unsubUrl);

      if (dryRun) {
        report.push({ user: userId, status: "dry-run", subject: digest.subject });
        continue;
      }
      if (redirectTo) {
        const err = await sendEmail(redirectTo, digest.subject, html);
        report.push({ user: userId, status: err ? "failed" : "sent-redirected", reason: err ?? undefined, subject: digest.subject });
        continue;
      }
      const email = await clerkEmail(userId);
      items.push({
        user_id: userId,
        email,
        subject: digest.subject,
        html,
        counts: digest.counts,
        snapshot: complianceSnapshot(profile.employee_states),
      });
      report.push({ user: userId, status: email ? "staged" : "staged-no-email", subject: digest.subject });
    } catch (e) {
      report.push({ user: userId, status: "failed", reason: String(e).slice(0, 300) });
    }
  }

  let reviewUrl: string | null = null;
  if (!dryRun && !redirectTo) {
    await stageRun(runDate, items);
    reviewUrl = `${APP_URL}/api/digest/review?run=${runDate}&t=${runToken(runDate)}`;
    const notifyErr = await sendEmail(
      REVIEW_EMAIL,
      `Review before send: ${items.length} digests staged (${runDate})`,
      `<p>The monthly digest run for <b>${runDate}</b> is staged and waiting for your review.</p>
       <p><b>${items.length}</b> emails built · ${report.filter(r => r.status === "skipped").length} skipped ·
       ${report.filter(r => r.status === "failed").length} failed ·
       ${items.filter(i => !i.email).length} missing an email address.</p>
       <p><a href="${reviewUrl}">Review every email and approve or discard the batch</a></p>
       <p style="color:#6B7080;font-size:12px;">Nothing sends until you approve. Staged batches are
       overwritten if the run is re-staged.</p>`,
    );
    if (notifyErr && !viaTrigger) {
      return NextResponse.json({ runDate, staged: items.length, reviewUrl, notifyError: notifyErr, report }, { status: 502 });
    }
    // Browser trigger: land the reviewer directly on the review page —
    // trigger → review → approve is one continuous flow.
    if (viaTrigger && reviewUrl) {
      return NextResponse.redirect(reviewUrl, 302);
    }
  }

  return NextResponse.json({
    runDate,
    mode: dryRun ? "dry-run" : redirectTo ? "redirected-test" : "staged",
    staged: items.length,
    reviewUrl,
    report,
  });
}
