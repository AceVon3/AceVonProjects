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

const C = {
  surface: "#ffffff",
  surface2: "#F4F2EC",
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  line: "rgba(0,0,0,0.08)",
  redText: "#A32D2D",
  redFill: "#FCEBEB",
  amberFill: "#FAEEDA",
  amberText: "#633806",
  blueText: "#0C447C",
};

const cardBase: React.CSSProperties = {
  border: `0.5px solid ${C.line}`,
  borderRadius: 12,
  padding: 16,
  background: C.surface,
};
const cardUrgent: React.CSSProperties = {
  ...cardBase,
  border: `2px solid ${C.redText}`,
};

const iconBox = (bg: string): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: bg,
});
const ovHead: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  marginBottom: 10,
};
const lab: React.CSSProperties = { fontSize: 13, color: C.text2, paddingTop: 2 };
const ovNum: React.CSSProperties = { fontSize: 26, fontWeight: 500, marginBottom: 8, color: C.text };
const ovLinkStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.blueText,
  fontWeight: 500,
  textDecoration: "none",
};
const redBadge: React.CSSProperties = {
  display: "inline-block",
  background: C.redFill,
  color: C.redText,
  padding: "2px 8px",
  fontSize: 11,
  borderRadius: 999,
  lineHeight: 1.4,
  fontWeight: 500,
};

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
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        marginBottom: 20,
      }}
    >
      {/* Prospect */}
      <div style={cardBase} data-testid="ov-card-prospect">
        <div style={ovHead}>
          <div style={iconBox(C.surface2)}>
            <i className="ti ti-target-arrow" style={{ fontSize: 17, color: C.text2 }} />
          </div>
          <div style={lab}>Prospect opportunities</div>
        </div>
        <div style={ovNum} data-testid="ov-prospect-count">
          {prospectCount}
        </div>
        <Link href="/prospect" style={ovLinkStyle}>
          View all →
        </Link>
      </div>

      {/* Defend */}
      <div style={cardBase} data-testid="ov-card-defend">
        <div style={ovHead}>
          <div style={iconBox(C.amberFill)}>
            <i className="ti ti-shield-half" style={{ fontSize: 17, color: C.amberText }} />
          </div>
          <div style={lab}>Defend risks</div>
        </div>
        <div style={ovNum} data-testid="ov-defend-count">
          {defendCount}
        </div>
        <Link href="/defend" style={ovLinkStyle}>
          View all →
        </Link>
      </div>

      {/* Most Urgent (or fallback) */}
      {mostUrgent ? (
        <Link
          href={mostUrgent.classification === "prospect" ? "/prospect" : "/defend"}
          style={{ ...cardUrgent, textDecoration: "none" }}
          data-testid="ov-card-most-urgent"
          data-tier={mostUrgent.tier}
        >
          <div style={ovHead}>
            <div style={iconBox(C.redFill)}>
              <i
                className="ti ti-alert-triangle"
                style={{ fontSize: 17, color: C.redText }}
              />
            </div>
            <div style={lab}>Most urgent</div>
          </div>
          <div
            style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: C.text }}
            data-testid="ov-most-urgent-body"
          >
            {mostUrgent.filing.brand}{" "}
            <span style={{ color: C.redText }}>
              {formatRateImpact(mostUrgent.filing.overall_rate_impact)}
            </span>{" "}
            in {mostUrgent.filing.state}
          </div>
          <span style={redBadge} data-testid="ov-most-urgent-pill">
            {mostUrgent.pillText}
          </span>
        </Link>
      ) : (
        <div style={cardBase} data-testid="ov-card-most-urgent-empty">
          <div style={ovHead}>
            <div style={iconBox(C.surface2)}>
              <i
                className="ti ti-alert-triangle"
                style={{ fontSize: 17, color: C.text3 }}
              />
            </div>
            <div style={lab}>Most urgent</div>
          </div>
          <div style={{ fontSize: 13, color: C.text3 }}>Nothing urgent right now.</div>
        </div>
      )}

      {/* Compliance — lightweight v1 (no change-detection claims) */}
      <div style={cardBase} data-testid="ov-card-compliance">
        <div style={ovHead}>
          <div style={iconBox(C.surface2)}>
            <i className="ti ti-gavel" style={{ fontSize: 17, color: C.text2 }} />
          </div>
          <div style={lab}>Compliance</div>
        </div>
        <div
          style={{ fontSize: 15, fontWeight: 500, marginBottom: 4, color: C.text }}
          data-testid="ov-compliance-states"
        >
          {employeeStatesCount} {employeeStatesCount === 1 ? "state" : "states"} tracked
        </div>
        <div style={{ fontSize: 11, color: C.text3, marginBottom: 8 }}>
          Last checked {todayLabel}
        </div>
        <Link href="/compliance" style={ovLinkStyle}>
          View resources →
        </Link>
      </div>
    </div>
  );
}
