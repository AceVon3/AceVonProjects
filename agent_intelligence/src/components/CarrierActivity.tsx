"use client";

import { formatRateImpact } from "@/lib/format";
import type { CarrierActivityItem } from "@/lib/overview";

type Props = {
  agentType: "captive" | "independent";
  brands: string[];                 // authorized brands, in profile order
  items: CarrierActivityItem[];     // from computeCarrierActivity (own-carrier filings)
};

// |avg| ~ 0 reads "flat" (never "flat avg"); a single-filing group is NOT
// called "avg" either (the average is just that one filing) — consistent
// with the Positioning guardrail.
function activityValue(item: CarrierActivityItem): string {
  if (Math.abs(item.avg) < 0.05) return "flat";
  const v = formatRateImpact(item.avg);
  return item.count >= 2 ? `${v} avg` : v;
}

function Chip({ item }: { item: CarrierActivityItem }): React.JSX.Element {
  return (
    <span
      data-testid="carrier-activity-item"
      className="inline-flex items-baseline gap-1 rounded-md bg-surface-2 px-2 py-1 text-12"
    >
      <span className="text-ink-2">{item.line}</span>
      <span className="text-ink font-medium">{activityValue(item)}</span>
      <span className="text-ink-3">· {item.state}</span>
    </span>
  );
}

export default function CarrierActivity({ agentType, brands, items }: Props): React.JSX.Element {
  const isCaptive = agentType === "captive";
  const title = isCaptive
    ? `Your carrier (${brands[0]}) in your states`
    : "Your carriers' activity";

  // Group items by brand, preserving the profile's brand order.
  const byBrand = new Map<string, CarrierActivityItem[]>();
  for (const it of items) {
    const arr = byBrand.get(it.brand);
    if (arr) arr.push(it);
    else byBrand.set(it.brand, [it]);
  }
  const orderedBrands = brands.filter(b => byBrand.has(b));

  return (
    <div
      data-testid="carrier-activity"
      className="rounded-lg border border-hairline border-line overflow-hidden mb-5"
    >
      <div className="bg-surface-2 border-b border-hairline border-line-2 px-4 py-2.5">
        <h3 className="text-11 uppercase tracking-wider04 font-medium m-0 text-ink-2">
          {title}
        </h3>
      </div>

      {items.length === 0 ? (
        <div className="text-12 text-ink-3 px-4 py-4" data-testid="carrier-activity-empty">
          {isCaptive
            ? `No recent ${brands[0]} filings in your states.`
            : "No recent filings from your carriers in your states."}
        </div>
      ) : isCaptive ? (
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {items.map(it => (
            <Chip key={`${it.line}@@${it.state}`} item={it} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-2">
          {orderedBrands.map((brand, i) => (
            <div
              key={brand}
              className={`flex flex-wrap items-center gap-2 py-2 ${i === orderedBrands.length - 1 ? "" : "border-b border-hairline border-line"}`}
            >
              <span className="text-13 font-medium text-ink min-w-[110px]">{brand}</span>
              {byBrand.get(brand)!.map(it => (
                <Chip key={`${it.line}@@${it.state}`} item={it} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
