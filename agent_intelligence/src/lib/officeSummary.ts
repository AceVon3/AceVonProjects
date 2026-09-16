// Compliance office summary — pure logic.
//
// A factual recap of what the agent entered (office location, headcount,
// remote workers + their states, pay type) plus RELEVANCE-POINTING: it surfaces
// which compliance topics are worth reviewing given their numbers, always as
// "fact + your number, you draw the conclusion" — NEVER a determination
// ("X applies/doesn't apply to you"). The one piece of load-bearing
// interpretation is the out-of-state remote flag (see below), which is an
// honesty safeguard, not a legal conclusion.
//
// No generated legal claims live here: every string is either the agent's own
// input read back, or a pointer at a section to review.

import {
  isBriefingReady,
  orderedBriefingStates,
  sectionsForState,
  stateName,
  stateReviewLines,
  StateReviewLine,
} from "./briefing";
import type { AgentProfile, PayType } from "./profile";
import { retirementMandateInfo } from "./retirementMandates";

function emp(n: number): string {
  return `${n} ${n === 1 ? "employee" : "employees"}`;
}

// Human label for the recap line. Kept neutral — it describes the office's pay
// structure, it does not classify any individual employee.
export function payTypeLabel(pt: PayType): string {
  switch (pt) {
    case "hourly": return "Hourly";
    case "salary": return "Salary";
    case "both":   return "Both hourly and salaried";
  }
}

// Employee work/live states the briefing does NOT cover today (the briefing is
// ready for WA, ID, and UT). These are the states whose own rules the briefing
// can't speak to — the basis of the out-of-state remote flag. Sorted for stable
// copy.
export function outOfCoverageEmployeeStates(employeeStates: string[]): string[] {
  return employeeStates.filter(s => !isBriefingReady(s)).sort();
}

// Name(s) of the briefing coverage the agent actually has, for the flag copy
// ("…which this briefing (currently Washington) does not cover"). Falls back to
// "Washington" — the first built briefing — when the agent has no covered
// employee state of their own.
export function briefingCoverageLabel(employeeStates: string[]): string {
  const covered = employeeStates.filter(isBriefingReady).map(stateName);
  return covered.length > 0 ? covered.join(", ") : "Washington";
}

// The load-bearing honesty safeguard. Fires when the agent has remote workers
// AND at least one employee state the briefing doesn't cover — so the WA
// briefing is never misread as covering out-of-state remote staff. Required,
// not optional.
export function shouldFlagOutOfStateRemote(p: AgentProfile): boolean {
  return p.remote_count > 0 && outOfCoverageEmployeeStates(p.employee_states).length > 0;
}

// --- Per-state review blocks (50-state expansion, 2026-07) ------------------
//
// One block per employee state: the state's own gates and mandates read
// against the agent's headcount, derived from the same config the briefing
// sections use. Ordered like the briefing (primary state first) so the
// summary and the briefing tell the same story in the same order.
export type StateReview = {
  state: string;
  name: string;
  lines: StateReviewLine[];
};

export function stateReviews(
  employeeStates: string[],
  homeState: string,
  employeeCount: number,
): StateReview[] {
  return orderedBriefingStates(employeeStates, homeState).map(s => ({
    state: s,
    name: stateName(s),
    lines: stateReviewLines(s, employeeCount),
  }));
}

// --- Office states (multi-office agencies, 2026-09-16) -----------------------
//
// Every state with an office, primary first, deduped. The retirement row and
// blurb render for EACH of these (a state auto-IRA mandate keys off having
// staff in that state, and an office there means staff there).
export function officeStates(p: AgentProfile): string[] {
  const out: string[] = [];
  for (const o of p.offices ?? []) {
    if (o?.state && !out.includes(o.state)) out.push(o.state);
  }
  return out;
}

