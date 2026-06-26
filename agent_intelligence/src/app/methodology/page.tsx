// Static methodology page. No interactive features; no profile required
// (spec: /methodology is one of two routes that does NOT redirect when
// localStorage.agent_profile is missing — /setup is the other).
//
// The page is a server component so it can read data/last_updated.txt
// directly at request time. force-dynamic prevents Next from baking a
// stale date into a static build.

import fs from "node:fs";
import path from "node:path";

import {
  ACTIVE_RATE_ACTIVITIES,
  AMBEST_PERMANENT_STATES,
  BRANDS,
  DEFEND_THRESHOLD,
  PROSPECT_THRESHOLD,
} from "@/lib/constants";
import { STATES } from "@/lib/states";

export const dynamic = "force-dynamic";

// Excluded brands — one line each on why. The "why" pattern across all of
// them is "filing vehicle or subsidiary that would double-count an
// existing brand or doesn't represent a consumer-facing product." Only
// names with rationales we can stand behind are listed; others that the
// brand-derivation rule already excludes by virtue of not matching any
// of the 8 brand prefixes (Drive, Esurance, National General) are
// handled silently by the import script's fail-loudly-on-unmatched
// gate, not by an asserted rationale on this page.
const EXCLUDED_BRANDS: Array<{ name: string; why: string }> = [
  {
    name: "LM General",
    why: "A Liberty Mutual filing vehicle covering a subset of policies, not a separate consumer brand.",
  },
  {
    name: "Standard Fire",
    why: "A Travelers filing vehicle, not sold to consumers under its own brand.",
  },
  {
    name: "American Economy",
    why: "A Liberty Mutual subsidiary used as a filing vehicle; not the consumer Liberty Mutual brand.",
  },
  {
    name: "Peerless",
    why: "A legacy Liberty Mutual subsidiary, not sold under its own brand in the current dataset.",
  },
];

function readLastUpdated(): string {
  try {
    const raw = fs
      .readFileSync(path.join(process.cwd(), "data", "last_updated.txt"), "utf-8")
      .trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return "unknown";
  } catch {
    return "unknown";
  }
}

// Reusable className strings — keeps the JSX legible while sharing tokens.
const sectionCls = "mb-8";
const h2Cls = "text-14 font-medium uppercase tracking-wider06 text-ink-2 mt-0 mb-3";
const pCls = "text-14 leading-[1.6] text-ink mt-0 mb-2";
const liCls = "text-14 leading-[1.6] text-ink mb-1.5";
const codeCls =
  "font-mono text-13 bg-surface-2 px-1.5 py-px rounded";

