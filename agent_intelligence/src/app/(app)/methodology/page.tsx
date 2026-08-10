// Static methodology page — slim trust-statement rewrite (2026-08-10).
//
// The original 435-line page documented the retired AM Best interim
// architecture (interim/permanent state lists, a per-state cross-check
// table) and operational detail (source-system names, per-state validation
// mechanics) that aged badly and over-shared the pipeline recipe. This
// version states what a skeptical agent needs to trust the numbers —
// sources, freshness, how to read the figures, thresholds, validation
// posture — in general terms that stay true as the pipeline evolves.
//
// No profile required (spec: /methodology is one of two routes that does
// NOT redirect when localStorage.agent_profile is missing — /setup is the
// other). Server component so it can read data/last_updated.txt directly;
// force-dynamic prevents Next from baking a stale date into a static build.

import fs from "node:fs";
import path from "node:path";

import TopBar from "@/components/TopBar";
import { BRANDS, DEFEND_THRESHOLD, PROSPECT_THRESHOLD } from "@/lib/constants";
import { STATES } from "@/lib/states";

export const dynamic = "force-dynamic";

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

// Design 3f tokens: 17px/650 section headings, 13px/1.6 body, single white card.
const sectionCls = "mb-8";
const h2Cls = "text-17 font-[650] text-ink mt-0 mb-3";
const pCls = "text-13 leading-[1.6] text-ink-2 mt-0 mb-2";
const liCls = "text-13 leading-[1.6] text-ink-2 mb-1.5";
const codeCls = "font-mono text-12 bg-soft px-1.5 py-px rounded";

export default function MethodologyPage(): React.JSX.Element {
  const lastUpdated = readLastUpdated();
  const coveredStates = STATES.filter(s => s.data_coverage);

  return (
    <main className="min-h-screen bg-canvas">
      <TopBar
        title="Methodology"
        asOf={lastUpdated !== "unknown" ? lastUpdated : undefined}
      />
      <div className="max-w-[760px] mx-auto px-4 md:px-0 py-[30px]">
        <div className="bg-surface border border-card-line rounded-card shadow-card px-6 md:px-9 py-[30px]">
          <header className="mb-7">
            <h1 className="text-19 font-[650] tracking-tight02 text-ink mt-0 mb-1.5">
              Methodology
            </h1>
            <p className={pCls}>
              Where the data comes from and how to read it. Data as of:{" "}
              <span data-testid="last-updated" className={codeCls}>
                {lastUpdated}
              </span>
              .
            </p>
          </header>

          {/* --- Sources --- */}
          <section className={sectionCls} data-testid="section-sources">
            <h2 className={h2Cls}>Sources</h2>
            <p className={pCls}>
              Every rate change shown here comes from a public rate filing made
              by the carrier with a state insurance regulator. Figures are
              taken from the filing documents themselves — never estimated,
              inferred, or crowd-sourced. Where a state publishes its approved
              rate decisions separately, approved values take precedence over
              carrier-requested values.
            </p>
          </section>

          {/* --- Coverage --- */}
          <section className={sectionCls} data-testid="section-coverage">
            <h2 className={h2Cls}>Coverage</h2>
            <ul className="m-0 pl-[18px]">
              <li className={liCls}>
                <strong>{BRANDS.length} customer-facing brands:</strong>{" "}
                {BRANDS.join(", ")}. Filing-vehicle subsidiaries that would
                double-count one of these brands are excluded.
              </li>
              <li className={liCls}>
                <strong>{coveredStates.length} states currently covered</strong>{" "}
                for personal auto and homeowners filings. All 50 states appear
                in setup; states without data coverage are intentionally not
                selectable rather than silently returning empty results.
                Coverage depth varies with what each state&rsquo;s regulator
                makes public.
              </li>
            </ul>
          </section>

          {/* --- Freshness --- */}
          <section className={sectionCls} data-testid="section-freshness">
            <h2 className={h2Cls}>Freshness</h2>
            <p className={pCls}>
              The dataset snapshot is dated{" "}
              <span className={codeCls}>{lastUpdated}</span>, and every rolling
              12-month window in the app is anchored to that date — so counts
              and lists are stable for a given snapshot rather than drifting
              with the wall clock. Filings can carry future effective dates;
              those appear as soon as they are filed.
            </p>
          </section>

          {/* --- Reading the numbers --- */}
          <section className={sectionCls} data-testid="section-reading">
            <h2 className={h2Cls}>Reading the numbers</h2>
            <ul className="m-0 pl-[18px]">
              <li className={liCls}>
                <strong>Rate impact</strong> is the overall percentage change
                the filing puts into effect. When one filing covers several
                underwriting companies, the impacts are combined weighted by
                each company&rsquo;s written premium; the row&rsquo;s tooltip
                shows the entity count and the min/max spread.
              </li>
              <li className={liCls}>
                <strong>Approved vs. pending:</strong> &ldquo;Approved&rdquo;
                means the state closed its review. Some states let a rate take
                effect while the review is still open — those rows say
                &ldquo;Rate in effect; state review still open&rdquo; instead
                of a bare &ldquo;Pending.&rdquo;
              </li>
              <li className={liCls}>
                <strong>Policyholders</strong> is the carrier-reported count of
                policies affected by the filing, where the filing disclosed it.
              </li>
            </ul>
          </section>

          {/* --- Signals & thresholds --- */}
          <section className={sectionCls} data-testid="section-thresholds">
            <h2 className={h2Cls}>Signals &amp; thresholds</h2>
            <ul className="m-0 pl-[18px]">
              <li className={liCls}>
                <strong>Prospect:</strong> a competitor raised rates by{" "}
                <span className={codeCls}>+{PROSPECT_THRESHOLD}%</span> or more
                in the last 12 months — their customers are likely to shop.
              </li>
              <li className={liCls}>
                <strong>Defend:</strong> a competitor cut rates by{" "}
                <span className={codeCls}>{DEFEND_THRESHOLD}%</span> or more —
                your customers may see cheaper quotes.
              </li>
              <li className={liCls}>
                <strong>Retention risk / opportunity</strong> apply the same
                two thresholds to your own carriers&rsquo; filings: a raise is
                a retention risk, a cut is a price advantage you can sell.
              </li>
            </ul>
          </section>

          {/* --- Validation --- */}
          <section className={sectionCls} data-testid="section-validation">
            <h2 className={h2Cls}>Validation</h2>
            <p className={pCls}>
              Imports run automated integrity gates: every company name must
              resolve to a known brand, required fields must be present, and
              dataset-level counts are re-verified on every update — an
              inconsistency halts the import rather than shipping quietly.
              Extracted values are additionally cross-checked against
              regulator-published approval records in states that publish
              them. Where a state withholds filing details (some states allow
              trade-secret designations), we show what the regulator makes
              public rather than estimating the rest.
            </p>
          </section>

          <footer className="border-t border-line pt-4 mt-2">
            <p className="text-12 text-ink-3 m-0">
              None of this is legal or financial advice. Verify against the
              official state filing and the issuing carrier&rsquo;s rate
              schedule before acting.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}
