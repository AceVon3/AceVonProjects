# Brand Health: What We Built vs. the dashboard_v2 Manuals

*Reconciliation of the shipped Brand Health tab (agent_intelligence, July 2026)
against the two source documents:
`dashboard_v2_vercel_build_manual.pdf` and
`dashboard_v2_live_data_integration_manual.pdf` (both in `~/Downloads`).*

## The big picture

The manuals describe a **standalone dashboard product** — a full-page market
dashboard with six insight cards, AI summaries, modals, and charts. What we
built is a **Brand Health tab inside the existing agent_intelligence app**,
adopting the manuals' scoring engine, source discipline, and metadata schema
while deliberately skipping the surrounding dashboard chrome. The engine is
faithful; the shell around it is our own.

Where the manuals offered a "recommended" formula requiring licensed data
plus a "fallback" formula on free sources, we shipped **the fallback — exactly
as written — in three of four pillars**, and validated (not assumed) our one
larger deviation in the fourth.

## Scoring engine — manual vs. built

| Element | Manual | Built | Verdict |
|---|---|---|---|
| Composite formula | 30% Price + 25% Sentiment + 20% Search + 25% Website, user-adjustable, never stored | Identical (`DEFAULT_WEIGHTS`, `calculateBrandHealth`, always computed live) | ✅ verbatim |
| Weight handling | sliders total 100%, renormalize | `normalizeWeights` + missing pillars drop out and renormalize | ✅ + extension |
| `SourceBackedMetric` schema | tier / sourceName / dataAsOf / retrievedAt / confidence / refreshCadence / isEstimated | Same fields, same tier vocabulary, plus `scope` (state vs national) and `note` | ✅ + extensions |
| Score classification | `classifyScore` | `classifyScore` (excellent/good/fair/weak) | ✅ |

## Pillar by pillar

### Price Competitiveness — the one real deviation
- **Manual:** `normalized inverse premium gap vs standardized driver profile and
  state benchmark` — price *levels*, primary source **licensed** (Quadrant /
  S&P RateWatch); rate filings only a supporting input.
- **Built:** filed rate **momentum** only — net approved/pending Personal Auto
  rate impact per window, peer-ranked in-state (least movement → 90, most → 30),
  computed live from our own SERFF/AM Best filings.
- **Why:** every primary input requires licensed feeds not in v1. We tested the
  free substitute (implied premium = written premium ÷ policyholders from our
  filings) against official NV/MD/CO DOI premium surveys — **it failed rank
  validation** (Spearman 0.03/0.35/0.60; State Farm systematically misranked
  cheap). Decision record: `docs/PRICE_PILLAR_VALIDATION.md`. Every metric
  tooltip carries the "rate movement, not price levels" caveat, which the
  manual's own "do not claim every metric is live/real" ethos requires.
- **Path back to spec:** license Quadrant/RateWatch; the pillar's input
  structure and the validation harness are ready for it.

### Customer Sentiment — the manual's fallback formula, enhanced
- **Manual (fallback, no licensed benchmark):** 45% platform ratings + 35%
  inverted NAIC/state complaint index + 20% review volume/recency.
- **Built:** exactly that, with two upgrades: platform ratings are a
  **log-volume-weighted blend of Google Places (10-metro sample) and App Store
  ratings** (fixes the direct-writer skew — USAA/GEICO were being judged on
  corporate-office listings), and the complaint index is **peer-relative**
  across the 13 flagship entities (data-derived: each brand's largest
  multi-state Personal Auto writer in our own filings).
