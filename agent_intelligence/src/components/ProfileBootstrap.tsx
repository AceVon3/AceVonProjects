"use client";

import { useEffect, useState } from "react";
import { syncProfile } from "@/lib/profileSync";

// Gate for the (app) route group: holds children until the account's
// profile has been pulled into the localStorage cache (or local-only mode
// is confirmed). Every page below can then keep its original synchronous
// loadProfile() read — including the redirect-to-/setup decision, which
// would otherwise misfire on a signed-in user's brand-new device where the
// cache starts empty.
export default function ProfileBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    syncProfile().finally(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen bg-canvas">
        <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px] text-13 text-ink-3">
          Loading…
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
