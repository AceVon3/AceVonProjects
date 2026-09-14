"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CoverageMatrix from "@/components/CoverageMatrix";
import PageSkeleton from "@/components/PageSkeleton";
import TopBar from "@/components/TopBar";
import { AgentProfile, loadProfile } from "@/lib/profile";

export default function CoveragePage(): React.JSX.Element {
  const router = useRouter();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);
    setReady(true);
  }, [router]);

  if (!ready || !profile) return <PageSkeleton variant="table" />;

  return (
    <main className="min-h-screen bg-canvas">
      <TopBar title="Coverage Compare" />
      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
        <p className="text-13 text-ink-2 max-w-[640px] mt-0 mb-4 leading-relaxed">
          How your carrier&rsquo;s coverage stacks up against competitors, feature by feature. Switch between auto and home,
          filter to one of your states, or search a coverage — then read across the row.
        </p>
        <CoverageMatrix profile={profile} />
      </div>
    </main>
  );
}
