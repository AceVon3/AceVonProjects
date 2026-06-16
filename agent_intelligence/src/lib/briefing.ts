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
  // Suppress the generic "Applies regardless of company size." footer. Used by
  // the federal-default leave section, whose summary already explains the FMLA
  // 50-employee coverage gate — so "regardless of size" would contradict it.
  hideSizeNote?: boolean;
};

// The strong inline warning for the salary box — UI product copy (not from a
// source). This is the misclassification-risk figure an employer acts on
// directly, so it carries its own warning, stronger than the blanket band.
// WA names L&I (it sets WA's own threshold); federal-default states name the
// U.S. DOL (they follow the federal FLSA level).
export const SALARY_WARNING =
  "This salary determines overtime-exempt status. A figure that's out of date can cause an employee to be misclassified and owed back overtime — confirm the current threshold and multiplier with L&I before classifying anyone as exempt or setting a salary by it.";

export const FEDERAL_SALARY_WARNING =
  "This salary determines overtime-exempt status under the federal FLSA. A figure that's out of date can cause an employee to be misclassified and owed back overtime — confirm the current federal threshold with the U.S. Department of Labor before classifying anyone as exempt or setting a salary by it.";

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

// --- Per-state section model -----------------------------------------------
//
// Each built state declares the sections that APPLY to it, in display order.
// A section that applies but isn't grounded yet renders coming-soon (e.g. UT
// at-will); a section that doesn't apply is simply absent (e.g. WA Cares for
// non-WA states). Within a section, grounded → full content, ungrounded →
// coming-soon. States with NO section list (the not-yet-built ones) render the
// whole-state coming-soon block.

// Washington — the original full set (PFML + WA Cares, B&O, L&I framing).
// UNCHANGED from the single-state version, so WA renders exactly as before.
const WA_SECTIONS: BriefingSectionDef[] = [
  { key: "wage", label: "Minimum wage & overtime", topic: "wage_hour" },
  { key: "salary", label: "Salary & exempt thresholds", topic: "salary_threshold", salaryRisk: true },
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
  { key: "wacares", label: "WA Cares (long-term care)", topic: "wa_cares" },
  { key: "atwill", label: "At-will termination", topic: "at_will" },
  { key: "btax", label: "Business tax basics (B&O)", topic: "business_tax" },
];

// Federal-default states (ID, UT): follow federal on wage/overtime and the
// exempt-salary threshold; NO state leave program (leave section explains the
// federal FMLA gate, so it hides the generic size note); NO WA Cares analog;
// business tax is income-based (no "(B&O)"). Shared keys (wage/salary/atwill/
// btax) match WA so the office-summary relevance links resolve the same way.
const FEDERAL_DEFAULT_SECTIONS: BriefingSectionDef[] = [
  { key: "wage", label: "Minimum wage & overtime", topic: "wage_hour" },
  { key: "salary", label: "Salary & exempt thresholds", topic: "salary_threshold", salaryRisk: true },
  { key: "leave", label: "Leave laws", topic: "leave", hideSizeNote: true },
  { key: "atwill", label: "At-will termination", topic: "at_will" },
  { key: "btax", label: "Business tax basics", topic: "business_tax" },
];

// Built states → their section list. A new state with its own structure (e.g.
// CO's own salary threshold + FAMLI, OR's regional wages) gets its own list.
const SECTIONS_BY_STATE: Record<string, BriefingSectionDef[]> = {
  WA: WA_SECTIONS,
  ID: FEDERAL_DEFAULT_SECTIONS,
  UT: FEDERAL_DEFAULT_SECTIONS,
};

// The sections that apply to a state — empty for not-yet-built states.
export function sectionsForState(state: string): BriefingSectionDef[] {
  return SECTIONS_BY_STATE[state] ?? [];
}

// Which salary-misclassification warning a state's salary section carries.
// WA names L&I; federal-default states name the U.S. DOL.
export function salaryWarningForState(state: string): string {
  return state === "WA" ? SALARY_WARNING : FEDERAL_SALARY_WARNING;
}

const SUMMARY_INDEX = new Map<string, ComplianceSummary>(
  COMPLIANCE_SUMMARIES.map(s => [`${s.state}/${s.topic}`, s] as const),
);

export function sectionSummary(
  state: string,
  topic: ResourceKey,
): ComplianceSummary | undefined {
  return SUMMARY_INDEX.get(`${state}/${topic}`);
}

// A state is "briefing-ready" if it is a built state (has a section list) AND
// at least one of its sections has a grounded (non-null) summary. WA, ID, and
// UT qualify; every other employee state (covered-but-unmapped or non-covered)
// renders the whole-state coming-soon block.
export function isBriefingReady(state: string): boolean {
  const secs = sectionsForState(state);
  return secs.length > 0 && secs.some(sec => {
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
