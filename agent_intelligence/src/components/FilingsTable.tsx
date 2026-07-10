"use client";

import SubtypeCell from "@/components/SubtypeCell";
import type { Filing } from "@/lib/filings";
import type { SortChoice } from "@/lib/filters";
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
  // Current sort. Draws the direction caret on the active column header.
  sort?: SortChoice;
  // Click-to-sort callback. When provided, the Impact and Effective headers
  // become clickable and write the SAME sort state the FilterBar dropdown
  // uses (the page wires this to setFilters). Clicking the active column
  // toggles its direction; clicking the other sortable column switches to it
  // (descending). Omit it and the headers are non-interactive (caret only).
  onSortChange?: (next: SortChoice) => void;
  // True when the unfiltered API response had rows but the current
  // filter set produces zero. Lets the empty state explain "your filters
  // narrowed too much" instead of "there's no data" — completely
  // different action for the agent (widen filters vs. just wait).
  filteredToEmpty?: boolean;
  // Honest coverage-gap message (from coverageGapNote) when one or more of the
  // agent's authorized brands has no filing data in any of their states yet
  // (e.g. a WA agent authorizing Farmers, which is GA-only). Shown INSTEAD of
  // the "no recent moves" copy on an unfiltered-empty result, so the empty
  // state never reads like a bug. Null when every brand has coverage.
  coverageGap?: string | null;
  // My Carriers only: filing ids in the computeRetentionRisk /
  // computeOpportunity alert sets. Drives the per-row RETENTION RISK /
  // OPPORTUNITY pills (design 3c) so the pilled rows reconcile exactly with
  // the page's alert-count cards (which use the same helpers).
  alertIds?: { retention: Set<number>; opportunity: Set<number> };
};

// Category color convention (design handoff, uniform across the app):
// PROSPECT = brand red, DEFEND = blue; My Carriers rows are neutral (their
// signal color comes from rateImpactColor per row). Drives the row's left
// border accent, the impact number, and the active sort header.
const MODE_ACCENT: Record<FilingsTableMode, string> = {
  prospect:      "border-l-brand-red",
  defend:        "border-l-blue-text",
  "my-carriers": "",
};
const MODE_IMPACT_TEXT: Record<Exclude<FilingsTableMode, "my-carriers">, string> = {
  prospect: "text-brand-red",
  defend:   "text-blue-text",
};
const MODE_SORT_ACTIVE: Record<FilingsTableMode, string> = {
  prospect:      "text-brand-red",
  defend:        "text-blue-text",
  "my-carriers": "text-brand-red",
};

// Window badge palette (design 3a–3c). computeWindowBadge's LOGIC (text +
// semantic color family) is untouched — this maps its Badge.color onto the
// refresh's per-mode presentation:
//   Prospect:    future = red fill, "Effective this week" = amber,
//                in-effect = gray
//   Defend:      risk-window (red) = red, in-effect (amber) = amber
//   My Carriers: neutral gray throughout (surveillance framing)
const WINDOW_BADGE_STYLE: Record<"red" | "amber" | "gray", string> = {
  red:   "bg-red-fill text-brand-red",
  amber: "bg-amber-fill text-amber-text",
  gray:  "bg-soft text-ink-mid",
};
function windowBadgeStyle(mode: FilingsTableMode, color: BadgeColor): string {
  if (mode === "my-carriers") return WINDOW_BADGE_STYLE.gray;
  const mapped: "red" | "amber" | "gray" =
    color === "amber" ? "amber"
    : mode === "prospect"
      ? (color === "green" ? "red" : "gray")
      : (color === "red" ? "red" : "gray");
  return WINDOW_BADGE_STYLE[mapped];
}

// Compact status: a small colored dot + a muted label. Green = approved
// (in force), amber = pending review.
const STATUS_DOT: Record<BadgeColor, string> = {
  green: "bg-green-text",
  amber: "bg-amber-dot",
  blue:  "bg-blue-text",
  red:   "bg-brand-red",
  gray:  "bg-ink-3",
};

