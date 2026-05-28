"use client";

import type { Filing } from "@/lib/filings";
import {
  BadgeColor,
  computeStatusBadge,
  computeWindowBadge,
  entitySpreadTooltip,
  formatEffectiveDate,
  formatPolicyholders,
  formatRateImpact,
  rateImpactColor,
  shouldShowEntitySpreadDot,
} from "@/lib/format";

export type FilingsTableMode = "prospect" | "defend" | "my-carriers";

type Props = {
  mode: FilingsTableMode;
  filings: Filing[];
  agentType: "captive" | "independent";
  ownedBrands: Set<string>; // empty for captives (mine pill never shows)
  asOf: string;
  // True when the unfiltered API response had rows but the current
  // filter set produces zero. Lets the empty state explain "your filters
  // narrowed too much" instead of "there's no data" — completely
  // different action for the agent (widen filters vs. just wait).
  filteredToEmpty?: boolean;
};

// Map BadgeColor → Tailwind class pair (fill + text). All values come from
// tailwind.config.ts which mirrors ui-reference.html's :root tokens.
const BADGE_CLASS: Record<BadgeColor, string> = {
  green: "bg-green-fill text-green-text",
  amber: "bg-amber-fill text-amber-text",
  blue:  "bg-blue-fill text-blue-text",
  red:   "bg-red-fill text-red-text",
  gray:  "bg-gray-fill text-gray-text",
};

function badgeClass(color: BadgeColor): string {
  return `${BADGE_CLASS[color]} inline-block px-2 py-0.5 text-11 rounded-full font-medium leading-[1.4]`;
}

function firstColumnHeader(mode: FilingsTableMode, agentType: Props["agentType"]): string {
  if (mode === "my-carriers") return "Carrier";
  if (mode === "defend") return "Threat";
  return agentType === "captive" ? "Competitor" : "Carrier";
}

function impactClass(c: "red" | "green" | "black"): string {
  if (c === "red") return "text-red-text font-medium";
  if (c === "green") return "text-green-text font-medium";
  return "text-ink font-medium";
}

export default function FilingsTable({
  mode,
  filings,
  agentType,
  ownedBrands,
  asOf,
  filteredToEmpty,
}: Props): React.JSX.Element {
  const firstHeader = firstColumnHeader(mode, agentType);

  if (filings.length === 0) {
    const copy = filteredToEmpty ? FILTERED_EMPTY_COPY : emptyStateCopy(mode);
    return (
      <div
        data-testid="empty-state"
        data-variant={filteredToEmpty ? "filtered" : "no-data"}
        className="text-13 px-4 py-6 text-center text-ink-3 border border-hairline border-line rounded-lg"
      >
        {copy}
      </div>
    );
  }

  return (
    <table
      className="w-full text-13"
      style={{ tableLayout: "fixed", borderCollapse: "collapse" }}
    >
      <colgroup>
        <col style={{ width: "17%" }} />
        <col style={{ width: "7%" }} />
        <col style={{ width: "16%" }} />
        <col style={{ width: "14%" }} />
        <col style={{ width: "22%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "12%" }} />
      </colgroup>
      <thead>
        <tr className="border-b border-hairline border-line-2 text-left">
          <Th>{firstHeader}</Th>
          <Th>State</Th>
          <Th>Line</Th>
          <Th>Impact</Th>
          <Th>Effective</Th>
          <Th>Status</Th>
          <Th align="right">Policyholders affected</Th>
        </tr>
      </thead>
      <tbody>
        {filings.map(f => {
          // Mine pill + warm tint apply only to Prospect/Defend for
          // independents — on /my-carriers every row is owned by
          // definition, so the marker would be noise (see Screen 5).
          const isMine =
            mode !== "my-carriers"
            && agentType === "independent"
            && ownedBrands.has(f.brand);
          const impactC = rateImpactColor(f.overall_rate_impact, mode);
          const showDot = shouldShowEntitySpreadDot(
            f.entity_count, f.min_entity_impact, f.max_entity_impact,
          );
          const windowB = computeWindowBadge(f.effective_date, asOf, mode);
          const statusB = computeStatusBadge(f.rate_activity);

          return (
            <tr
              key={f.id}
              title={`Filing: ${f.serff_tracking_number}`}
              className={[
                "border-b border-hairline border-line",
                isMine ? "bg-mine-bg" : "",
              ].join(" ")}
            >
              <Td>
                <span>{f.brand}</span>
                {isMine && (
                  <span
                    data-testid="mine-pill"
                    className="inline-block bg-blue-fill text-blue-text text-10 px-1.5 py-px rounded-full ml-1 align-[1px] font-medium"
                  >
                    Mine
                  </span>
                )}
              </Td>
              <Td>{f.state}</Td>
              <Td>{f.line_of_business}</Td>
              <Td>
                <span className={impactClass(impactC)}>
                  {formatRateImpact(f.overall_rate_impact)}
                </span>
                {showDot && (
                  <span
                    title={entitySpreadTooltip(
                      f.entity_count, f.min_entity_impact, f.max_entity_impact,
                    )}
                    aria-label="Multi-entity rollup details"
                    data-testid="entity-spread-dot"
                    className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-soft text-ink-2 text-10 italic ml-1 cursor-help"
                    style={{ fontFamily: "Georgia, serif" }}
                  >
                    i
                  </span>
                )}
              </Td>
              <Td>
                <div className="text-12">
                  {formatEffectiveDate(f.effective_date)}
                </div>
                <span className={`${badgeClass(windowB.color)} mt-0.5`}>
                  {windowB.text}
                </span>
              </Td>
              <Td>
                <span className={badgeClass(statusB.color)}>{statusB.text}</span>
              </Td>
              <Td align="right">
                <span className={f.total_policyholders == null ? "text-ink-2" : ""}>
                  {formatPolicyholders(f.total_policyholders)}
                </span>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Th padding: 8px all sides, except left=0 when the cell is left-aligned.
// (Original inline behavior: padding: 8; paddingLeft: align ? 8 : 0.)
function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={
        align
          ? "font-medium text-ink-2 text-11 uppercase tracking-wider04 p-2 text-right"
          : "font-medium text-ink-2 text-11 uppercase tracking-wider04 py-2 pr-2 pl-0 text-left"
      }
    >
      {children}
    </th>
  );
}

// Td padding: 12px vertical, 8px horizontal — except left=0 when the cell
// is left-aligned. (Original: padding: "12px 8px"; paddingLeft: align ? 8 : 0.)
function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td
      className={
        align
          ? "py-3 px-2 text-right"
          : "py-3 pr-2 pl-0 text-left"
      }
    >
      {children}
    </td>
  );
}

// Mode-specific copy when the unfiltered API result is empty — these
// are spec wording (lines 763, 819, 885). They explain a real product
// fact: nothing on the wire crosses the threshold in your scope right
// now. Action: wait for the next monthly refresh.
function emptyStateCopy(mode: FilingsTableMode): string {
  if (mode === "prospect") {
    return "No competitors are raising rates in your states right now (≥5% threshold). Check back next month — data refreshes monthly.";
  }
  if (mode === "defend") {
    return "No competitors are cutting rates in your states (≤ −2% threshold). Your book is safe — for now.";
  }
  return "No recent filings from your authorized carriers in your states. The data refreshes monthly — check back.";
}

// Filtered-to-empty copy: the underlying data has rows, but the agent's
// current filter combination returns none. Different problem, different
// action — widen the filter, not wait. Voice stays factual and points
// at the obvious next step rather than apologizing.
const FILTERED_EMPTY_COPY =
  "No filings match the current filters. Try widening the time window, adding states, or including more lines of business.";
