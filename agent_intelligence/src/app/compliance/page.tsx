"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

const C = {
  bg: "#fafaf9",
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  amberFill: "#FAEEDA",
  amberText: "#633806",
};

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
      <main className="min-h-screen" style={{ background: C.bg }}>
        <div
          className="max-w-[1100px] mx-auto px-4 py-10 text-[13px]"
          style={{ color: C.text3 }}
        >
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: C.bg }}>
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        <div className="mb-3">
          <h1
            className="text-[18px] font-medium m-0"
            style={{ color: C.text }}
            data-testid="page-title"
          >
            Compliance
          </h1>
          <p className="text-[13px] mt-1 m-0" style={{ color: C.text2 }}>
            HR & insurance regulations for the states your team works in:{" "}
            {renderedStates.join(", ") || "—"}.
          </p>
        </div>

        {/* Disclaimer banner — non-optional for a compliance feature. */}
        <div
          data-testid="disclaimer-banner"
          style={{
            background: C.amberFill,
            color: C.amberText,
            fontSize: 12,
            padding: "9px 12px",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          AI-generated summaries of official sources, which may be incomplete or out
          of date. Always verify on the official site. This is not legal advice.
        </div>

        {renderedStates.length === 0 ? (
          <div
            className="text-[13px] px-4 py-6 text-center"
            style={{
              color: C.text3,
              border: "0.5px solid rgba(0,0,0,0.08)",
              borderRadius: 8,
            }}
          >
            None of your employee work/live states are currently covered by our
            data. Coverage is expanding — check back as more states come online.
          </div>
        ) : (
          <div
            data-testid="compliance-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
            }}
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
