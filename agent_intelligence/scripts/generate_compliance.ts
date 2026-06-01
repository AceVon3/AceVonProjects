#!/usr/bin/env node
// Regenerates src/lib/complianceData.ts from the official .gov source URLs
// in src/lib/resourceUrls.ts.
//
// For each (state, topic) with mapped URLs:
//   1. Fetch every URL with a timeout
//   2. Strip HTML → plain text, clipped to a budget per source
//   3. Call Claude Sonnet 4.6 with a strict-grounding SYSTEM_PROMPT
//   4. Receive {title, summary} as JSON, validated against SUMMARY_SCHEMA
//   5. Write all successful results to complianceData.ts atomically
//
// The web app reads only complianceData.ts — it never fetches official
// pages at view time. Regeneration is a build-time / monthly batch.
//
// Grounding is enforced two ways: the system prompt forbids using model
// knowledge, and JSON-schema output keeps the model from going off-format.
// The system prompt is reused across every call, so it's marked with
// cache_control: ephemeral — the marker is a no-op when the prompt is
// under Sonnet 4.6's 2048-token cache minimum but future-proofs the rubric
// as it grows.
//
// Usage:
//   Full regen:    ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate_compliance.ts
//   Partial regen: ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate_compliance.ts \
//                    --only WA/payroll,WA/nexus
//
// With --only, the script loads the existing complianceData.ts, regenerates
// only the matching (state, topic) entries, and merges the result back in.
// Entries outside the filter are preserved untouched. If a regenerated entry
// fails (all sources unreachable, etc.) the previous entry is dropped, so
// the page renders the coming-soon fallback for it.
//
// If ANTHROPIC_API_KEY is unset, exits 0 without touching the existing
// complianceData.ts seed — local dev / CI without keys keeps building.
//
// Grounding-refusal handling: when the model output matches a refusal
// pattern (the prompt instructs it to say so when the source pages don't
// contain enough substantive content), the entry is stored with null
// title and summary so ComplianceCard renders the coming-soon variant
// rather than displaying a meaningless "cannot summarize" body.

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import path from "node:path";

import {
  RESOURCE_URLS,
  ResourceKey,
  StateCode,
} from "../src/lib/resourceUrls";

// ---- config ---------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_TEXT_CHARS_PER_SOURCE = 20_000; // clip long pages for token budget

// JSON-schema output. `additionalProperties: false` is required for
// structured outputs to keep the model from inventing extra keys.
const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "6-12 words describing what the summary covers (e.g. 'Washington Paid Family & Medical Leave'). Not just the topic category.",
    },
    summary: {
      type: "string",
      description:
        "2-4 short, plain-language sentences. Maximum 100 words. Include source-stated figures where relevant; no URLs, no jargon, no inferred numbers.",
    },
  },
  required: ["title", "summary"],
  additionalProperties: false,
} as const;

// The grounding contract. This is the load-bearing artifact of the whole
// compliance feature — every change here changes what summaries the model
// is allowed to produce. Keep both ABSOLUTE RULE blocks intact.
const SYSTEM_PROMPT = `You are summarizing official US government compliance pages for an insurance agent's reference site. The summaries you write are presented to licensed insurance professionals who may make business decisions based on them. Two rules are absolute and override every other instruction.

ABSOLUTE RULE 1 — STRICT GROUNDING.
Write the summary using ONLY information present in the provided source pages. Do NOT use prior knowledge of US laws, federal rules, state statutes, regulatory bodies, deadlines, percentages, dollar amounts, or anything else — even if you know facts that would improve the summary. If a fact is not in the source pages, it does not exist for the purposes of this summary. If the sources contradict each other, summarize only what they agree on or omit the contested point entirely.

ABSOLUTE RULE 2 — NO INFERENCE OR HALLUCINATION OF NUMBERS.
Do not infer or supply from prior knowledge: dollar amounts, percentage rates, contribution splits, employee-count thresholds, time periods (weeks/days/months), effective dates, or any other numeric fact. Every number in your summary must appear verbatim in the source pages. If a specific number is not stated explicitly in the source text, do not include any number in its place. BUT when the source DOES state a specific current figure (a dollar amount, wage, rate, or threshold), INCLUDE that exact figure with its context — grounded figures the source provides are wanted, not omitted. Quote the source's number; never round, average, or guess one.

OUTPUT REQUIREMENTS.
- Write a descriptive TITLE (6-12 words) describing what the summary covers — not the topic category alone. So "Washington Paid Family & Medical Leave", not just "Leave Laws".
- Write a SUMMARY: 2-4 short, plain sentences. Maximum 100 words total. Include the specific current figures the source states (wage, rate, threshold) where relevant. No URLs, no citation markers, no jargon.
- Address employers/agents in the third person ("Employers must..."), not "you".

If the source pages do not contain enough substantive content to write a grounded summary, return a summary that says exactly: "The official source page is available, but a grounded summary cannot be produced from its current contents." The title in that case should be the state name plus topic category (e.g. "Washington Wage & Hour").`;

