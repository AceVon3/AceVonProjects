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

// --- 50-state expansion (2026-07) ------------------------------------------
//
// Per-state briefing configuration. Every state renders the five shared
// sections (wage / salary / leave / termination-doctrine / business tax);
// program states add a "State employer programs" section (TDI/SDI/DBL,
// paid-leave premium programs, retirement mandates) between leave and the
// termination doctrine. Structure-only config — every figure a section shows
// comes from the grounded summaries, and size-gate framing lines carry the
// same "verify" hedge WA's PFML gate set the precedent for.
type StateBriefingConfig = {
  // State sets its own overtime-exempt salary threshold — the salary warning
  // names this agency instead of the U.S. DOL.
  thresholdAgency?: string;
  // State runs signature employer programs → add the state_programs section.
  programsLabel?: string;
  // Employee-count line on a state program (retirement mandates etc.).
  programsSizeGate?: SectionSizeGate;
  // State has a real state leave mandate (sick leave / PFML premium program)
  // → the leave section keeps the generic size note visible unless a
  // specific gate replaces it. Federal-FMLA-only states hide it.
  hasStateLeave?: boolean;
  leaveLabel?: string;
  leaveSizeGate?: SectionSizeGate;
  // Employee-count line on the state's wage/overtime rules (WV's 6-per-
  // location minimum-wage line, AK's 4-employee daily-overtime line).
  wageSizeGate?: SectionSizeGate;
  // Montana: the ONLY non-at-will state (WDEA good-cause standard).
  notAtWill?: boolean;
};

const gate = (threshold: number, line: (n: number) => string): SectionSizeGate => ({
  threshold,
  framing: line,
});

// States with NO remote-work-specific law (product decision 2026-07-14, per
// user): their Remote Work cards say so plainly instead of "coming soon".
// These are the states whose labor-hub pages contain nothing remote-specific
// (the generator honestly refused) — general employment rules still apply by
// where the work is performed, which is what the card copy says. Product
// copy, not a grounded summary: the card renders WITHOUT a last-checked
// date or AI-summary framing. If a state ever enacts a remote-work law,
// remove it here and map real sources in resourceUrls.ts.
export const NO_REMOTE_LAW_STATES: ReadonlySet<string> = new Set([
  "AK", "AL", "AR", "AZ", "DE", "FL", "GA", "IN", "KY", "LA", "MA",
  "ME", "MN", "MO", "MS", "NC", "ND", "OR", "SC", "SD", "TX",
]);

// Product-copy cards for (state, topic) cells where NO state law exists —
// the honest content is the absence itself, which no official page states,
// so it can't be grounded from a source. Same discipline as the remote
// variant: renders WITHOUT a last-checked date or AI-summary framing, and
// the official links stay on the card. Extend this map only for verified
// absences (a hunt round confirmed nothing exists to find).
export type NoStateLawCard = { title: string; body: string };

const NO_STATE_LAW_CARDS: Record<string, NoStateLawCard> = {
  // 2026-07-15: three hunt rounds confirmed MS has no final-paycheck
  // statute and no state wage-and-hour agency (MDES handles UI only and
  // routes wage matters to the US DOL).
  "MS/termination": {
    title: "No state final-paycheck law",
    body: "Mississippi has no state law setting a final-paycheck deadline or other termination-pay rules, and no state wage-and-hour agency — pay timing after separation is governed by the federal FLSA's regular-payday requirements and the employer's own written policies. Federal wage disputes go to the U.S. Department of Labor.",
  },
};

// The card content for a (state, topic) cell whose honest answer is "no
// state law" — the remote-work set plus the explicit per-pair map above.
export function noStateLawCard(state: string, topic: string): NoStateLawCard | null {
  if (topic === "remote" && NO_REMOTE_LAW_STATES.has(state)) {
    return {
      title: "No state remote-work law",
      body: `There are no remote-work laws in this state — ${stateName(state)} has no statute specific to remote work. Its general employment rules (wage and hour, leave, worker protections) apply based on where the employee performs the work.`,
    };
  }
  return NO_STATE_LAW_CARDS[`${state}/${topic}`] ?? null;
}

