"use client";

import { useState } from "react";

import { formatEffectiveDate, formatPolicyholders, formatRateImpact } from "@/lib/format";
import type { AnchorBlock, BrandStat, Comparison, PositioningCell } from "@/lib/positioning";

// Compact premium for the audit panel (it's what drives the weighting).
function fmtMoney(p: number | null): string {
  if (p == null) return "—";
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(1)}M`;
  if (p >= 1_000) return `$${(p / 1_000).toFixed(0)}k`;
  return `$${Math.round(p)}`;
}

// A >=2-filing stat reads as a genuine "avg"; a single filing must NEVER be
// dressed as an average (rename guardrail) — it reads "1 filing: +X%".
function statLabel(s: BrandStat): string {
  return s.count >= 2
    ? `${formatRateImpact(s.avgChange)} avg`
    : `1 filing: ${formatRateImpact(s.avgChange)}`;
}

// Spread is shown only for higher-confidence comparisons (both sides averages).
function fmtSpread(d: number): string {
  if (Math.abs(d) < 0.05) return "≈ same change";
  const mag = Math.abs(d).toFixed(1);
  return d > 0 ? `+${mag} pts higher` : `−${mag} pts lower`;
}

function FilingsAudit({ filings, asOf }: { filings: BrandStat["filings"]; asOf: string }): React.JSX.Element {
  return (
    <div className="mt-2 mb-1 rounded-lg bg-surface-2 border border-line px-3.5 py-2.5">
      <div className="text-10 uppercase tracking-wider04 text-ink-3 mb-1.5">
        change filed, not price · {filings.length} filing{filings.length === 1 ? "" : "s"}
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-1">
        {filings.map(f => (
          <li key={f.id} className="text-12 text-ink-2 flex flex-wrap gap-x-2">
            <span className="text-ink font-medium">{formatRateImpact(f.overall_rate_impact)}</span>
            <span>· {formatEffectiveDate(f.effective_date)}</span>
            <span>· {formatPolicyholders(f.total_policyholders)} ph</span>
            <span>· {fmtMoney(f.total_written_premium)} premium</span>
            {/* AM Best rows have no SERFF tracking number and the surrogate key
                is backend-only — omit the identifier entirely (no visual marker). */}
            {f.source !== "ambest_sourced" && (
              <span>· {f.serff_tracking_number}</span>
            )}
            {f.rate_activity === "rate_change_pending" && (
              <span className="text-amber-text">
                {/* file-and-use: rate can be live while the review is open —
                    say so once the effective date has passed (see format.ts) */}
                {f.effective_date && asOf && f.effective_date <= asOf
                  ? "· rate in effect; state review still open"
                  : "· pending"}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExpandableRow({
  testid,
  tier,
  hasSpread,
  left,
  right,
  children,
}: {
  testid: string;
  tier?: "high" | "thin";
  hasSpread?: boolean;
  left: React.ReactNode;
  right: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border-b border-line last:border-b-0 py-3"
      data-testid={testid}
      data-tier={tier}
      data-spread={hasSpread ? "true" : "false"}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-3 bg-transparent border-none cursor-pointer text-left p-0"
      >
        <span className="min-w-0">{left}</span>
        <span className="flex items-center gap-2 shrink-0">
          {right}
          <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"} text-12 text-ink-3`} aria-hidden />
        </span>
      </button>
      {open && children}
    </div>
  );
}

function ComparisonRow({ cmp, asOf }: { cmp: Comparison; asOf: string }): React.JSX.Element {
  const thin = cmp.tier === "thin";
  return (
    <ExpandableRow
      testid="comparison-row"
      tier={cmp.tier}
      hasSpread={cmp.spread !== null}
      left={
        <span className={`text-13 ${thin ? "text-ink-2" : "text-ink"}`}>
          {cmp.competitor.brand}
          {thin && (
            <span className="ml-1.5 inline-block bg-soft text-ink-3 text-10 font-semibold uppercase tracking-wider04 px-1.5 py-px rounded-full align-[1px]">
              thin
            </span>
          )}
        </span>
      }
      right={
        <span className="text-13 flex items-center gap-2 flex-wrap justify-end">
          <span className={thin ? "text-ink-2" : "text-ink font-medium"}>{statLabel(cmp.competitor)}</span>
          <span className="text-11 text-ink-3">· {cmp.competitor.count} filing{cmp.competitor.count === 1 ? "" : "s"}</span>
          {cmp.spread !== null && (
            <span className="text-11 text-ink-2">· {fmtSpread(cmp.spread)}</span>
          )}
        </span>
      }
    >
      <FilingsAudit filings={cmp.competitor.filings} asOf={asOf} />
    </ExpandableRow>
  );
}

function Anchor({ anchor, withDivider, asOf }: { anchor: AnchorBlock; withDivider: boolean; asOf: string }): React.JSX.Element {
  return (
    <div className={withDivider ? "border-t border-line-2 mt-1 pt-1" : ""}>
      <ExpandableRow
        testid="anchor-row"
        left={
          <span className="text-14 font-[650] text-ink">
            {anchor.agent.brand}{" "}
            <span className="text-11 text-ink-3 font-normal">your carrier</span>
          </span>
        }
        right={
          <span className="text-13 flex items-center gap-2">
            <span className="text-ink font-medium">{statLabel(anchor.agent)}</span>
            <span className="text-11 text-ink-3">· {anchor.agent.count} filing{anchor.agent.count === 1 ? "" : "s"}</span>
          </span>
        }
      >
        <FilingsAudit filings={anchor.agent.filings} asOf={asOf} />
      </ExpandableRow>

      {anchor.comparisons.map(c => (
        <ComparisonRow key={c.competitor.brand} cmp={c} asOf={asOf} />
      ))}

      {anchor.insufficient.length > 0 && (
        <div className="py-2 text-12 text-ink-3" data-testid="insufficient-line">
          Insufficient data: {anchor.insufficient.join(", ")}
        </div>
      )}
    </div>
  );
}

export default function PositioningCard({ cell, asOf }: { cell: PositioningCell; asOf: string }): React.JSX.Element {
  return (
    <div
      data-testid="positioning-cell"
      className="bg-surface border border-card-line rounded-card shadow-card overflow-hidden"
    >
      <div className="bg-surface-2 border-b border-line px-[18px] py-3 flex items-center justify-between">
        <h3 className="text-14 font-[650] m-0 text-ink">
          {cell.line} · {cell.state}
        </h3>
        <span className="text-10 uppercase tracking-wider06 text-ink-3">avg rate change</span>
      </div>
      <div className="px-[18px]">
        {cell.anchors.map((a, i) => (
          <Anchor key={a.agent.brand} anchor={a} withDivider={i > 0} asOf={asOf} />
        ))}
      </div>
    </div>
  );
}