- **Sources:** Google Places API ✅ (manual-listed), NAIC CIS complaint index ✅
  (via the public Tableau CSV endpoint we discovered), App Store ✅. Not used:
  Yelp/Trustpilot (no free API), J.D. Power/Consumer Reports (licensed),
  review excerpts (manual's `brand_reviews` concept — not built).
- **Manual's recommended formula** (35% licensed benchmark + …) remains the
  upgrade path if a benchmark is ever licensed.

### Website Performance — the manual's fallback formula, verbatim
- **Manual (fallback, no synthetic tests):** 50% PageSpeed/Lighthouse + 30%
  CrUX real-user CWV + 20% mobile app rating proxy.
- **Built:** exactly that, 13/13 brands live, weights renormalizing over
  missing components (Encompass has no CrUX → disclosed, medium confidence).
- **Not built:** the recommended formula's 40% **synthetic quote-flow tests**
  (Playwright quote journeys) — the largest untapped upgrade the manual
  offers that needs no licensed data, only engineering time.

### Search Interest — same source family, different measurement
- **Manual:** normalized search-interest/trend index by carrier, state, period;
  sources Google Trends alpha → DataForSEO → Semrush/Similarweb; inputs include
  trend direction and geographic concentration.
- **Built:** **DataForSEO Google Ads search volumes** (13 pinned branded
  keywords × 45 states × 12-month series, ~$4/run), sliced per range, scored
  peer-relative on log volume. Volume is a stronger demand measure than a
  trend index, but we do **not** ship the manual's *trend direction* signal,
  and Semrush/Similarweb traffic estimates are unused.

### Market Share — not built (the manual's sixth metric)
The manuals treat Market Share as a first-class dashboard metric (NAIC
InsData / state DOI annual reports). The Brand Health tab has no market-share
pillar or display. Partial raw material exists (our filings' premium volumes;
Missouri's per-company premium tables found in the July 2026 DOI audit), but
official InsData is unlicensed and no UI slot exists. **Open item** if the tab
should grow toward the manuals' full dashboard.

## Dashboard features — manual scope vs. the tab

| Manual feature | Status |
|---|---|
| State + date-range filters | ✅ built (45 states; 3M/6M/12M/YTD/Q1–Q4) |
| Custom Metric Weights card (sliders, live recompute) | ✅ built |
| Brand cards (per-carrier score + pillars) | ✅ built (13 brands vs manual's 11-carrier AZ seed incl. HiRoad — we swapped in the app's 13-brand scope) |
| Metric Methodology (manual: modal) | ✅ built as accordion section, same "production-credible source language" |
| Data sources / confidence labels ("Data as of", "Estimated", tiers) | ✅ built, per-metric tooltips |
| Six top insight cards (Top Brand / Market Leader / Best Price / …) | ❌ not built |
| Cache/status strip + Refresh Now job flow | ❌ not built (refresh = local scripts, data ships committed) |
| Executive Summary (AI-generated) | ❌ not built |
| Brand Detail modal | ❌ not built (cards carry pillar detail inline) |
| Brand Performance comparison chart | ❌ not built |
| Positioning Map | ➖ the app has its own `/positioning` page (predates this feature, filings-based) — not the manual's bubble chart |
| Multi-State Comparison | ❌ not built |
| Ask Questions (AI Q&A) | ❌ not built |
| Export (CSV/JSON) | ❌ not built |

## Architecture — manual vs. built

| Layer | Manual | Built |
|---|---|---|
| Data store | Postgres (12+ tables: source_records, dashboard_snapshots, …) | Committed SQLite (`filings.db`) + generated TypeScript snapshot files per pillar |
| Raw source retention | Blob storage of every fetched payload | Not retained (scripts log runs; snapshots keep raw component values per brand) |
| Refresh | Vercel Cron → Queues → workers → cache invalidation | Manual `npx tsx` scripts per pillar (consolidated runner = pending "Phase 5"); price computes live per request |
| Serving | cached snapshot API, 30–60 min SWR | `/api/brand-health?state=XX` serving one state slice; per-process caching |
| AI layer | AI SDK + Gateway summaries, Q&A | none |
| Env keys | DATABASE_URL, BLOB, AI_GATEWAY, GOOGLE_MAPS, PAGESPEED, CRUX, DATAFORSEO, SEMRUSH, SIMILARWEB | PSI_API_KEY, PLACES_API_KEY, DATAFORSEO_LOGIN/PASSWORD — a subset that matches what's actually wired |

The simplification is deliberate: agent_intelligence's standing rules are
"pre-generated and cached, never fetched live at view time" and a committed
data store — the manuals' pipeline solves scale we don't have yet. The
manuals' cadence table (reviews daily/weekly, search weekly…) is collapsed to
**monthly everything**, with each metric's `refreshCadence` labeling how often
its *source* actually changes — the manual's own honesty rule.

## Data foundations

- Manual's priority states: AZ, CA, WA, TX, FL, NY, IL, OH, PA, GA, NC.
  We cover 45 states (38 scraped + AM Best interim/permanent) — including
  CA/NY/TX — but **FL and NC are not covered** (FL pending re-pull; NC is a
  structural NCRB gap).
- Manual's carrier list was 11 (with HiRoad); we use the app's 13
  customer-facing brands (adds Safeco, COUNTRY, Encompass; drops HiRoad).

## Appendix: complete pillar-by-pillar breakdown

### 1. Price Competitiveness (30% default weight)

| | Manual | Built |
|---|---|---|
| **Measures** | Price *levels* — "is this carrier actually cheaper here?" | Price *direction* — "is this carrier raising rates slower than peers?" |
| **Formula** | Normalized inverse premium gap vs. standardized driver profile and state benchmark | Peer-ranked filed rate momentum |
| **Inputs** | Carrier monthly premium, state average premium, premium percentile, recent rate changes, discount availability | Approved/pending Personal Auto `overall_rate_impact` summed over the selected window — the manual's *supporting* input promoted to the whole pillar |
| **Source** | Quadrant / S&P RateWatch (licensed); rate filings supporting | Our own SERFF-scraped + AM Best filings (`filings.db`) — sourceTier "official"/"licensed" per row |
| **Scope** | State | State, varies with all 8 range windows |

**Built math:** for each state+window, sum each brand's rate impacts → net
movement %. Rank against peers that also filed there: least movement → 90,
most → 30, linear between; all-equal or single-brand → neutral 60. Computed
**live** in the API route (not snapshotted), windows anchored to
`data/last_updated.txt`, never the wall clock. Confidence: medium with ≥3
peers, low below. Brands with no filings in a window get *no metric*
(weights renormalize) — never a fabricated score.

**The gap, quantified:** this is the only pillar measuring a different
quantity than the manual wanted. The free bridge (implied premium from our
filings) was tested against official NV/MD/CO premium surveys — Spearman
0.03/0.35/0.60, State Farm misranked cheap by ~4 positions
(`docs/PRICE_PILLAR_VALIDATION.md`) — so the gap stays open until licensed
data exists. Every tooltip says "rate movement, not price levels."

### 2. Customer Sentiment (25%)

| | Manual (recommended) | Manual (fallback) | Built |
|---|---|---|---|
| **Formula** | 35% licensed benchmark + 25% platform ratings + 25% inverted complaint index + 15% volume/recency | **45% platform ratings + 35% inverted complaint index + 20% volume/recency** | The fallback, exactly — with two structural upgrades |
| **Sources** | J.D. Power / Consumer Reports + Google Places, Yelp, Trustpilot, NAIC | Google Places, Yelp, Trustpilot, NAIC | Google Places (10-metro sample) + App Store (iTunes) + NAIC CIS complaint index |

**Built math, per component:**
- **Platform ratings (45%):** log-volume-weighted blend of two surfaces —
  Google listing ratings (review-count-weighted across 10 fixed metros) and
  the brand's pinned App Store rating. Each surface's influence = log₁₀ of
  its review volume, so USAA's 2.3M app ratings outvote 1.5k
  corporate-office Google reviews ~2:1. Blended rating maps 3.0★→30,
  4.8★→90 (not naive ×20, which would cram everyone into the 80s).
- **Complaint index (35%):** NAIC CIS index for each brand's flagship auto
  entity (data-derived: largest multi-state Personal Auto writer by premium
  in our filings), fetched from the public Tableau CSV endpoint. Scored
  **peer-relative** — lowest index → 90, highest → 30 — because
  flagship-entity indexes skew as a cohort.
- **Volume (20%):** log₁₀ scale on combined review volume, 1M-review cap.

**Deviations from manual:** Yelp/Trustpilot skipped (no free API; heavy
complaint self-selection); review excerpts (`brand_reviews`) not built; App
Store added as a platform surface (it is in the manual's "platform" tier —
used to fix the direct-writer skew the manual never anticipated). The
peer-relative complaint scoring is ours; the manual didn't specify
normalization. Confidence: high with all three components and adequate
evidence; medium when platform evidence is thin (only Encompass today).

### 3. Website Performance (25%)

| | Manual (recommended) | Manual (fallback) | Built |
|---|---|---|---|
| **Formula** | 40% quote-flow completion test + 25% Lighthouse + 20% CrUX + 15% app proxy | **50% Lighthouse + 30% CrUX + 20% app rating proxy** | The fallback, verbatim |
| **Sources** | + synthetic Playwright quote-flow tests, Sensor Tower | PageSpeed Insights, CrUX API, app stores | PSI (one call returns Lighthouse *and* CrUX origin data) + iTunes Lookup |

**Built math:** Lighthouse mobile performance score (0–100) at 50%; CrUX =
mean share of real-user visits with "good" LCP/INP/CLS (28-day rolling)
×100 at 30%; App Store rating ×20 at 20%. Missing components drop out and
weights renormalize with integer display weights summing to 100. 13/13
brands live; Encompass lacks CrUX (low-traffic origin) → 71/29
Lighthouse/app blend, medium confidence, disclosed in the note.

**This is the most faithful pillar.** The only gap is the manual's
*recommended* upgrade: synthetic quote-flow tests (drive each carrier's
quote funnel with Playwright, measure completion friction). That's the
largest remaining upgrade that needs zero licensed data — pure engineering
time — and it would also shift the formula toward measuring *acquisition
experience* rather than homepage speed.

### 4. Search Interest (20%)

| | Manual | Built |
|---|---|---|
| **Formula** | "Normalized search interest and digital demand score by carrier, state, and period" | Peer-ranked log search volume by state and window |
| **Inputs** | Trend index (Google Trends/DataForSEO), Semrush/Similarweb traffic estimates, branded keyword volume, **trend direction**, geographic concentration | Branded keyword volume only — DataForSEO Google Ads monthly volumes, 13 pinned keywords × 45 states × 12-month series |
| **Cost** | varies by provider | ~$4.05/run |

**Built math:** for each state+range, sum each brand's monthly volumes over
the window's months (axis anchored to the latest measured month — Google
Ads lags ~1 month). Score peer-relative on **log₁₀(volume+1)**:
most-searched → 90, least → 30 — log because branded demand spans three
orders of magnitude in one state (Progressive ~18k/mo vs Encompass ~70/mo
in AZ; linear ranking would floor everyone but the leader). Q3/Q4 before
they're measured → honest no-data. Confidence medium with ≥3 peers.

**Deviations:** volume is measured where the manual leans *trend index* —
volume is arguably the stronger signal (absolute, comparable across brands)
but the manual's **trend direction** input is not shipped (the stored
12-month series contains everything needed to add it; it's a UI/scoring
decision, not a data gap). Semrush/Similarweb traffic estimates unused
(paid, redundant at our scale). Keyword construction is pinned per brand
("«brand» insurance", except bare "country financial") rather than the
manual's unspecified "canonical brand terms."

