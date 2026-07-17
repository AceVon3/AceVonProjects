// Methodology accordions for the Brand Health tab — where every pillar
// states its formula, its sources, its scope (state vs national), and its
// honest cadence. Static content; native <details> keeps it accessible with
// zero client JS. Source language follows the dashboard_v2 integration
// manual's production-credible categories (no editorial sites presented as
// primary pricing truth).

const SECTIONS: Array<{
  title: string;
  scope: string;
  formula: string;
  sources: string[];
  notes?: string;
}> = [
  {
    title: "Price Competitiveness",
    scope: "State-scoped · varies with the date range",
    formula:
      "Filed rate momentum (Personal Auto): the brand's net approved/pending rate impact over the selected window, ranked against the peers that also filed in that state — lowest net increase scores 90, highest scores 30, linear between. Public average-premium context may be blended in where available (always marked estimated).",
    sources: [
      "SERFF rate filings (our own scraped dataset — official regulatory source)",
      "State DOI filing portals (non-SERFF states)",
      "Public premium context (clearly marked estimated, low confidence)",
    ],
    notes:
      "This measures rate movement, not absolute price levels — a smaller increase than peers is not proof of a cheaper premium. Carrier-level premium data requires licensed feeds (Quadrant, S&P RateWatch) that are not part of v1. Tooltips add context that never changes the score: momentum trend (▲ accelerating / → steady / ▼ cooling, ±3pp vs the preceding period), filing-pattern volatility (consistent / moderate / volatile, from all filings since 2024), and the state's average auto expenditure (NAIC annual supplement — a statewide figure, not carrier-level).",
  },
  {
    title: "Customer Sentiment",
    scope: "National · point-in-time (date range does not apply)",
    formula:
      "45% platform ratings (Google listings + App Store, each weighted by log of its review volume) + 35% inverted NAIC complaint index + 20% review volume confidence.",
    sources: [
      "Google Places ratings and review counts (10-metro sample)",
      "App Store ratings (channel-neutral — direct writers have few local listings)",
      "NAIC complaint index (official; flagship auto entity, named per brand)",
    ],
    notes:
      "Measured per brand nationally — the same value applies in every state, and cards tag it \"US\" accordingly. App ratings also inform the Website pillar's app component (a disclosed overlap). Licensed satisfaction benchmarks (J.D. Power, Consumer Reports) would upgrade this formula if ever licensed.",
  },
  {
    title: "Search Interest",
    scope: "State-scoped · varies with the date range",
    formula:
      "Normalized brand search-interest score by state and period, from a stored monthly series sliced to the selected window. Cards also show demand trend direction (▲ growing / → stable / ▼ declining, ±10% band vs the prior period) — informational only, it does not change the score.",
    sources: [
      "DataForSEO (Google Ads search volume, state-level)",
      "Branded keyword demand",
    ],
  },
  {
    title: "Website Performance",
    scope: "National · point-in-time (date range does not apply)",
    formula:
      "50% PageSpeed/Lighthouse score + 30% CrUX real-user Core Web Vitals + 20% mobile app rating proxy.",
    sources: [
      "PageSpeed Insights API (lab)",
      "Chrome UX Report API (real-user, 28-day rolling)",
      "App Store / Google Play ratings",
    ],
    notes:
      "Carrier websites are national properties — one measurement per brand, tagged \"US\" on cards. A quote-flow friction heuristic (clicks and seconds to the first quote question) is built and under evaluation; it joins the formula at 20% weight once its measurement source is reliable across brands.",
  },
];

export default function BrandHealthMethodology(): React.JSX.Element {
  return (
    <div
      data-testid="bh-methodology"
      className="bg-surface border border-card-line rounded-card shadow-card px-5 py-4"
    >
      <div className="text-11 uppercase tracking-wider06 text-ink-3 mb-1">
        Methodology &amp; sources
      </div>
      <p className="m-0 mb-2 text-12 text-ink-2 leading-relaxed">
        Brand Health is a weighted composite of the four pillars below, computed live from
        your slider weights. Missing pillars drop out and the remaining weights renormalize —
        a score is never fabricated. All data refreshes monthly; each pillar keeps its own
        honest cadence and &quot;as of&quot; date.
      </p>

      {SECTIONS.map(s => (
        <details key={s.title} className="border-t border-line py-2 group" data-testid="bh-method-section">
          <summary className="cursor-pointer list-none flex items-center gap-2 text-13 text-ink font-medium">
            <i className="ti ti-chevron-right text-13 text-ink-3 transition-transform group-open:rotate-90" aria-hidden />
            {s.title}
            <span className="ml-auto text-11 font-normal text-ink-3">{s.scope}</span>
          </summary>
          <div className="pl-6 pt-1.5">
            <p className="m-0 mb-1.5 text-12 text-ink-2 leading-relaxed">{s.formula}</p>
            <div className="text-11 text-ink-3 mb-1">Sources</div>
            <ul className="m-0 mb-1.5 pl-4 text-12 text-ink-2">
              {s.sources.map(src => (
                <li key={src}>{src}</li>
              ))}
            </ul>
            {s.notes && <p className="m-0 text-11 text-ink-3 leading-relaxed">{s.notes}</p>}
          </div>
        </details>
      ))}
    </div>
  );
}