// Size-gate framings follow WA's pattern: state the threshold, the agent's N,
// the neutral above/below comparison, and ALWAYS defer to verification.
const STATE_CONFIG: Record<string, StateBriefingConfig> = {
  // --- Own-threshold states -------------------------------------------------
  AK: {
    thresholdAgency: "the Alaska Department of Labor",
    hasStateLeave: true,
    leaveLabel: "Paid sick leave",
    wageSizeGate: gate(4, n =>
      `Alaska's daily overtime rule (over 8 hours/day) applies at 4+ employees; under 4, only the weekly 40-hour trigger applies. You have ${emp(n)} — ${sit(n, 4)} the 4-employee line. Counting rules vary — verify your obligation.`),
  },
  CA: {
    thresholdAgency: "the California DIR",
    programsLabel: "SDI, Paid Family Leave & CalSavers",
    hasStateLeave: true,
  },
  CO: {
    thresholdAgency: "the Colorado CDLE",
    programsLabel: "FAMLI & Colorado SecureSavings",
    programsSizeGate: gate(5, n =>
      `Colorado SecureSavings registration applies at 5+ employees without a qualified retirement plan; FAMLI withholding applies regardless of size. You have ${emp(n)} — ${sit(n, 5)} the 5-employee line. Counting rules vary — verify your obligation.`),
    hasStateLeave: true,
    leaveLabel: "Paid sick leave & FAMLI",
    leaveSizeGate: gate(10, n =>
      `The FAMLI employer share applies at 10+ employees; under 10, only the employee share is collected and remitted. You have ${emp(n)} — ${sit(n, 10)} the 10-employee line. Counting rules vary — verify your obligation.`),
  },
  HI: {
    thresholdAgency: "the Hawaii DLIR",
    programsLabel: "TDI & Prepaid Health Care Act",
    hasStateLeave: true,
  },
  ME: {
    thresholdAgency: "the Maine Department of Labor",
    programsLabel: "Maine PFML & MERIT",
    hasStateLeave: true,
    leaveLabel: "Earned paid leave & PFML",
    leaveSizeGate: gate(15, n =>
      `Maine PFML's full employer share applies at 15+ employees; under 15, a reduced rate can be funded through employee withholding. You have ${emp(n)} — ${sit(n, 15)} the 15-employee line. Counting rules vary — verify your obligation.`),
  },
  NY: {
    thresholdAgency: "the New York DOL",
    programsLabel: "DBL, Paid Family Leave & NY Secure Choice",
    programsSizeGate: gate(10, n =>
      `NY Secure Choice retirement registration applies at 10+ employees (in business 2+ years, no qualified plan); DBL and Paid Family Leave apply from the first employee. You have ${emp(n)} — ${sit(n, 10)} the 10-employee line. Counting rules vary — verify your obligation.`),
    hasStateLeave: true,
  },

  // --- Program states on the federal salary floor ---------------------------
  AZ: {
    hasStateLeave: true,
    leaveLabel: "Earned paid sick time",
    leaveSizeGate: gate(15, n =>
      `Employers with 15+ employees must allow up to 40 hours of earned paid sick time per year; under 15, the cap is lower. You have ${emp(n)} — ${sit(n, 15)} the 15-employee line. Counting rules vary — verify your obligation.`),
  },
  CT: {
    programsLabel: "CT Paid Leave & MyCTSavings",
    programsSizeGate: gate(5, n =>
      `MyCTSavings registration applies at 5+ employees without a qualified retirement plan; CT Paid Leave applies regardless of size. You have ${emp(n)} — ${sit(n, 5)} the 5-employee line. Counting rules vary — verify your obligation.`),
    hasStateLeave: true,
    leaveLabel: "Paid sick leave & CT Paid Leave",
    leaveSizeGate: gate(11, n =>
      `Connecticut's paid-sick-leave mandate applies at 11+ employees (expanding to all employers January 1, 2027); CT Paid Leave withholding applies regardless of size. You have ${emp(n)} — ${sit(n, 11)} the 11-employee line. Counting rules vary — verify your obligation.`),
  },
  DE: {
    programsLabel: "Delaware Paid Leave & EARNS",
    programsSizeGate: gate(5, n =>
      `Delaware EARNS retirement registration applies at 5+ employees without a qualified plan. You have ${emp(n)} — ${sit(n, 5)} the 5-employee line. Counting rules vary — verify your obligation.`),
    hasStateLeave: true,
    leaveSizeGate: gate(10, n =>
      `Delaware Paid Leave is mandatory at 10+ employees working in Delaware (parental-only for 10–24; the full program at 25+). You have ${emp(n)} — ${sit(n, 10)} the 10-employee line. Counting rules vary — verify your obligation.`),
  },
  IL: {
    programsLabel: "Illinois Secure Choice",
    programsSizeGate: gate(5, n =>
      `Illinois Secure Choice registration applies at 5+ employees (in business 2+ years, no qualified retirement plan). You have ${emp(n)} — ${sit(n, 5)} the 5-employee line. Counting rules vary — verify your obligation.`),
    hasStateLeave: true,
    leaveLabel: "Paid Leave for All Workers (PLAWA)",
  },
  MA: {
    programsLabel: "Massachusetts PFML",
    hasStateLeave: true,
    leaveLabel: "Paid Family & Medical Leave (PFML)",
    leaveSizeGate: gate(25, n =>
      `The PFML employer share applies at 25+ covered individuals; under 25, a lower employee-funded rate applies. You have ${emp(n)} — ${sit(n, 25)} the 25-employee line. Counting rules vary — verify your obligation.`),
  },
  MD: {
    programsLabel: "Maryland FAMLI & MarylandSaves",
    hasStateLeave: true,
    leaveSizeGate: gate(15, n =>
      `The FAMLI employer share applies at 15+ employees; under 15, only the employee share is collected and remitted. You have ${emp(n)} — ${sit(n, 15)} the 15-employee line. The program's dates have shifted — verify your obligation and its current timeline.`),
  },
  MI: {
    hasStateLeave: true,
    leaveLabel: "Earned Sick Time Act (ESTA)",
    leaveSizeGate: gate(10, n =>
      `ESTA's full paid-leave cap applies at 10+ employees; under 10, a lower paid cap applies. You have ${emp(n)} — ${sit(n, 10)} the 10-employee line. Counting rules vary — verify your obligation.`),
  },
  MN: {
    programsLabel: "Minnesota Paid Leave & Secure Choice",
    programsSizeGate: gate(5, n =>
      `Minnesota Secure Choice retirement registration applies at 5+ employees without a qualified plan; Minnesota Paid Leave applies regardless of size. You have ${emp(n)} — ${sit(n, 5)} the 5-employee line. Counting rules vary — verify your obligation.`),
    hasStateLeave: true,
    leaveLabel: "Earned Sick & Safe Time + Paid Leave",
    leaveSizeGate: gate(31, n =>
      `Minnesota Paid Leave's standard premium split applies above 30 employees; at 30 or fewer (with average wages under the statutory level), a reduced employer rate applies. You have ${emp(n)} — ${sit(n, 31)} the 30-employee line. Counting rules vary — verify your obligation.`),
  },
  NJ: {
    programsLabel: "TDI, Family Leave Insurance & RetireReady NJ",
    programsSizeGate: gate(10, n =>
      `RetireReady NJ (Secure Choice) registration applies at 10+ employees (in business 2+ years, no qualified plan); TDI and FLI apply regardless of size. You have ${emp(n)} — ${sit(n, 10)} the 10-employee line. Counting rules vary — verify your obligation.`),
    hasStateLeave: true,
    leaveLabel: "Earned sick leave, TDI & FLI",
  },
  NM: {
    hasStateLeave: true,
    leaveLabel: "Healthy Workplaces Act (paid sick leave)",
  },
  NV: {
    hasStateLeave: true,
    leaveLabel: "Paid leave (SB 312)",
    leaveSizeGate: gate(50, n =>
      `SB 312's any-reason paid-leave accrual applies at 50+ employees; under 50 it is optional. You have ${emp(n)} — ${sit(n, 50)} the 50-employee line. Counting rules vary — verify your obligation.`),
  },
  OR: {
    programsLabel: "Paid Leave Oregon & OregonSaves",
    hasStateLeave: true,
    leaveLabel: "Paid Leave Oregon",
    leaveSizeGate: gate(25, n =>
      `The Paid Leave Oregon employer share applies at 25+ employees; under 25, only the employee share is withheld and remitted. You have ${emp(n)} — ${sit(n, 25)} the 25-employee line. Counting rules vary — verify your obligation.`),
  },
  RI: {
    programsLabel: "TDI/TCI & RISavers",
    programsSizeGate: gate(5, n =>
      `RISavers retirement registration applies at 5+ employees without a qualifying plan (compliance deadlines are staggered by size through 2028); TDI/TCI applies regardless of size. You have ${emp(n)} — ${sit(n, 5)} the 5-employee line. Counting rules vary — verify your obligation.`),
    hasStateLeave: true,
    leaveLabel: "Paid sick leave & TDI/TCI",
    leaveSizeGate: gate(18, n =>
      `Rhode Island's paid-sick-leave mandate applies at 18+ employees; TDI/TCI applies regardless of size. You have ${emp(n)} — ${sit(n, 18)} the 18-employee line. Counting rules vary — verify your obligation.`),
  },
  NE: {
    hasStateLeave: true,
    leaveLabel: "Paid sick time (Healthy Families Act)",
    leaveSizeGate: gate(11, n =>
      `Nebraska's paid-sick-time mandate applies at 11+ employees, with a higher annual cap at 20+. You have ${emp(n)} — ${sit(n, 11)} the 11-employee line. Counting rules vary — verify your obligation.`),
  },
  VA: {
    programsLabel: "RetirePath Virginia & PFML (2028)",
    programsSizeGate: gate(5, n =>
      `RetirePath Virginia registration applies at 5+ employees as of July 1, 2026 (in business 2+ years, no qualified plan). You have ${emp(n)} — ${sit(n, 5)} the 5-employee line. Counting rules vary — verify your obligation.`),
  },
  VT: {
    programsLabel: "VT Saves",
    programsSizeGate: gate(5, n =>
      `VT Saves retirement registration applies at 5+ employees without a retirement plan. You have ${emp(n)} — ${sit(n, 5)} the 5-employee line. Counting rules vary — verify your obligation.`),
    hasStateLeave: true,
    leaveLabel: "Earned sick time",
  },
  WV: {
    wageSizeGate: gate(7, n =>
      `West Virginia's state minimum wage applies at locations with more than 6 employees; at or under 6 per location, the federal floor applies. You have ${emp(n)} — ${sit(n, 7)} that line. Counting is per location — verify your obligation.`),
  },
  // --- Montana: the one non-at-will state -----------------------------------
  MT: { notAtWill: true },
};

