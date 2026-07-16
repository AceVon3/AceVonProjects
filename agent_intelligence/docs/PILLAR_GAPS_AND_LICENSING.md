# Brand Health Pillars: Gaps vs. the Manuals & the Licensing Walls Behind Them

*Companion to `BUILT_VS_MANUALS.md`. This document covers ONLY the four
pillars — where each deviates from the dashboard_v2 manuals' spec, and why:
in every case the gap traces to a data source that is licensed, expensive,
or access-gated. Current live stack cost for comparison: **~$4/month**
(DataForSEO) + free Google API quota.*

---

## 1. Price Competitiveness — the widest gap, the tallest wall

**Manual spec:** normalized inverse premium gap vs. a standardized driver
profile and state benchmark — *what each carrier would actually charge*.

**Built:** filed rate momentum — *which carrier is raising rates slower than
peers* — from our own SERFF/AM Best filings. A different measurement: a brand
can take the state's biggest increase and still be its cheapest option.

### The data-source limitation
The manual's formula needs carrier-level premiums for defined driver
profiles. Exactly three source classes can produce that, and all are walled:

| Source | Wall | Realistic cost |
|---|---|---|
| **Quadrant Information Services** | Rating-engine data licensed B2B to carriers; no self-serve tier, no API without contract | Five figures+/yr |
| **S&P RateWatch / product filings** | Same raw material, same enterprise licensing | Five figures+/yr |
| Licensed quote-marketplace feeds | Contract + data-use restrictions | Varies, enterprise |

Free substitutes were exhausted empirically (July 2026):
- **Implied premium from our own filings** (written premium ÷ policyholders):
  **failed validation** against official NV/MD/CO DOI premium surveys —
  Spearman 0.03/0.35/0.60, State Farm systematically misranked ~4 positions
  cheap. Not rank-reliable; not shipped. (`PRICE_PILLAR_VALIDATION.md`)
- **State DOI premium surveys** (official, free, per-carrier): only ~6 of our
  45 states have a current automatable one (NV, CO, MD, ND, OK, HI). Partial
  coverage would make the score mean different things in different states —
  rejected on uniformity grounds. Retained as validation ground truth only.
- **Editorial pages (U.S. News, NerdWallet, Bankrate…):** their numbers ARE
  Quadrant data, republished under license. Scraping them is unlicensed
  redistribution; the manual explicitly forbids using them as primary data.

**Bottom line:** the pillar measures movement instead of levels because
levels are only purchasable. Every tooltip discloses this. The blend design
and validation harness are ready if a license is ever bought.

---

## 2. Customer Sentiment — fallback formula shipped; the gold standard is licensed

**Manual spec (recommended):** 35% **licensed satisfaction benchmark** + 25%
platform ratings + 25% inverted complaint index + 15% volume/recency.

**Built:** the manual's own no-license fallback (45% platform ratings + 35%
inverted NAIC complaint index + 20% volume), upgraded with a log-volume
Google + App Store blend and peer-relative complaint scoring.

### The data-source limitations
| Source | Status | Wall / cost |
|---|---|---|
| **J.D. Power** (U.S. Auto Insurance Study) | not used | Syndicated study license typically ~$30–80k/yr per study, **internal use only**; displaying scores in a sellable product requires commercial republication rights on top — realistically mid-5 to low-6 figures/yr. Public jdpower.com scores are viewable but scraping/republishing them is unlicensed redistribution. |
| **Consumer Reports** | not used | Licensed; CR rarely licenses for commercial redistribution at all. |
| **Yelp / Trustpilot** | not used | No free API tier fit for this; heavy complaint self-selection bias anyway. |
| Google Places | used | Free-quota API, but a 10-metro sample with structural channel skew (agent storefronts vs. corporate offices) — mitigated by the app-store blend, not eliminated. |
| App Store ratings | used | Free, but compressed at the top (majors all 4.69–4.83★) — limited discriminating power. |
| NAIC complaint index | used | Free and official, but a single-flagship-entity, all-lines, annual proxy. |

