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
  BRANDS,
  DEFEND_THRESHOLD,
  PROSPECT_THRESHOLD,
} from "@/lib/constants";
import { STATES } from "@/lib/states";

export const dynamic = "force-dynamic";

// Excluded brands — one line each on why. The "why" pattern across all of
// them is some flavor of "filing vehicle or subsidiary that would either
// double-count an existing brand or doesn't represent a consumer-facing
// product." Phrasing kept conservative on purpose — this page's job is
// credibility, not marketing.
const EXCLUDED_BRANDS: Array<{ name: string; why: string }> = [
  {
    name: "National General",
    why: "An Allstate subsidiary that files separately. Excluded to avoid double-counting Allstate.",
  },
  {
    name: "Standard Fire",
    why: "A Travelers filing vehicle, not sold to consumers under its own brand.",
  },
  {
    name: "LM General",
    why: "A Liberty Mutual filing vehicle covering a subset of policies, not a separate consumer brand.",
  },
  {
    name: "American Economy",
    why: "A Liberty Mutual subsidiary used as a filing vehicle; not the consumer Liberty Mutual brand.",
  },
  {
    name: "Peerless",
    why: "A legacy Liberty Mutual subsidiary, not sold under its own brand in the current dataset.",
  },
  {
    name: "Drive",
    why: "Progressive's non-standard-auto brand, sold through a separate channel from the consumer Progressive product.",
  },
  {
    name: "Esurance",
    why: "Allstate's wound-down digital brand. Excluded to avoid double-counting and historical noise.",
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

// Visual tokens — same palette as the rest of the app.
const C = {
  bg: "#fafaf9",
  surface: "#ffffff",
  surface2: "#F4F2EC",
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  line: "rgba(0,0,0,0.08)",
  line2: "rgba(0,0,0,0.15)",
  greenText: "#27500A",
  redText: "#A32D2D",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
};
const h2Style: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: C.text2,
  margin: "0 0 12px",
};
const pStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: C.text,
  margin: "0 0 8px",
};
const liStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: C.text,
  marginBottom: 6,
};
const codeStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 13,
  background: C.surface2,
  padding: "1px 6px",
  borderRadius: 4,
};