// The states the /compliance page briefs on: the employee work/live states
// PLUS any office state the agent didn't also list under employees — an
// office in a state is staff in that state, so it gets a briefing card (and
// with it the retirement row) rather than silently nothing.
export function complianceStates(p: AgentProfile): string[] {
  const out = [...(p.employee_states ?? [])];
  for (const s of officeStates(p)) if (!out.includes(s)) out.push(s);
  return out;
}

// An office state's retirement-mandate blurb for the top "Worth reviewing"
// list (2026-09-16, per Ryan). One or two sentences in the same voice as the
// other pointers — the rule's line, the agent's number, the neutral
// above/below comparison — never a determination. One blurb per office
// state; `multiOffice` words the headcount as a total split across offices.
export function retirementPointer(state: string, n: number, multiOffice = false): RelevancePointer | null {
  const info = retirementMandateInfo(state);
  if (!info) return null;
  const name = stateName(state);
  const key = `retirement-${state}`;
  const targetSection = "retirement";
  const targetState = state;
  const you = multiOffice
    ? `you have ${emp(n)} across your offices (the count that matters is staff in ${name})`
    : `you have ${emp(n)}`;

  if (info.status === "mandate-live" || info.status === "mandate-pending") {
    const scheduled = info.status === "mandate-pending";
    if (info.threshold !== null) {
      const t = info.threshold;
      const where = n >= t ? "at or above" : "below";
      const reach = t === 1
        ? "employers from the first employee"
        : `employers with ${t}+ employees`;
      return {
        key,
        targetSection,
        targetState,
        text: scheduled
          ? `${name} has enacted a retirement plan mandate (${info.program}) that is not yet in effect — it will reach ${reach} without their own plan, and ${you}, ${where} that line. The retirement section has the launch date and penalties.`
          : `${name} requires ${reach} without their own retirement plan to join ${info.program}, with per-employee penalties for not doing so — ${you}, ${where} the ${t}-employee line. Counting rules vary, so the retirement section is worth a look.`,
      };
    }
    // WA: an hours test rather than a headcount.
    return {
      key,
      targetSection,
      targetState,
      text: scheduled
        ? `${name} has enacted a retirement plan mandate (${info.program}) that is not yet in effect — its line is an hours test rather than a headcount, so the retirement section is the one to review for the launch date and where ${you} sits.`
        : `${name}'s retirement plan mandate (${info.program}) is in effect — its line is an hours test rather than a headcount, so the retirement section is the one to review.`,
    };
  }
  if (info.status === "voluntary") {
    return {
      key,
      targetSection,
      targetState,
      text: `${name} has no employer retirement plan mandate — ${info.program} is optional at any size. The retirement section has the details.`,
    };
  }
  return {
    key,
    targetSection,
    targetState,
    text: `${name} has no state retirement plan mandate for private employers today — the retirement section notes what has been proposed.`,
  };
}

// --- Out-of-state remote registration guide (2026-07) ------------------------
//
// Employee work/live states beyond the primary office state — the states
// whose payroll registrations (withholding account + unemployment account)
// an agency with remote workers typically needs BEFORE the first paycheck.
// Sorted for stable copy.
export function outOfStateEmployeeStates(
  employeeStates: string[],
  primaryState: string,
): string[] {
  return employeeStates.filter(s => s !== primaryState).sort();
}

// The guide renders when the agent reported remote workers AND at least one
// employee state beyond the office state — the exact setup answer that
// makes out-of-state payroll registration a live question.
export function shouldShowRegistrationGuide(
  p: AgentProfile,
  primaryState: string,
): boolean {
  return (
    p.remote_count > 0 &&
    outOfStateEmployeeStates(p.employee_states, primaryState).length > 0
  );
}

// The state whose briefing sections actually render (first ready state in
// display order). null when no employee state is briefing-ready, i.e. the
// briefing shows only coming-soon blocks and there are NO sections to jump to.
export function primaryBriefingState(
  employeeStates: string[],
  homeState: string,
): string | null {
  return orderedBriefingStates(employeeStates, homeState).find(isBriefingReady) ?? null;
}

