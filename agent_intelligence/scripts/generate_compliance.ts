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
import { STATES } from "../src/lib/states";

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

// Full-name lookup sourced from the app's canonical 50-state list, so the
// generator never drifts from states.ts as coverage expands.
const STATE_NAMES: Record<StateCode, string> = Object.fromEntries(
  STATES.map(s => [s.code, s.name]),
) as Record<StateCode, string>;

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
  // Generic across all 50 states — the per-state guidance profile carries the
  // state's actual structure (WA B&O gross receipts, OH CAT, TX margin, ...).
  business_tax: "Business Tax",
  // 50-state expansion: state disability insurance / paid-leave premium
  // programs / retirement mandates. Only mapped where a state runs one.
  state_programs: "State Employer Programs",
};

// Per-topic extra grounding constraints, appended to the user message for
// specific briefing topics. These ADD to (never relax) the absolute rules in
// SYSTEM_PROMPT. Topics not listed get no extra instruction.
//
// REVERSAL (2026-06-01): the briefing now SHOWS concrete figures (with
// disclaimers in the UI). So include the source-stated numbers — still
// grounded only in the fetched pages, never invented.
//
// MULTI-STATE (2026-06): guidance is now per-STATE as well as per-topic, since
// states differ structurally (WA sets its own salary threshold and has PFML/WA
// Cares; ID/UT follow federal and have no state leave program). WA keeps its
// exact guidance below; federal-default states (ID, UT) use FEDERAL_DEFAULT_*.
// Selected via getExtraGuidance(state, topic). New states must add their own
// profile here before being mapped in resourceUrls.ts.
const WA_EXTRA_GUIDANCE: Partial<Record<ResourceKey, string>> = {
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
  // B&O — surface the INSURANCE-commissions classification rate specifically,
  // framed for an insurance-agency audience, with the classification-specific
  // caveat. The classifications source page lists it as a decimal (.00484).
  business_tax:
    "The audience is an insurance agency. From the source classifications page, INCLUDE the specific B&O tax rate for the 'Insurance Agents/Insurance Brokers Commissions' classification — the rate that applies to insurance agent/broker commission income — exactly as the source states it. If the source gives the rate as a decimal (e.g. .00484), express it as the equivalent percentage (0.484%) since that is the same number. Frame it plainly: insurance agent/broker commissions are taxed at that rate under that B&O classification. Then add that B&O is a gross-receipts tax and that rates are CLASSIFICATION-SPECIFIC — an agency with other revenue may fall under other classifications with different rates, so they should confirm their classification(s) with DOR. Every number must come verbatim from the source.",
  // The at-will summary MUST carry the exceptions, not just the headline.
  at_will:
    "CRITICAL FOR THIS TOPIC: The summary MUST convey BOTH halves of the rule. (1) Washington is an at-will employment state — an employer generally may end employment at any time, without cause and without advance notice. (2) BUT it must ALSO state the key exceptions present in the source: an employer may NOT terminate for an unlawful or protected reason — such as discrimination against a protected class, retaliation for exercising a protected right or filing a complaint, or for using protected leave. Never present at-will without its exceptions; an exceptions-light summary is unacceptable.",
};

