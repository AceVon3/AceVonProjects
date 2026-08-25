"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";

// The account-aware right side of the landing nav. With auth dormant
// (no publishable key — see src/middleware.ts) it renders the original
// pre-accounts links; Clerk components never mount, so no provider is
// needed.
const authConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function LandingAuthActions() {
  if (!authConfigured) {
    return (
      <>
        <Link className="link-quiet" href="/overview">
          Open the app
        </Link>
        {/* Both branches route through /checkout — the launch-offer funnel
            (price anchor + code) sits in front of account creation. */}
        <Link className="btn btn-primary" href="/checkout">
          Get started
        </Link>
      </>
    );
  }
  return <ClerkAuthActions />;
}

// Signed-out links are the SSR default so the nav CTA exists at first paint
// (and with JS blocked) instead of waiting on Clerk's external script; the
// signed-in swap happens only after Clerk resolves an actual session.
// Hooks live here, below the authConfigured branch, so the dormant path
// never calls useAuth outside a ClerkProvider.
function ClerkAuthActions() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) {
    return (
      <>
        <Link className="link-quiet" href="/overview">
          Open the app
        </Link>
        <UserButton afterSignOutUrl="/" />
      </>
    );
  }
  return (
    <>
      <Link className="link-quiet" href="/sign-in">
        Sign in
      </Link>
      <Link className="btn btn-primary" href="/checkout">
        Get started
      </Link>
    </>
  );
}