// Static, Defend-only contextual framing for the Action column. This is
// guidance text, NOT a data value — it carries no number and is identical
// for every row. Appropriate to the Defend page's "your customers may shop"
// framing (spec §Feature 4).
const DEFEND_ACTION_COPY = "Lock in renewals before they shop.";

function firstColumnHeader(mode: FilingsTableMode, agentType: Props["agentType"]): string {
  if (mode === "my-carriers") return "Carrier";
  if (mode === "defend") return "Threat";
  return agentType === "captive" ? "Competitor" : "Carrier";
}

export default function FilingsTable({
  mode,
  filings,
  agentType,
  ownedBrands,
  asOf,
  sort,
  onSortChange,
  filteredToEmpty,
  coverageGap,
  alertIds,
}: Props): React.JSX.Element {
  const firstHeader = firstColumnHeader(mode, agentType);
  // Defend swaps the trailing Policyholders column for static contextual
  // guidance (design 3b); Prospect/My Carriers end on Policyholders.
  const showActionCol = mode === "defend";

  // Which column is the table currently sorted by, and in which direction.
  // Drives the live header caret (up = asc, down = desc).
  const sortCol: "impact" | "effective" | null =
    sort === "impact_desc" || sort === "impact_asc"
      ? "impact"
      : sort === "effective_desc" || sort === "effective_asc"
        ? "effective"
        : null;
  const sortDir: "asc" | "desc" = sort && sort.endsWith("_asc") ? "asc" : "desc";

  // Next sort value when a header is clicked: toggle direction if it's the
  // active column, otherwise switch to that column (descending default).
  function nextSortFor(col: "impact" | "effective"): SortChoice {
    if (col === "impact") return sort === "impact_desc" ? "impact_asc" : "impact_desc";
    return sort === "effective_desc" ? "effective_asc" : "effective_desc";
  }
  function sortHandler(col: "impact" | "effective"): (() => void) | undefined {
    return onSortChange ? () => onSortChange(nextSortFor(col)) : undefined;
  }

  if (filings.length === 0) {
    // Precedence: a narrowed filter (widen it) > a brand we don't collect here
    // yet (coverage gap, honest "coming") > genuinely nothing crossed the
    // threshold ("no recent moves"). The coverage gap only applies to an
    // UNFILTERED-empty result, so it reflects the agent's whole scope.
    const showCoverage = !filteredToEmpty && !!coverageGap;
    const variant = filteredToEmpty ? "filtered" : showCoverage ? "coverage-gap" : "no-data";
    const copy = filteredToEmpty
      ? FILTERED_EMPTY_COPY
      : showCoverage
        ? coverageGap!
        : emptyStateCopy(mode);
    return (
      <div
        data-testid="empty-state"
        data-variant={variant}
        className="text-13 px-5 py-8 text-center text-ink-2
                   bg-surface border border-card-line rounded-card shadow-card"
      >
        {copy}
      </div>
    );
  }

  return (
    // White list-card (design 3a–3c): 14px radius, card border + shadow,
    // overflow hidden so the header band and footer strip stay clipped. The
    // inner wrapper still scrolls horizontally on narrow viewports.
    <div className="bg-surface border border-card-line rounded-card shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[900px] text-13"
          style={{ tableLayout: "fixed", borderCollapse: "collapse" }}
        >
          {showActionCol ? (
            // Defend: Threat · Effective · Status · Impact · Action
            <colgroup>
              <col style={{ width: "34%" }} />
              <col style={{ width: "19%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "24%" }} />
            </colgroup>
          ) : (
            // Prospect / My Carriers: Carrier · Effective · Status · Impact · Policyholders
            <colgroup>
              <col style={{ width: "44%" }} />
              <col style={{ width: "21%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
          )}
          <thead>
            <tr className="bg-surface-2 border-b border-line text-left">
              <Th first>{firstHeader}</Th>
              <Th
                sortId="effective"
                active={sortCol === "effective"}
                dir={sortDir}
                onSort={sortHandler("effective")}
                activeColor={MODE_SORT_ACTIVE[mode]}
              >
                Effective
              </Th>
              <Th>Status</Th>
              <Th
                sortId="impact"
                active={sortCol === "impact"}
                dir={sortDir}
                onSort={sortHandler("impact")}
                align="right"
                activeColor={MODE_SORT_ACTIVE[mode]}
              >
                Impact
              </Th>
              {showActionCol ? (
                <Th>Action</Th>
              ) : (
                <Th align="right">Policyholders</Th>
              )}
            </tr>
          </thead>
          <tbody>
            {filings.map(f => {
              // Mine pill + row tint apply only to Prospect/Defend for
              // independents — on /my-carriers every row is owned by
              // definition, so the marker would be noise (see Screen 5).
              const isMine =
                mode !== "my-carriers"
                && agentType === "independent"
                && ownedBrands.has(f.brand);
              // Impact wears the CATEGORY color (agent perspective): Prospect
              // rows are red signals, Defend rows blue. My Carriers keeps its
              // own-carrier mapping (increase = retention-risk red, decrease =
              // opportunity green, else neutral ink) via rateImpactColor.
              const myCarriersColor =
                mode === "my-carriers" ? rateImpactColor(f.overall_rate_impact, mode) : null;
              const impactCls =
                mode === "my-carriers"
                  ? myCarriersColor === "red"
                    ? "text-brand-red"
                    : myCarriersColor === "green"
                      ? "text-green-text"
                      : "text-ink"
                  : MODE_IMPACT_TEXT[mode];
              const showDot = shouldShowEntitySpreadDot(
                f.entity_count, f.min_entity_impact, f.max_entity_impact,
              );
              const windowB = computeWindowBadge(f.effective_date, asOf, mode);
              const statusB = computeStatusBadge(f.rate_activity);
              const isAmBest = f.source === "ambest_sourced";

              return (
                <tr
                  key={f.id}
                  // AM Best provenance is BACKEND-ONLY — no visual marker. These rows
                  // have no SERFF tracking number (the surrogate key is never shown),
                  // so they simply omit the filing-number tooltip; everything else
                  // renders identically to scraped rows.
                  title={isAmBest ? undefined : `Filing: ${f.serff_tracking_number}`}
                  className={[
                    "border-b border-line last:border-b-0 transition-colors",
                    isMine ? "bg-mine-bg" : "hover:bg-surface-2",
                  ].join(" ")}
                >
                  {/* Carrier cell: name (+ Mine / category pill) on the lead
                      line; "Line · State · sub-type" on a muted secondary
                      line (design row anatomy). */}
                  <Td first accent={MODE_ACCENT[mode]}>
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                      <span data-testid="row-brand" className="text-15 font-[650] text-ink">
                        {f.brand}
                      </span>
                      {isMine && (
                        <span
                          data-testid="mine-pill"
                          className="inline-block bg-blue-fill text-blue-text text-10 font-bold px-2 py-0.5 rounded-full"
                        >
                          Mine
                        </span>
                      )}
                      {/* My Carriers: per-row signal pill for rows in the
                          alert sets (same computeRetentionRisk /
                          computeOpportunity results as the summary cards). */}
                      {alertIds?.retention.has(f.id) && (
                        <span
                          data-testid="retention-pill"
                          className="inline-block bg-red-fill text-brand-red text-10 font-bold uppercase tracking-wider04 px-2 py-0.5 rounded-full"
                        >
                          Retention risk
                        </span>
                      )}
                      {alertIds?.opportunity.has(f.id) && (
                        <span
                          data-testid="opportunity-pill"
                          className="inline-block bg-green-fill text-green-text text-10 font-bold uppercase tracking-wider04 px-2 py-0.5 rounded-full"
                        >
                          Opportunity
                        </span>
                      )}
                    </div>
                    <div className="text-13 text-ink-2 mt-0.5">
                      {f.line_of_business} · <span data-testid="row-state">{f.state}</span>
                      <span className="text-ink-3"> · </span>
                      <SubtypeCell raw={f.sub_type} />
                    </div>
                  </Td>
                  <Td>
                    <div className="text-12 text-ink mb-1.5">
                      {formatEffectiveDate(f.effective_date)}
                    </div>
                    <span
                      className={`${windowBadgeStyle(mode, windowB.color)} inline-block px-2 py-1 text-11 font-semibold rounded-badge leading-[1.35] whitespace-normal`}
                    >
                      {windowB.text}
                    </span>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5 text-12 text-ink-2">
                      <span
                        className={`w-[6px] h-[6px] rounded-full shrink-0 ${STATUS_DOT[statusB.color]}`}
                        aria-hidden
                      />
                      {statusB.text}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className={`text-17 font-bold tabular-nums ${impactCls}`}>
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
                  {showActionCol ? (
                    <Td>
                      <span className="text-12 text-ink-2">{DEFEND_ACTION_COPY}</span>
                    </Td>
                  ) : (
                    <Td align="right">
                      <span className={f.total_policyholders == null ? "text-ink-3" : "text-ink"}>
                        {formatPolicyholders(f.total_policyholders)}
                      </span>
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Footer note strip inside the card (design 3a) */}
      <div className="bg-surface-2 border-t border-line px-[22px] py-3 text-13 text-ink-3">
        Premium-weighted, rolled up per filing — sourced from public state filing systems.
      </div>
    </div>
  );
}

// Column header (11px uppercase kicker on the surface-2 band). When `onSort`
// is provided the header becomes a clickable sort control with a three-state
// affordance: the active column shows a solid directional caret (▲/▼) in the
// mode's category color; a sortable-but-inactive column shows a muted ⇅
// double-arrow signalling it's clickable; the <th> carries aria-sort.
function Th({
  children,
  align,
  first,
  active,
  dir,
  onSort,
  sortId,
  activeColor,
}: {
  children: React.ReactNode;
  align?: "right";
  first?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onSort?: () => void;
  sortId?: string;
  activeColor?: string;
}) {
  const padAlign = [
    "py-3",
    first ? "pl-[22px] pr-3" : "px-3",
    align === "right" ? "text-right" : "text-left",
  ].join(" ");
  const colorCls = active ? (activeColor ?? "text-ink") : "text-ink-3";
  const activeCaret = (
    <i
      className={`ti ${dir === "asc" ? "ti-caret-up" : "ti-caret-down"} text-12`}
      aria-hidden
    />
  );
  const mutedDoubleArrow = (
    <i
      className="ti ti-arrows-sort text-12 text-ink-3 opacity-50 group-hover:opacity-90"
      aria-hidden
    />
  );

  if (onSort) {
    return (
      <th
        className={padAlign}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={onSort}
          data-testid={sortId ? `sort-${sortId}` : undefined}
          data-sort-active={active ? "true" : "false"}
          className={[
            "group inline-flex items-center gap-1 cursor-pointer select-none",
            "border-none bg-transparent p-0 font-semibold text-11 uppercase tracking-wider04",
            "hover:text-ink transition-colors",
            colorCls,
          ].join(" ")}
        >
          {children}
          {active ? activeCaret : mutedDoubleArrow}
        </button>
      </th>
    );
  }

  // Non-sortable header: label only. (If `active` is somehow set without an
  // onSort handler — sort prop wired but no onSortChange — fall back to the
  // presentational caret rather than nothing.)
  return (
    <th className={`font-semibold text-11 uppercase tracking-wider04 ${padAlign} ${colorCls}`}>
      <span className="inline-flex items-center gap-1 align-middle">
        {children}
        {active ? activeCaret : null}
      </span>
    </th>
  );
}

// Body cell. 15px vertical padding (design row spec); the first cell carries
// the 22px lead padding plus the 3px category left-border accent. Top-aligned
// so the stacked Effective (date + badge) and the Action text line up.
function Td({
  children,
  align,
  first,
  accent,
}: {
  children: React.ReactNode;
  align?: "right";
  first?: boolean;
  accent?: string;
}) {
  return (
    <td
      className={[
        "py-[15px] align-top",
        first ? "pl-[22px] pr-3" : "px-3",
        first && accent ? `border-l-[3px] ${accent}` : "",
        align === "right" ? "text-right" : "text-left",
      ].join(" ")}
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