// Federal-default states (ID, UT): follow federal minimum wage, overtime, and
// the FLSA exempt-salary threshold; have NO state paid-leave program; tax
// business INCOME (net profit), not gross receipts. The guidance frames these
// honestly without inventing figures — the absolute grounding rules still
// apply, so a figure prints only if a fetched source states it.
const FEDERAL_DEFAULT_GUIDANCE: Partial<Record<ResourceKey, string>> = {
  // Minimum wage & overtime — the summary MUST cover BOTH halves. The wage
  // half alone is not enough; the overtime half (incl. a "no state OT law →
  // federal FLSA" statement when the source says so) is required.
  wage_hour:
    "The summary MUST cover BOTH (1) minimum wage and (2) overtime — do not omit the overtime half. (1) MINIMUM WAGE: INCLUDE the minimum wage dollar amount the source states; if the source says the state follows the federal minimum wage, state that plainly with the figure (for example, 'follows the federal minimum wage, $7.25 per hour'). (2) OVERTIME: INCLUDE the overtime rule the source states. If the source says the state has NO state overtime law and that overtime is governed by the federal Fair Labor Standards Act, state that plainly — that the state has no separate overtime law and overtime follows the federal FLSA at one-and-one-half times the regular rate for hours worked over 40 in a workweek. Quote the source's figures verbatim; do not add any number not in the source.",
  // Salary/exempt threshold — federal-follower framing, dated + hedged, NO
  // confident permanent number, NO annual (the UI frames that).
  salary_threshold:
    "This state has NO state-specific overtime-exempt salary threshold; the white-collar (executive/administrative/professional) exemption follows the FEDERAL FLSA salary level. State plainly that the state follows the federal threshold. INCLUDE the federal weekly salary figure ONLY if a source states it (for example '$684 per week'), and present it as the federal figure as of the source — NOT as a settled permanent number — noting the federal level has changed and been subject to legal challenge, so the current figure should be confirmed with the U.S. Department of Labor. Do NOT state an annual figure. If no source states a current federal weekly figure, omit the number entirely and say the state follows the federal threshold, which should be confirmed with the U.S. Department of Labor — never supply a number from prior knowledge.",
  // Leave — there is NO state program; surface federal FMLA from the FMLA
  // source. Don't manufacture a state program.
  leave:
    "This state has NO state-specific paid family/medical leave program and NO state paid-sick-leave mandate. State that plainly. Then, using ONLY the federal FMLA source, summarize the federal FMLA coverage it states — the covered-employer employee-count threshold and the weeks of unpaid, job-protected leave — and frame FMLA clearly as a FEDERAL law that may apply to larger employers. Do NOT invent a state leave program, and do NOT state any figure that is not in the sources.",
  // At-will — same two-halves requirement as WA, generalized to this state.
  // If the source doesn't actually establish at-will + exceptions, refuse
  // (the UI then shows coming-soon — that is the intended, honest fallback).
  at_will:
    "CRITICAL FOR THIS TOPIC: The summary MUST convey BOTH halves of the rule, and BOTH must be supported by the source. (1) This state is an at-will employment state — an employer generally may end employment at any time, without cause and without advance notice. (2) AND the key exceptions the source states: an employer may NOT terminate for an unlawful or protected reason — such as discrimination, retaliation for exercising a protected right, or a violation of public policy. Never present at-will without its exceptions. If the source pages do NOT actually establish that this state is at-will and state its exceptions, do not produce a summary (return the cannot-summarize response).",
  // Business tax — income on NET PROFIT, pass-through framing, NOT a single
  // gross-receipts-style 'your rate'.
  business_tax:
    "The audience is an insurance agency. This state taxes business INCOME (net profit), NOT gross receipts — there is no B&O-style single rate on commission revenue. Explain plainly that an agency pays state income tax on its net profit, and that agencies organized as pass-through entities (LLC / S-corporation / partnership) generally have that income flow through to the owner's personal return rather than paying a single business tax rate. You MAY note that the state has a corporate income tax (and its rate) for context if the source states it, but make clear that is not necessarily the agency's effective rate, and the agency should confirm its situation with a tax professional. Do NOT present a single actionable 'your rate' figure. Every number must come verbatim from the source.",
};

// Per-state guidance profiles. WA is bespoke; ID/UT share the federal-default
// profile. States not listed get no extra guidance (and currently have no
// mapped URLs). A new state with its own structure (e.g. CO's own salary
// threshold, OR's regional wages) needs its own profile added here.
// Utah business tax needs a sharper distinction than the generic federal-
// default framing: the $100 minimum privilege tax is a CORPORATE (C-corp)
// franchise-tax minimum, NOT a general obligation — it must never read as
// something a sole-proprietor / pass-through owner owes. This overrides the
// shared business_tax guidance for UT only (Idaho keeps the generic one).
const UT_BUSINESS_TAX_GUIDANCE =
  "The audience is an insurance agency. Utah taxes business INCOME (net profit), NOT gross receipts — there is no B&O-style single rate on commission revenue. You MUST clearly DISTINGUISH two separate taxes, because which one applies depends entirely on the agency's entity structure: (a) INDIVIDUAL income tax — a flat rate (use the exact percentage the source states) that applies to the OWNERS of pass-through entities and sole proprietorships (LLCs, S corporations, partnerships, sole props), whose business income flows through to their personal return; (b) CORPORATE franchise/income tax — applies specifically to C CORPORATIONS, at the corporate rate the source states, and carries a minimum privilege (franchise) tax of the dollar amount the source states (e.g. $100). CRITICAL: do NOT present that minimum privilege tax as a general, universal, or per-business obligation — it applies ONLY to C corporations, NOT to sole proprietors or pass-through owners. Make explicit that which tax applies depends on the agency's entity structure, and that this is exactly why the agency should confirm its situation with a qualified tax professional. Every number must come verbatim from the source.";