export default function MethodologyPage(): React.JSX.Element {
  const lastUpdated = readLastUpdated();
  const coveredStates = STATES.filter(s => s.data_coverage);
  const validationRows = coveredStates.map(s => ({
    code: s.code,
    name: s.name,
    auto: s.validated?.auto ?? false,
    home: s.validated?.home ?? false,
  }));
  const validatedSomewhere = validationRows.filter(r => r.auto || r.home).length;

  return (
    <main className="min-h-screen" style={{ background: C.bg }}>
      <div className="max-w-[820px] mx-auto px-4 py-10">
        <header style={{ marginBottom: 28 }}>
          <h1
            data-testid="page-title"
            style={{ fontSize: 22, fontWeight: 500, color: C.text, margin: "0 0 4px" }}
          >
            Methodology
          </h1>
          <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
            What this product covers, what it excludes, and how to read the numbers.
            Last updated: <span data-testid="last-updated" style={codeStyle}>{lastUpdated}</span>{" "}
            (the freshness of the source SERFF dataset; the active 12-month window
            is anchored to this date).
          </p>
        </header>

        {/* --- Scope --- */}
        <section style={sectionStyle} data-testid="section-scope">
          <h2 style={h2Style}>Scope</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={liStyle}>
              <strong>{BRANDS.length} customer-facing brands:</strong>{" "}
              {BRANDS.join(", ")}.
            </li>
            <li style={liStyle}>
              <strong>{coveredStates.length} states currently covered:</strong>{" "}
              {coveredStates.map(s => s.code).join(", ")}. All 50 are listed in
              setup so the picker reflects the full national map; only the 8
              covered states are selectable. Coverage expands by flipping
              one flag per state — no other code changes.
            </li>
            <li style={liStyle}>
              <strong>Lines of business:</strong> Personal Auto and Homeowners.
            </li>
            <li style={liStyle}>
              <strong>Effective-date range:</strong> 2025–2026.
            </li>
            <li style={liStyle}>
              <strong>Source:</strong> SERFF rate filings (the public state
              filing system), normalized into one row per filing × line of
              business. Multi-entity filings are rolled up using a
              premium-weighted average of the overall rate impact.
            </li>
          </ul>
        </section>

        {/* --- Thresholds --- */}
        <section style={sectionStyle} data-testid="section-thresholds">
          <h2 style={h2Style}>What “raising” and “lowering” mean</h2>
          <p style={pStyle}>
            The Prospect and Defend tables apply two fixed thresholds across the
            same 12-month active window. They’re defined in one place
            (<span style={codeStyle}>src/lib/constants.ts</span>) and never
            re-implemented per page.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={liStyle}>
              <strong style={{ color: C.redText }}>Raising (Prospect):</strong>{" "}
              <span style={codeStyle}>overall_rate_impact ≥ +{PROSPECT_THRESHOLD}%</span>.
              A meaningful increase a competitor’s customers are likely to feel.
            </li>
            <li style={liStyle}>
              <strong style={{ color: C.greenText }}>Lowering (Defend):</strong>{" "}
              <span style={codeStyle}>overall_rate_impact ≤ {DEFEND_THRESHOLD}%</span>.
              A cut deep enough that your customers may start shopping.
            </li>
            <li style={liStyle}>
              <strong>Active rate activities:</strong>{" "}
              {ACTIVE_RATE_ACTIVITIES.map(a => (
                <span key={a} style={{ ...codeStyle, marginRight: 4 }}>{a}</span>
              ))}.
              Withdrawn and disapproved filings are excluded from the rolled-up
              tables.
            </li>
            <li style={liStyle}>
              <strong>Window:</strong> 12 months relative to{" "}
              <span style={codeStyle}>{lastUpdated}</span>, not to the wall clock.
              This keeps the spec’s verification counts stable across deploys.
            </li>
          </ul>
        </section>

        {/* --- Excluded brands --- */}
        <section style={sectionStyle} data-testid="section-excluded">
          <h2 style={h2Style}>Excluded brands</h2>
          <p style={pStyle}>
            These names appear in SERFF filings but are NOT counted as one of the
            eight customer-facing brands. Each one would either double-count an
            existing brand or doesn’t represent a consumer-facing product.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }} data-testid="excluded-list">
            {EXCLUDED_BRANDS.map(b => (
              <li key={b.name} style={liStyle}>
                <strong>{b.name}.</strong> {b.why}
              </li>
            ))}
          </ul>
        </section>

        {/* --- AM Best validation table --- */}
        <section style={sectionStyle} data-testid="section-validation">
          <h2 style={h2Style}>AM Best cross-check</h2>
          <p style={pStyle}>
            For each covered state, we cross-checked the SERFF brand-coverage
            list against AM Best’s market reports. A check mark means the brand
            list we recognize matches AM Best’s for that (state, line) pair —
            no missing carriers, no spurious additions.
          </p>
          <p style={pStyle}>
            Currently validated on{" "}
            <strong>{validatedSomewhere} of {coveredStates.length} covered states</strong>{" "}
            for at least one line.
          </p>
          <div
            style={{
              border: `0.5px solid ${C.line}`,
              borderRadius: 8,
              overflow: "hidden",
              marginTop: 12,
            }}
          >
            <table
              data-testid="validation-table"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                background: C.surface,
              }}
            >
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${C.line2}`, background: C.surface2 }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: C.text2, fontWeight: 500 }}>
                    State
                  </th>
                  <th style={{ textAlign: "center", padding: "10px 12px", color: C.text2, fontWeight: 500 }}>
                    Personal Auto
                  </th>
                  <th style={{ textAlign: "center", padding: "10px 12px", color: C.text2, fontWeight: 500 }}>
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
                    style={{ borderBottom: `0.5px solid ${C.line}` }}
                  >
                    <td style={{ padding: "10px 12px", color: C.text }}>
                      {r.name} <span style={{ color: C.text3 }}>({r.code})</span>
                    </td>
                    <td
                      data-testid="cell-auto"
                      style={{ textAlign: "center", color: r.auto ? C.greenText : C.text3 }}
                    >
                      {r.auto ? "✓" : "—"}
                    </td>
                    <td
                      data-testid="cell-home"
                      style={{ textAlign: "center", color: r.home ? C.greenText : C.text3 }}
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
        <section style={sectionStyle} data-testid="section-limitations">
          <h2 style={h2Style}>Known limitations</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li style={liStyle}>
              <strong>SERFF visibility gaps.</strong> An estimated 10–12 filings
              are missing from the current dataset because the relevant state’s
              SERFF Public Access interface either rate-limited scraping or
              structurally hides certain filings. We do not silently impute
              missing rows.
            </li>
            <li style={liStyle}>
              <strong>Colorado not yet AM Best–validated.</strong> Filing rows
              for CO are loaded and queryable, but the AM Best cross-check has
              not been run yet — treat CO numbers as plausible but unverified
              until the validation column above flips to ✓.
            </li>
            <li style={liStyle}>
              <strong>42 states not yet covered.</strong> Only the 8 listed
              above currently have filing data. Selecting other states in setup
              is intentionally blocked rather than silently returning empty
              results.
            </li>
            <li style={liStyle}>
              <strong>No future-dated filings in the current snapshot.</strong>{" "}
              Every effective date in the active window is in the past
              relative to <span style={codeStyle}>{lastUpdated}</span>. The
              Overview’s Most Urgent card and the Defend page’s
              risk-window badges both have future-dated code paths wired
              up — they’re running on the past-effective fallback today, not
              broken.
            </li>
            <li style={liStyle}>
              <strong>Compliance summaries are point-in-time.</strong> The
              Compliance page reads pre-generated summaries committed to the
              repo — it never fetches official .gov pages live. Each card
              shows the date its summary was last refreshed; treat anything
              older than the most recent regeneration as potentially stale.
            </li>
          </ul>
        </section>

        <footer style={{ borderTop: `0.5px solid ${C.line}`, paddingTop: 16, marginTop: 8 }}>
          <p style={{ fontSize: 12, color: C.text3, margin: 0 }}>
            None of this is legal or financial advice. Verify on the official
            SERFF filing and the issuing carrier’s rate schedule before acting.
          </p>
        </footer>
      </div>
    </main>
  );
}
