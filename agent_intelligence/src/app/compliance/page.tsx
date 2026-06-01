"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ComplianceBriefing from "@/components/ComplianceBriefing";
import ComplianceCard from "@/components/ComplianceCard";
import {
  COMPLIANCE_SUMMARIES,
  ComplianceSummary,
} from "@/lib/complianceData";
import {
  RESOURCE_URLS,
  ResourceKey,
  StateCode,
} from "@/lib/resourceUrls";
import { AgentProfile, loadProfile } from "@/lib/profile";

const TOPIC_ORDER: ResourceKey[] = [
  "wage_hour",
  "leave",
  "payroll",
  "workers_comp",
  "termination",
  "nexus",
  "hiring",
  "remote",
];

const COVERED: ReadonlySet<string> = new Set<StateCode>([
  "AZ", "CO", "ID", "MT", "NV", "OR", "UT", "WA",
]);

// Build a quick lookup so the page never iterates the whole array per cell.
function buildSummaryIndex(): Map<string, ComplianceSummary> {
  const m = new Map<string, ComplianceSummary>();
  for (const s of COMPLIANCE_SUMMARIES) m.set(`${s.state}/${s.topic}`, s);
  return m;
}

export default function CompliancePage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [profile, setProfile] = useState<AgentProfile | null>(null);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);
    setPhase("ready");
  }, [router]);

  const summaryIndex = useMemo(() => buildSummaryIndex(), []);

  // Only render cards for employee states that are inside our data coverage
  // (the 8 covered states). Non-covered employee states are silently dropped
  // for now — could add a "coming soon for these states" hint later.
  const renderedStates = useMemo(() => {
    if (!profile) return [];
    return profile.employee_states.filter(s => COVERED.has(s));
  }, [profile]);

  if (phase === "loading") {
    return (
      <main className="min-h-screen bg-canvas">
        <div className="max-w-[1100px] mx-auto px-4 py-10 text-13 text-ink-3">
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        <div className="mb-3">
          <h1 className="text-18 font-medium m-0 text-ink" data-testid="page-title">
            Compliance
          </h1>
          <p className="text-13 mt-1 m-0 text-ink-2">
            HR & insurance regulations for the states your team works in:{" "}
            {renderedStates.join(", ") || "—"}.
          </p>
        </div>

        {/* Office briefing — personalized, ordered by primary state, with the
            load-bearing "not legal/tax advice" band. Reuses the same grounded
            summaries the card grid below reads. */}
        {profile && (
          <ComplianceBriefing
            employeeStates={profile.employee_states}
            homeState={profile.home_state}
            employeeCount={profile.employee_count}
          />
        )}

        {/* All topics — the comprehensive source-linked reference grid. */}
        <div className="mb-3">
          <h2 className="text-13 uppercase tracking-wider04 font-medium m-0 text-ink-2">
            All compliance topics
          </h2>
          <p className="text-12 mt-1 m-0 text-ink-3">
            Every tracked topic for your covered states:{" "}
            {renderedStates.join(", ") || "—"}.
          </p>
        </div>

        {/* Disclaimer banner — non-optional for a compliance feature. */}
        <div
          data-testid="disclaimer-banner"
          className="bg-amber-fill text-amber-text text-12 px-3 py-[9px] rounded-lg mb-4"
        >
          AI-generated summaries of official sources, which may be incomplete or out
          of date. Always verify on the official site. This is not legal advice.
        </div>

        {renderedStates.length === 0 ? (
          <div className="text-13 text-ink-3 px-4 py-6 text-center border border-hairline border-line rounded-lg">
            None of your employee work/live states are currently covered by our
            data. Coverage is expanding — check back as more states come online.
          </div>
        ) : (
          <div
            data-testid="compliance-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5"
          >
            {renderedStates.flatMap(state =>
              TOPIC_ORDER.map(topic => {
                const summary = summaryIndex.get(`${state}/${topic}`);
                const urls =
                  RESOURCE_URLS[state as StateCode]?.[topic] ?? [];
                return (
                  <ComplianceCard
                    key={`${state}-${topic}`}
                    state={state}
                    topic={topic}
                    title={summary?.title}
                    summary={summary?.summary}
                    sources={summary?.sources ?? urls}
                    last_checked={summary?.last_checked}
                  />
                );
              }),
            )}
          </div>
        )}
      </div>
    </main>
  );
}