**Bottom line:** this is our weakest-data pillar *because* its best source is
the most expensive one relative to product stage. The recommended formula is
a drop-in upgrade the day a benchmark is licensed — the 35% slot is reserved
for it in the manual's own design.

---

## 3. Website Performance — no licensing wall; the gap is engineering time

**Manual spec (recommended):** 40% **synthetic quote-flow completion tests**
+ 25% Lighthouse + 20% CrUX + 15% app proxy.

**Built:** the manual's fallback (50% Lighthouse + 30% CrUX + 20% app
rating), verbatim, 13/13 brands live.

### The data-source limitations
| Source | Status | Wall / cost |
|---|---|---|
| Synthetic quote-flow tests | not built | **No license needed** — Playwright scripts driving each carrier's quote funnel. The wall is engineering + maintenance (13 funnels that change without notice, bot-detection on carrier sites), not money. |
| **Sensor Tower** (app intelligence) | not used | Licensed, enterprise pricing; App Store ratings serve as the free proxy. |
| PageSpeed / CrUX | used | Free with API key. The only per-brand gap: low-traffic origins (Encompass) have no CrUX field data — disclosed, weights renormalize. |

**Bottom line:** the most faithful pillar, and the one place the manual's
*recommended* formula is reachable without buying anything. Quote-flow
testing is the highest-value unfunded upgrade in the whole feature — it
would shift the pillar from "how fast is the homepage" toward "how hard is
it to buy," which is what agents actually care about.

---

## 4. Search Interest — cheapest gap; partially self-imposed

**Manual spec:** normalized search interest/trend index by carrier, state,
period — inputs include a trend index, traffic estimates, branded keyword
volume, **trend direction**, geographic concentration.

**Built:** DataForSEO Google Ads branded-keyword volumes (13 keywords × 45
states × 12-month series, ~$4.05/run), peer-ranked on log volume per
state+window.

### The data-source limitations
| Source | Status | Wall / cost |
|---|---|---|
| DataForSEO | **used** | ~$4/run — the one paid source in production; $50 min deposit ≈ a year of refreshes. |
| **Google Trends API (official)** | not used | Free but **alpha, invite/waitlist-gated**. Worth requesting access; not worth blocking on. |
| Google Trends (unofficial scrapers) | rejected | ToS-gray, aggressively rate-limited, breaks routinely — a fragility we deliberately kept out of the pipeline. |
| **Semrush / Similarweb** | not used | Paid API tiers (hundreds/mo+) for traffic estimates that duplicate what volumes already tell us at our scale. |
| Trend direction | not shipped | **No wall at all** — the stored 12-month series already contains it; adding a rising/falling signal is a UI/scoring decision, not a data purchase. |

**Bottom line:** the smallest gap and the cheapest to close further. The only
manual input genuinely missing (trend direction) is computable from data we
already own.

---

## The cost ladder, summarized

| Upgrade | Pillar | What it buys | Order of cost |
|---|---|---|---|
| Trend direction from stored series | Search | Manual's missing input | $0 — already own the data |
| Synthetic quote-flow tests | Website | Manual's recommended formula | $0 data / real engineering time |
| Google Trends official API access | Search | Trend index alongside volumes | $0, access-gated |
| DataForSEO (in production) | Search | State-level branded demand | ~$4/month ✅ paid |
| Semrush / Similarweb | Search | Traffic estimates (redundant) | ~$100s/month |
| **Quadrant / S&P RateWatch** | **Price** | **True price levels — the manual's actual formula** | **Five figures+/yr** |
| **J.D. Power license + republication** | **Sentiment** | **Licensed benchmark at 35% weight** | **Mid-5 to low-6 figures/yr** |

Two structural observations:
1. **The two most expensive licenses map to the two pillars that deviate
   most from spec.** That's not coincidence — the manuals' recommended
   formulas were written for a licensed-data budget, and the fallbacks for
   ours. We are running the fallback tier at ~$4/month, with the deviations
   disclosed per metric.
2. **The best free upgrades left are not data purchases**: quote-flow tests
   and trend direction close real gaps with engineering alone. If budget
   ever appears, Quadrant closes the biggest measurement gap (Price);
   J.D. Power fixes the weakest data (Sentiment).
