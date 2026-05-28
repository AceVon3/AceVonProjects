"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { loadProfile } from "@/lib/profile";

// Placeholder Overview page. Step 4 wires the redirect guard only; the real
// four-card Overview ships in step 8. Until then, agents with a profile
// land on a tiny "profile loaded" stub so the redirect can be verified.
export default function OverviewPage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfileName(p.full_name);
    setPhase("ready");
  }, [router]);

  if (phase === "loading") {
    return (
      <main className="min-h-screen" style={{ background: "#fafaf9" }}>
        <div className="max-w-[1100px] mx-auto px-4 py-10 text-[13px]" style={{ color: "#888780" }}>
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "#fafaf9" }}>
      <div className="max-w-[1100px] mx-auto px-4 py-10">
        <h1 className="text-[18px] font-medium m-0" style={{ color: "#1c1c1b" }}>
          Overview
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "#5F5E5A" }}>
          Welcome back, {profileName}. The Overview cards arrive in step 8.
        </p>
      </div>
    </main>
  );
}
