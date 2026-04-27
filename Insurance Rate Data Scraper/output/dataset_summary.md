# Insurance Rate Filings — Five-State Dataset

**Canonical deliverable:** `output/all_states_final_rates.xlsx` (sheet `rate_filings`) and `output/all_states_final_rates.csv`.

## What this dataset contains

249 rate-filing rows for personal-lines insurance across **Idaho, Washington, Colorado, Oregon, and Utah**, structured to match AM Best's Disposition Page Data export. Each row represents one carrier subsidiary's per-program rate impact under a specific SERFF filing.

| State | Rows |
|------:|-----:|
| ID    |   43 |
| WA    |   20 |
| CO    |   91 |
| OR    |   45 |
| UT    |   50 |
| **Σ** | **249** |

### Per-state per-brand breakdown

| State | State Farm | GEICO | Allstate | Encompass | Travelers | Liberty Mutual | Safeco | Progressive | Total |
|------:|----:|----:|----:|----:|----:|----:|----:|----:|----:|
| ID    |   5 |   6 |  16 |   4 |   0 |   5 |   4 |   3 |  43 |
| WA    |   1 |   6 |   9 |   2 |   0 |   0 |   2 |   0 |  20 |
| CO    |  20 |  18 |  18 |   4 |   5 |  12 |   4 |  10 |  91 |
| OR    |   9 |   1 |  14 |   1 |   0 |   4 |   8 |   8 |  45 |
| UT    |   6 |  13 |  15 |   0 |   1 |  10 |   5 |   0 |  50 |
| **Σ** |  41 |  44 |  72 |  11 |   6 |  31 |  23 |  21 | **249** |

## Scope: Major customer-facing personal lines brands

This dataset tracks **8 brands** that operate as distinct customer-facing insurers in their target markets:

- **Six flagship national brands:** State Farm, GEICO, Allstate, Travelers, Progressive, Liberty Mutual
- **Two independent-agent brand subsidiaries:** Safeco (owned by Liberty Mutual), Encompass (owned by Allstate)

The two independent-agent brands are included because they operate as distinct customer-facing brands with their own agent networks, policy forms, and filing activity. When Safeco raises rates, Safeco customers are affected — not Liberty Mutual direct-channel customers.

**Explicitly excluded subsidiaries:**
- **National General / Integon** (specialty non-standard auto; different market segment; Allstate-acquired 2021)
- **Standard Fire Insurance** (Travelers filing vehicle, not marketed as a separate brand)
- **LM General / LM Insurance Corp** (Liberty Mutual filing vehicles, not customer-facing brands)
- **Drive Insurance** (Progressive, retired 2020)
- **Esurance** (Allstate, wound down 2020)
- **United Financial** (Progressive specialty) and other niche specialty subsidiaries

The scope criterion is *"does this entity represent a distinct brand that customers interact with and recognize?"* — **not** *"does this entity share a corporate parent with a major brand?"*

## Methodology

1. **Discover.** Search SERFF Public Filing Access (`filingaccess.serff.com`) per state by carrier-group keyword — one keyword per in-scope brand (see Scope section above).
2. **Filter.** Keep only target NAIC TOI codes (19.0 Personal Auto, 04.0 Homeowners) for the 8 in-scope brands.
3. **Download.** From each filing's detail page, click "Download Zip File" with **no checkboxes selected** to receive a ~20 KB minimal zip containing the system-generated Filing Summary PDF.
4. **Parse.** Extract the Disposition / Company Rate Information table from the PDF. Five row layouts are handled (full / blank-indicated / sparse / blank-indicated+blank-max/min with and without premium change).
5. **Exclude.** Drop Form-only / Rule-only filings, **true** new-program launches, and filings the filer flagged with "Rate data does NOT apply to filing." The new-product detector is anchored to header fields (`Project Name/Number`, `Company Tracking #`) or requires "introduction of …" body text to be followed by a product-launch noun (`Program`, `line of business`); it does not trip on rating-factor additions, deductible tweaks, discount changes, or process-only updates.
6. **Expand.** One row per subsidiary listed in the per-company rate table. For multi-company filings the `Multiple` company label is replaced by the actual subsidiary name from the table. Within a single filing, subsidiaries are deduped by name to avoid the parser emitting one row per Disposition section when a filing has multiple amendments.

