// Determination-language blocklist over the GROUNDED briefing summaries.
//
// The office briefing must report what the rules say in the third person
// ("Employers must…") and never make a per-reader legal determination
// ("you are exempt", "this applies to you", "you must…"). This scans every
// grounded briefing-topic summary for the built states (WA, ID, UT) against the
// same determination blocklist the office-summary pointers use — so the new
// states' content is held to the same honesty bar as WA, not just WA.
//
// Usage: npx tsx scripts/verify_briefing_language.ts

import { COMPLIANCE_SUMMARIES } from "../src/lib/complianceData";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

// The states that render a real briefing today, and the topics the briefing
// pulls. (wa_cares is WA-only but harmless to include — other states have no
// such entry.)
const BUILT_STATES = ["WA", "ID", "UT"];
const BRIEFING_TOPICS = new Set([
  "wage_hour",
  "salary_threshold",
  "leave",
  "wa_cares",
  "at_will",
  "business_tax",
]);

// The determination line — second-person legal conclusions a grounded summary
// must never cross. Identical in spirit to verify_office_summary's blocklist.
const DETERMINATION: RegExp[] = [
  /\bapplies to you\b/i,
  /\bdoes not apply to you\b/i,
  /\bdoesn'?t apply to you\b/i,
  /\byou are (exempt|subject|required|liable|covered|owed)\b/i,
  /\byou'?re (exempt|subject|required|liable|covered)\b/i,
  /\byou must\b/i,
  /\byou qualify\b/i,
  /\byou owe\b/i,
  /\bnot subject to\b/i,
];

console.log("=".repeat(72));
console.log("VERIFY: determination-language blocklist over grounded briefing summaries");
console.log("=".repeat(72));

const grounded = COMPLIANCE_SUMMARIES.filter(
  s => BUILT_STATES.includes(s.state) && BRIEFING_TOPICS.has(s.topic) && s.title && s.summary,
);

// Guard: the test is only meaningful if it actually scanned ID and UT content
// (not just WA) — otherwise a regression that drops ID/UT would pass silently.
for (const st of ["WA", "ID", "UT"]) {
  const n = grounded.filter(s => s.state === st).length;
  check(`scanned ${st} briefing content (>0 grounded entries)`, n > 0, { entries: n });
}

console.log("\nPer-entry scan (title + summary):");
for (const s of grounded) {
  const text = `${s.title}\n${s.summary}`;
  const hit = DETERMINATION.find(re => re.test(text));
  check(`${s.state}/${s.topic} — no determination language`, !hit,
    hit ? { matched: String(hit), text: text.slice(0, 160) } : undefined);
}

console.log(`\nScanned ${grounded.length} grounded briefing entries across ${BUILT_STATES.join(", ")}.`);
console.log("=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
