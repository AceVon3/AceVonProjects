# Price pillar — implied-premium validation study (2026-07-16)

## Question

Can `written_premium_for_program ÷ policyholders_affected` from our own
filings (the "implied average premium") be blended into the Brand Health
Price pillar as a price-LEVEL component, alongside the existing filed-rate
momentum? The dashboard_v2 integration manual's original formula wants price
levels ("normalized inverse premium gap vs standardized driver profile"),
which otherwise requires licensed feeds (Quadrant / S&P RateWatch).

## Method

Pre-registered decision rule: strong rank agreement with official data →
ship the blend; weak → keep the pillar momentum-only.

Ground truth: the three current, per-carrier, official DOI premium surveys
that a 45-state audit (three research agents, July 2026) found automatable:

- **NV** — 2026 Auto Rates Guide PDF (7 examples × 2 options × 9 ZIPs; 24 entities)
- **MD** — MIA Auto Rate Guide, Feb 2026 (22 scenarios × ZIP columns; 46+ entities)
- **CO** — DORA premium tool (sampled Denver/Colo Springs/Pueblo × Plan 1 × Drivers A–D)

Survey entities were mapped through `scripts/import_filings.py::derive_brand`
with two survey-context corrections (MGA Insurance is GAINSCO in MD, not the
dataset's State-Farm-quirk mapping; American Economy = Safeco brand;
American Family Connect = CONNECT, excluded). Compared per-state brand
rankings: implied (quality-gated: ≥2 filings, ≥5k policyholders, $400–6k/yr)
vs official median premium, Spearman rank correlation on common brands.

## Result — FAILED validation

| State | Common brands | Spearman ρ |
|---|---|---|
| NV | 6 | **0.03** |
| MD | 9 | **0.35** |
| CO | 5 | **0.60** |

Systematic per-brand bias (implied rank − official rank, + = we overprice):
State Farm **−3.7** (implied ~$1.4k everywhere vs official $2.5–3.5k — looks
artificially cheap, likely semi-annual/program-mix artifacts in its filings),
Allstate **+2.3**, Safeco **+2.0**. GEICO and USAA also misrank cheap-side.

## Decision

- **Do NOT blend implied premium into the Price pillar score.** The
  estimator is not rank-reliable; program/filing mix dominates the signal.
- **Do NOT use DOI surveys as a scoring input either** — only ~6 of 45
  covered states have a current automatable survey, and a pillar whose score
  is constructed differently per state is worse than a uniformly-imperfect
  one (decided with Ryan, 2026-07-16).
- The Price pillar **stays filed-rate momentum only**, uniformly constructed
  in all states, with its existing "rate movement, not price levels" caveat.
- Revisit only if licensed premium data (Quadrant / RateWatch) is ever
  bought — the manual's original formula becomes implementable then.

Study scripts were session-scratch (parse_nv/parse_md/parse_co/correlate.py);
this document is the durable record. Source URLs:
NV `doi.nv.gov/.../CG%20to%20Auto%20Insurance%20Rates%202026%20-%20Final.pdf`,
MD `insurance.maryland.gov/Consumer/Documents/publicnew/AutoRateGuide.pdf`,
CO `dora.state.co.us/pls/real/Ins_Survey_Reports.Report_Selection_Criteria?p_report_id=AUTO`.
