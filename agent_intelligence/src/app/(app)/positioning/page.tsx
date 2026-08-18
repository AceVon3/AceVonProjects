"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PageSkeleton from "@/components/PageSkeleton";
import PositioningCard from "@/components/PositioningCard";
import PositioningDumbbell from "@/components/PositioningDumbbell";
import TopBar from "@/components/TopBar";
import { formatEffectiveDate } from "@/lib/format";
import { computeMarketDumbbell } from "@/lib/marketDumbbell";
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
          <TopBar title="Competitive Positioning" />
          <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
            <p className="text-13 m-0 p-3 rounded-md text-red-text bg-red-fill border border-red-border">
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
    ? `How ${brand}'s recent Personal Auto rate changes compare to each competitor, by state.`
    : "How your carriers' recent Personal Auto rate changes compare to the rest of the market.";

  // AUTO-ONLY VIEW: the page shows Personal Auto cells only. Pure display
  // filter over the API result — the (line, state) cells arrive per line, so
  // Homeowners cells are simply not rendered; the computation is untouched.
  const view: PositioningResult = {
    ...result,
    anchoredCells: result.anchoredCells.filter(c => c.line === "Personal Auto"),
    unanchoredCells: result.unanchoredCells.filter(c => c.line === "Personal Auto"),
  };

  const sellsEverything = view.competitorBrands.length === 0;
  const nothingAnchored = view.anchoredCells.length === 0;
  // Headline chart data — derived from the SAME filtered view the cards
  // render, so the dumbbell and the cards reconcile by construction.
  const dumbbell = computeMarketDumbbell(view, "Personal Auto");
  const agentLabel = isCaptive ? brand : "Your carriers";
  // Interprets one real comparison from THIS agent's view; null when the view
  // has no higher-confidence comparison (thin ones carry no spread to explain).
  // Fed the filtered view so the narrated example is always an auto comparison.
  const explainer = buildExplainer(view);

  return (
    <main className="min-h-screen bg-canvas">
      <TopBar
        title="Competitive Positioning"
        chips={[{ icon: "map-pin", label: profile.licensed_states.join(", ") }]}
        asOf={asOf}
      />

      <div className="max-w-[1120px] mx-auto px-4 md:px-8 py-[30px]">
        <p className="text-13 text-ink-2 max-w-[640px] mt-0 mb-4 leading-relaxed">
          {subtitle}
        </p>

        {/* LOAD-BEARING framing — rate change, not price. Persistent + sticky;
            not dismissible, not fine print. Red band per design 3d. */}
        <div
          data-testid="rate-change-frame"
          className="sticky top-0 z-10 mb-4 rounded-tile bg-red-fill text-red-text border border-red-border px-[18px] py-3 text-13 leading-normal"
        >
          <span className="font-bold">These are rate changes, not price levels.</span>{" "}
          A carrier filing a smaller increase than yours isn’t necessarily cheaper — it moved less, recently.
        </div>

        {sellsEverything ? (
          <div
            data-testid="positioning-empty"
            className="text-13 px-5 py-8 text-center text-ink-2 bg-surface border border-card-line rounded-card shadow-card"
          >
            You sell every covered carrier — there’s no competitor set to compare against.
          </div>
        ) : nothingAnchored ? (
          <div
            data-testid="positioning-empty"
            className="text-13 px-5 py-8 text-center text-ink-2 bg-surface border border-card-line rounded-card shadow-card"
          >
            None of your carriers have filed Personal Auto rates in your states in the last 12 months, so there’s nothing to compare yet. Data refreshes monthly.
          </div>
        ) : (
          <>
            <PositioningDumbbell
              data={dumbbell}
              line="Personal Auto"
              agentLabel={agentLabel}
              asOf={formatEffectiveDate(asOf)}
            />

            {explainer && (
              <div
                data-testid="positioning-explainer"
                className="mb-5 bg-surface border border-card-line rounded-card shadow-card px-5 py-4"
              >
                <div className="text-11 uppercase tracking-wider06 text-ink-3 mb-2">
                  Example — what this means
                </div>
                <p className="m-0 text-13 text-ink-2 leading-relaxed">{explainer}</p>
                {/* States what the query actually covers: the rolling 12-month
                    effective-date window (DEFAULT_WINDOW) — NOT the full dataset. */}
                {asOf && (
                  <p className="text-12 mt-2 m-0 text-ink-3" data-testid="date-range-note">
                    {dateRangeNote(asOf)}
                  </p>
                )}
              </div>
            )}

            {/* No higher-confidence comparison to narrate → no example card,
                but the window note must still be stated somewhere. */}
            {!explainer && asOf && (
              <p className="text-12 mt-0 mb-4 text-ink-3" data-testid="date-range-note">
                {dateRangeNote(asOf)}
              </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              {view.anchoredCells.map(cell => (
                <PositioningCard key={`${cell.line}@@${cell.state}`} cell={cell} asOf={asOf} />
              ))}
            </div>

            {view.unanchoredCells.length > 0 && (
              <div
                data-testid="unanchored-section"
                className="mt-5 bg-surface border border-card-line rounded-card shadow-card px-5 py-4"
              >
                <div className="text-11 uppercase tracking-wider06 text-ink-3 mb-1.5">
                  No filings from your carrier{isCaptive ? "" : "s"} here
                </div>
                <div className="text-12 text-ink-2 flex flex-wrap gap-x-3 gap-y-1">
                  {view.unanchoredCells.map(c => (
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
