// Feature 9 — Compliance office briefing assembly.
//
// Maps the briefing's six sections to the grounded compliance summaries
// (reusing wage_hour / leave where they already cover a topic, plus the four
// new topics) and carries the size-gate framing. No new data path — it reads
// the same pre-generated COMPLIANCE_SUMMARIES the card grid reads.

import { COMPLIANCE_SUMMARIES, ComplianceSummary } from "./complianceData";
import type { ResourceKey } from "./resourceUrls";
import { STATES } from "./states";

export type SectionSizeGate = {
  threshold: number;
  // The "applies at T+; you have N — where you sit" line. NEVER a
  // determination — it states the threshold, N, the neutral above/below
  // comparison, and defers the legal conclusion to verification.
  framing: (n: number) => string;
};

export type BriefingSectionDef = {
  key: string;
  label: string;
  topic: ResourceKey;     // which COMPLIANCE_SUMMARIES topic supplies the text
  sizeGate?: SectionSizeGate;
  // The exempt-salary threshold gets a STRONGER figure-specific treatment
  // instead of a generic size-gate (small/large tiers currently match in
  // 2026, so "where you sit vs 50" has no size-dependent answer this year):
  // a misclassification warning + a derived annual figure.
  salaryRisk?: boolean;
};

// The strong inline warning for the salary box — UI product copy (not from a
// source). This is the misclassification-risk figure an employer acts on
// directly, so it carries its own warning, stronger than the blanket band.
export const SALARY_WARNING =
  "This salary determines overtime-exempt status. A figure that's out of date can cause an employee to be misclassified and owed back overtime — confirm the current threshold and multiplier with L&I before classifying anyone as exempt or setting a salary by it.";

// Parse the weekly dollar figure from the (grounded) salary summary and derive
// the ANNUAL as weekly × 52 — a derived convenience that ties to the weekly by
// construction, never independently sourced. Returns null if no weekly figure
// is found (graceful: the UI then shows no annual).
export function deriveAnnualFromWeekly(
  summary: string | null,
): { weekly: string; annual: string } | null {
  if (!summary) return null;
  const m = summary.match(/\$([\d,]+(?:\.\d{2})?)\s*(?:per|a)\s+week/i);
  if (!m) return null;
  const weeklyNum = parseFloat(m[1].replace(/,/g, ""));
  if (!isFinite(weeklyNum) || weeklyNum <= 0) return null;
  const annual = Math.round(weeklyNum * 52);
  return {
    weekly: `$${weeklyNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    annual: `$${annual.toLocaleString("en-US")}`,
  };
}

function sit(n: number, t: number): string {
  return n >= t ? "at or above" : "below";
}
function emp(n: number): string {
  return `${n} ${n === 1 ? "employee" : "employees"}`;
}

export const BRIEFING_SECTIONS: BriefingSectionDef[] = [
  {
    key: "wage",
    label: "Minimum wage & overtime",
    topic: "wage_hour",
  },
  {
    key: "salary",
    label: "Salary & exempt thresholds",
    topic: "salary_threshold",
    salaryRisk: true,
  },
  {
    key: "pfml",
    label: "Paid family & medical leave (PFML)",
    topic: "leave",
    sizeGate: {
      threshold: 50,
      framing: n =>
        `The employer share of PFML premiums applies at 50+ employees; under 50, only the employee share is withheld. You have ${emp(n)} — ${sit(n, 50)} the 50-employee line. Counting rules vary — verify your obligation.`,
    },
  },
  {
    key: "wacares",
    label: "WA Cares (long-term care)",
    topic: "wa_cares",
  },
  {
    key: "atwill",
    label: "At-will termination",
    topic: "at_will",
  },
  {
    key: "btax",
    label: "Business tax basics (B&O)",
    topic: "business_tax",
  },
];

const SUMMARY_INDEX = new Map<string, ComplianceSummary>(
  COMPLIANCE_SUMMARIES.map(s => [`${s.state}/${s.topic}`, s] as const),
);

export function sectionSummary(
  state: string,
  topic: ResourceKey,
): ComplianceSummary | undefined {
  return SUMMARY_INDEX.get(`${state}/${topic}`);
}

// A state is "briefing-ready" if at least one of its briefing sections has a
// grounded (non-null) summary. Today only WA qualifies; every other employee
// state (covered-but-unmapped or non-covered) renders the coming-soon block.
export function isBriefingReady(state: string): boolean {
  return BRIEFING_SECTIONS.some(sec => {
    const s = SUMMARY_INDEX.get(`${state}/${sec.topic}`);
    return !!(s && s.title && s.summary);
  });
}

const STATE_NAME = new Map<string, string>(STATES.map(s => [s.code, s.name]));
export function stateName(code: string): string {
  return STATE_NAME.get(code) ?? code;
}

// Order the agent's employee states with the primary state first: home_state
// if it's an employee state, otherwise the first briefing-ready employee
// state, otherwise the original order. Briefing renders in this order.
export function orderedBriefingStates(
  employeeStates: string[],
  homeState: string,
): string[] {
  const rest = employeeStates.filter(s => s !== homeState);
  let primary: string | null = null;
  if (employeeStates.includes(homeState)) primary = homeState;
  else primary = rest.find(isBriefingReady) ?? null;
  if (!primary) return [...employeeStates];
  return [primary, ...employeeStates.filter(s => s !== primary)];
}
