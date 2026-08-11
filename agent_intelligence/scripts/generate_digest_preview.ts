// Render a sample monthly digest to scratch/digest_preview.html for review.
//
// Usage: npx tsx scripts/generate_digest_preview.ts [runDate]
//   runDate (optional, YYYY-MM-DD) anchors the "last month + upcoming"
//   window; defaults to the data as-of date.
//
// The sample profile mirrors a realistic independent office (WA primary,
// employees in WA/OR/ID, sells three brands) — swap fields freely to
// preview other shapes (captive, other states).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildDigest, complianceSnapshot, type DigestProfile } from "../src/lib/digest";

const runDate = process.argv[2];

// Synthetic prior snapshot to demo the UPDATED callout: take the current
// snapshot and pretend one WA topic had different text last month. Real runs
// pass the persisted prior-month snapshot instead.
const prior = complianceSnapshot(["WA", "OR", "ID"]);
const demoKey = Object.keys(prior).find(k => k.startsWith("WA|"));
if (demoKey) prior[demoKey] = { ...prior[demoKey], summary: "(previous month's text)" };

const sample: DigestProfile = {
  agent: {
    agent_type: "independent",
    authorized_brands: ["State Farm", "Travelers", "Progressive"],
    licensed_states: ["WA", "OR", "ID"],
  },
  employee_count: 20,
  employee_states: ["WA", "OR", "ID"],
  first_name: "Ryan",
};

const d = buildDigest(sample, { runDate, priorCompliance: prior });
mkdirSync(path.join(process.cwd(), "scratch"), { recursive: true });
const out = path.join(process.cwd(), "scratch", "digest_preview.html");
writeFileSync(out, d.html, "utf-8");
console.log("subject:", d.subject);
console.log("counts:", d.counts);
console.log("->", out);
