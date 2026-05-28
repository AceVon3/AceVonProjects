"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FilingsTable from "@/components/FilingsTable";
import ScopeStrip from "@/components/ScopeStrip";
import type { Filing } from "@/lib/filings";
import { AgentProfile, loadProfile } from "@/lib/profile";

type Phase = "loading" | "ready" | "error";

type ApiResponse = { asOf: string; filings: Filing[] };

const C = {
  bg: "#fafaf9",
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  line: "rgba(0,0,0,0.08)",
  line2: "rgba(0,0,0,0.15)",
  surface2: "#F4F2EC",
  redText: "#A32D2D",
  blueText: "#0C447C",
};

export default function ProspectPage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [asOf, setAsOf] = useState<string>("");
  const [filings, setFilings] = useState<Filing[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);
    const params = new URLSearchParams({
      mode: "prospect",
      agent_type: p.agent_type,
      licensed_states: p.licensed_states.join(","),
      authorized_brands: p.authorized_brands.join(","),
    });
    if (p.agent_type === "captive") {
      params.set("captive_brand", p.authorized_brands[0]);
    }
    fetch(`/api/filings?${params.toString()}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then(data => {
        setAsOf(data.asOf);
        setFilings(data.filings);
        setPhase("ready");
      })
      .catch(e => {
        setError(String(e?.message ?? e));
        setPhase("error");
      });
  }, [router]);

  const ownedBrands = useMemo(
    () => new Set(profile?.authorized_brands ?? []),
    [profile],
  );

  // Header card numbers — spec line 759.
  const headerCard = useMemo(() => {
    if (filings.length === 0) return null;
    const states = new Set(filings.map(f => f.state));
    const largest = filings.reduce(
      (best, f) => (f.overall_rate_impact > best.overall_rate_impact ? f : best),
      filings[0],
    );
    return {
      count: filings.length,
      stateCount: states.size,
      largest,
    };
  }, [filings]);

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

  if (phase === "error") {
    return (
      <main className="min-h-screen" style={{ background: C.bg }}>
        <div className="max-w-[1100px] mx-auto px-4 py-10">
          <h1 className="text-[18px] font-medium m-0" style={{ color: C.text }}>
            Prospect
          </h1>
          <p
            className="text-[13px] mt-3 p-3 rounded-md"
            style={{
              color: C.redText,
              background: "#FCEBEB",
              border: "0.5px solid rgba(0,0,0,0.08)",
            }}
          >
            Couldn’t load filings: {error}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: C.bg }}>
      <ScopeStrip
        states={profile!.licensed_states}
        captiveBrand={
          profile!.agent_type === "captive" ? profile!.authorized_brands[0] : undefined
        }
      />

      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-[18px] font-medium m-0" style={{ color: C.text }}>
            Prospect
          </h1>
          <p className="text-[13px] mt-1 m-0" style={{ color: C.text2 }}>
            Rate increases in your states — opportunities to attack and decisions to make.
          </p>
        </div>

        {headerCard && (
          <div
            className="rounded-lg mb-4 flex gap-6 items-center"
            style={{ background: C.surface2, padding: "14px 16px" }}
          >
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.4px] mb-0.5"
                style={{ color: C.text2 }}
              >
                Filings in your states
              </div>
              <div className="text-[22px] font-medium" style={{ color: C.text }}>
                {headerCard.count}
              </div>
            </div>
            <div style={{ width: "0.5px", background: C.line2, alignSelf: "stretch" }} />
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.4px] mb-0.5"
                style={{ color: C.text2 }}
              >
                Largest move
              </div>
              <div className="text-[14px]" style={{ color: C.text }}>
                <span style={{ fontWeight: 500, color: C.redText }}>
                  {headerCard.largest.overall_rate_impact >= 0 ? "+" : "−"}
                  {Math.abs(headerCard.largest.overall_rate_impact).toFixed(1)}%
                </span>{" "}
                by {headerCard.largest.brand} in {headerCard.largest.state}
              </div>
            </div>
          </div>
        )}

        <FilingsTable
          mode="prospect"
          filings={filings}
          agentType={profile!.agent_type}
          ownedBrands={ownedBrands}
          asOf={asOf}
        />
      </div>
    </main>
  );
}
