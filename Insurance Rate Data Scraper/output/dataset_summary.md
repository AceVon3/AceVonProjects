# Insurance Rate Filings — Five-State Dataset

**Canonical deliverable:** `output/all_states_final_rates.xlsx` (sheet `rate_filings`) and `output/all_states_final_rates.csv`.

## What this dataset contains

320 rate-filing rows for personal-lines insurance across **Idaho, Washington, Colorado, Oregon, and Utah**, structured to match AM Best's Disposition Page Data export. Each row represents one carrier subsidiary's per-program rate impact under a specific SERFF filing whose **effective date** falls in `[2025-01-01, 2026-04-17]`.

| State | Rows |
|------:|-----:|
| ID    |   53 |
| WA    |   34 |
| CO    |  100 |
| OR    |   48 |
| UT    |   85 |
| **Σ** | **320** |

### Per-state per-brand breakdown

| State | State Farm | GEICO | Allstate | Encompass | Travelers | Liberty Mutual | Safeco | Progressive | Total |
|------:|----:|----:|----:|----:|----:|----:|----:|----:|----:|
| ID    |   7 |   6 |  19 |   3 |   2 |  10 |   3 |   3 |  53 |
| WA    |   3 |   6 |  14 |   3 |   3 |   0 |   3 |   2 |  34 |
| CO    |  26 |  18 |  21 |   4 |   5 |  13 |   3 |  10 | 100 |
| OR    |  10 |   1 |  13 |   1 |   0 |   8 |   7 |   8 |  48 |
| UT    |  10 |  20 |  24 |   0 |   2 |  13 |   6 |  10 |  85 |
| **Σ** |  56 |  51 |  91 |  11 |  12 |  44 |  22 |  33 | **320** |

State Farm row counts include filings made under the **MGA Insurance Company, Inc.** subsidiary brand (a State Farm-owned filer that submits under its own name on SERFF). MGA Insurance was added as a separate SERFF search keyword in the Item #3a resolution (2026-05-15) and is classified back into State Farm via `GROUP_KW["State Farm"]`.

## Scope: Major customer-facing personal lines brands

This dataset tracks **8 brands** that operate as distinct customer-facing insurers in their target markets:

- **Six flagship national brands:** State Farm, GEICO, Allstate, Travelers, Progressive, Liberty Mutual
- **Two independent-agent brand subsidiaries:** Safeco (owned by Liberty Mutual), Encompass (owned by Allstate)

The two independent-agent brands are included because they operate as distinct customer-facing brands with their own agent networks, policy forms, and filing activity. When Safeco raises rates, Safeco customers are affected — not Liberty Mutual direct-channel customers.

