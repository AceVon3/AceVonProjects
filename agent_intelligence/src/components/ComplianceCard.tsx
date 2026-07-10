"use client";

import type { ResourceKey } from "@/lib/resourceUrls";

export type ComplianceCardProps = {
  state: string;
  topic: ResourceKey;
  // Full card: title + summary populated as strings. Coming-soon:
  // either field null/undefined → ComplianceCard renders the
  // "Summary coming soon" variant. Null is used by the generator to
  // mark grounding refusals; undefined is used for (state, topic)
  // pairs that aren't in complianceData.ts at all.
  title?: string | null;
  summary?: string | null;
  sources: string[];     // may be empty if no URLs are mapped
  last_checked?: string; // omitted on coming-soon cards
};

// Topic tag color pairs keyed to the reference's per-topic palette. Remote
// Work is intentionally neutral — it doubles as the coming-soon fallback
// color. Stored as Tailwind class pairs so the palette flows from the
// shared tokens.
const TOPIC_TAG_CLASS: Record<ResourceKey, string> = {
  wage_hour:    "bg-green-fill text-green-text",
  leave:        "bg-green-fill text-green-text",
  payroll:      "bg-blue-fill text-blue-text",
  workers_comp: "bg-amber-fill text-amber-text",
  termination:  "bg-red-fill text-red-text",
  nexus:        "bg-blue-fill text-blue-text",
  hiring:       "bg-green-fill text-green-text",
  remote:       "bg-gray-fill text-gray-text",
  // Office-briefing topics (Feature 9) — not in the 8-topic card grid's
  // TOPIC_ORDER, but ResourceKey requires an entry for each.
  salary_threshold: "bg-amber-fill text-amber-text",
  wa_cares:         "bg-blue-fill text-blue-text",
  at_will:          "bg-red-fill text-red-text",
  business_tax:     "bg-green-fill text-green-text",
  state_programs:   "bg-blue-fill text-blue-text",
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
  salary_threshold: "Salary & Exempt Thresholds",
  wa_cares: "WA Cares",
  at_will: "At-Will Termination",
  business_tax: "Business Tax",
  state_programs: "State Employer Programs",
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
  const tagLabel = TOPIC_LABELS[topic];

  return (
    <div
      data-testid="compliance-card"
      data-state={state}
      data-topic={topic}
      data-variant={isComingSoon ? "coming-soon" : "full"}
      className="bg-surface border border-card-line rounded-card shadow-card p-5 flex flex-col"
    >
      {/* Header: topic tag (left) + state badge (right) */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`${TOPIC_TAG_CLASS[topic]} text-11 px-2.5 py-0.5 rounded-full font-semibold`}
        >
          {tagLabel}
        </span>
        <span className="text-11 px-[7px] py-0.5 rounded-md border border-line-2 text-ink-2">
          {state}
        </span>
      </div>

      {/* Title */}
      <h3
        className={[
          "text-15 font-[650] mt-0 mb-2 leading-[1.35]",
          isComingSoon ? "text-ink-3" : "text-ink",
        ].join(" ")}
      >
        {isComingSoon ? "Summary coming soon" : title}
      </h3>

      {/* Summary */}
      <p
        className={[
          "text-13 leading-[1.55] mt-0 mb-3.5 flex-1",
          isComingSoon ? "text-ink-3" : "text-ink-2",
        ].join(" ")}
      >
        {isComingSoon
          ? "We’re preparing a grounded summary for this topic. The official source link is available below."
          : summary}
      </p>

      {/* Sources block — always rendered when at least one URL is mapped */}
      {sources.length > 0 && (
        <>
          <div className="text-11 text-ink-3 uppercase tracking-wider06 border-t border-line pt-3 mb-1.5">
            Sources
          </div>
          {sources.map(url => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="source-link"
              className={[
                "text-12 font-semibold flex items-center gap-[5px] mb-[3px] no-underline hover:underline",
                isComingSoon ? "text-ink-3" : "text-brand-red",
              ].join(" ")}
            >
              <span aria-hidden className="text-11">↗</span>
              {bareDomain(url)}
            </a>
          ))}
          {!isComingSoon && last_checked && (
            <div
              data-testid="last-checked"
              className="text-11 text-ink-3 mt-2"
            >
              Last checked: {last_checked}
            </div>
          )}
        </>
      )}
    </div>
  );
}