// ---- helpers --------------------------------------------------------------

const STATE_NAMES: Record<StateCode, string> = {
  AZ: "Arizona", CO: "Colorado", ID: "Idaho", MT: "Montana",
  NV: "Nevada", OR: "Oregon", UT: "Utah", WA: "Washington",
};

const TOPIC_LABELS: Record<ResourceKey, string> = {
  wage_hour: "Wage & Hour",
  leave: "Leave Laws",
  payroll: "Payroll",
  workers_comp: "Workers' Compensation",
  termination: "Termination",
  nexus: "Nexus & Licensing",
  hiring: "Hiring Basics",
  remote: "Remote Work",
  // Office-briefing topics (Feature 9)
  salary_threshold: "Salary & Exempt Thresholds",
  wa_cares: "WA Cares (Long-Term Care)",
  at_will: "At-Will Termination",
  business_tax: "Business Tax (B&O)",
};

// Per-topic extra grounding constraints, appended to the user message for
// specific briefing topics. These ADD to (never relax) the absolute rules in
// SYSTEM_PROMPT. Topics not listed get no extra instruction.
//
// REVERSAL (2026-06-01): the briefing now SHOWS concrete figures (with
// disclaimers in the UI). So include the source-stated numbers — still
// grounded only in the fetched pages, never invented.
const EXTRA_GUIDANCE: Partial<Record<ResourceKey, string>> = {
  // Minimum wage & overtime — the dollar wage and the overtime multiple.
  wage_hour:
    "INCLUDE the current Washington minimum wage dollar amount and the overtime pay multiple (e.g. 1.5x over 40 hours) exactly as the source states them. Quote the source's figures verbatim.",
  // Salary/exempt threshold — INCLUDE the figure AND show the formula for
  // transparency. Only SOURCE-stated numbers (multiplier, minimum wage,
  // weekly result); the UI derives the annual (weekly × 52) and carries the
  // strong inline misclassification warning.
  salary_threshold:
    "INCLUDE the current overtime-exempt WEEKLY salary figure AND show how it is derived, as a transparent formula using ONLY numbers the L&I source states: minimum exempt salary = the multiplier × the state minimum wage × 40 hours per week. Show the multiplication explicitly with the current numbers and the weekly result the source gives (for example '2.25 × $[wage] × 40 = $[weekly] per week'). Note the multiplier and minimum wage are set by L&I and update every January 1, and say whether the small (1-50) and large (51+) employer thresholds currently match or differ. Every number must come verbatim from the source; the multiplications are arithmetic shown for transparency. Do NOT state an annual salary figure — the app derives the yearly amount from the weekly figure.",
  // PFML — premium rate / employer-employee split if the source states it.
  leave:
    "If the source states the current Paid Family & Medical Leave premium rate (a percentage of wages) or the employer/employee share split, INCLUDE it exactly as stated. Also keep the paid-sick-leave accrual rate if the source gives it.",
  // WA Cares — the premium rate as a percentage of gross wages.
  wa_cares:
    "INCLUDE the current WA Cares premium rate (the percentage of each employee's gross wages) exactly as the source states it.",
  // B&O — representative rate(s) by classification; many exist, so use what
  // the source gives without inventing.
  business_tax:
    "If the source states specific Business & Occupation (B&O) tax rates by business classification, INCLUDE the main rate(s) exactly as stated; if many rates are listed, give a representative rate or the range the source provides. Do not invent a rate the source does not state.",
  // The at-will summary MUST carry the exceptions, not just the headline.
  at_will:
    "CRITICAL FOR THIS TOPIC: The summary MUST convey BOTH halves of the rule. (1) Washington is an at-will employment state — an employer generally may end employment at any time, without cause and without advance notice. (2) BUT it must ALSO state the key exceptions present in the source: an employer may NOT terminate for an unlawful or protected reason — such as discrimination against a protected class, retaliation for exercising a protected right or filing a complaint, or for using protected leave. Never present at-will without its exceptions; an exceptions-light summary is unacceptable.",
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPageText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "agent-intelligence/compliance-generator (insurance agent reference)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) {
      console.error(`  fail  ${url}  HTTP ${resp.status}`);
      return null;
    }
    const html = await resp.text();
    const text = stripHtml(html);
    if (text.length < 100) {
      console.error(`  fail  ${url}  stripped text <100 chars (likely JS-rendered)`);
      return null;
    }
    return text.slice(0, MAX_TEXT_CHARS_PER_SOURCE);
  } catch (e) {
    console.error(`  fail  ${url}  ${(e as Error)?.message ?? e}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type GeneratedSummary = {
  state: StateCode;
  topic: ResourceKey;
  // null when the model declined to ground a summary on the fetched
  // source content — page renders coming-soon for those.
  title: string | null;
  summary: string | null;
  sources: string[];
  last_checked: string;
};

// Phrase patterns that indicate the model declined to produce a grounded
// summary (most often because the source page is generic and doesn't
// cover the topic). The prompt instructs an exact phrase, but the model
// frequently rephrases — so match the load-bearing parts liberally.
const REFUSAL_PATTERNS: RegExp[] = [
  /cannot be produced/i,
  /can(?:not|'t) be summari[sz]ed/i,
  /not contain (?:substantive )?content/i,
  /does not (?:contain|have) (?:substantive )?(?:specific )?content/i,
  /insufficient (?:source |substantive )?content/i,
  /unable to (?:produce|write|summari[sz]e)/i,
];

function isGroundingRefusal(summary: string): boolean {
  return REFUSAL_PATTERNS.some(p => p.test(summary));
}

async function generateOne(
  client: Anthropic,
  state: StateCode,
  topic: ResourceKey,
  urls: string[],
  today: string,
): Promise<GeneratedSummary | null> {
  const sources: Array<{ url: string; text: string }> = [];
  for (const url of urls) {
    const text = await fetchPageText(url);
    if (text) sources.push({ url, text });
  }
  if (sources.length === 0) {
    console.error(`  skip  ${state}/${topic}: all sources failed`);
    return null;
  }

  // User content: delimited source pages, then the (state, topic) anchor.
  const sourceBlocks = sources
    .map(s => `<<<URL: ${s.url}\n${s.text}\n>>>`)
    .join("\n\n");
  const extra = EXTRA_GUIDANCE[topic];
  const userText =
    `${sourceBlocks}\n\n` +
    `STATE: ${STATE_NAMES[state]}\n` +
    `TOPIC CATEGORY: ${TOPIC_LABELS[topic]}\n\n` +
    (extra ? `${extra}\n\n` : "") +
    `Produce the title + summary as JSON, grounded strictly in the source pages above.`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" }, // grounded summarization — no reasoning gain
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SUMMARY_SCHEMA },
    },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userText }],
  });

  const textBlock = resp.content.find(b => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error(`  fail  ${state}/${topic}: no text block in response`);
    return null;
  }

  let parsed: { title: string; summary: string };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    console.error(
      `  fail  ${state}/${topic}: invalid JSON (${textBlock.text.slice(0, 200)})`,
    );
    return null;
  }

  const u = resp.usage;
  const refused = isGroundingRefusal(parsed.summary);
  console.error(
    `  ${refused ? "refused" : "ok    "} ${state}/${topic}  in=${u.input_tokens} cached=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens}` +
    (refused ? "  (model declined to ground — coming-soon)" : ""),
  );

  return {
    state,
    topic,
    title: refused ? null : parsed.title,
    summary: refused ? null : parsed.summary,
    sources: sources.map(s => s.url),
    last_checked: today,
  };
}

function writeComplianceData(results: GeneratedSummary[]): void {
  const today = new Date().toISOString().slice(0, 10);
  const body = `// AUTO-GENERATED by scripts/generate_compliance.ts on ${today}.
//
// Do NOT hand-edit. Re-run \`npx tsx scripts/generate_compliance.ts\` to
// refresh from official sources. The web app reads this file only; it
// never fetches official pages live.

import type { ResourceKey, StateCode } from "./resourceUrls";

export type ComplianceSummary = {
  state: StateCode;
  topic: ResourceKey;
  // null when the model declined to produce a grounded summary from
  // the fetched source pages. ComplianceCard renders these entries
  // as the "Summary coming soon" coming-soon variant.
  title: string | null;
  summary: string | null;
  sources: string[];
  last_checked: string;
};

export const COMPLIANCE_SUMMARIES: ComplianceSummary[] = ${JSON.stringify(results, null, 2)};
`;
  const outPath = path.resolve(process.cwd(), "src/lib/complianceData.ts");
  writeFileSync(outPath, body, "utf-8");
  console.error(`\nwrote ${results.length} summaries → ${outPath}`);
}

// ---- main -----------------------------------------------------------------

// Parse `--only state/topic[,state/topic...]` into a Set, or null if absent.
function parseOnlyFlag(argv: string[]): Set<string> | null {
  const idx = argv.indexOf("--only");
  if (idx < 0 || !argv[idx + 1]) return null;
  const items = argv[idx + 1]
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return items.length > 0 ? new Set(items) : null;
}

async function loadExistingSummaries(): Promise<GeneratedSummary[]> {
  // Dynamic import the current complianceData.ts so partial regens merge
  // back into the existing array instead of clobbering unfiltered entries.
  const mod = await import("../src/lib/complianceData");
  // Older committed shapes had non-null title/summary; the cast widens
  // those to the nullable shape we use now.
  return mod.COMPLIANCE_SUMMARIES as GeneratedSummary[];
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.");
    console.error(
      "Exiting without regenerating — the existing complianceData.ts is preserved.",
    );
    process.exit(0);
  }

  const onlyFilter = parseOnlyFlag(process.argv);

  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);

  // Partial regen: seed `results` with existing entries that are OUTSIDE
  // the filter so they survive untouched. Entries that match the filter
  // are removed (and re-added below only if regeneration succeeds).
  let results: GeneratedSummary[] = [];
  if (onlyFilter) {
    try {
      const existing = await loadExistingSummaries();
      results = existing.filter(r => !onlyFilter.has(`${r.state}/${r.topic}`));
      console.error(
        `Partial regen: --only ${Array.from(onlyFilter).join(", ")}\n` +
        `  preserved ${results.length} existing entries; regenerating ${onlyFilter.size} target(s).\n`,
      );
    } catch (e) {
      console.error("FATAL: --only requires a readable src/lib/complianceData.ts;");
      console.error("       could not import it:", e);
      process.exit(1);
    }
  } else {
    console.error(
      `Full regen (model: ${MODEL}, asOf: ${today})\n`,
    );
  }

  for (const [state, topics] of Object.entries(RESOURCE_URLS) as Array<
    [StateCode, Partial<Record<ResourceKey, string[]>>]
  >) {
    for (const [topic, urls] of Object.entries(topics) as Array<
      [ResourceKey, string[]]
    >) {
      if (!urls || urls.length === 0) continue;
      if (onlyFilter && !onlyFilter.has(`${state}/${topic}`)) continue;
      console.error(`${state}/${topic}: fetching ${urls.length} source(s)`);
      try {
        const result = await generateOne(client, state, topic, urls, today);
        if (result) results.push(result);
      } catch (e) {
        console.error(`  error ${state}/${topic}:`, e);
      }
    }
  }

  if (results.length === 0) {
    console.error("\nno summaries to write — leaving complianceData.ts unchanged.");
    process.exit(1);
  }

  // Stable sort so partial regens don't churn the file order in diffs.
  results.sort((a, b) => {
    if (a.state !== b.state) return a.state.localeCompare(b.state);
    return a.topic.localeCompare(b.topic);
  });

  writeComplianceData(results);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
