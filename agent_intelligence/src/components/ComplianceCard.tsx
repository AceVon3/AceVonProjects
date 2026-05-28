"use client";

import type { ResourceKey } from "@/lib/resourceUrls";

export type ComplianceCardProps = {
  state: string;
  topic: ResourceKey;
  // Full card: title + summary populated. Coming-soon: both undefined.
  title?: string;
  summary?: string;
  sources: string[];     // may be empty if no URLs are mapped
  last_checked?: string; // omitted on coming-soon cards
};

// Topic tag colors keyed to the reference's per-topic palette. Remote Work
// is intentionally neutral — it doubles as the coming-soon fallback color.
const TOPIC_COLORS: Record<ResourceKey, { fill: string; text: string }> = {
  wage_hour:    { fill: "#EAF3DE", text: "#27500A" }, // green
  leave:        { fill: "#EAF3DE", text: "#27500A" }, // green
  payroll:      { fill: "#E6F1FB", text: "#0C447C" }, // blue
  workers_comp: { fill: "#FAEEDA", text: "#633806" }, // amber
  termination:  { fill: "#FCEBEB", text: "#A32D2D" }, // red
  nexus:        { fill: "#E6F1FB", text: "#0C447C" }, // blue
  hiring:       { fill: "#EAF3DE", text: "#27500A" }, // green
  remote:       { fill: "#F1EFE8", text: "#444441" }, // gray
};

const TOPIC_LABELS: Record<ResourceKey, string> = {
  wage_hour: "Wage & Hour",
  leave: "Leave Laws",
  payroll: "Payroll",
  workers_comp: "Workers' Comp",
  termination: "Termination",
  nexus: "Nexus & Licensing",
  hiring: "Hiring Basics",
  remote: "Remote Work",
};

const C = {
  surface: "#ffffff",
  surface2: "#F4F2EC",
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  line: "rgba(0,0,0,0.08)",
  line2: "rgba(0,0,0,0.15)",
  blueText: "#0C447C",
};

// "https://www.lni.wa.gov/workers-rights/wages/minimum-wage/" → "lni.wa.gov"
function bareDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function ComplianceCard({
  state,
  topic,
  title,
  summary,
  sources,
  last_checked,
}: ComplianceCardProps): React.JSX.Element {
  const isComingSoon = !title || !summary;
  const tag = TOPIC_COLORS[topic];
  const tagLabel = TOPIC_LABELS[topic];

  return (
    <div
      data-testid="compliance-card"
      data-state={state}
      data-topic={topic}
      data-variant={isComingSoon ? "coming-soon" : "full"}
      style={{
        border: `0.5px solid ${C.line}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        background: C.surface,
      }}
    >
      {/* Header: topic tag (left) + state badge (right) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
            fontWeight: 500,
            background: tag.fill,
            color: tag.text,
          }}
        >
          {tagLabel}
        </span>
        <span
          style={{
            fontSize: 11,
            padding: "2px 7px",
            borderRadius: 6,
            border: `0.5px solid ${C.line2}`,
            color: C.text2,
          }}
        >
          {state}
        </span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: 15,
          fontWeight: 500,
          margin: "0 0 8px",
          lineHeight: 1.35,
          color: isComingSoon ? C.text3 : C.text,
        }}
      >
        {isComingSoon ? "Summary coming soon" : title}
      </h3>

      {/* Summary */}
      <p
        style={{
          fontSize: 13,
          color: isComingSoon ? C.text3 : C.text2,
          lineHeight: 1.55,
          margin: "0 0 14px",
          flex: 1,
        }}
      >
        {isComingSoon
          ? "We’re preparing a grounded summary for this topic. The official source link is available below."
          : summary}
      </p>

      {/* Sources block — always rendered when at least one URL is mapped */}
      {sources.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              color: C.text3,
              textTransform: "uppercase",
              letterSpacing: 0.4,
              borderTop: `0.5px solid ${C.line}`,
              paddingTop: 10,
              marginBottom: 6,
            }}
          >
            Sources
          </div>
          {sources.map(url => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="source-link"
              style={{
                fontSize: 12,
                color: isComingSoon ? C.text3 : C.blueText,
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: 3,
                textDecoration: "none",
              }}
            >
              <span aria-hidden style={{ fontSize: 11 }}>↗</span>
              {bareDomain(url)}
            </a>
          ))}
          {!isComingSoon && last_checked && (
            <div
              data-testid="last-checked"
              style={{ fontSize: 11, color: C.text3, marginTop: 8 }}
            >
              Last checked: {last_checked}
            </div>
          )}
        </>
      )}
    </div>
  );
}
