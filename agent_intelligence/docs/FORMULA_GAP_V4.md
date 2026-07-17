# Formula Gap Analysis: Shipped Pillars vs. the v4 Free-Public Spec

*Compares what's running in the Brand Health tab against the formulas in
`dashboard_v4_free_public_build_handoff_guide.pdf` /
`dashboard_v4_free_public_researched_vercel_prompt.txt` (the coworker's
revision written after the licensing findings). Verdict vocabulary:
**KEEP OURS** (we meet or exceed v4), **ADOPT** (take v4's idea),
**ADAPT** (take it with changes), **REJECT** (v4's idea is wrong for us).*

v4's own framing matches our findings — "Price is the biggest gap, customer
sentiment is the weakest data, website performance is closest to the ideal
free implementation" — and its required price caveat is nearly verbatim the
one already on our tooltips. Where v4 differs from what we shipped, it is
usually because v4 assumes a from-scratch build with **no API keys and no
billing**. We have Places billing, a PSI key, and paid DataForSEO live —
several of v4's substitutions are downgrades from our position.

---

## Composite (Brand Health)

| Element | v4 | Ours | Verdict |
|---|---|---|---|
| Weights | 30/25/20/25, user-adjustable | Identical | — |
| Missing-pillar handling | none specified — `computeBrandHealth` assumes all four present | drop + renormalize, "insufficient data" when nothing scorable | **KEEP OURS** (stricter) |
| Bands | 85/70/55 → Excellent / Good / Average / Needs Attention | same cutpoints → excellent / good / fair / weak | cosmetic label difference only |

---

## Price Competitiveness

**v4:** `70% inverse recent approved rate-change momentum + 20% public
state-average / pricing-context confidence + 10% rate-change stability`
**Ours:** 100% peer-ranked momentum (least movement → 90, most → 30).

| v4 component | Verdict | Reasoning |
|---|---|---|
| 70% inverse momentum | **KEEP OURS** | Same signal; ours specifies the normalization (peer-linear 90–30) where v4 leaves "inverse" undefined, and ours is validation-documented. |
| 20% state-average / pricing-context confidence | **REJECT as score input / ADOPT as tooltip context** | The NAIC state-average premium is *the same number for every brand in a state* — as a score component it cannot differentiate brands, only compress the spread by 20%. And scoring "confidence" rewards brands for our instrumentation, not their behavior. The underlying data (free annual NAIC report) is genuinely useful as displayed context: "state average premium ≈ $X/yr." |
| 10% rate-change stability | **ADOPT (pending sign-off)** | Genuinely differentiating and computable today: variance/erraticness of a brand's filed changes across the window. Two ways in — as a 10% score component (a published-formula change) or as display context first (consistent with the trend-arrow precedent). Recommend display-first. |

---

## Customer Sentiment

**v4:** `40% inverted NAIC complaint index + 30% app rating + 20% public
review/context score + 10% review volume and recency confidence`
**Ours:** 45% platform ratings (log-volume Google Places + App Store blend)
+ 35% peer-ranked inverted complaint index + 20% log-volume confidence.

| v4 component | Verdict | Reasoning |
|---|---|---|
| 30% app rating (as the primary platform signal) | **KEEP OURS** | v4 dropped Google Places only because it assumes no billing. We have Places live; our blend uses app ratings *and* real local-listing reviews, weighted by evidence volume. Falling back to app-only would rely on a signal compressed into a 4.69–4.83★ band for every major carrier. |
| 40% complaint index (up from 35%) | **KEEP OURS (weight)** | Reweighting toward NAIC is v4 compensating for its weaker platform signal — a compensation we don't need. Our peer-relative scoring of the index is also specified where v4's normalization isn't. |
| 20% "public review/context score" | **REJECT** | The vaguest component in v4 — unverifiable editorial/public "context" as a scored input contradicts the v2 manual's own warning against editorial sources and this app's every-number-traceable rule. Nothing in v4 defines how it's computed. |
| 10% volume/recency | **KEEP OURS** | Same idea at 20% weight with a defined log curve. |

---

## Website Performance

**v4:** `35% Lighthouse + 25% CrUX + 20% app rating + 20% quote-flow
friction heuristic`
**Ours (v2 fallback):** 50% Lighthouse + 30% CrUX + 20% app rating.

| v4 component | Verdict | Reasoning |
|---|---|---|
| 20% quote-flow friction heuristic | **ADAPT** | The one real formula upgrade v4 offers. It's the lighter cousin of v2's synthetic quote-flow tests, with a sane ops plan (scheduled CI jobs, never request-path). Needs definition work — "heuristic" is unspecified — but it moves the pillar toward measuring *how hard it is to buy* rather than homepage speed. When it ships, rebalance to something like v4's 35/25/20/20 with a methodology update. |
| Lighthouse demoted 50→35, CrUX 30→25 | **ADOPT only alongside the heuristic** | The demotion exists to fund the new component; adopting the weights without the component would just dilute measured data. |

---

## Search Interest

**v4:** `40% GDELT news mention share + 30% Wikimedia pageview share + 20%
trend direction from cached 12-month data + 10% source confidence`
**Ours:** 100% peer-ranked log search volume (DataForSEO Google Ads,
state-level), with trend direction as a display-only annotation.

| v4 component | Verdict | Reasoning |
|---|---|---|
| 40% GDELT + 30% Wikimedia as the demand signal | **REJECT as replacement** | Both are national-only and measure different things (news coverage; encyclopedia curiosity) than shopping demand. v4 itself says DataForSEO is the upgrade and these are the no-budget fallbacks — we already run the upgrade, state-scoped, for ~$4/run. Swapping would break the pillar's state scope and its published meaning. GDELT *could* someday be a separate "news awareness" signal — different metric, not this pillar. |
| 20% trend direction inside the score | **REJECT (documented disagreement)** | We deliberately ship trend as display-only: folding demand-*change* into a demand-*rank* makes "72" mean two things and silently breaks the published methodology. v4 gets away with it only because its score is already a proxy soup. If trend should ever carry weight, that's an explicit formula decision, not a default. |
| 10% source confidence as a score input | **REJECT** | Confidence is metadata everywhere in this app. Scoring it penalizes brands for *our* coverage gaps — the opposite of the renormalize-and-disclose rule every pillar follows. |

---

## Metadata schema

v4 adds `sourceAccess` (public_api / public_web / manual_upload /
paid_optional) and a first-class `caveat` field to `SourceBackedMetric`.
**ADOPT (cheap):** our `note` already carries caveats; `sourceAccess` is a
small honest addition that would also serve the methodology tab. Low
priority.

---

## Summary

| Action | Items |
|---|---|
| **KEEP OURS** (meet or exceed v4) | Momentum normalization; Places+App platform blend; complaint-index weighting + peer scoring; volume curve; DataForSEO state-level demand; renormalization rules |
| **ADOPT** | Rate-change stability signal (display-first, score later with sign-off); NAIC state-average premium as tooltip context; `sourceAccess`/`caveat` schema fields |
| **ADAPT** | Quote-flow friction heuristic → then v4's 35/25/20/20 website weights |
| **REJECT** | GDELT/Wikimedia as the search signal; trend direction and source confidence as score inputs; "public review/context" component; state-average as a price score component; regression to seeded data |

Net: v4 ratifies the shipped architecture (its formulas moved *toward* what
we built), contributes two cheap context upgrades and one real formula
upgrade (quote-flow), and its remaining differences are artifacts of
assuming a zero-key, zero-budget build we've already outgrown.

---

## Addendum (2026-07-17): quote-flow heuristic attempted — shipped DORMANT

The probe (`scripts/brand_health/probe_quoteflow.ts`) and the full scoring
path (`pathScore`/`speedScore`/`quoteFlowScore`, 4-component `scoreWebsite`)
are built and verified, but the component is **dormant at weight 0**:

- Three probe runs measured 7/13, 4/13, and 6/13 brands, with brands
  flapping between measured and blocked run-to-run (Progressive and
  Nationwide measured in run 1, bot-walled in runs 2-3; State Farm and
  Allstate only appeared once using the real-Chrome channel). Carrier bot
  management reacts to repeated automated visits.
- Decision rule (same argument as the per-state price surveys): a formula
  component that exists for a shifting minority of brands makes the score
  mean different things per brand and per month. Coverage floor for
  activation: **>= 10/13 brands, stable across consecutive runs**.
- Measured friction data (for when it activates): ZIP-on-homepage in ~5s —
  Travelers, State Farm, Liberty Mutual, Farmers, Progressive, Nationwide;
  1-click flows — American Family (~7s), Allstate (~14s); consistently
  blocked — GEICO, USAA (hard walls); no CTA detected — COUNTRY, Encompass.
- Activation paths: (a) one-time **manual audit** (~20 min in a normal
  browser, recorded into `brandHealthQuoteFlowData.ts` as manual_upload —
  v4 §12 Phase C explicitly sanctions manual ingestion), refreshed
  quarterly; (b) scheduled CI probe from a different network vantage;
  (c) both — manual baseline, automation where it works.
