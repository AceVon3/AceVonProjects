"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { clearProfile } from "@/lib/profile";
import { resetProfileSync } from "@/lib/profileSync";

// Renders nothing; watches the Clerk session and clears the localStorage
// profile cache when a signed-in user signs out, so the next person on a
// shared computer doesn't inherit the previous agent's profile. Mounted
// from the root layout ONLY when auth is configured (useAuth requires
// ClerkProvider).
export default function SignOutCleanup() {
  const { isLoaded, isSignedIn } = useAuth();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (wasSignedIn.current && !isSignedIn) {
      clearProfile();
      // Also drop the sync memo: if someone signs in next on this same
      // page load (even a different user), the sync must hit the server
      // again instead of replaying this session's result.
      resetProfileSync();
    }
    wasSignedIn.current = isSignedIn ?? false;
  }, [isLoaded, isSignedIn]);

  return null;
}
