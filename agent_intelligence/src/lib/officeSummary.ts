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

// The state whose briefing sections actually render (first ready state in
// display order). null when no employee state is briefing-ready, i.e. the
// briefing shows only coming-soon blocks and there are NO sections to jump to.
export function primaryBriefingState(
  employeeStates: string[],
  homeState: string,
): string | null {
  return orderedBriefingStates(employeeStates, homeState).find(isBriefingReady) ?? null;
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
// target and stays plain text.
export type RelevancePointer = { key: string; text: string; targetSection?: string };

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

  return items;
}
