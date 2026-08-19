"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

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
  return (
    <>
      <SignedOut>
        <Link className="link-quiet" href="/sign-in">
          Sign in
        </Link>
        <Link className="btn btn-primary" href="/checkout">
          Get started
        </Link>
      </SignedOut>
      <SignedIn>
        <Link className="link-quiet" href="/overview">
          Open the app
        </Link>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}
