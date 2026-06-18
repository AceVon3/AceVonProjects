"use client";

import Link from "next/link";

type Props = {
  prospectCount: number;
  defendCount: number;
  // Own-carrier alerts (last 6 months) — see src/lib/retention.ts.
  retentionCount: number;   // own-carrier INCREASES >= +5% (retention risk)
  opportunityCount: number; // own-carrier DECREASES <= -2% (opportunity)
  employeeStatesCount: number;
  // Today's date for the Compliance card's "Last checked …". v1 has no
  // snapshot pipeline, so this is just the page-load date (spec line 633).
  todayLabel: string;
};

// Cards are flex columns so every "View all →" link can be pushed to the
// bottom (mt-auto) and line up across the row regardless of body height.
const CARD =
  "flex flex-col border border-hairline border-line rounded-xl p-4 bg-surface";

export default function OverviewCards({
  prospectCount,
  defendCount,
  retentionCount,
  opportunityCount,
  employeeStatesCount,
  todayLabel,
}: Props): React.JSX.Element {
  return (
    <div
      data-testid="ov-cards"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5"
    >
      {/* Prospect */}
      <div className={CARD} data-testid="ov-card-prospect">
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2">
            <i className="ti ti-target-arrow text-17 text-ink-2" />
          </div>
          <div className="text-13 text-ink-2 pt-0.5">Prospect opportunities</div>
        </div>
        <div className="text-26 font-medium mb-2 text-ink" data-testid="ov-prospect-count">
          {prospectCount}
        </div>
        {/* Prospect = your opportunity → green link */}
        <Link href="/prospect" className="mt-auto text-12 text-green-text font-medium no-underline">
          View all →
        </Link>
      </div>

      {/* Defend */}
      <div className={CARD} data-testid="ov-card-defend">
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-fill">
            <i className="ti ti-shield-half text-17 text-amber-text" />
          </div>
          <div className="text-13 text-ink-2 pt-0.5">Defend risks</div>
        </div>
        <div className="text-26 font-medium mb-2 text-ink" data-testid="ov-defend-count">
          {defendCount}
        </div>
        {/* Defend = your risk → red link */}
        <Link href="/defend" className="mt-auto text-12 text-red-text font-medium no-underline">
          View all →
        </Link>
      </div>

      {/* My Carrier — two-direction own-carrier alert summary (last 6 months).
          Retention risk = your carrier RAISED (>= +5%); Opportunity = your
          carrier CUT (<= -2%). Both reconcile with the /my-carriers tab via the
          shared retention.ts helpers. Replaces the old competitor-only "Most
          urgent" card. */}
      <div className={CARD} data-testid="ov-card-my-carrier">
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2">
            <i className="ti ti-arrows-left-right text-17 text-ink-2" />
          </div>
          <div className="text-13 text-ink-2 pt-0.5">My Carrier</div>
        </div>
        <Link
          href="/my-carriers"
          data-testid="ov-retention-link"
          className="flex items-baseline gap-2 mb-1.5 no-underline group"
        >
          <span
            className={`text-18 font-medium ${retentionCount > 0 ? "text-red-text" : "text-ink-3"}`}
            data-testid="ov-retention-count"
          >
            {retentionCount}
          </span>
          <span className="text-12 text-ink-2 group-hover:underline">
            retention risk alert{retentionCount === 1 ? "" : "s"}
          </span>
        </Link>
        <Link
          href="/my-carriers"
          data-testid="ov-opportunity-link"
          className="flex items-baseline gap-2 no-underline group"
        >
          <span
            className={`text-18 font-medium ${opportunityCount > 0 ? "text-green-text" : "text-ink-3"}`}
            data-testid="ov-opportunity-count"
          >
            {opportunityCount}
          </span>
          <span className="text-12 text-ink-2 group-hover:underline">
            opportunity alert{opportunityCount === 1 ? "" : "s"}
          </span>
        </Link>
      </div>

      {/* Compliance — lightweight v1 (no change-detection claims) */}
      <div className={CARD} data-testid="ov-card-compliance">
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2">
            <i className="ti ti-gavel text-17 text-ink-2" />
          </div>
          <div className="text-13 text-ink-2 pt-0.5">Compliance</div>
        </div>
        <div
          className="text-15 font-medium mb-1 text-ink"
          data-testid="ov-compliance-states"
        >
          {employeeStatesCount} {employeeStatesCount === 1 ? "state" : "states"} tracked
        </div>
        <div className="text-11 text-ink-3 mb-2">
          Last checked {todayLabel}
        </div>
        {/* Compliance is neutral (not an opportunity/risk signal) → keep the
            existing neutral link color. */}
        <Link href="/compliance" className="mt-auto text-12 text-blue-text font-medium no-underline">
          View resources →
        </Link>
      </div>
    </div>
  );
}