**Explicitly excluded subsidiaries:**
- **National General / Integon** (specialty non-standard auto; different market segment; Allstate-acquired 2021)
- **Standard Fire Insurance** (Travelers filing vehicle, not marketed as a separate brand)
- **LM General / LM Insurance Corp** (Liberty Mutual filing vehicles, not customer-facing brands)
- **American Economy Insurance Company** (Liberty Mutual filing entity; no consumer website, no own agent channel, AM Best rating consolidated under LM, sold under Safeco's umbrella; matches LM General/Standard Fire pattern — see Item #3b in Phase 2 backlog for research findings)
- **Drive Insurance** (Progressive, retired 2020)
- **Esurance** (Allstate, wound down 2020)
- **United Financial** (Progressive specialty) and other niche specialty subsidiaries

The scope criterion is *"does this entity represent a distinct brand that customers interact with and recognize?"* — **not** *"does this entity share a corporate parent with a major brand?"*

## Methodology

The dataset is **effective-date aligned with AM Best** while accommodating SERFF's submission-date-only search interface. Two date windows are in play:

- **Submission window** (`DATE_FROM = 2024-07-01` to `DATE_TO = 2026-04-17`): used by the SERFF search. The 2024-07-01 start is a 6-month lookback that ensures filings submitted before 2025-01-01 with effective dates inside the AM Best window are still captured (SERFF cannot filter by effective date).
- **Effective-date emit filter** (`EFFECTIVE_DATE_FROM = 2025-01-01` to `EFFECTIVE_DATE_TO = 2026-04-17`): applied at row emission in `run_final_rates.py`. Rows whose parsed effective date falls outside this window are dropped. Rows with **blank** effective date are KEPT (filer omitted the field; we don't silently drop).

The dataset's date axis is therefore *effective date*, which matches AM Best's matching methodology directly.

1. **Discover.** Search SERFF Public Filing Access (`filingaccess.serff.com`) per state by carrier-group keyword — one keyword per in-scope brand (see Scope section above). Submission window 2024-07-01 → 2026-04-17.
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
- **Date range:** Effective-date window 2025-01-01 → 2026-04-17 (the AM Best validation cutoff). SERFF submission window widened to 2024-07-01 → 2026-04-17 so pre-2025 submissions with in-window effective dates are captured. The effective-date filter is applied at row emit time in `run_final_rates.py`.
- **Disposition status:** PENDING / Re-Open / Withdrawn filings are kept and labeled in `rate_activity`; only filings with no rate data at all (filer flag below) are excluded.
- **Filer flag:** When the filer flagged "Rate data does NOT apply to filing," the row is excluded — this flag is taken at face value.
- **PDF parsing:** Six Disposition row patterns are supported (full / blank-indicated / sparse / blank-indicated+blank-max-min with and without premium change / full-with-blank-max-min). Within a filing, subsidiary rows are deduped by name so multi-amendment filings (multiple Disposition sections) emit one row per subsidiary using the most recent disposition's values. Subsidiary-name lines that wrap across multiple PDF lines are folded by the existing continuation loop after the first line matches a row pattern.
- **Disposition cases:** ID uses ALL-CAPS (`APPROVED`); WA uses `Approved`; CO uses `Filed` (file-and-use); OR uses `Approved` / `Filed`; UT uses `FILED FOR USE` (file-and-use) and `REJECTED` (equivalent to other states' `Disapproved`). Casing preserved as filed. The `rate_activity` classifier maps `REJECTED → rate_change_disapproved` alongside the standard `WITHDRAWN`/`DISAPPROVED`/`PENDING` patterns.
- **Filing-vehicle subsidiary exclusion:** When a customer-facing-brand filing's per-company rate table lists subsidiary names that are themselves filing vehicles or out-of-scope specialty acquisitions (`LM General Insurance Company`, `LM Insurance Corporation`, `Standard Fire Insurance`, `Integon`, `National General`, `Esurance`, `Drive Insurance`, `United Financial`), those individual rows are dropped at emission time — the parent filing is kept but the filing-vehicle row is suppressed. Enforced in `run_final_rates.py:_is_excluded_subsidiary`.

## AM Best WA cross-check (2025-01-01 to 2026-04-17, PPA only)

| Result | Count |
|---|---:|
| Matched (subsidiary + policyholders + impact %) | 12 |
| In AM Best, missing from ours | 2 |
| In ours, not in AM Best report | 21 |

**Phase C did NOT improve the WA match rate** (still 12/14). The 2 unmatched entries are now confirmed (via Item #4 investigation 2026-05-15) to be **genuine SERFF Public Access visibility gaps** — a structural limitation, not a fixable scraper bug:

1. **Progressive Casualty 03/07/25** (4.5%, 46,504 pol) — filed 2024-12-12 (inside the new 2024-07-01 lookback window).
2. **Encompass Indemnity 07/12/25** (19.6%, 6,098 pol) — filed 2025-03-12 (was inside the *original* DATE_FROM=2025-01-01 window all along; never visible to our scraper despite multiple keyword angles).

**Root cause confirmed:** SERFF provides filer-controlled public visibility via a "Public Access Indicator" field on each filing. Filings marked private do not appear in SERFF Public Access search results, even when approved by the state. Live re-search on 2026-05-15 across "encompass" (22 hits), "allstate" (55 hits), "indemnity" (31 hits — all ACE/Chubb), and "progressive" (8 hits) confirmed neither AM Best filing appears under any reasonable carrier keyword. WA OIC's own website (`insurance.wa.gov`) directs property/casualty rate-filing searches to SERFF Public Access — no separate state-only portal exists for our scope. AM Best obtains these filings through licensed state DOI data-sharing arrangements that public scrapers cannot replicate. See the new [SERFF Public Access Limitations](#serff-public-access-limitations) section below.

The in-ours-not-in-AM-Best entries are all expected: a mix of Homeowners filings (AM Best PPA report excludes HO), 0% PPA filings that AM Best reports as N/A, and additional pre-2025-submission rows recovered by the new lookback that AM Best may not have indexed at export time.

## AM Best OR cross-check (AM Best PPA report, 2026-04-24 export)

Scope filter: AM Best report is PPA-only. Our OR PPA bucket aggregates sub-types `19.0001` (PPA), `19.0000` (Personal Auto Combinations), `19.0002` (Motorcycle), and `19.0004` (Other Personal Auto) to align with AM Best's PPA classification.

After Phase C re-run (DATE_FROM=2024-07-01 lookback) and the Item #4 investigation's compare-script fix (2026-05-15):

| Result | Count |
|---|---:|
| Matched — direct (subsidiary + effective date + impact %) | 29 |
| In AM Best, missing from ours — out-of-scope filing vehicles | 6 |
| **In-scope match rate** | **29 / 29 (100%)** |

**6 out-of-scope entities** (correctly excluded per Scope; not scraper gaps):

| Subsidiary | Parent | Why excluded |
|---|---|---|
| Standard Fire Insurance Company (×2 filings) | Travelers | Filing vehicle, not customer-facing brand |
| Integon Indemnity Corporation (×2 filings) | Allstate (National General) | Specialty non-standard auto |
| LM General Insurance Company (×1) | Liberty Mutual | Filing vehicle |
| LM Insurance Corporation (×1) | Liberty Mutual | Filing vehicle |

**Item #4 investigation note (2026-05-15):** A previous version of `compare_or_ambest.py` had `_is_ppa()` filtering only `19.0001` and `19.0000`, omitting `19.0002` (Motorcycle) and `19.0004` (Other Personal Auto). AM Best's PPA aggregation includes all four. The omission hid 4 valid in-scope matches (Allstate Insurance Company eff 07/21/25 31% in 19.0004; Progressive Universal, Artisan & Truckers, Safeco of Oregon all in 19.0002), incorrectly counting them as missing. Those filings are present in our data with correct rate-effect values; the bug was solely in the comparison script's filter. After fix, OR returns to its previously documented 29/29 (100%) in-scope match rate. Pattern parity with `compare_ut_ambest.py` restored.

The "in our OR PPA but not in AM Best report" entries are a mix of future-dated filings past the AM Best 2026-04-24 export cutoff, zero-impact filings that AM Best lists as N/A, additional pre-2025-submission rows recovered by the lookback, and homeowners sub-type rows outside AM Best PPA scope.

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

## AM Best UT cross-check (AM Best PPA report, 2026-04-27 export)

Source: AM Best Best's State Rate Filings UT PPA report (12,001 filings raw; deduplicates to 110 unique subsidiary entries after removing PDF page-break repetition; **21 in scope** for our 8 brands × Rate filing-action × 2025-01-01→2026-04-17 effective-date window with `EXCLUDED_SUBSIDIARY_PATTERNS` applied). Scope filter parity with `compare_or_ambest.py`.

Match keys: AM Best dates use disposition/approved date while ours use filed effective date — these can differ by 8-42 days in some cases. Strict (subsidiary + effective_date + impact) yields 0 matches. Adopting a tiered match policy (mirrors OR cross-check intent):

| Match tier | Count | Definition |
|---|---:|---|
| Tier 1 — Direct (sub + eff_date + impact) | 0 | Date-shift between AM Best and SERFF prevents direct match |
| Tier 2 — Date-relaxed (sub + impact + policyholders) | 18 | Same filing, AM Best effective_date drifts from our filed effective_date |
| Tier 3 — Sub-type reclass (our row in non-PPA bucket) | 1 | Allstate F&C 18.6% landed in our `19.0004 Other`; AM Best PPA includes it |
| **In-scope match rate** | **19 / 19 (100%)** | |

The AM Best UT report has 21 entries for our 8 brands, but 2 are American Economy Insurance Company filings now correctly excluded as a filing vehicle per the Item #3b scope decision (2026-05-15). In-scope AM Best entries: 21 − 2 = 19. All 19 are matched.

**Phase B remediation (2026-05-14)**: Pushing DATE_FROM back to 2024-07-01 (6-month lookback) recovered all 6 Progressive UT subsidiary rows on the single filing eff 02/19/25 (Tier 2 jumped 12 → 18). Match rate went 13/21 → 19/21.

**Item #3a remediation (2026-05-15)**: Adding "mga insurance" as a separate SERFF search keyword (`TARGET_COMPANIES += "MGA Insurance"`; `GROUP_SEARCH["State Farm"] += "mga insurance"`) recovered the State Farm-owned MGA Insurance Company UT filing (GNSC-134605705 eff 07/18/2025 imp -9.9% pol=10395 — matches AM Best's 08/25/25 disposition entry via Tier 2 date-relaxed match). Tier 2 jumped 18 → 19. Match rate went 19/21 → 20/21.

**Item #3b resolution (2026-05-15)**: American Economy Insurance Company excluded as filing vehicle (matches LM General / Standard Fire pattern; see Phase 2 backlog Item #3b for research findings). The American Economy AM Best entry was the last remaining "miss"; it is now correctly out-of-scope. In-scope denominator drops from 21 to 19 (2 AEIC entries excluded); all 19 remaining are matched. UT cross-check now at **19/19 (100%) in-scope match rate** matching the OR cross-check.

**Resolved 2026-04-27**: The two SFMA-134676709 rows (SF Fire + SF Mutual Auto, AM Best disposition 10/09/25) were originally missing because `parse_filing_summary_pdf` had no row pattern matching the layout `name + ind% + imp% + $prem_chg + ph + $prem_for + % %` (full ind/imp, blank max/min — UT's State Farm format). Added Pattern F to `src/utils.py`; sweep across all 527 cached PDFs found this was the only silent failure in the dataset (no impact on ID/WA/CO/OR). UT row count went 50 → 52, anchor SFMA-134676753 still validates 14/14, AM Best UT match rate went 11/21 → 13/21 in that pass.

The "in our UT PPA but not in AM Best report" rows are a mix of (a) 0% rate impacts that AM Best Disposition typically reports as N/A, (b) GEICO multi-subsidiary forms-only filings, (c) the GECC-134721778 RV filing's 5 REJECTED rows, and (d) additional pre-2025-submission rows recovered by the new lookback. Same expected-extras pattern as WA/OR.

## Phase 2 backlog (consolidated)

Items deferred from Phase 1 collection. Each was identified and documented during a Phase 1 milestone but not addressed inline because the scope or risk warranted a dedicated pass.

### 1. `refresh_pending.py` — periodic pending-status refresh
Build a job that re-queries SERFF detail pages for filings in our dataset where `disposition_status ∈ {Pending, Review pending, PENDING, Active Suspense}`. Decouples pending-status freshness from full-search re-runs and keeps `DATE_TO` aligned with AM Best validation cutoffs. Surfaced during the WA pending coverage characterization (commit `bfbdfd2`).

### 2. ~~Submission-window strategy~~ — RESOLVED 2026-05-14

**Resolution:** Adopted Option 1 — pushed `DATE_FROM` back to 2024-07-01 (6-month lookback) and added an emit-time effective-date filter (`EFFECTIVE_DATE_FROM/EFFECTIVE_DATE_TO = 2025-01-01/2026-04-17`) so the dataset's date axis aligns with AM Best's effective-date matching. Documented in the [Methodology section](#methodology).

**Results across all 5 states:**

| State | Pre-lookback | Post-lookback | Δ |
|---|---:|---:|---:|
| ID | 43 | 53 | +10 |
| WA | 20 | 34 | +14 |
| CO | 91 | 99 | +8 |
| OR | 45 | 47 | +2 |
| UT | 52 | 81 | +29 |
| **Σ** | **251** | **314** | **+63** |

**Validation:** Anchor SFMA-134676753 still validates 14/14 fields. UT AM Best cross-check 13/21 → 19/21 (90.5%). All 63 recovered rows have filing_date < 2025-01-01 and effective_date in the AM Best window — exactly the set the lookback was designed to capture. 10 rows dropped (all eff > 04/17/2026, legitimately out of window).

**Important methodology correction:** The previous WA cross-check section described 2 specific filings (Progressive Casualty 03/07/25, Encompass Indemnity 07/12/25) as "submission-window misses." Phase C investigation revealed these are not submission-window issues — both filings exist in AM Best but cannot be retrieved from SERFF Public Access under any of our 8 brand keyword searches, including after the new 6-month lookback. They've been re-classified as Item #4 (SERFF visibility gaps).

### 3. Carrier-keyword cleanup (queued from UT cross-check, 2026-04-27)

**3a. ~~Add `MGA Insurance Company` to State Farm `GROUP_SEARCH` keywords.~~ — RESOLVED 2026-05-15**

- Added `"MGA Insurance"` to `TARGET_COMPANIES` (so `run_search.py` searches for it) and `"mga insurance"` to `GROUP_SEARCH["State Farm"]` (so `run_final_rates.py::download_all_pdfs` can find MGA filings when downloading PDFs).
- Per-state SERFF spot-check before re-search (live keyword "mga insurance"): **ID=2, WA=0, CO=0, OR=4, UT=7**. Re-search executed only for ID, OR, UT (the 3 states with MGA filings).
- **Pipeline tool refinement:** `tools/enrich_new_brands.py` was extended to take brand slugs as a CLI argument (previously hardcoded to "safeco"/"encompass") and to preserve un-enriched rows when appending new-brand filings (was dropping them on the assumption a retry pass would re-enrich, which never happened in practice).
- **Results:**
  - 3 MGA Insurance Company rows emitted across the dataset (GNSC-134806133 ID eff 01/23/26 -0.1%; GNSC-134675106 OR eff 09/19/25 -3.0%; GNSC-134605705 UT eff 07/18/25 -9.9% — the AM Best UT target).
  - Pipeline-tool fix to `enrich_new_brands.py` indirectly recovered 5 additional Liberty Mutual UT rows (LBPM-134332238 subsidiaries filed 2024-12-02 eff 01/01/25) whose detail-page enrichment had failed in Phase C and were being silently dropped on each subsequent re-run.
  - Total +8 rows across ID/OR/UT (251 → 322 since pre-Phase-B; 314 → 322 since end of Phase C).
  - UT AM Best cross-check: **19/21 (90.5%) → 20/21 (95.2%)** — recovered the MGA UT filing.
  - ID anchor SFMA-134676753 still validates 14/14 (no regression).

**3b. ~~Research `American Economy Insurance Company` scope inclusion.~~ — RESOLVED 2026-05-15: EXCLUDE**

**Decision:** Excluded as a filing vehicle, matching LM General / Standard Fire pattern. Added to `EXCLUDED_SUBSIDIARY_PATTERNS` in `run_final_rates.py` and `compare_ut_ambest.py`; removed from `GROUP_KW["Liberty Mutual"]` and `TARGET_KEYWORDS["Liberty Mutual"]` (compare_ut_ambest.py).

**Research findings (2026-05-15):** American Economy Insurance Company fails the customer-facing-brand test on every signal that distinguishes Safeco/Encompass (in scope) from LM General/Standard Fire (excluded):

| Signal | Safeco (in scope) | American Economy |
|---|---|---|
| Standalone consumer website | safeco.com ✓ | None — redirects to Safeco |
| Own agent channel | Independent-agent network ✓ | Uses Safeco's agent network |
| Standalone AM Best rating | Member-rated as a distinct channel | Consolidated under Liberty Mutual Holding, no separate rating |
| Consumer marketing as a distinct brand | Yes ✓ | No — "operates under the Safeco umbrella" |
| Premium volume tracked separately | Yes ✓ | Bundled into LM consolidated reporting |

AEIC operates as a back-end filing entity within the Safeco brand family. AM Best can see it via direct state DOI feeds, but consumers never see the AEIC name on advertising, policy documents, or agent collateral. This matches the precedent that excluded LM General Insurance Company.

**Impact on dataset (2026-05-15):**
- 4 AEIC rows dropped from the dataset (1 ID, 1 CO, 2 UT) that had been inadvertently classified as Liberty Mutual via the previous `GROUP_KW` entry.
- 2 additional Liberty Mutual rows recovered (CO LBPM-134358341 subsidiaries) as a side effect of the re-run.
- Net dataset delta: 322 → 320 (-2 rows).
- UT AM Best cross-check: AEIC removed from in-scope denominator (21 → 19); all 19 in-scope matched. New rate: **19/19 (100%) in-scope match** (was 20/21 = 95.2%).

### 4. ~~SERFF visibility investigation~~ — INVESTIGATED 2026-05-15: structural limitation confirmed

**Status:** Closed. Root cause identified as a structural limitation of public-scraping approaches against SERFF Filing Access. Not fixable via search-keyword, pagination, or filter changes. Kept in backlog as documentation, not as an action item.

**Original scope (Phase C):** 6 filings — 2 WA + 4 OR.

**Phase 2 investigation findings (2026-05-15):**

- **OR's 4 "missing" cases were a FALSE ALARM** — a compare-script bug in `compare_or_ambest.py::_is_ppa()` that omitted sub-types `19.0002` (Motorcycle) and `19.0004` (Other Personal Auto) from the PPA bucket. AM Best's PPA report aggregates those codes; our script didn't. All 4 OR filings were actually in our dataset with matching parameters; they just weren't visible to the cross-check key lookup. After the 1-line fix, OR cross-check returns to 29/29 (100%) in-scope match rate. **Not an Item #4 case.**
- **WA's 2 cases are GENUINE Item #4 cases** — confirmed via live SERFF re-search across "encompass" (22 hits), "allstate" (55 hits), "indemnity" (31 hits — all ACE/Chubb, none Allstate-affiliated), and "progressive" (8 hits). None of those keyword searches returns the AM Best filings. WA OIC's website confirms SERFF Public Access is the only public search portal for property/casualty rate filings. Most likely root cause: the filer set the SERFF "Public Access Indicator" to "No" on these filings, hiding them from public search while AM Best can still see them via licensed state DOI data feeds.

**Confirmed affected filings (Item #4 scope is just 2 filings):**

| State | Subsidiary | Eff date | Filing date | Impact | Pol |
|---|---|---|---|---:|---:|
| WA | Progressive Casualty Insurance Company | 03/07/25 | 2024-12-12 | +4.5% | 46,504 |
| WA | Encompass Indemnity Company | 07/12/25 | 2025-03-12 | +19.6% | 6,098 |

UT cross-check shows zero Item #4 cases (both remaining UT misses are Item #3 carrier-keyword issues). OR is fully clean after the compare-script fix. ID and CO have no AM Best PPA reports available for direct verification but UT/OR/WA results suggest the issue is rare.

**Why this is not fixable:** SERFF Public Access intentionally exposes only filings whose "Public Access Indicator" is set to "Yes" by the filer. AM Best, RateFilings.com, and other commercial providers bridge this gap via licensed state DOI data-sharing arrangements not available to public scrapers. The 2 WA filings are correctly approved and in WA OIC's records, but the filers chose to mark them private. No code change to our SERFF scraper can recover them; the only resolution paths are:
- Switch to a licensed commercial data source (AM Best feed, RateFilings.com, etc.), or
- Request copies directly from WA OIC under public records procedures.

Both approaches are out of scope for the public-SERFF-scraping pipeline. **The dataset's representation is therefore "rate filings publicly visible via SERFF Filing Access," not "all rate filings in the state."** See the new [SERFF Public Access Limitations](#serff-public-access-limitations) section below for the broader characterization of this constraint.

### Why these were deferred rather than addressed in Phase 1

- Item 1 represents a strategic shift (refresh job) that is out of scope for one-time Phase 1 collection.
- Item 3 is small per-keyword work, but each addition requires a SERFF browser re-run and re-validation across affected states. Bundling them into a single keyword-cleanup pass amortizes that cost rather than running the full pipeline once per keyword. Until item 3b is researched and decided, adding `american economy` as a search keyword could pull in either an in-scope brand or an out-of-scope filing vehicle.

## SERFF Public Access Limitations

This dataset represents *rate filings publicly visible via SERFF Filing Access (`filingaccess.serff.com`)* — **not** *all rate filings in each state*. The distinction matters and is documented here so downstream consumers don't assume the dataset is a complete enumeration of state rate filings.

**Why the difference exists:**

- SERFF (System for Electronic Rate and Form Filings) is the NAIC-operated filing system used by most US state insurance regulators.
- Each filing has a **Public Access Indicator** field that the filer sets to control whether the filing appears in `filingaccess.serff.com` (the public-search portal). When set to "No," the filing is still received and processed by the state DOI but is hidden from public search.
- State DOIs receive ALL filings (public and non-public). Commercial data providers (AM Best, RateFilings.com, S&P Capital IQ, etc.) bridge the gap by licensing direct state DOI data feeds that include both public and non-public filings.
- Public scrapers — including this one — can only retrieve filings the filer chose to make public. There is no public-scraping technique that recovers the full set.

**Observed impact in this dataset (2026-05-15 Item #4 investigation):**

Of the WA AM Best PPA cross-check's 14 in-scope filings, 2 are not retrievable via SERFF Public Access:

| Filing | Why we believe it's a non-public filing |
|---|---|
| Progressive Casualty WA eff 03/07/25 (4.5%, 46,504 pol) | Approved 2024-12-16 by WA OIC per AM Best; absent from SERFF Public Access search for "progressive" (8 results), "casualty" or other keyword angles |
| Encompass Indemnity WA eff 07/12/25 (19.6%, 6,098 pol) | Approved 2025-09-15 by WA OIC per AM Best; absent from SERFF Public Access search for "encompass" (22 results), "allstate" (55 results), "indemnity" (31 results — all ACE/Chubb) |

OR, UT, ID, and CO show no current Item #4 cases. OR was a false alarm from a compare-script bug. UT's 2 remaining cross-check misses are Item #3 search-keyword issues, not Item #4. ID and CO have no AM Best PPA reports for direct verification.

**Implications for dataset consumers:**

- The cross-check match rates documented above (UT: 19/21 = 90.5%; OR: 29/29 = 100%; WA: 12/14 = 86%) are the maximum achievable via public scraping.
- For market analysis comparing carriers within the publicly-visible set, the dataset is reliable.
- For comprehensive market analysis requiring every rate filing on record (including non-public filings), licensed commercial sources are required. No iteration on this scraper will close that gap.
- This is a known structural limitation, not a defect.

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