// Assemble a state's section list from its config. Shared keys (wage/salary/
// leave/atwill/btax) match WA's so office-summary relevance links resolve
// identically across states.
function buildSections(state: string): BriefingSectionDef[] {
  const cfg = STATE_CONFIG[state] ?? {};
  const sections: BriefingSectionDef[] = [
    {
      key: "wage",
      label: "Minimum wage & overtime",
      topic: "wage_hour",
      ...(cfg.wageSizeGate ? { sizeGate: cfg.wageSizeGate } : {}),
    },
    { key: "salary", label: "Salary & exempt thresholds", topic: "salary_threshold", salaryRisk: true },
    {
      key: "leave",
      label: cfg.leaveLabel ?? (cfg.hasStateLeave ? "Paid leave" : "Leave laws"),
      topic: "leave",
      ...(cfg.leaveSizeGate ? { sizeGate: cfg.leaveSizeGate } : {}),
      // Federal-FMLA-only states explain the FMLA 50-employee gate in the
      // summary itself, so the generic size note would contradict it.
      ...(!cfg.hasStateLeave && !cfg.leaveSizeGate ? { hideSizeNote: true } : {}),
    },
  ];
  if (cfg.programsLabel) {
    sections.push({
      key: "programs",
      label: cfg.programsLabel,
      topic: "state_programs",
      ...(cfg.programsSizeGate ? { sizeGate: cfg.programsSizeGate } : {}),
    });
  }
  sections.push(
    cfg.notAtWill
      ? { key: "atwill", label: "Termination — good cause required (WDEA)", topic: "at_will" }
      : { key: "atwill", label: "At-will termination", topic: "at_will" },
    { key: "btax", label: "Business tax basics", topic: "business_tax" },
  );
  return sections;
}

