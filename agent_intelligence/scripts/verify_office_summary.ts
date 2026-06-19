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
// BASE employee states are WA, CO, ID. WA and ID are now briefing-ready
// (ID was added in the multi-state expansion), so CO is the only one the
// briefing can't speak to — the flag still fires on it.
check("fires: remote workers + an uncovered employee state (CO)",
  shouldFlagOutOfStateRemote(BASE) === true);
check("lists only the still-uncovered state (CO); ID now has its own briefing",
  JSON.stringify(outOfCoverageEmployeeStates(BASE.employee_states)) === JSON.stringify(["CO"]),
  { got: outOfCoverageEmployeeStates(BASE.employee_states) });
check("multiple uncovered states are returned sorted (CO, MT, NV)",
  JSON.stringify(outOfCoverageEmployeeStates(["NV", "CO", "MT"])) === JSON.stringify(["CO", "MT", "NV"]),
  { got: outOfCoverageEmployeeStates(["NV", "CO", "MT"]) });
check("does NOT fire when no remote workers (remote_count 0)",
  shouldFlagOutOfStateRemote({ ...BASE, remote_count: 0 }) === false);
check("does NOT fire when all employee states are covered (WA only)",
  shouldFlagOutOfStateRemote({ ...BASE, employee_states: ["WA"] }) === false);
check("WA is covered, so WA alone yields no out-of-coverage states",
  outOfCoverageEmployeeStates(["WA"]).length === 0);
check("ID is now covered, so ID alone yields no out-of-coverage states",
  outOfCoverageEmployeeStates(["ID"]).length === 0);
check("coverage label names WA when WA is an employee state",
  briefingCoverageLabel(["WA", "CO"]) === "Washington");
check("coverage label names a covered non-WA state (ID) when WA isn't present",
  briefingCoverageLabel(["CO", "ID"]) === "Idaho");
check("coverage label falls back to Washington when no employee state is covered",
  briefingCoverageLabel(["CO", "MT"]) === "Washington");

console.log("\nPay-type labels:");
check("hourly -> 'Hourly'", payTypeLabel("hourly") === "Hourly");
check("salary -> 'Salary'", payTypeLabel("salary") === "Salary");
check("both -> 'Both hourly and salaried'", payTypeLabel("both") === "Both hourly and salaried");

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
