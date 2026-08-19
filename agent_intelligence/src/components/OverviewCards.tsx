"use client";

import Link from "next/link";

import { formatEffectiveDate, formatRateImpact } from "@/lib/format";
import type { BiggestMover } from "@/lib/overview";

type Props = {
  prospectCount: number;
  defendCount: number;
  // Own-carrier alerts (last 6 months) — see src/lib/retention.ts.
  retentionCount: number;   // own-carrier INCREASES >= +5% (retention risk)
  opportunityCount: number; // own-carrier DECREASES <= -2% (opportunity)
  // Largest ±30-day filed change (computeBiggestMover). Replaced the
  // Compliance card in this row 2026-08-19 (build spec Phase 1); Compliance
  // moved to the bottom of the page — see ComplianceSummaryCard.
  biggestMover: BiggestMover | null;
};

// Three summary cards (design frame 2a). Cards are flex columns so pinned
// bottom links (mt-auto) line up across the row regardless of body height.
const CARD =
  "flex flex-col bg-surface border border-card-line rounded-card p-5 shadow-card";

const KICKER =
  "text-11 uppercase tracking-wider06 text-ink-3 mb-3";

// One big-number stat line. The number goes muted (ink-3) at zero — a zero
// count isn't a signal, so it shouldn't wear the signal color.
function StatLine({
  count,
  colorClass,
  label,
  href,
  countTestId,
  linkTestId,
}: {
  count: number;
  colorClass: string;
  label: string;
  href: string;
  countTestId: string;
  linkTestId?: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      data-testid={linkTestId}
      className="flex items-baseline gap-2.5 no-underline group [&+&]:mt-2"
    >
      <span
        className={`text-30 font-bold leading-none tabular-nums ${count > 0 ? colorClass : "text-ink-3"}`}
        data-testid={countTestId}
      >
        {count}
      </span>
      <span className="text-13 text-ink-2 group-hover:underline">{label}</span>
    </Link>
  );
}

export default function OverviewCards({
  prospectCount,
  defendCount,
  retentionCount,
  opportunityCount,
  biggestMover,
}: Props): React.JSX.Element {
  return (
    <div
      data-testid="ov-cards"
      className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7"
    >
      {/* Signal counts. The design's kicker reads "This quarter", but these
          counts are the 12-month Prospect/Defend query results and MUST
          reconcile with the table pages (CLAUDE.md verification numbers) —
          so the label states the real window. */}
      <div className={CARD} data-testid="ov-card-prospect">
        <div className={KICKER}>Last 12 months</div>
        <StatLine
          count={prospectCount}
          colorClass="text-brand-red"
          label={`prospect signal${prospectCount === 1 ? "" : "s"}`}
          href="/prospect"
          countTestId="ov-prospect-count"
        />
        <StatLine
          count={defendCount}
          colorClass="text-blue-text"
          label={`defend risk${defendCount === 1 ? "" : "s"}`}
          href="/defend"
          countTestId="ov-defend-count"
        />
      </div>

      {/* My Carrier — two-direction own-carrier alert summary (last 6 months).
          Retention risk = your carrier RAISED (>= +5%); Opportunity = your
          carrier CUT (<= -2%). Both reconcile with the /my-carriers tab via
          the shared retention.ts helpers. */}
      <div className={CARD} data-testid="ov-card-my-carrier">
        <div className={KICKER}>My carriers</div>
        <StatLine
          count={retentionCount}
          colorClass="text-brand-red"
          label={`retention risk alert${retentionCount === 1 ? "" : "s"}`}
          href="/my-carriers"
          countTestId="ov-retention-count"
          linkTestId="ov-retention-link"
        />
        <StatLine
          count={opportunityCount}
          colorClass="text-green-text"
          label={`opportunity alert${opportunityCount === 1 ? "" : "s"}`}
          href="/my-carriers"
          countTestId="ov-opportunity-count"
          linkTestId="ov-opportunity-link"
        />
      </div>

      {/* Biggest mover — largest |filed change| effective within ±30 days of
          the data as-of date. Badge inherits the signal's SOURCE mode, never
          the sign. Whole card links to the page that backs the signal up.
          "Mover" language only — filed changes, never price levels. */}
      {biggestMover ? (
        <Link
          href={biggestMover.mode === "prospect" ? "/prospect" : "/defend"}
          data-testid="ov-card-mover"
          className={`${CARD} no-underline group`}
        >
          <div className="flex items-baseline justify-between">
            <div className={KICKER.replace(" mb-3", " mb-2")}>Biggest mover</div>
            <span
              data-testid="ov-mover-badge"
              className={`text-10 font-bold tracking-wider06 rounded-badge px-2 py-0.5 ${
                biggestMover.mode === "prospect"
                  ? "bg-red-fill text-red-text"
                  : "bg-blue-fill text-blue-text"
              }`}
            >
              {biggestMover.mode === "prospect" ? "PROSPECT" : "DEFEND"}
            </span>
          </div>
          <div
            data-testid="ov-mover-impact"
            className={`text-30 font-bold leading-none tabular-nums ${
              biggestMover.mode === "prospect" ? "text-brand-red" : "text-blue-text"
            }`}
          >
            {formatRateImpact(biggestMover.filing.overall_rate_impact)}
          </div>
          <div className="text-13 text-ink mt-1.5 group-hover:underline">
            {biggestMover.filing.brand} · {biggestMover.filing.line_of_business} ·{" "}
            {biggestMover.filing.state}
          </div>
          <div className="text-12 text-ink-3 mt-auto pt-2">
            {biggestMover.future ? "Effective" : "In effect"}{" "}
            {formatEffectiveDate(biggestMover.filing.effective_date)} · largest{" "}
            {biggestMover.filing.overall_rate_impact >= 0 ? "increase" : "decrease"} this month
          </div>
        </Link>
      ) : (
        <div className={CARD} data-testid="ov-card-mover">
          <div className={KICKER}>Biggest mover</div>
          <div className="text-13 text-ink-3 my-auto">
            No rate filings in the last 30 days.
          </div>
        </div>
      )}
    </div>
  );
}

// Compliance — lightweight v1 (no change-detection claims). Content unchanged
// from its old summary-row slot; relocated to the bottom of the Overview page
// when Biggest Mover took the third card (build spec Phase 1, 2026-08-19).
export function ComplianceSummaryCard({
  employeeStatesCount,
  todayLabel,
}: {
  employeeStatesCount: number;
  // Today's date for the "Last checked …" line. v1 has no snapshot pipeline,
  // so this is just the page-load date (spec line 633).
  todayLabel: string;
}): React.JSX.Element {
  return (
    <div className={`${CARD} mt-7`} data-testid="ov-card-compliance">
      <div className={KICKER}>Compliance</div>
      <div
        className="text-18 font-[650] text-ink mb-1"
        data-testid="ov-compliance-states"
      >
        {employeeStatesCount} {employeeStatesCount === 1 ? "state" : "states"} tracked
      </div>
      <div className="text-12 text-ink-3">Last checked {todayLabel}</div>
      <Link
        href="/compliance"
        className="mt-auto pt-3 text-12 font-semibold text-brand-red no-underline hover:underline"
      >
        View resources →
      </Link>
    </div>
  );
}
