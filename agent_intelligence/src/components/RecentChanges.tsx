"use client";

import { useRouter } from "next/navigation";

import { formatEffectiveDate, formatRateImpact } from "@/lib/format";
import { FeedRow } from "@/lib/overview";
import { STATES } from "@/lib/states";

type Props = {
  rows: FeedRow[];
};

// Category color convention (design handoff, uniform across the app):
// PROSPECT = brand red, DEFEND = blue. Drives the row's left border accent,
// the impact %, and the category pill so a row reads uniformly.
const CATEGORY_BORDER: Record<"prospect" | "defend", string> = {
  prospect: "border-l-brand-red",
  defend:   "border-l-blue-text",
};
const CATEGORY_TEXT: Record<"prospect" | "defend", string> = {
  prospect: "text-brand-red",
  defend:   "text-blue-text",
};
const CATEGORY_PILL: Record<"prospect" | "defend", string> = {
  prospect: "bg-red-fill text-brand-red",
  defend:   "bg-blue-fill text-blue-text",
};

function stateName(code: string): string {
  return STATES.find(s => s.code === code)?.name ?? code;
}

// Group the feed rows by state, preserving the incoming (date-desc) order
// both across groups (a group sorts where its newest row sorts) and within
// each group. Pure presentation — the rows are exactly computeRecentChanges'
// output, so the feed still reconciles with /prospect and /defend.
function groupByState(rows: FeedRow[]): Array<{ state: string; rows: FeedRow[] }> {
  const groups: Array<{ state: string; rows: FeedRow[] }> = [];
  const byState = new Map<string, FeedRow[]>();
  for (const r of rows) {
    let bucket = byState.get(r.filing.state);
    if (!bucket) {
      bucket = [];
      byState.set(r.filing.state, bucket);
      groups.push({ state: r.filing.state, rows: bucket });
    }
    bucket.push(r);
  }
  return groups;
}

export default function RecentChanges({ rows }: Props): React.JSX.Element {
  const router = useRouter();
  const groups = groupByState(rows);

  return (
    <div data-testid="recent-changes">
      {/* Feed heading. The design frame says "The past 3 months' signals",
          but the feed is the newest threshold-crossing filings from the
          12-month Prospect/Defend sets (computeRecentChanges) — "Recent
          signals" states what it actually is. */}
      <div className="flex items-baseline justify-between mb-3.5">
        <h2 className="m-0 text-19 font-[650] text-ink tracking-tight02">
          Recent signals
        </h2>
        <span className="text-13 text-ink-3">filtered to your states</span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface border border-card-line rounded-card shadow-card px-5 py-4 text-13 text-ink-2">
          No threshold-crossing filings in your scope yet. Check back next month — data refreshes monthly.
        </div>
      ) : (
        groups.map(group => (
          <div key={group.state} className="mb-5">
            <div className="text-11 font-bold uppercase tracking-wider08 text-ink-3 mb-2 ml-0.5">
              {stateName(group.state)} · {group.rows.length}{" "}
              {group.rows.length === 1 ? "signal" : "signals"}
            </div>
            <div className="bg-surface border border-card-line rounded-card shadow-card overflow-hidden">
              {group.rows.map((r, idx) => {
                const href = r.classification === "prospect" ? "/prospect" : "/defend";
                const isLast = idx === group.rows.length - 1;
                // "effective Aug 1, 2026" for future rows, "in effect since
                // Jun 22, 2026" once landed. The year stays (dataset spans
                // 2025–2026, so a bare month/day is ambiguous).
                const when = r.future
                  ? `effective ${formatEffectiveDate(r.filing.effective_date)}`
                  : `in effect since ${formatEffectiveDate(r.filing.effective_date)}`;
                const go = () => router.push(href);
                return (
                  // The whole row navigates (role=link + keyboard), keeping
                  // the single-click affordance the old rows had.
                  <div
                    key={`${r.filing.id}-${idx}`}
                    data-testid="feed-row"
                    role="link"
                    tabIndex={0}
                    onClick={go}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
                    }}
                    className={[
                      "flex items-center justify-between gap-4 px-[22px] py-4",
                      "border-l-[3px] cursor-pointer transition-colors hover:bg-surface-2",
                      CATEGORY_BORDER[r.classification],
                      isLast ? "" : "border-b border-b-line",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="text-15 font-[650] text-ink truncate">
                        {r.filing.brand}
                      </div>
                      <div className="text-13 text-ink-2 mt-0.5 truncate">
                        {r.filing.line_of_business} · {when}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3.5">
                      <span
                        className={`text-17 font-bold tabular-nums ${CATEGORY_TEXT[r.classification]}`}
                      >
                        {formatRateImpact(r.filing.overall_rate_impact)}
                      </span>
                      <span
                        className={`${CATEGORY_PILL[r.classification]} rounded-full px-3 py-[5px] text-11 font-bold uppercase tracking-wider06 leading-none`}
                      >
                        {r.classification}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <p className="text-13 text-ink-3 mt-4 mb-0">
        Premium-weighted, rolled up per filing — sourced from public state filing systems.
      </p>
    </div>
  );
}
