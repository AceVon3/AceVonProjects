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
        <Link className="btn btn-primary" href="/setup">
          Get started free
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
        <Link className="btn btn-primary" href="/sign-up">
          Get started free
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
