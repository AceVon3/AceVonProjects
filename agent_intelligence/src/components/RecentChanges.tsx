"use client";

import Link from "next/link";

import { formatRateImpact } from "@/lib/format";
import { FeedRow, feedRowPillColor } from "@/lib/overview";

type Props = {
  rows: FeedRow[];
};

const C = {
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  line: "rgba(0,0,0,0.08)",
  redFill: "#FCEBEB", redText: "#A32D2D",
  grayFill: "#F1EFE8", grayText: "#444441",
};

const card: React.CSSProperties = {
  border: `0.5px solid ${C.line}`,
  borderRadius: 12,
  padding: "18px 18px 6px",
};

const pill = (color: "red" | "gray"): React.CSSProperties => ({
  display: "inline-block",
  background: color === "red" ? C.redFill : C.grayFill,
  color: color === "red" ? C.redText : C.grayText,
  padding: "2px 8px",
  fontSize: 11,
  borderRadius: 999,
  lineHeight: 1.4,
  fontWeight: 500,
});

export default function RecentChanges({ rows }: Props): React.JSX.Element {
  return (
    <div style={card} data-testid="recent-changes">
      <h3
        style={{
          fontSize: 15,
          fontWeight: 500,
          margin: "0 0 14px",
          color: C.text,
        }}
      >
        Recent changes
      </h3>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: C.text3, paddingBottom: 12 }}>
          No threshold-crossing filings in your scope yet. Check back next month — data refreshes monthly.
        </div>
      ) : (
        rows.map((r, idx) => {
          const href = r.classification === "prospect" ? "/prospect" : "/defend";
          const ageText = r.future ? `${r.ageWeeks}w left` : `${r.ageWeeks}w`;
          return (
            <Link
              key={`${r.filing.id}-${idx}`}
              href={href}
              data-testid="feed-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: idx === rows.length - 1 ? "none" : `0.5px solid ${C.line}`,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                  {r.filing.brand}
                </div>
                <div style={{ fontSize: 12, color: C.text2 }}>
                  {formatRateImpact(r.filing.overall_rate_impact)} in {r.filing.state} · {r.classification}
                </div>
              </div>
              <span style={pill(feedRowPillColor(r))}>{ageText}</span>
            </Link>
          );
        })
      )}
    </div>
  );
}