// Built states → their section list. WA keeps its bespoke original list
// (PFML gate + WA Cares + B&O framing) so it renders exactly as before;
// ID/UT keep the federal-default list they shipped with; every other state
// gets a config-driven list.
const SECTIONS_BY_STATE: Record<string, BriefingSectionDef[]> = {
  WA: WA_SECTIONS,
  ID: FEDERAL_DEFAULT_SECTIONS,
  UT: FEDERAL_DEFAULT_SECTIONS,
};

// The sections that apply to a state — config-driven for the 50-state set.
export function sectionsForState(state: string): BriefingSectionDef[] {
  const bespoke = SECTIONS_BY_STATE[state];
  if (bespoke) return bespoke;
  return buildSections(state);
}

// --- Per-state "worth reviewing" lines (office summary) ---------------------
//
// One line-set per employee state, derived from the SAME config that drives
// the briefing sections — so the summary can never claim a gate the briefing
// doesn't render. Same language discipline as size gates: state the rule's
// line, the agent's N, the neutral above/below comparison, and defer the
// conclusion. NEVER "this applies to you."
export type StateReviewLine = {
  key: string;
  text: string;
  // Briefing section key the line points at — the component links it only if
  // that section actually renders for the state.
  targetSection?: string;
};

export function stateReviewLines(state: string, n: number): StateReviewLine[] {
  // WA is bespoke (not in STATE_CONFIG): surface its two signature gates.
  if (state === "WA") {
    const pfmlGate = WA_SECTIONS.find(s => s.key === "pfml")?.sizeGate;
    return [
      ...(pfmlGate
        ? [{ key: "leave", text: pfmlGate.framing(n), targetSection: "pfml" }]
        : []),
      {
        key: "programs",
        text: "WA Cares long-term-care premiums are collected from employees' wages regardless of employer size — the WA Cares section covers the employer duties.",
        targetSection: "wacares",
      },
    ];
  }

  const cfg = STATE_CONFIG[state];
  if (!cfg) {
    // Pure federal-default state: one honest line so every listed state
    // appears, pointing at its briefing rather than implying nothing exists.
    return [{
      key: "default",
      text: `${stateName(state)} largely follows the federal wage-and-hour floors, with no state paid-leave mandate or employer-mandate programs — its briefing below covers the specifics.`,
      targetSection: "wage",
    }];
  }

  const lines: StateReviewLine[] = [];
  if (cfg.notAtWill) {
    lines.push({
      key: "atwill",
      text: `${stateName(state)} is not an at-will state — after the probationary period, ending employment requires good cause under the WDEA. The termination section is the one to review before any separation.`,
      targetSection: "atwill",
    });
  }
  if (cfg.leaveSizeGate) {
    lines.push({ key: "leave", text: cfg.leaveSizeGate.framing(n), targetSection: "leave" });
  } else if (cfg.hasStateLeave) {
    lines.push({
      key: "leave",
      text: `${stateName(state)} mandates paid leave regardless of employer size — the leave section covers the accrual rules.`,
      targetSection: "leave",
    });
  }
  if (cfg.programsSizeGate) {
    lines.push({ key: "programs", text: cfg.programsSizeGate.framing(n), targetSection: "programs" });
  } else if (cfg.programsLabel) {
    lines.push({
      key: "programs",
      text: `${cfg.programsLabel} — state-run employer programs; the programs section covers who they reach and what they cost.`,
      targetSection: "programs",
    });
  }
  if (cfg.wageSizeGate) {
    lines.push({ key: "wage", text: cfg.wageSizeGate.framing(n), targetSection: "wage" });
  }
  if (cfg.thresholdAgency) {
    lines.push({
      key: "salary",
      text: `${stateName(state)} sets its own overtime-exempt salary threshold, above the federal floor — worth checking any exempt classification against the state figure in the salary section.`,
      targetSection: "salary",
    });
  }
  return lines;
}

// Which salary-misclassification warning a state's salary section carries.
// WA names L&I; own-threshold states name their own agency; federal-default
// states name the U.S. DOL.
export function salaryWarningForState(state: string): string {
  if (state === "WA") return SALARY_WARNING;
  const agency = STATE_CONFIG[state]?.thresholdAgency;
  if (agency) {
    return `This salary determines overtime-exempt status under state law. A figure that's out of date can cause an employee to be misclassified and owed back overtime — confirm the current threshold with ${agency} before classifying anyone as exempt or setting a salary by it.`;
  }
  return FEDERAL_SALARY_WARNING;
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
