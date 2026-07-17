// Brand Health — quote-flow friction probe (Website pillar, 4th component).
//
// For each brand, a Playwright pass that measures how hard it is to START
// an auto quote — never completing one (no PII, no submissions, no funnel
// walking):
//   1. Load the homepage (desktop viewport, real UA string).
//   2. Look for a quote entry point on the homepage itself: a visible ZIP
//      input (the classic direct-writer pattern) → 0 clicks.
//   3. Otherwise find and click the most prominent get-a-quote CTA, then
//      wait for a quote-start form (ZIP or first quote question) → 1 click.
//   4. Record clicks-to-quote and elapsed ms from navigation start until
//      the first quote field is visible.
// Bot walls, timeouts, and undetectable flows record a `failed` reason —
// the component drops out for that brand and weights renormalize (same
// honesty rule as missing CrUX).
//
// Output: src/lib/brandHealthQuoteFlowData.ts (raw measurements only —
// scoring math lives in src/lib/brandHealthWebsite.ts where the verify
// script can recompute it).
//
// Run: npx tsx scripts/brand_health/probe_quoteflow.ts

import { writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

import { BRANDS, type Brand } from "../../src/lib/constants";
import { BRAND_WEBSITES, type QuoteFlowSnapshot } from "../../src/lib/brandHealthWebsite";

const ROOT = path.join(__dirname, "..", "..");
const OUT_FILE = path.join(ROOT, "src", "lib", "brandHealthQuoteFlowData.ts");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const ZIP_SELECTOR =
  'input[name*="zip" i]:visible, input[id*="zip" i]:visible, input[placeholder*="zip" i]:visible, input[aria-label*="zip" i]:visible';

// A ZIP field only counts as a QUOTE entry if its surrounding context talks
// about quotes/rates/prices — agent-locator ZIP fields ("find an agent near
// you") are service UI, not a quote start (Safeco false-positived on one).
async function zipQuoteEntry(page: Page): Promise<boolean> {
  const contexts = await page.$$eval(ZIP_SELECTOR, els =>
    els.map(el => {
      const scope = el.closest("form, section, [class*='hero' i]") ?? el.parentElement;
      return (scope?.textContent ?? "").slice(0, 400);
    }),
  ).catch(() => [] as string[]);
  return contexts.some(t => /quote|rate|price|save|bundle/i.test(t) && !/find (an |a )?agent|agent near/i.test(t));
}

// Visible quote-start signal: a ZIP field, or a form input near quote wording.
async function quoteFieldVisible(page: Page): Promise<boolean> {
  if (await page.$(ZIP_SELECTOR)) return true;
  // Fallback: an input inside a container whose text mentions a quote.
  const generic = await page.$$eval(
    "form input:not([type=hidden])",
    els =>
      els.filter(el => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const form = el.closest("form");
        return /quote/i.test(form?.textContent ?? "");
      }).length,
  ).catch(() => 0);
  return generic > 0;
}

async function probeBrand(page: Page, brand: Brand) {
  const started = Date.now();
  await page.goto(BRAND_WEBSITES[brand], { waitUntil: "domcontentloaded", timeout: 45_000 });
  // Give SPAs a beat to hydrate their hero forms.
  await page.waitForTimeout(2_500);

  if (await zipQuoteEntry(page)) {
    return {
      zipOnHomepage: true,
      clicksToQuote: 0,
      msToQuoteStart: Date.now() - started,
      finalUrl: page.url(),
    };
  }

  // Find the most prominent quote CTA (first visible match wins — links
  // and buttons, hero areas come first in DOM order on all 13 sites).
  const cta = page
    .locator("a, button")
    .filter({ hasText: /get (a |your |my )?quote|start (a |your |my )?quote|^quote$|quote now/i })
    .first();
  if ((await cta.count()) === 0) {
    return { failed: "no quote CTA found on homepage" };
  }
  await cta.click({ timeout: 10_000 });

  // Quote-start reached when a quote field shows up (same page or after nav).
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await quoteFieldVisible(page)) {
      return {
        zipOnHomepage: false,
        clicksToQuote: 1,
        msToQuoteStart: Date.now() - started,
        finalUrl: page.url(),
      };
    }
    await page.waitForTimeout(500);
  }
  return { failed: "no quote form within 20s of CTA click" };
}

async function main(): Promise<void> {
  // Prefer the machine's installed Chrome (closer to real-user traffic than
  // bundled Chromium); fall back if unavailable.
  const browser = await chromium
    .launch({ channel: "chrome" })
    .catch(() => chromium.launch());
  const brands: QuoteFlowSnapshot["brands"] = {};

  for (const brand of BRANDS) {
    // Up to 3 attempts per brand: transient DNS/network flakes in the
    // browser process (ERR_NAME_NOT_RESOLVED bursts) are retryable; real
    // bot walls and missing CTAs fail the same way every time.
    let last: QuoteFlowSnapshot["brands"][Brand] = { failed: "not attempted" };
    for (let attempt = 0; attempt < 3; attempt++) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: UA,
      });
      const page = await context.newPage();
      try {
        last = await probeBrand(page, brand);
      } catch (e) {
        last = { failed: (e as Error).message.split("\n")[0].slice(0, 120) };
      } finally {
        await context.close();
      }
      const transient = "failed" in last! && /NAME_NOT_RESOLVED|HTTP2_PROTOCOL|Timeout/.test(last!.failed);
      if (!("failed" in last!) || !transient) break;
      await new Promise(r => setTimeout(r, 5_000));
    }
    brands[brand] = last!;
    if ("failed" in last!) {
      console.log(`${brand.padEnd(18)} FAILED — ${last!.failed}`);
    } else {
      console.log(
        `${brand.padEnd(18)} clicks=${last!.clicksToQuote} zipOnHome=${last!.zipOnHomepage} ` +
          `ms=${last!.msToQuoteStart}  (${last!.finalUrl.slice(0, 60)})`,
      );
    }
    await new Promise(r => setTimeout(r, 2_000));
  }
  await browser.close();

  const measured = Object.values(brands).filter(b => !("failed" in b)).length;
  const snapshot: QuoteFlowSnapshot = {
    probedAt: new Date().toISOString().slice(0, 10),
    brands,
  };
  const body =
    `// GENERATED FILE — written by scripts/brand_health/probe_quoteflow.ts\n` +
    `// on ${snapshot.probedAt}. Do not edit by hand; run the probe instead.\n\n` +
    `import { type QuoteFlowSnapshot } from "./brandHealthWebsite";\n\n` +
    `export const QUOTEFLOW_SNAPSHOT: QuoteFlowSnapshot | null =\n` +
    `  ${JSON.stringify(snapshot, null, 2).replace(/\n/g, "\n  ")};\n`;
  writeFileSync(OUT_FILE, body);
  console.log(`\nWrote ${measured}/13 measured brands to ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
