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
    // FilingsTable restyle. Each row is a TWO-BLOCK flex row (not a full-width
    // column table): a left block that keeps impact + carrier + meta tight
    // together, and a right cluster (category pill + time). One clean gap
    // between them — no floating left-edge impact, no middle void.
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
          const ph = r.filing.total_policyholders;
          // Policyholders lives in the secondary line, appended after the date.
          // Omit the count when missing (AM Best rows have none) so the line
          // stays clean rather than dangling a "—".
          const meta =
            ph == null
              ? formatEffectiveDate(r.filing.effective_date)
              : `${formatEffectiveDate(r.filing.effective_date)} · ${formatPolicyholders(ph)} policyholders`;
          const go = () => router.push(href);
          return (
            // The whole row navigates (role=link + keyboard), keeping the
            // single-click affordance the old rows had.
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
                "flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-surface-2/60",
                isLast ? "" : "border-b border-hairline border-line",
              ].join(" ")}
            >
              {/* LEFT BLOCK — impact sits directly next to the carrier; the
                  date + policyholders form the muted secondary line, aligned
                  under the carrier. Takes the available width. */}
              <div className="flex-1 min-w-0 flex items-baseline gap-2">
                <span
                  className={`w-[62px] shrink-0 text-right text-14 font-semibold tabular-nums ${CATEGORY_TEXT[r.classification]}`}
                >
                  {formatRateImpact(r.filing.overall_rate_impact)}
                </span>
                <div className="min-w-0">
                  <div className="text-14 truncate">
                    <span className="text-ink font-medium">{r.filing.brand}</span>
                    <span className="text-ink-2"> · {r.filing.line_of_business} · {r.filing.state}</span>
                  </div>
                  <div className="text-12 text-ink-2 mt-0.5">{meta}</div>
                </div>
              </div>

              {/* RIGHT BLOCK — compact category pill + muted time, right-aligned. */}
              <div className="shrink-0 flex items-center gap-3">
                <span
                  className={`${CATEGORY_PILL[r.classification]} inline-block px-2 py-0.5 text-11 rounded-full leading-[1.4] font-medium`}
                >
                  {CATEGORY_LABEL[r.classification]}
                </span>
                <span className="min-w-[28px] text-right text-11 text-ink-3 tabular-nums">
                  {ageText}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