## Validation

**Anchor:** Idaho filing **SFMA-134676753** matches AM Best Disposition Page Data on **all 14 fields** (effective date, indicated %, impact %, written premium change, policyholders, written premium for program, max %, min %, rate activity, tracking number, disposition status, filing date, company, line of business).

## Field definitions

| Column | Meaning |
|---|---|
| `state` | Two-letter state code |
| `effective_date` | Requested effective date (Renewal preferred over New) |
| `company_name` | Subsidiary writing the rate; per-row expansion when multiple |
| `line_of_business` | NAIC parent TOI code + label (kept for AM Best compatibility) |
| `sub_type_of_insurance` | NAIC Sub-TOI code + label (e.g. `19.0001 Private Passenger Auto (PPA)`, `19.0002 Motorcycle`, `19.0003 RV`) |
| `overall_indicated_change` | Filer's actuarially indicated change (may be blank when filer omits) |
| `overall_rate_impact` | Filed rate impact (the change actually requested) |
| `written_premium_change` | Effect of rate filing on written premium, USD |
| `policyholders_affected` | Count of policyholders impacted |
| `written_premium_for_program` | Total written premium for the program, USD |
| `maximum_percent_change` | Largest individual policyholder increase |
| `minimum_percent_change` | Largest individual policyholder decrease |
| `rate_activity` | `rate_change` / `rate_change_withdrawn` / `rate_change_disapproved` / `rate_change_pending` |
| `serff_tracking_number` | SERFF filing tracking number (carrier-prefixed) |
| `disposition_status` | State decision: `Approved` / `Filed` / `Withdrawn` / `Disapproved` / `Pending` (case as filed) |
| `filing_date` | Date submitted to the state |
| `source_pdf` | Relative path to the cached system PDF |

## Scope and limitations

