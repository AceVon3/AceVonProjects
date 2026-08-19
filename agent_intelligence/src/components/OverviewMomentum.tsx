"use client";

// "Carrier momentum" module (build spec Phase 3, 2026-08-19). Streak rows
// from computeCarrierMomentum; loading skeleton while the /api/positioning
// fetch resolves so the summary row never waits on it. Rows link to
// /positioning (whole pages only — no per-carrier deep link this build).
//
// Honesty rules carried as behavior: no arrow without 2+ filings; copy counts
// filings ("3 straight decreases"), never months; footnote states these are
// filed rate changes, not price levels.

import Link from "next/link";

import type { CarrierMomentum } from "@/lib/momentum";

function rowText(r: CarrierMomentum): string {
  if (r.kind === "unscored") return "1 filing · not scored";
  if (r.kind === "mixed") return "Mixed · no trend";
  return `${r.streak} straight ${r.dir === "down" ? "decreases" : "increases"}`;
}

export default function OverviewMomentum({
  rows,
}: {
  rows: CarrierMomentum[] | null; // null = /api/positioning still loading
}): React.JSX.Element {
  return (
    <div
      data-testid="ov-card-momentum"
      className="flex flex-col h-full min-h-[264px] bg-surface border border-card-line rounded-card p-5 shadow-card"
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-11 uppercase tracking-wider06 text-ink-3">Carrier momentum</div>
        <div className="text-12 text-ink-3">trailing 12 mo</div>
      </div>

      {rows === null ? (
        <div className="flex flex-col gap-2.5" data-testid="ov-momentum-skeleton" aria-hidden="true">
          {[72, 58, 64, 50].map((w, i) => (
            <div key={i} className="h-[14px] rounded bg-skeleton animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-13 text-ink-3 my-auto">
          No competitor filings in your states in the trailing 12 months.
        </div>
      ) : (
        // The "filed changes, not price levels" note moved to a shared
        // caption under the module row (uniformity fix, 2026-08-19).
        <>
          <div className="flex flex-col">
            {rows.map(r => (
              <Link
                key={r.brand}
                href="/positioning"
                data-testid="ov-momentum-row"
                className="flex items-center gap-2.5 no-underline group py-1.5 border-t border-line first:border-t-0"
              >
                <span
                  className={`text-13 truncate group-hover:underline ${
                    r.kind === "unscored" ? "text-ink-3" : "text-ink"
                  }`}
                >
                  {r.brand}
                </span>
                {r.kind === "trend" && (
                  <span
                    aria-hidden="true"
                    className={`flex-none text-13 font-bold leading-none ${
                      r.dir === "down" ? "text-blue-text" : "text-brand-red"
                    }`}
                  >
                    {r.dir === "down" ? "↓" : "↑"}
                  </span>
                )}
                <span
                  className={`ml-auto text-12 tabular-nums flex-none ${
                    r.kind === "trend"
                      ? r.dir === "down" ? "text-blue-text font-semibold" : "text-brand-red font-semibold"
                      : "text-ink-3"
                  }`}
                >
                  {rowText(r)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
