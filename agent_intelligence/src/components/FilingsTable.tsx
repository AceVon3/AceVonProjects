"use client";

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

// Window badge: the text can be long ("Customers may already be shopping",
// "Risk window opens in 3 weeks"), so it must wrap cleanly inside the
// Effective column. A full pill (rounded-full) looks awkward on two lines,
// so this variant uses an 8px radius with roomier vertical padding and a
// tighter line-height — the wrap reads as intentional. Same family colors.
function windowBadgeClass(color: BadgeColor): string {
  return `${BADGE_CLASS[color]} inline-block px-2 py-1 text-11 rounded-md font-medium leading-[1.35] whitespace-normal`;
}

// Status pill variant: same family colors, but with a small leading status
// dot (bg-current draws the dot in the pill's own text color, so it always
// stays in-family).
function statusBadgeClass(color: BadgeColor): string {
  return `${BADGE_CLASS[color]} inline-flex items-center gap-1.5 px-2 py-0.5 text-11 rounded-full font-medium leading-[1.4]`;
}

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
  sort,
  onSortChange,
  filteredToEmpty,
}: Props): React.JSX.Element {
  const firstHeader = firstColumnHeader(mode, agentType);
  // Defend gets one extra trailing column: static contextual guidance.
  // It is appended LAST so columns 1–7 keep their positions across all
  // three modes (Prospect/My Carriers stay 7 columns).
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
    // Rounded, hairline-bordered container (per the restyle). The wrapper
    // still scrolls horizontally on narrow viewports; min-w keeps columns
    // readable. The header card above carries the headline number so the
    // punch line is visible without scrolling.
    <div className="overflow-x-auto rounded-lg border border-hairline border-line">
      <table
        className={`w-full ${showActionCol ? "min-w-[1040px]" : "min-w-[900px]"} text-13`}
        style={{ tableLayout: "fixed", borderCollapse: "collapse" }}
      >
      {showActionCol ? (
        <colgroup>
          <col style={{ width: "13%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
      ) : (
        <colgroup>
          <col style={{ width: "17%" }} />
          <col style={{ width: "7%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>
      )}
      <thead>
        <tr className="bg-surface-2 border-b border-hairline border-line-2 text-left">
          <Th>{firstHeader}</Th>
          <Th>State</Th>
          <Th>Line</Th>
          <Th
            sortId="impact"
            active={sortCol === "impact"}
            dir={sortDir}
            onSort={sortHandler("impact")}
          >
            Impact
          </Th>
          <Th
            sortId="effective"
            active={sortCol === "effective"}
            dir={sortDir}
            onSort={sortHandler("effective")}
          >
            Effective
          </Th>
          <Th>Status</Th>
          <Th align="right">Policyholders affected</Th>
          {showActionCol && <Th>Action</Th>}
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
                "border-b border-hairline border-line last:border-b-0 transition-colors",
                isMine ? "bg-mine-bg" : "hover:bg-surface-2/60",
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
                <div className="text-12 mb-1">
                  {formatEffectiveDate(f.effective_date)}
                </div>
                <span className={windowBadgeClass(windowB.color)}>
                  {windowB.text}
                </span>
              </Td>
              <Td>
                <span className={statusBadgeClass(statusB.color)}>
                  <span className="w-[5px] h-[5px] rounded-full bg-current opacity-70" aria-hidden />
                  {statusB.text}
                </span>
              </Td>
              <Td align="right">
                <span className={f.total_policyholders == null ? "text-ink-2" : ""}>
                  {formatPolicyholders(f.total_policyholders)}
                </span>
              </Td>
              {showActionCol && (
                <Td>
                  <span className="text-12 text-ink-2">{DEFEND_ACTION_COPY}</span>
                </Td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

// Column header. Uniform 12px horizontal padding (the table now sits in a
// bordered container, so the first cell is no longer flush to the page edge).
//
// When `onSort` is provided the header becomes a clickable sort control: the
// label sits in a button, `active` darkens it and shows a direction caret
// (up = ascending, down = descending), and the <th> carries aria-sort.
// Without `onSort` it's a plain header (caret still shows if `active`).
function Th({
  children,
  align,
  active,
  dir,
  onSort,
  sortId,
}: {
  children: React.ReactNode;
  align?: "right";
  active?: boolean;
  dir?: "asc" | "desc";
  onSort?: () => void;
  sortId?: string;
}) {
  const padAlign = `py-2.5 px-3 ${align === "right" ? "text-right" : "text-left"}`;
  const colorCls = active ? "text-ink" : "text-ink-2";
  const caret = active ? (
    <i
      className={`ti ${dir === "asc" ? "ti-chevron-up" : "ti-chevron-down"} text-12`}
      aria-hidden
    />
  ) : null;

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
            "inline-flex items-center gap-1 cursor-pointer select-none",
            "border-none bg-transparent p-0 font-medium text-11 uppercase tracking-wider04",
            "hover:text-ink transition-colors",
            colorCls,
          ].join(" ")}
        >
          {children}
          {caret}
        </button>
      </th>
    );
  }

  return (
    <th className={`font-medium text-11 uppercase tracking-wider04 ${padAlign} ${colorCls}`}>
      <span className="inline-flex items-center gap-1 align-middle">
        {children}
        {caret}
      </span>
    </th>
  );
}

// Body cell. 14px vertical / 12px horizontal for a more spacious feel;
// top-aligned so the stacked Effective (date + badge) and the Action text
// line up cleanly across a row.
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
          ? "py-3.5 px-3 text-right align-top"
          : "py-3.5 px-3 text-left align-top"
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