export default function MethodologyPage(): React.JSX.Element {
  const lastUpdated = readLastUpdated();
  const coveredStates = STATES.filter(s => s.data_coverage);
  // Directly-scraped, AM Best-cross-checked states vs. interim AM Best industry-
  // data states (VA/OH/IL all now scraped 2026-06-22/24/25; the original interim trio is fully real). The
  // cross-check validation table is scraped-only —
  // interim states are not cross-checked, so they must NOT appear as validated.
  const scrapedStates = coveredStates.filter(s => s.source !== "ambest");
  const ambestStates = coveredStates.filter(s => s.source === "ambest");
  // AM Best states split into interim (replaceable once directly scraped) vs.
  // permanent (not on SERFF Public Access — the state runs its own system, so
  // they are AM Best-sourced for good and must not be called "not yet scraped").
  const permanentSet = new Set<string>(AMBEST_PERMANENT_STATES);
  const interimAmbestStates = ambestStates.filter(s => !permanentSet.has(s.code));
  const permanentAmbestStates = ambestStates.filter(s => permanentSet.has(s.code));
  const validationRows = scrapedStates.map(s => ({
    code: s.code,
    name: s.name,
    auto: s.validated?.auto ?? false,
    home: s.validated?.home ?? false,
  }));
  const validatedSomewhere = validationRows.filter(r => r.auto || r.home).length;

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-[820px] mx-auto px-4 py-10">
        <header className="mb-7">
          <h1
            data-testid="page-title"
            className="text-22 font-medium text-ink mt-0 mb-1"
          >
            Methodology
          </h1>
          <p className="text-13 text-ink-2 m-0">
            What this product covers, what it excludes, and how to read the numbers.
            Last updated: <span data-testid="last-updated" className={codeCls}>{lastUpdated}</span>{" "}
            (the freshness of the source SERFF dataset; the active 12-month window
            is anchored to this date).
          </p>
        </header>

        {/* --- Scope --- */}
        <section className={sectionCls} data-testid="section-scope">
          <h2 className={h2Cls}>Scope</h2>
          <ul className="m-0 pl-[18px]">
            <li className={liCls}>
              <strong>{BRANDS.length} customer-facing brands:</strong>{" "}
              {BRANDS.join(", ")}.
            </li>
            <li className={liCls}>
              <strong>{coveredStates.length} states currently covered:</strong>{" "}
              {scrapedStates.map(s => s.code).join(", ")} from directly-scraped
              SERFF filings, plus {interimAmbestStates.map(s => s.code).join(", ")}{" "}
              from interim AM Best industry data (not yet directly scraped)
              {permanentAmbestStates.length > 0 && (
                <>
                  , and {permanentAmbestStates.map(s => s.code).join(", ")} from
                  AM Best industry data permanently (these states are not on SERFF
                  Public Access, so they are AM Best-sourced rather than scraped)
                </>
              )}. All 50 are
              listed in setup so the picker reflects the full national map; only
              the covered states are selectable. Coverage expands by flipping one
              flag per state — no other code changes.
            </li>
            <li className={liCls}>
              <strong>Lines of business:</strong> Personal Auto and Homeowners.
            </li>
            <li className={liCls}>
              <strong>Effective-date range:</strong> 2024–2026.
            </li>
            <li className={liCls}>
              <strong>Newer, thinner coverage:</strong> Georgia and New Mexico
              were added most recently, and five brands (Farmers, COUNTRY
              Financial, American Family, Nationwide, USAA) currently have filing
              data in Georgia only — existing-state backfill is ongoing. Where we
              don&rsquo;t yet collect a brand in your state, the tables say so
              explicitly rather than implying the carrier made no moves.
            </li>
            <li className={liCls}>
              <strong>Source:</strong> SERFF rate filings (the public state
              filing system), normalized into one row per filing × line of
              business. Multi-entity filings are rolled up using a
              premium-weighted average of the overall rate impact.
            </li>
          </ul>
        </section>

        {/* --- Thresholds --- */}
        <section className={sectionCls} data-testid="section-thresholds">
          <h2 className={h2Cls}>What “raising” and “lowering” mean</h2>
          <p className={pCls}>
            The Prospect and Defend tables apply two fixed thresholds across the
            same 12-month active window. They’re defined in one place
            (<span className={codeCls}>src/lib/constants.ts</span>) and never
            re-implemented per page.
          </p>
          <ul className="m-0 pl-[18px]">
            <li className={liCls}>
              <strong className="text-red-text">Raising (Prospect):</strong>{" "}
              <span className={codeCls}>overall_rate_impact ≥ +{PROSPECT_THRESHOLD}%</span>.
              A meaningful increase a competitor’s customers are likely to feel.
            </li>
            <li className={liCls}>
              <strong className="text-green-text">Lowering (Defend):</strong>{" "}
              <span className={codeCls}>overall_rate_impact ≤ {DEFEND_THRESHOLD}%</span>.
              A cut deep enough that your customers may start shopping.
            </li>
            <li className={liCls}>
              <strong>Active rate activities:</strong>{" "}
              {ACTIVE_RATE_ACTIVITIES.map(a => (
                <span key={a} className={`${codeCls} mr-1`}>{a}</span>
              ))}.
              Withdrawn and disapproved filings are excluded from the rolled-up
              tables.
            </li>
            <li className={liCls}>
              <strong>Window:</strong> 12 months relative to{" "}
              <span className={codeCls}>{lastUpdated}</span>, not to the wall clock.
              This keeps the spec’s verification counts stable across deploys.
            </li>
          </ul>
        </section>

        {/* --- Rate Positioning --- */}
        <section className={sectionCls} data-testid="section-positioning">
          <h2 className={h2Cls}>How Rate Positioning compares carriers</h2>
          <p className={pCls}>
            The Positioning page (<span className={codeCls}>/positioning</span>)
            compares, for each (line, state), the premium-weighted average rate{" "}
            <em>change</em> your carrier filed against{" "}
            <strong>each competitor individually</strong> — never a single blended
            “field average.” A captive sees their one carrier versus the field; an
            independent sees each carrier they sell versus the brands they don’t,
            per carrier, never blended together.
          </p>

          {/* Load-bearing frame — the same callout the feature itself carries. */}
          <div className="bg-amber-fill text-amber-text border border-hairline border-line rounded-md px-4 py-3 text-13 leading-[1.5] mt-3 mb-3">
            <strong>These are rate changes, not prices.</strong> Every figure is the
            average percentage a carrier <em>changed</em> its filed rates — not how
            cheap it is. A favorable comparison means a competitor is raising rates
            faster (or cutting them less) than your carrier; it says nothing about
            whose premium is lower today. This is the easiest number on the site to
            misread, so the feature repeats the frame in its column header
            (“avg rate change”) and in every expanded audit panel.
          </div>

          <p className={pCls}>How the average is computed:</p>
          <ul className="m-0 pl-[18px]">
            <li className={liCls}>
              <strong>Premium-weighted.</strong> Within each (line, state, brand)
              group it is the average of{" "}
              <span className={codeCls}>overall_rate_impact</span> weighted by each
              filing’s written premium — a large book moves the average more than a
              small one. (If every premium in a group were null it falls back to a
              simple mean and flags it; that case is essentially nonexistent in the
              data.)
            </li>
            <li className={liCls}>
              <strong>Same active set as Prospect and Defend.</strong> It draws from
              the exact same filings — active rate activities, non-null effective
              date, inside the 12-month window anchored to{" "}
              <span className={codeCls}>{lastUpdated}</span> — so the numbers
              reconcile with the rest of the site rather than coming from a separate
              query.
            </li>
          </ul>

          <p className={pCls}>
            Because filing data is sparse, every comparison is labeled with how much
            evidence sits behind it. The confidence tier is the honesty signal, not
            decoration:
          </p>
          <ul className="m-0 pl-[18px]">
            <li className={liCls}>
              <strong>Higher-confidence (≥ 2 filings on each side).</strong> Genuine
              multi-filing averages on both sides. Only these show a computed point
              spread between the two carriers.
            </li>
            <li className={liCls}>
              <strong>Thin (exactly 1 filing on a side).</strong> Shown demoted and
              never called an “average” — a lone filing renders as{" "}
              <span className={codeCls}>“1 filing: +X%”</span>, not{" "}
              <span className={codeCls}>“+X% avg”</span>, and no spread is computed
              against it. Dressing one data point as an average is exactly the
              overstatement the tiering prevents.
            </li>
            <li className={liCls}>
              <strong>Anchored cells only.</strong> A (line, state) appears only
              where your carrier actually filed. Competitors with no filing in that
              cell are listed as <strong>insufficient data</strong> — surfaced
              honestly, never computed or estimated.
            </li>
          </ul>

          <p className={pCls}>
            <strong>The limit this creates:</strong> with sparse filings, many
            (line, state) cells cannot support a real comparison at all. The page
            surfaces only the comparisons the data genuinely supports — and names the
            gaps as insufficient data or “no filings from your carrier” — rather than
            manufacturing a comparison out of one or two filings.
          </p>
        </section>

        {/* --- Excluded brands --- */}
        <section className={sectionCls} data-testid="section-excluded">
          <h2 className={h2Cls}>Excluded brands</h2>
          <p className={pCls}>
            These names appear in SERFF filings but are NOT counted as one of the
            {" "}{BRANDS.length} customer-facing brands. Each one would either
            double-count an existing brand or doesn’t represent a consumer-facing
            product.
          </p>
          <ul className="m-0 pl-[18px]" data-testid="excluded-list">
            {EXCLUDED_BRANDS.map(b => (
              <li key={b.name} className={liCls}>
                <strong>{b.name}.</strong> {b.why}
              </li>
            ))}
          </ul>
        </section>

        {/* --- AM Best validation table --- */}
        <section className={sectionCls} data-testid="section-validation">
          <h2 className={h2Cls}>AM Best cross-check</h2>
          <p className={pCls}>
            For each covered state, we cross-checked the SERFF brand-coverage
            list against AM Best’s market reports. A check mark means the brand
            list we recognize matches AM Best’s for that (state, line) pair —
            no missing carriers, no spurious additions.
          </p>
          <p className={pCls}>
            Currently validated on{" "}
            <strong>{validatedSomewhere} of {scrapedStates.length} cross-checked states</strong>{" "}
            for at least one line. ({ambestStates.map(s => s.code).join(", ")} are
            AM Best industry data and are not cross-checked, so they do
            not appear in this table.)
          </p>
          <div className="border border-hairline border-line rounded-lg overflow-hidden mt-3">
            <table
              data-testid="validation-table"
              className="w-full text-13 bg-surface"
              style={{ borderCollapse: "collapse" }}
            >
              <thead>
                <tr className="border-b border-hairline border-line-2 bg-surface-2">
                  <th className="text-left px-3 py-2.5 text-ink-2 font-medium">
                    State
                  </th>
                  <th className="text-center px-3 py-2.5 text-ink-2 font-medium">
                    Personal Auto
                  </th>
                  <th className="text-center px-3 py-2.5 text-ink-2 font-medium">
                    Homeowners
                  </th>
                </tr>
              </thead>
              <tbody>
                {validationRows.map(r => (
                  <tr
                    key={r.code}
                    data-testid="validation-row"
                    data-state={r.code}
                    className="border-b border-hairline border-line"
                  >
                    <td className="px-3 py-2.5 text-ink">
                      {r.name} <span className="text-ink-3">({r.code})</span>
                    </td>
                    <td
                      data-testid="cell-auto"
                      className={`text-center ${r.auto ? "text-green-text" : "text-ink-3"}`}
                    >
                      {r.auto ? "✓" : "—"}
                    </td>
                    <td
                      data-testid="cell-home"
                      className={`text-center ${r.home ? "text-green-text" : "text-ink-3"}`}
                    >
                      {r.home ? "✓" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* --- Known limitations --- */}
        <section className={sectionCls} data-testid="section-limitations">
          <h2 className={h2Cls}>Known limitations</h2>
          <ul className="m-0 pl-[18px]">
            <li className={liCls}>
              <strong>SERFF visibility gaps.</strong> An estimated 10–12 filings
              are missing from the current dataset because the relevant state’s
              SERFF Public Access interface either rate-limited scraping or
              structurally hides certain filings. We do not silently impute
              missing rows.
            </li>
            <li className={liCls}>
              <strong>Colorado not yet AM Best–validated.</strong> Filing rows
              for CO are loaded and queryable, but the AM Best cross-check has
              not been run yet — treat CO numbers as plausible but unverified
              until the validation column above flips to ✓.
            </li>
            <li className={liCls}>
              <strong>{50 - coveredStates.length} states not yet covered.</strong>{" "}
              Only the {coveredStates.length} listed above currently have filing
              data ({scrapedStates.length} directly scraped, {interimAmbestStates.length}{" "}
              interim AM Best, {permanentAmbestStates.length} permanent AM Best).
              Selecting other states in setup is intentionally
              blocked rather than silently returning empty results.
            </li>
            <li className={liCls}>
              <strong>No future-dated filings in the current snapshot.</strong>{" "}
              Every effective date in the active window is in the past
              relative to <span className={codeCls}>{lastUpdated}</span>. The
              Overview’s Most Urgent card and the Defend page’s
              risk-window badges both have future-dated code paths wired
              up — they’re running on the past-effective fallback today, not
              broken.
            </li>
            <li className={liCls}>
              <strong>Compliance summaries are point-in-time.</strong> The
              Compliance page reads pre-generated summaries committed to the
              repo — it never fetches official .gov pages live. Each card
              shows the date its summary was last refreshed; treat anything
              older than the most recent regeneration as potentially stale.
            </li>
          </ul>
        </section>

        <footer className="border-t border-hairline border-line pt-4 mt-2">
          <p className="text-12 text-ink-3 m-0">
            None of this is legal or financial advice. Verify on the official
            SERFF filing and the issuing carrier’s rate schedule before acting.
          </p>
        </footer>
      </div>
    </main>
  );
}
