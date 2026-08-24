// Server-side state for the monthly digest (Neon, same connection pattern as
// profileDb.ts). One row per Clerk user in `digest_state`:
//   - unsubscribed_at: opt-out (set by the unsubscribe endpoint; the cron
//     skips these rows)
//   - last_sent_at / last_run_date: idempotency + audit
//   - prior_compliance: the complianceSnapshot() persisted at each send,
//     which powers next month's "Updated" HR badges (digest.ts design note:
//     first send has no prior -> section simply absent)
//
// Unsubscribe links are HMAC-signed (user_id, DIGEST_SECRET) so a link can't
// be forged for another user. DIGEST_SECRET doubles as the cron bearer token
// check fallback — see /api/digest/run.

import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

import type { ComplianceSnapshot } from "./digest";

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

export function isDigestDbConfigured(): boolean {
  return connectionString.length > 0;
}

function sql() {
  return neon(connectionString);
}

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = sql()`
      CREATE TABLE IF NOT EXISTS digest_state (
        user_id          text PRIMARY KEY,
        unsubscribed_at  timestamptz,
        last_sent_at     timestamptz,
        last_run_date    text,
        prior_compliance jsonb
      )
    `.then(() => undefined);
  }
  return ensured;
}

export type DigestState = {
  user_id: string;
  unsubscribed_at: string | null;
  last_run_date: string | null;
  prior_compliance: ComplianceSnapshot | null;
};

export async function getDigestStates(): Promise<Map<string, DigestState>> {
  await ensureTable();
  const rows = await sql()`
    SELECT user_id, unsubscribed_at, last_run_date, prior_compliance FROM digest_state
  `;
  const m = new Map<string, DigestState>();
  for (const r of rows) {
    m.set(r.user_id as string, {
      user_id: r.user_id as string,
      unsubscribed_at: r.unsubscribed_at ? String(r.unsubscribed_at) : null,
      last_run_date: (r.last_run_date as string) ?? null,
      prior_compliance: (r.prior_compliance as ComplianceSnapshot) ?? null,
    });
  }
  return m;
}

export async function recordSend(
  userId: string,
  runDate: string,
  snapshot: ComplianceSnapshot,
): Promise<void> {
  await ensureTable();
  await sql()`
    INSERT INTO digest_state (user_id, last_sent_at, last_run_date, prior_compliance)
    VALUES (${userId}, now(), ${runDate}, ${JSON.stringify(snapshot)}::jsonb)
    ON CONFLICT (user_id) DO UPDATE
      SET last_sent_at = now(),
          last_run_date = EXCLUDED.last_run_date,
          prior_compliance = EXCLUDED.prior_compliance
  `;
}

export async function markUnsubscribed(userId: string): Promise<void> {
  await ensureTable();
  await sql()`
    INSERT INTO digest_state (user_id, unsubscribed_at)
    VALUES (${userId}, now())
    ON CONFLICT (user_id) DO UPDATE SET unsubscribed_at = now()
  `;
}

// --- unsubscribe-link signing ----------------------------------------------

function secret(): string {
  return process.env.DIGEST_SECRET ?? "";
}

export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(userId).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  if (!secret() || !token) return false;
  const expect = Buffer.from(unsubscribeToken(userId));
  const got = Buffer.from(token);
  return expect.length === got.length && timingSafeEqual(expect, got);
}
