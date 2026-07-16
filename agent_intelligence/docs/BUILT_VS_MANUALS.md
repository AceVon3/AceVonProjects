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
