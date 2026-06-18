"use client";

import { useRouter } from "next/navigation";

import {
  formatEffectiveDate,
  formatPolicyholders,
  formatRateImpact,
} from "@/lib/format";
import { FeedRow } from "@/lib/overview";

type Props = {
  rows: FeedRow[];
};

// Category color — agent perspective, consistent with the Prospect/Defend
// tables: Prospect (competitor raised → your opening) = green, Defend
// (competitor cut → your risk) = red. Drives BOTH the leading impact % and
// the category pill so a row reads uniformly.
const CATEGORY_PILL: Record<"prospect" | "defend", string> = {
  prospect: "bg-green-fill text-green-text",
  defend:   "bg-red-fill text-red-text",
};
const CATEGORY_TEXT: Record<"prospect" | "defend", string> = {
  prospect: "text-green-text",
  defend:   "text-red-text",
};
const CATEGORY_LABEL: Record<"prospect" | "defend", string> = {
  prospect: "Prospect",
  defend:   "Defend",
};

export default function RecentChanges({ rows }: Props): React.JSX.Element {
  const router = useRouter();
  return (
    // Rounded hairline container with a surface-2 header band, matching the
    // FilingsTable restyle. The rows are a real fixed-layout table so the
    // columns align vertically down the list and span the full width evenly —
    // no middle gap, no edge-clustering.
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
        <table className="w-full text-13" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
          {/* Even column distribution across the full width. The date is NOT
              its own column — it sits under the carrier name (below) so it
              stays clearly attached to its filing. Impact · Carrier(+date) ·
              Policyholders · Category · Time. */}
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "44%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "11%" }} />
          </colgroup>
          <tbody>
            {rows.map((r, idx) => {
              const href = r.classification === "prospect" ? "/prospect" : "/defend";
              const ageText = r.future ? `${r.ageWeeks}w left` : `${r.ageWeeks}w`;
              const isLast = idx === rows.length - 1;
              const ph = r.filing.total_policyholders;
              const go = () => router.push(href);
              return (
                // The whole row navigates (role=link + keyboard), keeping the
                // single-click affordance the old <Link> rows had while letting
                // the cells lay out as a table.
                <tr
                  key={`${r.filing.id}-${idx}`}
                  data-testid="feed-row"
                  role="link"
                  tabIndex={0}
                  onClick={go}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
                  }}
                  className={[
                    "cursor-pointer transition-colors hover:bg-surface-2/60",
                    isLast ? "" : "border-b border-hairline border-line",
                  ].join(" ")}
                >
                  {/* Impact % leads, right-aligned and category-colored, so
                      magnitude scans straight down the column. */}
                  <td
                    className={`px-4 py-3 text-right align-middle text-14 font-medium tabular-nums ${CATEGORY_TEXT[r.classification]}`}
                  >
                    {formatRateImpact(r.filing.overall_rate_impact)}
                  </td>
                  {/* Carrier block: carrier · line · state on top, effective
                      date as a muted secondary line beneath, so the date reads
                      as attached to this filing rather than floating. */}
                  <td className="px-2 py-3 align-middle">
                    <div className="text-14 text-ink truncate">
                      {r.filing.brand} · {r.filing.line_of_business} · {r.filing.state}
                    </div>
                    <div className="text-12 text-ink-2 mt-0.5">
                      {formatEffectiveDate(r.filing.effective_date)}
                    </div>
                  </td>
                  {/* Policyholders: right-aligned, count over a muted label.
                      A muted "—" (with the label) when no count is available —
                      AM Best rows have no policyholder figure — so the column
                      stays consistent rather than blank. */}
                  <td data-testid="feed-policyholders" className="px-2 py-3 align-middle text-right">
                    <div className={`text-13 tabular-nums ${ph == null ? "text-ink-2" : "text-ink"}`}>
                      {formatPolicyholders(ph)}
                    </div>
                    <div className="text-11 text-ink-3">policyholders</div>
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <span
                      className={`${CATEGORY_PILL[r.classification]} inline-block px-2 py-0.5 text-11 rounded-full leading-[1.4] font-medium`}
                    >
                      {CATEGORY_LABEL[r.classification]}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-right text-11 text-ink-3 tabular-nums">
                    {ageText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