### Cross-pillar structural differences

- **Range behavior:** Price and Search genuinely re-slice per window (live
  SQL / stored monthly series). Sentiment and Website are point-in-time —
  there is no API that tells you State Farm's Google rating last Q1 — and
  their metadata says so. The manual acknowledges the same constraint (CrUX
  is 28-day rolling; complaint data annual).
- **Freshness:** Price is freshest (updates with every filings import);
  Search is monthly with a 1-month source lag; Website reflects each refresh
  run; Sentiment mixes point-in-time ratings with annual NAIC data. Each
  metric's `refreshCadence` labels its *source's* cadence, per the manual's
  honesty rule, even though everything refreshes monthly.
- **Scoring philosophy:** all four ended up peer-relative within their scope
  (momentum rank, complaint rank, log-volume rank; website's
  absolute-leaning blend is the exception) — more uniform than the manual,
  which mixed gap-normalization, weighted blends, and unspecified
  normalizations.
- **Failure behavior:** uniform across pillars and stricter than the manual
  requires — a missing component renormalizes inside the pillar, a missing
  pillar renormalizes inside the composite, and nothing is ever imputed.

## Bottom line

**Faithful:** composite engine, weights UX, metadata/confidence schema,
methodology language, sentiment/website fallback formulas, source tiers, the
"never fabricate, always disclose" discipline.
**Adapted with evidence:** price (momentum-only; premium-gap substitute failed
validation), search (volumes instead of trend index).
**Not built (descending value):** synthetic quote-flow tests for Website,
market share metric, executive summary/Ask-Questions AI layer, brand detail
modal + comparison charts/multi-state view, export, the Postgres/Blob/Queues
refresh infrastructure (its small-scale stand-in: the pending consolidated
refresh script).
