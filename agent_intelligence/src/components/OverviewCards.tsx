"use client";

import Link from "next/link";

import { formatRateImpact } from "@/lib/format";
import type { MostUrgent } from "@/lib/overview";

type Props = {
  prospectCount: number;
  defendCount: number;
  mostUrgent: MostUrgent | null;
  employeeStatesCount: number;
  // Today's date for the Compliance card's "Last checked …". v1 has no
  // snapshot pipeline, so this is just the page-load date (spec line 633).
  todayLabel: string;
};

const CARD =
  "border border-hairline border-line rounded-xl p-4 bg-surface";
const CARD_URGENT =
  "border-2 border-red-text rounded-xl p-4 bg-surface";

export default function OverviewCards({
  prospectCount,
  defendCount,
  mostUrgent,
  employeeStatesCount,
  todayLabel,
}: Props): React.JSX.Element {
  return (
    <div
      data-testid="ov-cards"
      className="grid grid-cols-4 gap-3 mb-5"
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
        <Link href="/prospect" className="text-12 text-blue-text font-medium no-underline">
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
        <Link href="/defend" className="text-12 text-blue-text font-medium no-underline">
          View all →
        </Link>
      </div>

      {/* Most Urgent (or fallback) */}
      {mostUrgent ? (
        <Link
          href={mostUrgent.classification === "prospect" ? "/prospect" : "/defend"}
          className={`${CARD_URGENT} no-underline block`}
          data-testid="ov-card-most-urgent"
          data-tier={mostUrgent.tier}
        >
          <div className="flex items-start gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-red-fill">
              <i className="ti ti-alert-triangle text-17 text-red-text" />
            </div>
            <div className="text-13 text-ink-2 pt-0.5">Most urgent</div>
          </div>
          <div
            className="text-15 font-medium mb-2 text-ink"
            data-testid="ov-most-urgent-body"
          >
            {mostUrgent.filing.brand}{" "}
            <span className="text-red-text">
              {formatRateImpact(mostUrgent.filing.overall_rate_impact)}
            </span>{" "}
            in {mostUrgent.filing.state}
          </div>
          <span
            className="inline-block bg-red-fill text-red-text px-2 py-0.5 text-11 rounded-full leading-[1.4] font-medium"
            data-testid="ov-most-urgent-pill"
          >
            {mostUrgent.pillText}
          </span>
        </Link>
      ) : (
        <div className={CARD} data-testid="ov-card-most-urgent-empty">
          <div className="flex items-start gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-surface-2">
              <i className="ti ti-alert-triangle text-17 text-ink-3" />
            </div>
            <div className="text-13 text-ink-2 pt-0.5">Most urgent</div>
          </div>
          <div className="text-13 text-ink-3">Nothing urgent right now.</div>
        </div>
      )}

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
        <Link href="/compliance" className="text-12 text-blue-text font-medium no-underline">
          View resources →
        </Link>
      </div>
    </div>
  );
}
