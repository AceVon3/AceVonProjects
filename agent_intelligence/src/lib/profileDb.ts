import { neon } from "@neondatabase/serverless";
import type { AgentProfile } from "@/lib/profile";

// Server-side profile store (Neon Postgres). One row per Clerk user; the
// whole AgentProfile lives in a JSONB column so profile-shape changes
// (offices became a list, pay_type was added, …) never require a SQL
// migration. validateProfile in src/lib/profile.ts remains the single
// gatekeeper for what counts as a valid profile — the API route runs it
// before anything reaches this file.
//
// DATABASE_URL comes from the Neon integration on the Vercel project
// (pulled into .env.local for dev via `vercel env pull`). Absent that,
// isProfileDbConfigured() is false and the API returns 503 — same
// dormant-until-configured pattern as Clerk in src/middleware.ts.

const connectionString =
  process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

export function isProfileDbConfigured(): boolean {
  return connectionString.length > 0;
}

function sql() {
  return neon(connectionString);
}

// Serverless functions get torn down and cold-started constantly, so the
// table is created lazily once per instance instead of via a deploy-time
// migration step this project doesn't have.
let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = sql()`
      CREATE TABLE IF NOT EXISTS profiles (
        user_id    text PRIMARY KEY,
        data       jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `.then(() => undefined);
  }
  return ensured;
}

export async function getProfileForUser(
  userId: string,
): Promise<AgentProfile | null> {
  await ensureTable();
  const rows = await sql()`
    SELECT data FROM profiles WHERE user_id = ${userId}
  `;
  return rows.length > 0 ? (rows[0].data as AgentProfile) : null;
}

export async function upsertProfileForUser(
  userId: string,
  profile: AgentProfile,
): Promise<void> {
  await ensureTable();
  await sql()`
    INSERT INTO profiles (user_id, data)
    VALUES (${userId}, ${JSON.stringify(profile)}::jsonb)
    ON CONFLICT (user_id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}
