"use client";

import Link from "next/link";

import type { Filing } from "@/lib/filings";
import {
  formatEffectiveDate,
  formatPolicyholders,
  formatRateImpact,
  rateImpactColor,
} from "@/lib/format";
import { resolveSubtype } from "@/lib/subtypes";

type Props = {
  agentType: "captive" | "independent";
  brands: string[];        // authorized brands, in profile order
  rows: Filing[];          // curated recent slice (computeCarrierActivity)
  noFilingStates: string[]; // licensed states with no own-carrier filings
};

// Signed rate change, colored on the same rules the My Carriers table uses
// (red ≥ +5, green ≤ −2, ink otherwise) so a number reads identically here
// and on the full table it links to.
function changeClass(impact: number): string {
  const c = rateImpactColor(impact, "my-carriers");
  if (c === "red") return "text-red-text font-medium";
  if (c === "green") return "text-green-text font-medium";
  return "text-ink font-medium";
}

function ActivityRow({ f, last }: { f: Filing; last: boolean }): React.JSX.Element {
  const { label } = resolveSubtype(f.sub_type);
  return (
    <div
      data-testid="carrier-activity-item"
      className={`grid grid-cols-[1fr_2.4fr_0.5fr_0.7fr_1fr_0.8fr] items-baseline gap-x-3 px-4 py-2.5 text-12 ${
        last ? "" : "border-b border-hairline border-line"
      }`}
    >
      {/* Carrier */}
      <span className="text-ink font-medium truncate">{f.brand}</span>
      {/* Line · sub-type */}
      <span className="text-ink-2 truncate">
        {f.line_of_business}
        <span className="text-ink-3"> · {label}</span>
      </span>
      {/* State */}
      <span data-testid="carrier-activity-state" className="text-ink-2">{f.state}</span>
      {/* Signed rate change */}
      <span className={changeClass(f.overall_rate_impact)}>
        {formatRateImpact(f.overall_rate_impact)}
      </span>
      {/* Effective date (with year) */}
      <span data-testid="carrier-activity-eff" className="text-ink-2">
        {formatEffectiveDate(f.effective_date)}
      </span>
      {/* Policyholders (abbreviated, em-dash for null) */}
      <span className={`text-right ${f.total_policyholders == null ? "text-ink-3" : "text-ink-2"}`}>
        {formatPolicyholders(f.total_policyholders)}
      </span>
    </div>
  );
}

export default function CarrierActivity({
  agentType,
  brands,
  rows,
  noFilingStates,
}: Props): React.JSX.Element {
  const isCaptive = agentType === "captive";
  const title = isCaptive
    ? `Your carrier (${brands[0]}) — recent filings`
    : "Your carriers — recent filings";
  // Match the My Carrier(s) page's own singular/plural framing.
  const carrierWord = isCaptive ? "carrier" : "carriers";

  return (
    <div
      data-testid="carrier-activity"
      className="rounded-lg border border-hairline border-line overflow-hidden mb-5"
    >
      <div className="bg-surface-2 border-b border-hairline border-line-2 px-4 py-2.5 flex items-center justify-between gap-3">
        <h3 className="text-11 uppercase tracking-wider04 font-medium m-0 text-ink-2">
          {title}
        </h3>
        <Link
          href="/my-carriers"
          data-testid="carrier-activity-seeall"
          className="text-11 font-medium text-blue-text hover:underline shrink-0"
        >
          See all →
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-12 text-ink-3 px-4 py-4" data-testid="carrier-activity-empty">
          {isCaptive
            ? `No recent ${brands[0]} filings in your states.`
            : "No recent filings from your carriers in your states."}
        </div>
      ) : (
        <>
          {rows.map((f, i) => (
            <ActivityRow key={f.id} f={f} last={i === rows.length - 1} />
          ))}
        </>
      )}

      {/* The note complements a populated list. When there are no rows at all,
          the empty message above already says "nothing in your states", so the
          per-state note would just be redundant. */}
      {rows.length > 0 && noFilingStates.length > 0 && (
        <div
          data-testid="carrier-activity-nofilings"
          className="text-11 text-ink-3 px-4 py-2.5 border-t border-hairline border-line bg-surface-2/40"
        >
          No recent rate-moving filings from your {carrierWord} in: {noFilingStates.join(", ")}
        </div>
      )}
    </div>
  );
}
