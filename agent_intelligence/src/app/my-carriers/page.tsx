"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import FilingsTable from "@/components/FilingsTable";
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
  greenText: "#27500A",
  blueText: "#0C447C",
};

export default function MyCarriersPage(): React.JSX.Element {
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
    // Captive guard: my-carriers is independent-only (spec line 835).
    if (p.agent_type === "captive") {
      router.replace("/");
      return;
    }
    setProfile(p);
    const params = new URLSearchParams({
      mode: "my-carriers",
      agent_type: p.agent_type,
      licensed_states: p.licensed_states.join(","),
      authorized_brands: p.authorized_brands.join(","),
    });
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

  // Header card numbers — spec line 877-881.
  //   Carriers tracked: authorized_brands.length (every authorized brand,
  //   not just brands that actually appear in the result set — matches the
  //   spec's "carriers you sell" framing).
  //   Filings this period: total in result set.
  //   Largest move: absolute-value max impact, signed.
  const headerCard = useMemo(() => {
    if (!profile || filings.length === 0) return null;
    const largest = filings.reduce(
      (best, f) =>
        Math.abs(f.overall_rate_impact) > Math.abs(best.overall_rate_impact) ? f : best,
      filings[0],
    );
    return {
      carriersTracked: profile.authorized_brands.length,
      filingsCount: filings.length,
      largest,
    };
  }, [filings, profile]);

  const scopeLabel = useMemo(() => {
    if (!profile) return "";
    // My Carriers is independent-only; no "vs competitors" suffix.
    return `Showing: ${profile.licensed_states.join(", ")}`;
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

  if (phase === "error") {
    return (
      <main className="min-h-screen" style={{ background: C.bg }}>
        <div className="max-w-[1100px] mx-auto px-4 py-10">
          <h1 className="text-[18px] font-medium m-0" style={{ color: C.text }}>
            My Carriers
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
      <div
        className="text-[12px] flex justify-between items-center px-4 py-2"
        style={{ background: C.surface2 }}
      >
        <span style={{ color: C.text2 }}>{scopeLabel}</span>
        <a
          href="/setup"
          style={{ color: C.blueText, fontWeight: 500, textDecoration: "none" }}
        >
          Edit
        </a>
      </div>

      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-[18px] font-medium m-0" style={{ color: C.text }}>
            My Carriers
          </h1>
          <p className="text-[13px] mt-1 m-0" style={{ color: C.text2 }}>
            Every recent filing from the carriers you sell — so you know what your book is doing.
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
                Carriers tracked
              </div>
              <div className="text-[22px] font-medium" style={{ color: C.text }}>
                {headerCard.carriersTracked}
              </div>
            </div>
            <div style={{ width: "0.5px", background: C.line2, alignSelf: "stretch" }} />
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.4px] mb-0.5"
                style={{ color: C.text2 }}
              >
                Filings this period
              </div>
              <div className="text-[22px] font-medium" style={{ color: C.text }}>
                {headerCard.filingsCount}
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
                <span
                  style={{
                    fontWeight: 500,
                    color:
                      headerCard.largest.overall_rate_impact >= 0
                        ? C.redText
                        : C.greenText,
                  }}
                >
                  {headerCard.largest.overall_rate_impact >= 0 ? "+" : "−"}
                  {Math.abs(headerCard.largest.overall_rate_impact).toFixed(1)}%
                </span>{" "}
                {headerCard.largest.brand} in {headerCard.largest.state}
              </div>
            </div>
          </div>
        )}

        <FilingsTable
          mode="my-carriers"
          filings={filings}
          agentType={profile!.agent_type}
          ownedBrands={ownedBrands}
          asOf={asOf}
        />
      </div>
    </main>
  );
}
