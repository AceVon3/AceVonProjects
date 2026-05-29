"use client";

import Link from "next/link";

import {
  formatEffectiveDate,
  formatPolicyholders,
  formatRateImpact,
} from "@/lib/format";
import { FeedRow, feedRowPillColor } from "@/lib/overview";

type Props = {
  rows: FeedRow[];
};

const PILL_CLASS: Record<"red" | "gray", string> = {
  red:  "bg-red-fill text-red-text",
  gray: "bg-gray-fill text-gray-text",
};

function pill(color: "red" | "gray"): string {
  return `${PILL_CLASS[color]} inline-block px-2 py-0.5 text-11 rounded-full leading-[1.4] font-medium`;
}

export default function RecentChanges({ rows }: Props): React.JSX.Element {
  return (
    // Matches the FilingsTable restyle: rounded hairline container, a
    // surface-2 header band, hairline row dividers, and row hover. It stays
    // a feed/list (not a table) — same rows, same data, just visually in line.
    <div
      data-testid="recent-changes"
      className="rounded-lg border border-hairline border-line overflow-hidden"
    >
      <div className="bg-surface-2 border-b border-hairline border-line-2 px-4 py-2.5">
        <h3 className="text-11 uppercase tracking-wider04 font-medium m-0 text-ink-2">
          Recent changes
        </h3>
      </div>

      {rows.length === 0 ? (
        <div className="text-12 text-ink-3 px-4 py-4">
          No threshold-crossing filings in your scope yet. Check back next month — data refreshes monthly.
        </div>
      ) : (
        rows.map((r, idx) => {
          const href = r.classification === "prospect" ? "/prospect" : "/defend";
          const ageText = r.future ? `${r.ageWeeks}w left` : `${r.ageWeeks}w`;
          const isLast = idx === rows.length - 1;
          return (
            <Link
              key={`${r.filing.id}-${idx}`}
              href={href}
              data-testid="feed-row"
              className={[
                "flex justify-between items-center px-4 py-3 no-underline text-inherit",
                "transition-colors hover:bg-surface-2/60",
                isLast ? "" : "border-b border-hairline border-line",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="text-14 font-medium text-ink">
                  {r.filing.brand}
                </div>
                {/* Enriched supporting line — kept as one muted secondary line
                    (not columns) so the carrier still reads first and the rest
                    is taken in second. Helpers shared with the tables keep the
                    date (with year) and policyholder abbreviation consistent. */}
                <div className="text-12 text-ink-2 mt-0.5">
                  {formatRateImpact(r.filing.overall_rate_impact)} on {r.filing.line_of_business} in {r.filing.state}
                  {" · "}{formatEffectiveDate(r.filing.effective_date)}
                  {" · "}{formatPolicyholders(r.filing.total_policyholders)} policyholders
                  {" · "}{r.classification}
                </div>
              </div>
              <span className={`${pill(feedRowPillColor(r))} ml-3 shrink-0`}>{ageText}</span>
            </Link>
          );
        })
      )}
    </div>
  );
}
