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

// Visual tokens — same palette as ProfileForm + ui-reference.html.
const C = {
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  line: "rgba(0,0,0,0.08)",
  line2: "rgba(0,0,0,0.15)",
  surface: "#ffffff",
  surface2: "#F4F2EC",
  soft: "#F1EFE8",
  blueFill: "#E6F1FB", blueText: "#0C447C",
  greenFill: "#EAF3DE", greenText: "#27500A",
  amberFill: "#FAEEDA", amberText: "#633806",
  redFill: "#FCEBEB", redText: "#A32D2D",
  grayFill: "#F1EFE8", grayText: "#444441",
  mineBg: "rgba(255, 230, 200, 0.18)",
};

function badgeStyle(color: BadgeColor): React.CSSProperties {
  const map: Record<BadgeColor, [string, string]> = {
    green: [C.greenFill, C.greenText],
    amber: [C.amberFill, C.amberText],
    blue:  [C.blueFill,  C.blueText],
    red:   [C.redFill,   C.redText],
    gray:  [C.grayFill,  C.grayText],
  };
  const [bg, fg] = map[color];
  return {
    display: "inline-block",
    background: bg,
    color: fg,
    padding: "2px 8px",
    fontSize: 11,
    borderRadius: 999,
    lineHeight: 1.4,
    fontWeight: 500,
  };
}

function firstColumnHeader(mode: FilingsTableMode, agentType: Props["agentType"]): string {
  if (mode === "my-carriers") return "Carrier";
  if (mode === "defend") return "Threat";
  return agentType === "captive" ? "Competitor" : "Carrier";
}

function impactColorStyle(c: "red" | "green" | "black"): React.CSSProperties {
  if (c === "red") return { color: C.redText, fontWeight: 500 };
  if (c === "green") return { color: C.greenText, fontWeight: 500 };
  return { color: C.text, fontWeight: 500 };
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
        className="text-[13px] px-4 py-6 text-center"
        style={{ color: C.text3, border: `0.5px solid ${C.line}`, borderRadius: 8 }}
      >
        {copy}
      </div>
    );
  }

  return (
    <table
      className="w-full"
      style={{ tableLayout: "fixed", fontSize: 13, borderCollapse: "collapse" }}
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
        <tr style={{ borderBottom: `0.5px solid ${C.line2}`, textAlign: "left" }}>
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
          const rowBg = isMine ? C.mineBg : undefined;
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
              style={{
                background: rowBg,
                borderBottom: `0.5px solid ${C.line}`,
              }}
            >
              <Td>
                <span>{f.brand}</span>
                {isMine && (
                  <span
                    style={{
                      display: "inline-block",
                      background: C.blueFill,
                      color: C.blueText,
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 999,
                      marginLeft: 4,
                      verticalAlign: 1,
                      fontWeight: 500,
                    }}
                    data-testid="mine-pill"
                  >
                    Mine
                  </span>
                )}
              </Td>
              <Td>{f.state}</Td>
              <Td>{f.line_of_business}</Td>
              <Td>
                <span style={impactColorStyle(impactC)}>
                  {formatRateImpact(f.overall_rate_impact)}
                </span>
                {showDot && (
                  <span
                    title={entitySpreadTooltip(
                      f.entity_count, f.min_entity_impact, f.max_entity_impact,
                    )}
                    aria-label="Multi-entity rollup details"
                    data-testid="entity-spread-dot"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: C.soft,
                      color: C.text2,
                      fontSize: 10,
                      fontStyle: "italic",
                      fontFamily: "Georgia, serif",
                      marginLeft: 4,
                      cursor: "help",
                    }}
                  >
                    i
                  </span>
                )}
              </Td>
              <Td>
                <div style={{ fontSize: 12 }}>
                  {formatEffectiveDate(f.effective_date)}
                </div>
                <span style={{ ...badgeStyle(windowB.color), marginTop: 2 }}>
                  {windowB.text}
                </span>
              </Td>
              <Td>
                <span style={badgeStyle(statusB.color)}>{statusB.text}</span>
              </Td>
              <Td align="right">
                <span
                  style={
                    f.total_policyholders == null
                      ? { color: C.text2 }
                      : undefined
                  }
                >
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

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      style={{
        fontWeight: 500,
        color: C.text2,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        padding: 8,
        paddingLeft: align ? 8 : 0,
        textAlign: align ?? "left",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td
      style={{
        padding: "12px 8px",
        paddingLeft: align ? 8 : 0,
        textAlign: align ?? "left",
      }}
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