// The DOM id of a state-pinned section (the per-office retirement rows): the
// row renders in every office state's briefing, so the link resolves when
// that state is briefing-ready and among the states the page briefs on.
export function stateSectionAnchorId(
  briefedStates: string[],
  state: string,
  sectionKey: string,
): string | null {
  if (!briefedStates.includes(state) || !isBriefingReady(state)) return null;
  return `briefing-${state}-${sectionKey}`;
}

// The DOM id of a briefing section for in-page jumping — or null when that
// section does NOT render for this profile. This is the single source of truth
// the office-summary links use, so a link's presence is tied to the exact
// condition that renders the target: there must be a ready briefing state, and
// the key must be a real briefing section. The id matches the one
// ComplianceBriefing puts on each section div (`briefing-{state}-{key}`).
export function briefingSectionAnchorId(
  employeeStates: string[],
  homeState: string,
  sectionKey: string,
): string | null {
  const primary = primaryBriefingState(employeeStates, homeState);
  if (!primary) return null;
  // Tie the link to the PRIMARY state's actual sections: only link if that
  // state renders a section with this key (e.g. ID has no "pfml" section, so
  // the size → PFML pointer won't link for an ID-primary agent).
  if (!sectionsForState(primary).some(s => s.key === sectionKey)) return null;
  return `briefing-${primary}-${sectionKey}`;
}

// A relevance pointer. `targetSection` is the briefing section key it points at
// (when one exists); the component turns it into an in-page link only if that
// section actually renders. `remote` has no briefing section, so it carries no
// target and stays plain text. `targetState` pins the link to a specific
// state's briefing (the per-office retirement blurbs) instead of the primary.
export type RelevancePointer = {
  key: string;
  text: string;
  targetSection?: string;
  targetState?: string;
};

// Relevance-pointing only: each item states a fact + the agent's own number, or
// points at a section to review. NONE may say a rule applies / doesn't apply,
// or that anyone is/ isn't exempt — that's the determination line we never
// cross. The agent draws the conclusion.
export function relevancePointers(p: AgentProfile): RelevancePointer[] {
  const items: RelevancePointer[] = [];

  // Size: fact + their number. The 50-line is a fact about the rules; where
  // their count sits is for them to confirm against the counting rules.
  // Points at the PFML section (the size-gated briefing section).
  items.push({
    key: "size",
    targetSection: "pfml",
    text: `You have ${emp(p.employee_count)} — size-gated rules (like the employer share of PFML premiums) use a 50-employee line. Where your count sits against the counting rules is for you to confirm.`,
  });

  // Pay type → which sections to review. Points, never classifies.
  if (p.pay_type === "salary" || p.pay_type === "both") {
    items.push({
      key: "salary",
      targetSection: "salary",
      text: "You have salaried staff, so the overtime-exempt salary threshold is the section to review.",
    });
  }
  if (p.pay_type === "hourly" || p.pay_type === "both") {
    items.push({
      key: "hourly",
      targetSection: "wage",
      text: "You have hourly staff, so minimum wage and overtime are the sections to review.",
    });
  }

  // Remote workers → point at the remote-work section (the out-of-state flag
  // below carries the stronger coverage warning).
  if (p.remote_count > 0) {
    items.push({
      key: "remote",
      text: `You have ${emp(p.remote_count)} working remotely — where remote staff live can change which state's rules reach them, so it's worth reviewing per state.`,
    });
  }

  // One retirement-mandate blurb per OFFICE state (primary first), each
  // pointing at that state's retirement row (2026-09-16).
  const offices = officeStates(p);
  const multi = offices.length > 1;
  for (const st of offices) {
    const pt = retirementPointer(st, p.employee_count, multi);
    if (pt) items.push(pt);
  }

  return items;
}
