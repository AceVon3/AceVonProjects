"use client";

// "Next 30 days" module (build spec Phase 2, 2026-08-19). Strictly
// future-dated signals from computeNext30, effective-date ascending, capped
// at 5 visible rows with a "+N more" overflow link. Each row links to the
// page that produced its signal (/prospect or /defend) — whole pages only,
// no filing-detail routes exist (recon). Empty state keeps the card visible.

import Link from "next/link";

import { formatRateImpact } from "@/lib/format";
import type { UpcomingSignal } from "@/lib/overview";

const CAP = 5;

// "2026-09-03" → "Sep 3" (UTC — a calendar fact, not a moment; same rule as
// formatEffectiveDate, minus the year since everything here is ≤30 days out).
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}`;
}

export default function OverviewNext30({
  rows,
}: {
  rows: UpcomingSignal[];
}): React.JSX.Element {
  const visible = rows.slice(0, CAP);
  const hidden = rows.slice(CAP);
  // Overflow goes to whichever page holds more of the hidden rows (tie →
  // /prospect). Whole pages only — no filtered feed view exists (recon Q2).
  const hiddenProspect = hidden.filter(r => r.mode === "prospect").length;
  const overflowHref = hiddenProspect * 2 >= hidden.length ? "/prospect" : "/defend";

  return (
    <div
      data-testid="ov-card-next30"
      className="flex flex-col bg-surface border border-card-line rounded-card p-5 shadow-card"
    >
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-11 uppercase tracking-wider06 text-ink-3">Next 30 days</div>
        <div className="text-12 text-ink-3 tabular-nums" data-testid="ov-next30-count">
          {rows.length === 0
            ? ""
            : `${rows.length} filing${rows.length === 1 ? "" : "s"} take${rows.length === 1 ? "s" : ""} effect`}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-13 text-ink-3 my-auto">
          No filings take effect in the next 30 days.
        </div>
      ) : (
        <div className="flex flex-col">
          {visible.map(({ filing: f, mode }) => (
            <Link
              key={f.id}
              href={mode === "prospect" ? "/prospect" : "/defend"}
              data-testid="ov-next30-row"
              className="flex items-center gap-2.5 no-underline group py-1.5 border-t border-line first:border-t-0"
            >
              <span className="text-12 text-ink-3 tabular-nums w-[44px] flex-none">
                {shortDate(f.effective_date!)}
              </span>
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full flex-none ${
                  mode === "prospect" ? "bg-brand-red" : "bg-blue-text"
                }`}
              />
              <span className="text-13 text-ink truncate group-hover:underline">
                {f.brand} · {f.line_of_business} · {f.state}
              </span>
              <span
                className={`ml-auto text-13 font-semibold tabular-nums flex-none ${
                  mode === "prospect" ? "text-brand-red" : "text-blue-text"
                }`}
              >
                {formatRateImpact(f.overall_rate_impact)}
              </span>
            </Link>
          ))}
          {hidden.length > 0 && (
            <Link
              href={overflowHref}
              data-testid="ov-next30-more"
              className="text-12 font-semibold text-brand-red no-underline hover:underline pt-2"
            >
              +{hidden.length} more →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
