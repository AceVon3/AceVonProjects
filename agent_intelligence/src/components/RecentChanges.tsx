"use client";

import Link from "next/link";

import { formatRateImpact } from "@/lib/format";
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
    <div
      data-testid="recent-changes"
      className="border border-hairline border-line rounded-xl pt-[18px] px-[18px] pb-1.5"
    >
      <h3 className="text-15 font-medium mt-0 mb-3.5 text-ink">
        Recent changes
      </h3>

      {rows.length === 0 ? (
        <div className="text-12 text-ink-3 pb-3">
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
                "flex justify-between items-center py-2.5 no-underline text-inherit",
                isLast ? "" : "border-b border-hairline border-line",
              ].join(" ")}
            >
              <div>
                <div className="text-14 font-medium text-ink">
                  {r.filing.brand}
                </div>
                <div className="text-12 text-ink-2">
                  {formatRateImpact(r.filing.overall_rate_impact)} in {r.filing.state} · {r.classification}
                </div>
              </div>
              <span className={pill(feedRowPillColor(r))}>{ageText}</span>
            </Link>
          );
        })
      )}
    </div>
  );
}