const GUIDANCE_BY_STATE: Partial<Record<StateCode, Partial<Record<ResourceKey, string>>>> = {
  WA: WA_EXTRA_GUIDANCE,
  ID: FEDERAL_DEFAULT_GUIDANCE,
  UT: { ...FEDERAL_DEFAULT_GUIDANCE, business_tax: UT_BUSINESS_TAX_GUIDANCE },
};

// --- 50-state expansion (2026-07): universal per-topic guidance -------------
//
// States beyond WA/ID/UT get SOURCE-DRIVEN guidance: instead of classifying
// each state by hand (own-threshold vs federal-default vs program state — a
// drift hazard across 47 states), each topic's guidance instructs the model
// to follow whichever structure the fetched official pages establish. The
// absolute grounding rules still bind: no figure prints unless a source
// states it. WA/ID/UT keep their bespoke profiles so their shipped summaries
// don't churn.
const UNIVERSAL_GUIDANCE: Partial<Record<ResourceKey, string>> = {
  wage_hour:
    "The summary MUST cover BOTH (1) minimum wage and (2) overtime. (1) If the state sets its own minimum wage, INCLUDE the current dollar amount exactly as the source states it, plus any scheduled increase the source gives. If the source says the state follows the federal minimum wage (or has no state minimum wage law), state that plainly with the federal figure only if a source states it. (2) INCLUDE the overtime rule the source states — the multiplier and the weekly (and any daily) trigger. If the state has no overtime law and follows the federal FLSA, say so plainly. Note any unusual rule the source states (daily overtime, seventh-day pay, no tip credit). Quote figures verbatim; never supply one from prior knowledge.",
  salary_threshold:
    "Determine from the sources which regime applies. If the state sets its OWN overtime-exempt salary threshold, INCLUDE the state weekly (or monthly) figure exactly as the source states it, note when it updates if the source says so, and — only if the sources support it — note that it exceeds the federal floor. Do NOT state an annual figure; the app derives it. If the state follows the federal FLSA threshold, state that plainly; include the federal weekly figure ONLY if a source states it, presented as the figure as of the source (the federal level has changed and been litigated), deferring confirmation to the U.S. Department of Labor. Never supply a number from prior knowledge.",
  leave:
    "Determine from the sources what the state actually mandates. If the state runs a paid sick leave mandate and/or a paid family-medical leave premium program, summarize each with the source-stated accrual rate, annual caps, contribution rate and employer/employee split, and any employer-size threshold — exactly as stated, clearly distinguishing the programs if there are two. If the state has NO state leave program, say that plainly, then summarize the federal FMLA from the FMLA source, framed clearly as a FEDERAL law that may apply to larger employers. Do not manufacture a program the sources don't establish.",
  at_will:
    "CRITICAL FOR THIS TOPIC: If the sources establish the state follows at-will employment, the summary MUST convey BOTH halves: (1) employment may generally be ended at any time without cause or notice, AND (2) the exceptions the source states — discrimination, retaliation for protected activity, violations of public policy. Never present at-will without its exceptions. EXCEPTION — if the sources establish the state does NOT follow at-will (Montana's Wrongful Discharge from Employment Act), summarize the actual standard instead: the probationary period and the good-cause requirement after it, as the source states them. If the sources do not actually establish the state's termination doctrine, return the cannot-summarize response.",
  business_tax:
    "The audience is an insurance agency. Describe the state's business tax STRUCTURE as the sources present it — which may be a corporate income tax, a gross-receipts tax, a franchise/margin/net-worth tax, a combination, or no income-based tax at all. Distinguish what applies to C corporations versus pass-through entities (LLCs, S corporations, partnerships) whose income flows to owners' personal returns. Include the rates, minimums, and thresholds the sources state, exactly as stated. If the sources give a classification or rate that applies specifically to insurance agency/commission revenue, surface it. Do not present a single 'your rate' figure unless the source itself frames one that way; close by deferring the agency's specific situation to a tax professional. Every number must come verbatim from the source.",
  state_programs:
    "Summarize the state-run employer program(s) the sources establish — disability insurance (TDI/SDI/DBL), a paid-leave premium program, a state retirement-savings mandate, or similar. For each: what it is, who must participate (include the employer-size or other threshold the source states), the contribution rate and employer/employee split as stated, and key deadlines the source gives. If a program is new or mid-rollout and the source says dates are staggered or subject to change, say so and defer to the source. Do not blend distinct programs into one; never supply a figure the sources don't state.",
  workers_comp:
    "Summarize the state's workers' compensation coverage requirement for employers: who must carry it and any employee-count or industry threshold the source states, how coverage is obtained (private insurers, competitive/monopolistic state fund, or self-insurance) as the source presents it, and any notable exemption. If the source establishes that coverage is elective/optional in this state, say that plainly and note what non-subscribing means if stated.",
  payroll:
    "Summarize the state's employer payroll obligations as the sources present them: unemployment-insurance registration and quarterly wage reporting/tax payment, plus any other employer withholding obligation the sources cover. Include the taxable wage base and rate details ONLY if a source states them.",
  termination:
    "Summarize the state's separation obligations as the sources present them: final-paycheck timing rules (include the deadline the source states, distinguishing quit vs discharge if it does), plus any state WARN-style mass-layoff notice requirement the sources cover, including its size threshold as stated.",
  nexus:
    "The audience is an insurance agency. Summarize insurance producer/agency licensing in this state as the sources present it: that a license is required to sell or adjust insurance, how licenses are obtained or renewed (state portal or NIPR) as stated, and continuing-education or renewal obligations the source states. Include business-registration basics only if a source covers them.",
  hiring:
    "Summarize the employer obligations when hiring in this state as the sources present them: new-hire reporting (to whom and the deadline the source states), plus core employment-standards obligations the sources cover. Do not include federal I-9/E-Verify rules unless a source states them.",
  remote:
    "Frame this for an agency employing someone who works remotely in this state: the state's employment rules generally apply based on where the employee performs the work. Summarize the standards-hub obligations the sources present (wage, leave, protections) as applying to employees working in the state regardless of where the employer sits. Only source-stated specifics.",
};

