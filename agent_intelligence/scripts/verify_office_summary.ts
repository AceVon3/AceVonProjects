// Node-level verification of the Compliance office-summary logic.
//
// The summary's only interpretive content is (1) relevance-pointing and (2) the
// out-of-state remote flag — both must stay on the honest side of the
// determination line. This asserts:
//   - relevance pointers NEVER use determination language ("applies to you",
//     "you are exempt/subject", etc.) and DO carry the agent's own number;
//   - the out-of-state remote flag fires exactly when there are remote workers
//     AND employee states the briefing doesn't cover, and lists those states.
//
// Usage: npx tsx scripts/verify_office_summary.ts

import {
  briefingCoverageLabel,
  outOfCoverageEmployeeStates,
  payTypeLabel,
  relevancePointers,
  shouldFlagOutOfStateRemote,
  stateReviews,
} from "../src/lib/officeSummary";
import type { AgentProfile } from "../src/lib/profile";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

const BASE: AgentProfile = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["WA", "OR"],
  full_name: "Test Agent",
  offices: [{ label: "Main Office", street: "123 Main St", city: "Spokane", state: "WA", zip: "99206" }],
  employee_count: 60,
  employee_states: ["WA", "CO", "ID"],
  pay_type: "both",
  remote_count: 5,
  created_at: "2026-05-28T00:00:00.000Z",
};

console.log("=".repeat(72));
console.log("VERIFY: Compliance office summary (relevance-pointing + remote flag)");
console.log("=".repeat(72));

// The determination line we must never cross. Each pattern is phrasing that
// would tell the agent a legal conclusion rather than point them at a section.
const DETERMINATION = [
  /\bapplies to you\b/i,
  /\bdoes not apply to you\b/i,
  /\bdoesn'?t apply to you\b/i,
  /\byou are (exempt|subject|required|liable|covered)\b/i,
  /\byou'?re (exempt|subject|required|liable|covered)\b/i,
  /\byou must\b/i,
  /\byou qualify\b/i,
  /\bnot subject to\b/i,
];

console.log("\nRelevance-pointing stays on the honest side of determination:");
for (const pt of ["hourly", "salary", "both"] as const) {
  const items = relevancePointers({ ...BASE, pay_type: pt });
  for (const it of items) {
    const offending = DETERMINATION.find(re => re.test(it.text));
    check(`[${pt}] pointer '${it.key}' uses no determination language`, !offending,
      offending ? { text: it.text, matched: String(offending) } : undefined);
  }
}

console.log("\nPay type drives which sections are pointed at:");
check("salary-only points at the exempt-salary threshold, not hourly/overtime",
  (() => {
    const keys = relevancePointers({ ...BASE, pay_type: "salary" }).map(p => p.key);
    return keys.includes("salary") && !keys.includes("hourly");
  })());
check("hourly-only points at min wage/overtime, not the salary threshold",
  (() => {
    const keys = relevancePointers({ ...BASE, pay_type: "hourly" }).map(p => p.key);
    return keys.includes("hourly") && !keys.includes("salary");
  })());
check("both points at salary AND hourly",
  (() => {
    const keys = relevancePointers({ ...BASE, pay_type: "both" }).map(p => p.key);
    return keys.includes("salary") && keys.includes("hourly");
  })());

console.log("\nSize pointer carries the agent's own number + the 50-line fact:");
check("size pointer states their employee_count and the 50-employee line",
  (() => {
    const size = relevancePointers({ ...BASE, employee_count: 60 }).find(p => p.key === "size");
    return !!size && /\b60 employees\b/.test(size.text) && /50-employee line/.test(size.text);
  })());

console.log("\nOut-of-state remote flag — the honesty safeguard:");
// 50-STATE EXPANSION (2026-07): every real state is now briefing-ready, so
// the out-of-state flag never fires on real employee states — that is the
// intended outcome of the expansion, not a regression. The safeguard LOGIC
// stays covered (it protects any future state whose summaries all fail
// generation) via a synthetic non-ready code ("ZZ"): buildSections gives it
// sections, but it has no grounded summaries, so isBriefingReady is false.
check("does NOT fire on real states — all 50 are briefing-ready (BASE: WA/CO/ID)",
  shouldFlagOutOfStateRemote(BASE) === false);
check("real employee states yield no out-of-coverage states",
  outOfCoverageEmployeeStates(BASE.employee_states).length === 0,
  { got: outOfCoverageEmployeeStates(BASE.employee_states) });
check("safeguard still fires: remote workers + a non-ready state (synthetic ZZ)",
  shouldFlagOutOfStateRemote({ ...BASE, employee_states: ["WA", "ZZ"] }) === true);