- **States:** ID, WA, CO, OR only.
- **Lines:** Personal Auto (TOI 19.0) and Homeowners (TOI 04.0) only. Farmowners explicitly out of scope.
- **Carriers:** See Scope section above — 8 customer-facing brands; filing-vehicle subsidiaries and specialty acquisitions explicitly excluded.
- **Date range:** SERFF Public Access search window 2025-01-01 → 2026-04-17. Filings submitted before 2025-01-01 are not in the dataset even if their effective date falls inside the window (this is the cause of the two AM Best WA misses below).
- **Disposition status:** PENDING / Re-Open / Withdrawn filings are kept and labeled in `rate_activity`; only filings with no rate data at all (filer flag below) are excluded.
- **Filer flag:** When the filer flagged "Rate data does NOT apply to filing," the row is excluded — this flag is taken at face value.
- **PDF parsing:** Five Disposition row patterns are supported. Within a filing, subsidiary rows are deduped by name so multi-amendment filings (multiple Disposition sections) emit one row per subsidiary using the most recent disposition's values. Layouts outside the supported patterns may be missed.
- **Disposition cases:** ID uses ALL-CAPS (`APPROVED`); WA uses `Approved`; CO uses `Filed` (file-and-use); OR uses `Approved` / `Filed`; UT uses `FILED FOR USE` (file-and-use) and `REJECTED` (equivalent to other states' `Disapproved`). Casing preserved as filed. The `rate_activity` classifier maps `REJECTED → rate_change_disapproved` alongside the standard `WITHDRAWN`/`DISAPPROVED`/`PENDING` patterns.
- **Filing-vehicle subsidiary exclusion:** When a customer-facing-brand filing's per-company rate table lists subsidiary names that are themselves filing vehicles or out-of-scope specialty acquisitions (`LM General Insurance Company`, `LM Insurance Corporation`, `Standard Fire Insurance`, `Integon`, `National General`, `Esurance`, `Drive Insurance`, `United Financial`), those individual rows are dropped at emission time — the parent filing is kept but the filing-vehicle row is suppressed. Enforced in `run_final_rates.py:_is_excluded_subsidiary`.

## AM Best WA cross-check (2025-01-01 to 2026-04-17, PPA only)

| Result | Count |
|---|---:|
| Matched (subsidiary + policyholders + impact %) | 12 |
| In AM Best, missing from ours | 2 |
| In ours, not in AM Best report | 8 |

The 2 unmatched-from-AM-Best entries are both submission-window misses (filed before our 2025-01-01 SERFF search window even though their effective dates fall inside it):
1. **Progressive Casualty 03/07/25** (4.5%, 46,504 pol) — submission 12/12/2024.
2. **Encompass Indemnity 07/12/25** (19.6%, 6,098 pol) — submission also pre-2025-01-01.

The 8 in-ours-not-in-AM-Best entries are all expected: 5 are Homeowners filings (AM Best PPA report excludes HO), and 3 are 0% PPA filings that AM Best Disposition reports as N/A for trivial 0% changes.

## AM Best OR cross-check (AM Best PPA report, 2026-04-24 export)

Scope filter: AM Best report is PPA-only. Our OR PPA bucket aggregates sub-types `19.0001` (PPA), `19.0000` (Personal Auto Combinations), and `19.0002` (Motorcycle) to align with AM Best's PPA classification.

| Result | Count |
|---|---:|
| Matched — direct (subsidiary + effective date + impact %) | 25 |
| Matched — via sub-type reclassification (same filing, coded differently) | 4 |
| Out-of-scope entities in AM Best (not scraper gaps) | 6 |
| **In-scope match rate** | **29 / 29 (100%)** |

**The 6 "missing from ours" rows are all out-of-scope entities** — correctly excluded per the Scope section above, not scraper bugs:

| Subsidiary | Parent | Why excluded |
|---|---|---|
| Standard Fire Insurance Company (×2 filings) | Travelers | Filing vehicle, not customer-facing brand |
| Integon Indemnity Corporation (×2 filings) | Allstate (National General) | Specialty non-standard auto, different market segment |
| LM General Insurance Company (×1) | Liberty Mutual | Filing vehicle, not customer-facing brand |
| LM Insurance Corporation (×1) | Liberty Mutual | Filing vehicle, not customer-facing brand |

The 33 in-ours-not-in-AM-Best entries are a mix of future-dated filings past the AM Best 2026-04-24 export cutoff, zero-impact filings that AM Best lists as N/A, and 12 homeowners/motorcycle/combinations sub-type rows outside AM Best PPA scope.

## Pending-coverage characterization (pre-Utah expansion, 2026-04-27)

Before expanding to Utah, the dataset's "what's coming next" signal was characterized by inspecting the 3 pending rows (`rate_activity = rate_change_pending`) and validating coverage against live SERFF.

**Pending rows in dataset:** 3 of 200 (1.5%)

| SERFF | State | Carrier | LOB | Filed | Effective | Filing impact |
|---|---|---|---|---|---|---|
| SFMA-134872376 | ID | State Farm Fire and Casualty | HO | 2026-03-13 | 07/15/2026 | 9.9% (72.8% indicated) |
| GMMX-134895766 | ID | Encompass Indemnity | PPA | 2026-04-01 | 06/22/2026 | 0.0% |
| ALSE-134886800 | OR | Allstate North American Insurance | PPA | 2026-03-30 | 04/14/2026 | 0.5% |

**ALSE-134886800 post-scrape refresh (2026-04-27):** Re-fetched SERFF detail page on 2026-04-27 — `state_status` and `filing_status` both still `Review pending`; no `disposition_status` set; no `disposition_date`. Filing remains pending **13 days past its filed effective date of 2026-04-14** (the OR DOI has not yet acted). Row was not modified — current dataset values still reflect SERFF state of record.

**WA pending coverage — structurally thin (validated):** A live SERFF search across all 8 in-scope brands in WA on 2026-04-27 (no end-date cap) returned **zero** Personal Auto (TOI 19.0001/19.0000) or Homeowners (TOI 04.0) filings in `Review Pending` / `Active Suspense` / `Referred` / `Re-Open` status. The only post-scrape pending-ish hit was SFMA-134763221 (State Farm RV, sub-TOI 19.0003, `Active Suspense` since 2025-12-08) — the same row already present in the raw WA data, correctly excluded from the final dataset because RV is outside our PPA/HO scope. Raw `wa_final.xlsx` confirms the pipeline captures pending dispositions correctly: 2 `Review Pending` rows submitted 2026-04-15 (within DATE_TO=04/17) were correctly filtered out as Commercial Multi-Peril (CMP) and Commercial Umbrella & Excess — out of personal-lines scope. WA personal-lines pending = 0 is genuine, not a pipeline gap.

**Search window — DATE_TO retained at 2026-04-17:** This cutoff aligns with the AM Best validation export dates (WA: 2026-04-17 window; OR: 2026-04-24 export). All 3 pending rows in the dataset were filed well before 04/17 (most-recent filing 04/01), so extending DATE_TO to today would not have surfaced additional pending coverage — pending filings tend to have older filing dates because they accumulate while awaiting review. Decoupling the search window from validation alignment is deferred to Phase 2.

**Phase 2 backlog item — `refresh_pending.py`:** Build a periodic job that re-queries SERFF detail pages for filings in our dataset where `disposition_status ∈ {Pending, Review pending, PENDING, Active Suspense}`. This decouples pending-status freshness from full-search re-runs and keeps DATE_TO aligned with AM Best.

## Utah expansion (added 2026-04-27)

UT was added bringing the dataset to 5 states / 249 rows (+50 UT rows; -1 CO row from filing-vehicle exclusion fix back-applied). Expansion notes:

- **Search:** 274 raw filings across 7 brands (Encompass=0; both retries confirmed Encompass has no UT presence). Progressive and Allstate timed out on initial `--all-companies` run and were retried separately, then merged via `merge_ut_search.py`.
- **Final-rates:** 100 target-TOI target-carrier filings → 30 emitted → 50 rows (after subsidiary expansion and 2 filing-vehicle rows dropped).
- **Per-brand:** Allstate 15, GEICO 13, Liberty Mutual 10, State Farm 6, Safeco 5, Travelers 1, Encompass 0, Progressive 0. (Progressive UT filings were all Form/Rule or "rate-data-does-not-apply"; Safeco contributes 5 rows via "First National Insurance Company of America" and "General Insurance Company of America" subsidiary names.)
- **New disposition vocabulary discovered:** UT uses `FILED FOR USE` and `REJECTED`. The classifier was extended to map `REJECTED → rate_change_disapproved` (5 rows on filing GECC-134721778, RV).
- **Spot-check validation:** SFMA-134384912 (State Farm HO 7.9%), GECC-134721778 (GEICO RV REJECTED, 5 subsidiaries), ALSE-134652121 (Allstate PPA, 3 subsidiaries) — all extracted values match the source PDFs exactly. ID anchor SFMA-134676753 still validates 14/14.
- **AM Best UT validation deferred to Phase 2.** No AM Best UT PPA report was available at run time. The pipeline pattern is identical to the validated WA/OR pipelines (same parser, same scope, same exclusion logic), so this is a known low-risk deferral rather than an unknown.

**Phase 2 backlog item — `validate_ut_against_ambest.py`:** Mirror `compare_or_ambest.py` for Utah. Cross-check our 50 UT rows against AM Best's UT PPA Disposition Page Data export when it becomes available, and document the in-scope match rate.

## Recommended use

- Comparative analysis of approved/filed rate changes across ID/WA/CO/OR for the 8 in-scope brands.
- Cross-reference to AM Best Disposition Page Data using `serff_tracking_number`.
- **Not** a substitute for full-state market analysis — scope is bounded by the brand and line filters above.

## Reproducibility

```bash
.venv/Scripts/python run_final_rates.py ID
.venv/Scripts/python run_final_rates.py WA
.venv/Scripts/python run_final_rates.py CO
.venv/Scripts/python run_final_rates.py OR
.venv/Scripts/python run_final_rates.py UT
.venv/Scripts/python build_all_states.py
```

System PDFs are cached idempotently under `output/pdfs/{state}/{filing_id}/filing_summary.pdf`, so re-runs only re-parse.
