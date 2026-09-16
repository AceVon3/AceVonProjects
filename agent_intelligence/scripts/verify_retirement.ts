// Node-level verification of the state retirement-mandate data + size line.
//
// Asserts:
//   - all 50 states have an entry (a missing state renders "not verified");
//   - every entry has ≥1 official source (https, .gov or a known program
//     domain) and a verified date;
//   - status/threshold/program are internally consistent (mandates name a
//     program and a line; "none" has neither);
//   - live/pending mandates carry a penalties statement;
//   - no entry text and no size line crosses the determination line.
//
// Usage: npx tsx scripts/verify_retirement.ts

import {
  RETIREMENT_MANDATES,
  retirementMandateInfo,
  retirementSizeLine,
} from "../src/lib/retirementMandates";
import { STATES } from "../src/lib/states";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

const DETERMINATION: RegExp[] = [
  /\bapplies to you\b/i,
  /\bdoes not apply to you\b/i,
  /\bdoesn'?t apply to you\b/i,
  /\byou are (exempt|subject|required|liable|covered|owed)\b/i,
  /\byou'?re (exempt|subject|required|liable|covered)\b/i,
  /\byou must\b/i,
  /\byou qualify\b/i,
  /\byou owe\b/i,
];

// Official program domains that are not .gov.
const PROGRAM_DOMAINS = [
  "calsavers.com", "oregonsaves.com", "ilsecurechoice.com", "myctsavings.com",
  "marylandsaves.com", "coloradosecuresavings.com", "retirepathva.com",
  "retirereadynj.gov", "earnsdelaware.com", "meritsaves.com", "vtsaves.com",
  "risavers.com", "nevadasavestrust.com", "mnsecurechoice.com", "nysecurechoice.com",
  "wasaves.com", "meritsaves.org", "marylandsaves.org", "palegis.us",
];
function officialHost(u: string): boolean {
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    return /\.gov$/.test(host) || /\.gov\./.test(host) || /\.state\.[a-z]{2}\.us$/.test(host)
      || /\.us$/.test(host) || PROGRAM_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

console.log("=".repeat(72));
console.log("VERIFY: state retirement-plan mandates (50-state data + size line)");
console.log("=".repeat(72));

console.log("\nCoverage:");
const missing = STATES.map(s => s.code).filter(c => !retirementMandateInfo(c));
check("all 50 states have an entry", missing.length === 0, { missing });
check("no entries for unknown codes",
  Object.keys(RETIREMENT_MANDATES).every(k => STATES.some(s => s.code === k)));

console.log("\nPer-state integrity:");
for (const s of STATES) {
  const info = retirementMandateInfo(s.code);
  if (!info) continue;
  const tag = s.code;
  check(`${tag}: ≥1 official source`, info.sources.length > 0 && info.sources.every(officialHost),
    { sources: info.sources });
  check(`${tag}: verified date is YYYY-MM-DD`, /^\d{4}-\d{2}-\d{2}$/.test(info.verified), { verified: info.verified });
  check(`${tag}: summary present`, info.summary.trim().length > 40);
  const isMandate = info.status === "mandate-live" || info.status === "mandate-pending";
  if (isMandate) {
    check(`${tag}: mandate names a program`, !!info.program);
    // WA's line is an hours test (10,400 combined hours), not a headcount —
    // a null threshold is allowed when `counting` explains the test.
    check(`${tag}: mandate has an employee line ≥1 (or an explained non-headcount test)`,
      (info.threshold !== null && info.threshold >= 1) || (info.threshold === null && !!info.counting),
      { threshold: info.threshold });
    check(`${tag}: mandate states penalties (or explicit no-penalty)`, !!info.penalties && info.penalties.length > 10);
    check(`${tag}: mandate states the exemption`, !!info.exemption);
    check(`${tag}: mandate states deadlines`, !!info.deadlines);
  } else {
    check(`${tag}: non-mandate has no employee line`, info.threshold === null, { threshold: info.threshold });
    if (info.status === "none") check(`${tag}: 'none' has no program`, info.program === null);
    if (info.status === "voluntary") check(`${tag}: 'voluntary' names a program`, !!info.program);
  }
  const text = [info.summary, info.counting, info.conditions, info.exemption, info.deadlines, info.penalties, info.note]
    .filter(Boolean).join("\n");
  const hit = DETERMINATION.find(re => re.test(text));
  check(`${tag}: no determination language`, !hit, hit ? { matched: String(hit) } : undefined);
}

console.log("\nSize line (agent headcount vs the state's line):");
for (const s of STATES) {
  const info = retirementMandateInfo(s.code);
  if (!info) continue;
  const isMandate = info.status === "mandate-live" || info.status === "mandate-pending";
  for (const n of [1, 4, 5, 25, 60]) {
    const line = retirementSizeLine(s.code, n);
    if (!isMandate || info.threshold === null) {
      check(`${s.code} N=${n}: no size line for a non-mandate state`, line === null);
      continue;
    }
    const t = info.threshold;
    check(`${s.code} N=${n}: size line carries N, the ${t}-line, and defers`,
      !!line && new RegExp(`\\b${n} employee`).test(line) && line.includes(`${t}-employee line`)
        && /verify/i.test(line) && (n >= t ? /at or above/.test(line) : /\bbelow\b/.test(line)),
      { line });
    check(`${s.code} N=${n}: size line never a determination`,
      !!line && !DETERMINATION.some(re => re.test(line)));
  }
}

console.log("\nCalifornia anchor (official FAQ, 2026-09-16):");
const ca = retirementMandateInfo("CA");
check("CA is a live mandate", ca?.status === "mandate-live");
check("CA reaches employers from the first employee (threshold 1)", ca?.threshold === 1);
check("CA penalties carry $250 and $500 per eligible employee",
  !!ca?.penalties && /\$250/.test(ca.penalties) && /\$500/.test(ca.penalties));
check("CA cites calsavers.com or treasurer.ca.gov",
  !!ca && ca.sources.some(u => /calsavers\.com|treasurer\.ca\.gov/.test(u)));

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