check("non-ready states are returned sorted (synthetic QQ, ZZ)",
  JSON.stringify(outOfCoverageEmployeeStates(["ZZ", "WA", "QQ"])) === JSON.stringify(["QQ", "ZZ"]),
  { got: outOfCoverageEmployeeStates(["ZZ", "WA", "QQ"]) });
check("does NOT fire when no remote workers (remote_count 0, even with ZZ)",
  shouldFlagOutOfStateRemote({ ...BASE, employee_states: ["WA", "ZZ"], remote_count: 0 }) === false);
check("does NOT fire when all employee states are covered (WA only)",
  shouldFlagOutOfStateRemote({ ...BASE, employee_states: ["WA"] }) === false);
check("WA is covered, so WA alone yields no out-of-coverage states",
  outOfCoverageEmployeeStates(["WA"]).length === 0);
check("ID is covered, so ID alone yields no out-of-coverage states",
  outOfCoverageEmployeeStates(["ID"]).length === 0);
check("coverage label names every covered employee state (WA + CO)",
  briefingCoverageLabel(["WA", "CO"]) === "Washington, Colorado");
check("coverage label names covered non-WA states (CO + ID)",
  briefingCoverageLabel(["CO", "ID"]) === "Colorado, Idaho");
check("coverage label falls back to Washington when no employee state is covered (synthetic ZZ)",
  briefingCoverageLabel(["ZZ"]) === "Washington");

console.log("\nPay-type labels:");
check("hourly -> 'Hourly'", payTypeLabel("hourly") === "Hourly");
check("salary -> 'Salary'", payTypeLabel("salary") === "Salary");
check("both -> 'Both hourly and salaried'", payTypeLabel("both") === "Both hourly and salaried");

console.log("\nPer-state review blocks (stateReviews):");
// N=15 profile against NY (10-line: at or above), OR (25-line: below),
// MT (not at-will), GA (pure federal-default), WA (bespoke PFML + WA Cares).
const reviews = stateReviews(["WA", "NY", "OR", "MT", "GA"], "WA", 15);
const byState = new Map(reviews.map(r => [r.state, r] as const));
check("one block per employee state, primary (WA) first",
  reviews.length === 5 && reviews[0].state === "WA",
  { order: reviews.map(r => r.state) });
const nyLines = byState.get("NY")?.lines.map(l => l.text).join(" ") ?? "";
check("NY: Secure Choice 10-line read against N=15 as at-or-above",
  /10-employee line/.test(nyLines) && /15 employees — at or above/.test(nyLines),
  { nyLines: nyLines.slice(0, 200) });
check("NY: own-threshold salary line present",
  /its own overtime-exempt salary threshold/.test(nyLines));
const orLines = byState.get("OR")?.lines.map(l => l.text).join(" ") ?? "";
check("OR: Paid Leave 25-line read against N=15 as below",
  /25-employee line/.test(orLines) && /15 employees — below/.test(orLines),
  { orLines: orLines.slice(0, 200) });
const mtLines = byState.get("MT")?.lines.map(l => l.text).join(" ") ?? "";
check("MT: not-at-will (WDEA good cause) line present",
  /not an at-will state/.test(mtLines) && /good cause/.test(mtLines));
const gaLines = byState.get("GA")?.lines ?? [];
check("GA (pure federal-default): exactly one honest fallback line",
  gaLines.length === 1 && /follows the federal wage-and-hour floors/.test(gaLines[0].text),
  { gaLines: gaLines.map(l => l.text) });
const waLines = byState.get("WA")?.lines.map(l => l.text).join(" ") ?? "";
check("WA: PFML 50-line + WA Cares lines present",
  /50-employee line/.test(waLines) && /WA Cares/.test(waLines));
check("every review line has a target section key",
  reviews.every(r => r.lines.every(l => !!l.targetSection)),
  { missing: reviews.flatMap(r => r.lines.filter(l => !l.targetSection).map(l => `${r.state}/${l.key}`)) });
// The determination line holds across ALL 50 states at several headcounts.
const allStates = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WV","WI","WY"];
const offenders: string[] = [];
for (const n of [1, 15, 60]) {
  for (const r of stateReviews(allStates, "WA", n)) {
    for (const l of r.lines) {
      if (DETERMINATION.some(re => re.test(l.text))) offenders.push(`${r.state}/${l.key}@${n}`);
    }
  }
}
check("NO review line uses determination language (50 states × N=1/15/60)",
  offenders.length === 0, { offenders });

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
