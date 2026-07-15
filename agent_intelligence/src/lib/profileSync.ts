import {
  AgentProfile,
  ValidationError,
  loadProfile,
  saveProfile,
} from "@/lib/profile";

// Client-side bridge between the localStorage profile cache (profile.ts)
// and the account-backed store (/api/profile). The server copy is the
// source of truth; localStorage is a fast-paint cache of it. While signed
// out — or on a deployment where accounts are dormant — /api/profile
// answers 401/503 and everything falls back to the original
// localStorage-only behavior.

export type ProfileSync = {
  profile: AgentProfile | null;
  // false -> running in local-only mode (signed out / accounts disabled)
  serverAvailable: boolean;
};

// One sync per page load: ProfileBootstrap and the NavBar both await this,
// and post-navigation callers reuse the settled promise instead of
// re-fetching on every route change.
let inflight: Promise<ProfileSync> | null = null;

export function syncProfile(): Promise<ProfileSync> {
  if (!inflight) {
    inflight = doSync().then(result => {
      // Never cache a signed-out / unavailable answer: Clerk swaps the
      // session client-side (sign-in and sign-out happen with NO page
      // reload), so the next caller must re-check or a user signing in
      // would keep getting the stale "no profile" result and be bounced
      // to an empty /setup.
      if (!result.serverAvailable) inflight = null;
      return result;
    });
  }
  return inflight;
}

// Drop the memoized result entirely — called on sign-out so a subsequent
// same-page-load sign-in (possibly by a different user) starts clean.
export function resetProfileSync(): void {
  inflight = null;
}

async function doSync(): Promise<ProfileSync> {
  const local = loadProfile();
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) {
      // 401 signed out, 503 accounts dormant — local-only mode.
      return { profile: local, serverAvailable: false };
    }
    const body = (await res.json()) as { profile: AgentProfile | null };
    if (body.profile) {
      // Refresh the cache so every synchronous loadProfile() reader —
      // the six app pages, the NavBar, the setup form — sees the account's
      // profile, including on a device this user has never used before.
      saveProfile(body.profile);
      return { profile: body.profile, serverAvailable: true };
    }
    if (local) {
      // Signed in, server empty, local profile present: this device used
      // the pre-accounts version. Import the profile into the account so
      // nothing is lost.
      await pushProfile(local);
      return { profile: local, serverAvailable: true };
    }
    return { profile: null, serverAvailable: true };
  } catch {
    return { profile: local, serverAvailable: false };
  }
}

// Save a profile to the signed-in user's account. Returns validation
// errors from the server's gatekeeper (shape-identical to validateProfile
// output so the form can render them in place). Signed-out / dormant /
// network-down are NOT errors — the localStorage save already succeeded,
// which is the complete pre-accounts behavior.
export async function pushProfile(
  profile: AgentProfile,
): Promise<ValidationError[]> {
  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (res.status === 400) {
      const body = (await res.json().catch(() => null)) as {
        errors?: ValidationError[];
      } | null;
      return (
        body?.errors ?? [
          { field: "form", message: "The server rejected this profile." },
        ]
      );
    }
    return [];
  } catch {
    return [];
  }
}
