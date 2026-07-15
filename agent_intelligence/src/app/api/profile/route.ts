import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { migrateProfile, validateProfile } from "@/lib/profile";
import {
  getProfileForUser,
  isProfileDbConfigured,
  upsertProfileForUser,
} from "@/lib/profileDb";

// GET  /api/profile -> { profile: AgentProfile | null }
// PUT  /api/profile -> { ok: true } | { errors: ValidationError[] }
//
// Requires a signed-in Clerk user (also enforced by src/middleware.ts when
// AUTH_ENFORCED=1; the checks here keep the route safe on its own). While
// auth or the database is unconfigured the route answers 503 and clients
// fall back to localStorage — the pre-accounts behavior.

function unavailable(): NextResponse {
  return NextResponse.json(
    { error: "Accounts are not enabled on this deployment." },
    { status: 503 },
  );
}

async function requireUserId(): Promise<string | NextResponse> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !isProfileDbConfigured()) {
    return unavailable();
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  return userId;
}

export async function GET(): Promise<NextResponse> {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const profile = await getProfileForUser(userId);
  return NextResponse.json({ profile });
}

export async function PUT(req: Request): Promise<NextResponse> {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  let candidate: unknown;
  try {
    candidate = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Same tolerance as the client store: migrate legacy shapes first, then
  // validate with the shared gatekeeper so the DB only ever holds profiles
  // the app itself would accept.
  const profile = migrateProfile(candidate);
  const errors = validateProfile(profile);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  await upsertProfileForUser(userId, profile);
  return NextResponse.json({ ok: true });
}
