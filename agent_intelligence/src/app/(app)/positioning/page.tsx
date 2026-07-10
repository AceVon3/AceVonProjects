"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PageSkeleton from "@/components/PageSkeleton";
import PositioningCard from "@/components/PositioningCard";
import ScopeStrip from "@/components/ScopeStrip";
import type { PositioningResult } from "@/lib/positioning";
import { buildExplainer, dateRangeNote } from "@/lib/positioningExplainer";
import { AgentProfile, loadProfile } from "@/lib/profile";

type Phase = "loading" | "ready" | "error";
type ApiResponse = { asOf: string; result: PositioningResult };

export default function PositioningPage(): React.JSX.Element {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [result, setResult] = useState<PositioningResult | null>(null);
  const [asOf, setAsOf] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/setup");
      return;
    }
    setProfile(p);
  }, [router]);

  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams({
      agent_type: profile.agent_type,
      licensed_states: profile.licensed_states.join(","),
      authorized_brands: profile.authorized_brands.join(","),
    });
    if (profile.agent_type === "captive") {
      params.set("captive_brand", profile.authorized_brands[0]);
    }
    fetch(`/api/positioning?${params.toString()}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        return r.json() as Promise<ApiResponse>;
      })
      .then(d => {
        setAsOf(d.asOf);
        setResult(d.result);
        setPhase("ready");
      })
      .catch(e => {
        setError(String(e?.message ?? e));
        setPhase("error");
      });
  }, [profile]);

  if (phase === "loading" || !profile || !result) {
    if (phase === "error") {
      return (
        <main className="min-h-screen bg-canvas">
          <div className="max-w-[1100px] mx-auto px-4 py-10">
            <h1 className="text-18 font-medium m-0 text-ink">Rate positioning</h1>
            <p className="text-13 mt-3 p-3 rounded-md text-red-text bg-red-fill border border-hairline border-line">
              Couldn’t load positioning data: {error}
            </p>
          </div>
        </main>
      );
    }
    return <PageSkeleton variant="table" />;
  }

  const isCaptive = profile.agent_type === "captive";
  const brand = profile.authorized_brands[0];
  const subtitle = isCaptive
    ? `How ${brand}'s recent rate changes compare to each competitor, by line and state.`
    : "How your carriers' recent rate changes compare to the rest of the market.";

  const sellsEverything = result.competitorBrands.length === 0;
  const nothingAnchored = result.anchoredCells.length === 0;
  // Interprets one real comparison from THIS agent's view; null when the view
  // has no higher-confidence comparison (thin ones carry no spread to explain).
  const explainer = buildExplainer(result);

  return (
    <main className="min-h-screen bg-canvas">
      <ScopeStrip
        states={profile.licensed_states}
        captiveBrand={isCaptive ? brand : undefined}
      />

      <div className="max-w-[1100px] mx-auto px-4 py-6">
        <div className="mb-3">
          <h1 className="text-18 font-medium m-0 text-ink">Rate positioning</h1>
          <p className="text-13 mt-1 m-0 text-ink-2">{subtitle}</p>
          {/* States what the query actually covers: the rolling 12-month
              effective-date window (DEFAULT_WINDOW) — NOT the full dataset. */}
          {asOf && (
            <p className="text-12 mt-1 m-0 text-ink-3" data-testid="date-range-note">
              {dateRangeNote(asOf)}
            </p>
          )}
        </div>

        {/* LOAD-BEARING framing — rate change, not price. Persistent + sticky;
            not dismissible, not fine print. */}
        <div
          data-testid="rate-change-frame"
          className="sticky top-0 z-10 mb-4 rounded-md bg-amber-fill text-amber-text border border-hairline border-line px-4 py-3 text-13"
        >
          <span className="font-medium">These are rate changes, not prices.</span>{" "}
          Every figure is the average percentage a carrier <em>changed</em> its filed rates — not how cheap it is.
          A carrier raising less or cutting more is moving more favorably for shoppers; it says nothing about whose premium is lower today.
        </div>

        {sellsEverything ? (
          <div
            data-testid="positioning-empty"
            className="text-13 px-4 py-6 text-center text-ink-3 border border-hairline border-line rounded-lg"
          >
            You sell every covered carrier — there’s no competitor set to compare against.
          </div>
        ) : nothingAnchored ? (
          <div
            data-testid="positioning-empty"
            className="text-13 px-4 py-6 text-center text-ink-3 border border-hairline border-line rounded-lg"
          >
            None of your carriers have filed in your states in the last 12 months, so there’s nothing to compare yet. Data refreshes monthly.
          </div>
        ) : (
          <>
            {explainer && (
              <div
                data-testid="positioning-explainer"
                className="mb-4 rounded-lg border border-hairline border-line px-4 py-3 text-13 text-ink-2"
              >
                <span className="font-medium text-ink">How to read this: </span>
                {explainer}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {result.anchoredCells.map(cell => (
                <PositioningCard key={`${cell.line}@@${cell.state}`} cell={cell} />
              ))}
            </div>

            {result.unanchoredCells.length > 0 && (
              <div
                data-testid="unanchored-section"
                className="mt-5 rounded-lg border border-hairline border-line px-4 py-3"
              >
                <div className="text-11 uppercase tracking-wider04 text-ink-3 mb-1.5">
                  No filings from your carrier{isCaptive ? "" : "s"} here
                </div>
                <div className="text-12 text-ink-2 flex flex-wrap gap-x-3 gap-y-1">
                  {result.unanchoredCells.map(c => (
                    <span key={`${c.line}@@${c.state}`} data-testid="unanchored-item">
                      {c.line} · {c.state}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