function getExtraGuidance(state: StateCode, topic: ResourceKey): string | undefined {
  return GUIDANCE_BY_STATE[state]?.[topic] ?? UNIVERSAL_GUIDANCE[topic];
}

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

// Fallback for hosts Node's fetch stack can't negotiate with (some state
// sites — cga.ct.gov, dor.ms.gov — serve fine to curl/browsers but fail
// undici's TLS/HTTP2 handshake). Same URL, same content, different client.
// PDFs are rejected: stripHtml on binary would feed garbage to the model.
async function fetchViaCurl(url: string): Promise<string | null> {
  const { execFile } = await import("node:child_process");
  return new Promise(resolve => {
    execFile(
      "curl.exe",
      ["-s", "-L", "--max-time", "20", "-A",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        url],
      { maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        if (stdout.slice(0, 8).includes("%PDF")) {
          console.error(`  fail  ${url}  PDF content (no text extraction)`);
          return resolve(null);
        }
        const text = stripHtml(stdout);
        resolve(text.length >= 100 ? text.slice(0, MAX_TEXT_CHARS_PER_SOURCE) : null);
      },
    );
  });
}

async function fetchPageText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // Browser-like headers: several state sites (VT, NH) and federal hosts
    // (dol.gov, ecfr.gov) 403-block obvious bot user-agents but serve the
    // same static HTML to a browser UA (verified during the 50-state URL
    // harvest, 2026-07).
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
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
    // Connection-level failure (not an HTTP status): retry once via curl —
    // several official hosts reject Node's TLS handshake but serve curl.
    const viaCurl = await fetchViaCurl(url);
    if (viaCurl) {
      console.error(`  note  ${url}  fetched via curl fallback`);
      return viaCurl;
    }
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
  const extra = getExtraGuidance(state, topic);
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
