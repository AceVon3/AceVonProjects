// Verifies the headline-signals synthesis layer (src/lib/signals.ts) against
// the real DB, for the same canonical profiles verify_positioning.ts uses.
// Node-only. Two halves:
//
//   1. Invariant checks (pass/fail): caps, threshold floors, scope rules
//      (price-pressure brands are never the agent's own; defend/trend states
//      stay inside the licensed set), and the determination-language
//      blocklist from e2e_positioning applied to every label + detail.
//   2. A printout of the ACTUAL signals produced — the human-review half:
//      read them and confirm they'd make sense to an agent.
//
// Usage:  npx tsx scripts/verify_signals.ts

import type { AgentProfile } from "../src/lib/filings";
import {
  getDefendFilings,
  getMyCarriersFilings,
  getProspectFilings,
} from "../src/lib/filings";
import { getDataAsOf } from "../src/lib/db";
import { getPositioning } from "../src/lib/positioning";
import {
  computePositioningSignals,
  computeRecentSignals,
  FAVORABLE_SPREAD_MIN,
  MAX_SIGNALS,
  Signal,
  TREND_MIN_ABS,
} from "../src/lib/signals";
import { DEFEND_THRESHOLD, PROSPECT_THRESHOLD } from "../src/lib/constants";

// Same blocklist e2e_positioning enforces on the explainer.
const DETERMINATION: RegExp[] = [
  /\byou are (exempt|subject|required|liable|covered|owed|cheaper)\b/i,
  /\byou'?re (exempt|subject|required|liable|covered|cheaper)\b/i,
  /\bswitch to\b/i,
  /\b(cheapest|guaranteed)\b/i,
];

const ALL_8 = ["AZ", "CO", "ID", "MT", "NV", "OR", "UT", "WA"];

let failures = 0;
function check(label: string, ok: boolean, ctx?: unknown) {
  if (!ok) failures++;
  console.log(`  [${ok ? "OK  " : "FAIL"}] ${label}${ok || ctx === undefined ? "" : ` ${JSON.stringify(ctx)}`}`);
}

function printSignals(title: string, signals: Signal[]) {
  console.log(`\n${title} — ${signals.length} signal(s):`);
  for (const s of signals) {
    console.log(`    [${s.kind}] (${s.tone}, mag ${s.magnitude.toFixed(1)}) ${s.label}`);
    console.log(`        ${s.detail}  -> ${s.href}`);
  }
  if (signals.length === 0) console.log("    (none)");
}

function invariants(name: string, signals: Signal[], profile: AgentProfile) {
  const own = new Set<string>(profile.authorized_brands);
  check(`${name}: capped at ${MAX_SIGNALS}`, signals.length <= MAX_SIGNALS);
  check(`${name}: no determination language`,
    !signals.some(s => DETERMINATION.some(re => re.test(`${s.label} ${s.detail}`))),
    signals.filter(s => DETERMINATION.some(re => re.test(`${s.label} ${s.detail}`))).map(s => s.label));
  check(`${name}: price-pressure never names an own brand`,
    signals.filter(s => s.kind === "price-pressure").every(s => !own.has(s.brand!)));
  check(`${name}: trend always names an own brand`,
    signals.filter(s => s.kind === "trend").every(s => own.has(s.brand!)));
  check(`${name}: states stay inside the licensed set`,
    signals.every(s => s.state === undefined || profile.licensed_states.includes(s.state)));
  check(`${name}: magnitudes respect their floors`,
    signals.every(s =>
      (s.kind !== "price-pressure" || s.magnitude >= PROSPECT_THRESHOLD) &&
      (s.kind !== "favorable-spread" || s.magnitude >= FAVORABLE_SPREAD_MIN) &&
      (s.kind !== "trend" || s.magnitude >= Math.min(TREND_MIN_ABS, Math.abs(DEFEND_THRESHOLD)))));
}

const captive: AgentProfile = {
  agent_type: "captive",
  captive_brand: "State Farm",
  authorized_brands: ["State Farm"],
  licensed_states: ALL_8,
};

const independent: AgentProfile = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers", "Progressive"],
  licensed_states: ALL_8,
};

console.log("=".repeat(72));
console.log("VERIFY: headline signals (positioning-derived + recency-driven)");
console.log("=".repeat(72));
const asOf = getDataAsOf();
console.log(`Data as of ${asOf}\n`);

for (const [name, profile] of [["Captive State Farm", captive], ["Independent SF+Trav+Prog", independent]] as const) {
  console.log("-".repeat(72));
  console.log(`${name}, states ${profile.licensed_states.join(",")}`);

  // Positioning strip — fed the AUTO-ONLY view, exactly as the page passes it.
  const result = getPositioning(profile);
  const autoView = {
    ...result,
    anchoredCells: result.anchoredCells.filter(c => c.line === "Personal Auto"),
    unanchoredCells: result.unanchoredCells.filter(c => c.line === "Personal Auto"),
  };
  const posSignals = computePositioningSignals(autoView);
  printSignals("POSITIONING strip (auto-only view)", posSignals);
  invariants(`${name} positioning`, posSignals, profile);

  // Overview strip — the exact row sets the dashboard fetches.
  const recent = computeRecentSignals({
    prospect: getProspectFilings(profile),
    defend: getDefendFilings(profile),
    myCarriers: getMyCarriersFilings(profile),
    asOf,
    authorizedBrands: profile.authorized_brands,
  });
  printSignals("OVERVIEW strip (recent signals)", recent);
  invariants(`${name} overview`, recent, profile);
}

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED — review the printed signals for sense.");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
