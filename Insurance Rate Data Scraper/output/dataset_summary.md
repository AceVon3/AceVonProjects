# Insurance Rate Filings — Eleven-State Dataset

**Canonical deliverable:** `output/all_states_final_rates.xlsx` (sheet `rate_filings`) and `output/all_states_final_rates.csv`.

## What this dataset contains

Rate-filing rows for personal-lines insurance across **Idaho, Washington, Colorado, Oregon, Utah, Arizona, Montana, Wyoming, Nevada, New Mexico, and Georgia**, structured to match AM Best's Disposition Page Data export. Each row represents one carrier subsidiary's per-program rate impact under a specific SERFF filing whose **effective date** falls in `[2024-01-01, 2026-04-17]`.

> **Dataset status (2026-06-10): 1,616 rows, eleven states, THIRTEEN brands.** Effective-date window `[2024-01-01, 2026-04-17]`; SERFF submission window `2023-07-01 → 2026-04-17`. The 13-brand expansion (USAA, Farmers, Nationwide, American Family, Country Financial — `SCOPE.md`) was validated on Georgia against its committed 268-row 8-brand baseline: all 268 rows byte-identical after the re-run (zero keyword bleed), +212 new-carrier rows, GA cross-check improved to PPA 92.8% / HO 94.3%. Georgia itself (added 2026-06-10) is the first eastern state; collection rode out the SERFF AWS-WAF bot-challenge throttle via the B1 search-universe pipeline + batched downloads (see "Georgia expansion").
>
> **Honest one-liner:** of 1,616 rows — **2 field-validated** (the `SFMA-134676753` anchor, all-field match), **363 AM Best cross-checked** (285 direct / 78 date-relaxed+reclassified), **301 extracted in a validated window but not individually matched**, **950 pipeline-extracted** (CO, ID non-anchor, all eff-2024). This is a SERFF-sourced, pipeline-extracted collection — corroborated against AM Best only where `external_validation` marks it, honest where not. Full detail + audit: **`TIER_RELABEL.md`**, `output/tier_relabel_audit.csv`, `output/corroboration/`.

### Validation tiering (four-tier, 2026-06-08)

Two earlier passes corrected an original overstatement (all 468 labeled `ambest_validated`, when the per-state cross-checks were *aggregate coverage analyses, not per-row validations*; CO had none). The current scheme is an honest **evidence gradient** in `external_validation`, with **`source`** orthogonal (provenance) and **`validation_tier`** a coarse app-compat alias. Per-row corroboration records live in `output/corroboration/`; rationale + audit in `TIER_RELABEL.md`.

| `external_validation` | meaning | count |
|---|---|--:|
| `field_validated` | documented all-field per-row AM Best Disposition Page Data match (the `SFMA-134676753` anchor, value unchanged) | 2 |
| `ambest_cross_checked` | matched an AM Best entry on subsidiary + impact (+ eff_date or policyholders); `match_strength` records `direct`/`date_relaxed`/`reclassified` | 363 |
| `pipeline_extracted_in_validated_window` | effective_date ≥ 2025-01-01 in a cross-checked state (AZ/GA/MT/NV/NM/OR/UT/WA), not individually matched | 301 |
| `pipeline_extracted` | CO (no cross-check), ID non-anchor, and all eff-2024 extension rows | 950 |

- **`source`**: `original` (pre-extension 468) / `extension` (2024 back-extension). **`validation_tier`** (legacy app-compat): `field_validated`+`ambest_cross_checked` → `ambest_validated`; the two pipeline tiers → `pipeline_only`. Use `external_validation` for the full gradient and `source` for provenance.
- **source × external_validation:** original → field 2 / cross_checked **179** / in-window 207 / pipeline 149; extension → cross_checked **6** / in-window 13 / pipeline 580. (NM, added 2026-06-08, is a fresh single-pass collection: its 69 eff≥2025 rows carry the mechanical `source=original` label — 51 cross_checked + 18 in-window — and its 62 eff-2024 rows `source=extension`/pipeline.) Of the **original pre-NM 468**, 130 still carry external corroboration; the 51 new cross_checked are all New Mexico.

| state | field_validated | cross_checked | in_window_unmatched | pipeline | total |
|---|--:|--:|--:|--:|--:|
| AZ | 0 | 29 | 48 | 102 | 179 |
| CO | 0 | 0 | 0 | 191 | 191 |
| GA | 0 | 178 | 81 | 221 | 480 |
| ID | 2 | 0 | 0 | 110 | 112 |
| MT | 0 | 19 | 6 | 32 | 57 |
| NM | 0 | 51 | 18 | 62 | 131 |
| NV | 0 | 39 | 26 | 44 | 109 |
| OR | 0 | 29 | 18 | 84 | 131 |
| UT | 0 | 18 | 66 | 58 | 142 |
| WA | 0 | 0 | 38 | 46 | 84 |

**`match_strength`** (ambest_cross_checked): AZ 25 direct / 4 date_relaxed; OR 29 direct; MT 18 direct / 1 date_relaxed; NV 28 direct / 7 date_relaxed / 4 reclassified; **NM 44 direct / 0 date_relaxed / 7 reclassified — strong (zero date-relaxed; the 7 reclassified are GEICO/Progressive RV filings AM Best buckets under PPA)**; **GA 141 direct / 31 date_relaxed / 6 reclassified (13-brand)**; **UT 0 direct / 17 date_relaxed / 1 reclassified — flagged mostly-date-relaxed (soft corroboration)**. Overall 285 direct / 60 date_relaxed / 18 reclassified.

**WA limitation:** WA was cross-checked (documented 12/14 PPA) but **no reusable per-row artifact was built** (decision 2026-06-08), so WA's matched rows are **not** marked `ambest_cross_checked` — its in-window rows sit in `pipeline_extracted_in_validated_window`. WA's corroboration is documented-only, not per-row re-derivable. New states (per `CROSS_CHECK_STANDARD.md`) always build the artifact.

**Scope is identical across the entire window.** The 8-brand scope (State Farm, GEICO, Allstate, Travelers, Progressive, Liberty Mutual, Safeco, Encompass), the filing-vehicle/specialty exclusions (LM General, Standard Fire, Integon/National General, American Economy, Peerless, Esurance, Drive, United Financial), and the TOI filters (19.0 / 04.0) apply unchanged to 2024 rows. No brand-status transition falls inside 2024 — Safeco's retirement (2026-04-25) is on the forward edge; Drive (2020) and Esurance (2020) were already retired and remain excluded. The only tier difference is the AM Best cross-check, not the collection methodology.

| State | Rows |
|------:|-----:|
| ID    |  112 |
| WA    |   84 |
| CO    |  191 |
| OR    |  131 |
| UT    |  142 |
| AZ    |  179 |
| MT    |   57 |
| WY    |    0 |
| NV    |  109 |
| NM    |  131 |
| GA    |  480 |
| **Σ** | **1,616** |

*(Per-brand breakdown table below predates the back-extension and reflects the original 468; the canonical per-state/per-tier counts are in [Validation tiering](#validation-tiering-four-tier-2026-06-08).)*

### Per-state per-brand breakdown

| State | State Farm | GEICO | Allstate | Encompass | Travelers | Liberty Mutual | Safeco | Progressive | Total |
|------:|----:|----:|----:|----:|----:|----:|----:|----:|----:|
| ID    |   7 |   6 |  19 |   3 |   2 |  10 |   3 |   3 |  53 |
| WA    |   3 |   6 |  14 |   3 |   3 |   0 |   3 |   2 |  34 |
| CO    |  26 |  18 |  21 |   4 |   5 |  10 |   3 |  10 |  97 |
| OR    |  10 |   1 |  13 |   1 |   0 |   7 |   7 |   8 |  47 |
| UT    |  10 |  20 |  24 |   0 |   2 |  12 |   6 |  10 |  84 |
| AZ    |  12 |   2 |  23 |   2 |  13 |  11 |   6 |   8 |  77 |
| MT    |   5 |   2 |   8 |   0 |   1 |   4 |   2 |   3 |  25 |
| WY    |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |   0 |
| NV    |  19 |   8 |  11 |   0 |   1 |   2 |   2 |   8 |  51 |
| **Σ** |  92 |  63 | 133 |  13 |  27 |  56 |  32 |  52 | **468** |

State Farm row counts include filings made under the **MGA Insurance Company, Inc.** subsidiary brand (a State Farm-owned filer that submits under its own name on SERFF). MGA Insurance was added as a separate SERFF search keyword in the Item #3a resolution (2026-05-15) and is classified back into State Farm via `GROUP_KW["State Farm"]`.

## Scope: Major customer-facing personal lines brands

> **Governing principle (2026-06-10, user-confirmed):** the operative inclusion test is **"what brand does the customer believe they bought?"** — IN if the customer experiences the policy as the parent brand (whatever the underwriting entity or its heritage), OUT if they believe they bought a different brand, even one the parent owns. Sub-brand activity belongs to that brand, never folded into the parent. Full statement, the 13-brand roster (8 original + USAA, Farmers, Nationwide, American Family, Country Financial), per-carrier entity lists and SERFF name traps: **`SCOPE.md`**. The sections below describe the original 8-brand scope; the 5-carrier expansion was validated on GA before any new-state use.

This dataset tracks **8 brands** that operate as distinct customer-facing insurers in their target markets:

- **Six flagship national brands:** State Farm, GEICO, Allstate, Travelers, Progressive, Liberty Mutual
- **Two independent-agent brand subsidiaries:** Safeco (owned by Liberty Mutual), Encompass (owned by Allstate)

The two independent-agent brands are included because they operate as distinct customer-facing brands with their own agent networks, policy forms, and filing activity. When Safeco raises rates, Safeco customers are affected — not Liberty Mutual direct-channel customers.

**Explicitly excluded subsidiaries:**
- **National General / Integon** (specialty non-standard auto; different market segment; Allstate-acquired 2021)
- **Standard Fire Insurance** (Travelers filing vehicle, not marketed as a separate brand)
- **LM General / LM Insurance Corp** (Liberty Mutual filing vehicles, not customer-facing brands)
- **American Economy Insurance Company** (Liberty Mutual filing entity; no consumer website, no own agent channel, AM Best rating consolidated under LM, sold under Safeco's umbrella; matches LM General/Standard Fire pattern — see Item #3b in Phase 2 backlog for research findings)
- **Peerless Insurance Company / Peerless Indemnity Insurance Company** (Liberty Mutual phased out the consumer-facing Peerless brand in 2013; both entities now exist only as filing vehicles within Liberty Mutual Holding Company; no consumer website, no own agent channel, AM Best rating consolidated under LM; same filing-vehicle pattern as LM General / American Economy — see Item #6 in Phase 2 backlog for research findings)
- **Drive Insurance** (Progressive, retired 2020)
- **Esurance** (Allstate, wound down 2020)
- **United Financial** (Progressive specialty) and other niche specialty subsidiaries

The scope criterion is *"does this entity represent a distinct brand that customers interact with and recognize?"* — **not** *"does this entity share a corporate parent with a major brand?"*

### Scope time-sensitivity note (Safeco brand retirement)

Safeco was retired as a customer-facing brand by Liberty Mutual on **2026-04-25**, eight days after this dataset's effective-date cutoff (2026-04-17). For the dataset's effective-date window (2025-01-01 to 2026-04-17), Safeco was a distinct customer-facing brand throughout, so its inclusion is correct.

However, any future expansion of the effective-date window past 2026-04-25 must reconsider Safeco's scope classification — post-retirement, Safeco filings would represent a wound-down brand rather than an active customer-facing one. This is the inverse of the filing-vehicle exclusion: a brand that WAS customer-facing during our window but ceased to be afterward. See Item #5 in Phase 2 backlog.

## Methodology

The dataset is **effective-date aligned with AM Best** while accommodating SERFF's submission-date-only search interface. Two date windows are in play:

- **Submission window** (`DATE_FROM = 2023-07-01` to `DATE_TO = 2026-04-17`): used by the SERFF search. The start is a 6-month lookback before the effective-date floor that ensures filings submitted before the floor with effective dates inside the emit window are still captured (SERFF cannot filter by effective date). *Pushed back from 2024-07-01 to 2023-07-01 on 2026-06-02 alongside the effective-floor extension; the 2024-07-01-onward slice is already cached, so the incremental search only fetches 2023-07-01 → 2024-06-30.*
- **Effective-date emit filter** (`EFFECTIVE_DATE_FROM = 2024-01-01` to `EFFECTIVE_DATE_TO = 2026-04-17`): applied at row emission in `run_final_rates.py`. Rows whose parsed effective date falls outside this window are dropped. Rows with **blank** effective date are KEPT (filer omitted the field; we don't silently drop). *Floor extended from 2025-01-01 to 2024-01-01 on 2026-06-02; rows below `AMBEST_VALIDATED_FROM = 2025-01-01` are tagged `pipeline_only` in `validation_tier` (see [Validation tiering](#validation-tiering-2026-06-02)).*

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
| `effective_date` | Requested effective date (New business date preferred; falls back to Renewal if New unavailable). Matches AM Best convention — verified via OR cross-check where 17/18 differing-date filings matched AM Best's New date (Thread 4 investigation, 2026-05-26). |
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
| `source` | Provenance (always true): `original` (in the pre-extension 468-row set) / `extension` (added by the 2026-06-02 back-extension). Added 2026-06-04. |
| `external_validation` | Evidence gradient (four-tier, 2026-06-08): `field_validated` (all-field anchor match, 2) / `ambest_cross_checked` (matched an AM Best entry; see `match_strength`, 134) / `pipeline_extracted_in_validated_window` (eff≥2025 in a cross-checked state, not matched, 202) / `pipeline_extracted` (CO, ID non-anchor, all eff-2024, 667). See `TIER_RELABEL.md` / `CROSS_CHECK_STANDARD.md`. |
| `match_strength` | For `ambest_cross_checked`: `direct` (subsidiary+eff_date+impact agree) / `date_relaxed` (subsidiary+impact+policyholders agree, eff differs) / `reclassified` (agree, different sub-TOI). `field` for the anchor; blank otherwise. Per-row: `output/corroboration/*.csv`. |
| `validation_tier` | Coarse app-compat alias, re-derived: `field_validated`+`ambest_cross_checked` → `ambest_validated`; both pipeline tiers → `pipeline_only`. Use `external_validation` for the full gradient, `source` for provenance. |

## Disposition vocabulary catalog (all 11 states, accumulated)

`disposition_status` is preserved as-filed (casing included); `rate_activity` is derived by substring rules. The classifier maps `WITHDRAWN`→`rate_change_withdrawn`, `DISAPPROV`/`REJECT`→`rate_change_disapproved`, `PENDING`/`OPEN`/`RECEIVED`/`EXAM`→`rate_change_pending`, else→`rate_change`.

| State | disposition_status terms observed | → rate_activity |
|---|---|---|
| ID | `APPROVED`, `WITHDRAWN`, `DISAPPROVED` (ALL-CAPS) | rate_change / withdrawn / disapproved |
| WA | `Approved` | rate_change |
| CO | `Filed`, `Withdrawn by company`, `Review pending` | rate_change / withdrawn / pending |
| OR | `Approved`, `Filed`, `Withdrawn by company`, `Review pending` | rate_change / … / withdrawn / pending |
| UT | `FILED FOR USE`, `REJECTED` | rate_change / disapproved |
| AZ | `Acknowledged` (file-and-use; as-filed = in effect) | rate_change |
| MT | `Rates Reviewed and Filed`, `Received and Filed`, `Withdrawn` | rate_change / rate_change / withdrawn |
| NV | `Approved`, `Approved with Stipulations`, `Open`, `Withdrawn` | rate_change / rate_change / pending / withdrawn |
| WY | — (0 in-scope rate rows) | — |
| NM | `File & Use With Review`, `Disapproved` | rate_change / disapproved |
| GA | `Approved`, `Acknowledged`, `Filed`, `Received`, `Exam`, `Withdrawn` | rate_change ×3 / pending ×2 / withdrawn |

Notes: `Received and Filed` (MT) and `Approved with Stipulations` (NV) surfaced in the 2026-06 back-extension and classify correctly via fall-through (both are approvals/file-and-use). `Withdrawn by company` (CO/OR) matches the `WITHDRAWN` substring. `Open` (NV) and `Review pending` (CO/OR) map to `rate_change_pending`. No conditional approval in this dataset changes the as-filed rate (AZ/MT/UT are file-and-use; NV stipulated approvals carried the filed figure). **`File & Use With Review` (NM)** is New Mexico's file-and-use phrasing (129 of 131 NM rows), semantically equivalent to `Filed`/`Approved` → `rate_change` via fall-through. The literal `&` required widening the `_FS_DISP_STATUS_RE` / `_FS_STATE_STATUS_RE` character class in `src/utils.py` to `[A-Za-z\-& ]` (2026-06-08); without it the match truncated at `&` and NM rows recorded a blank `disposition_status` (rate_activity was unaffected). **The fix is additive — no prior state's disposition_status contains `&`, so the 1,005 pre-NM rows are unchanged** (verified: anchor SFMA-134676753 still 14/14).

## Scope and limitations

- **States:** ID, WA, CO, OR, UT, AZ, MT, WY, NV, NM, GA.
- **Lines:** Personal Auto (TOI 19.0) and Homeowners (TOI 04.0) only. Farmowners explicitly out of scope.
- **Carriers:** See Scope section above — 8 customer-facing brands; filing-vehicle subsidiaries and specialty acquisitions explicitly excluded.
- **Date range:** Effective-date window 2024-01-01 → 2026-04-17. SERFF submission window 2023-07-01 → 2026-04-17 so pre-floor submissions with in-window effective dates are captured. The effective-date filter is applied at row emit time in `run_final_rates.py`. **Validation tiering:** only the 2025-01-01 → 2026-04-17 portion is AM Best cross-checked (`validation_tier = ambest_validated`); the 2024 back-extension (`pipeline_only`) is collected identically but not AM Best validated. *(Extended from 2025-01-01 on 2026-06-02.)*
- **Disposition status:** PENDING / Re-Open / Withdrawn filings are kept and labeled in `rate_activity`; only filings with no rate data at all (filer flag below) are excluded.
- **Filer flag:** When the filer flagged "Rate data does NOT apply to filing," the row is excluded — this flag is taken at face value.
- **PDF parsing:** Six Disposition row patterns are supported (full / blank-indicated / sparse / blank-indicated+blank-max-min with and without premium change / full-with-blank-max-min). Within a filing, subsidiary rows are deduped by name so multi-amendment filings (multiple Disposition sections) emit one row per subsidiary using the most recent disposition's values. Subsidiary-name lines that wrap across multiple PDF lines are folded by the existing continuation loop after the first line matches a row pattern.
- **Disposition cases:** ID uses ALL-CAPS (`APPROVED`); WA uses `Approved`; CO uses `Filed` (file-and-use); OR uses `Approved` / `Filed` / `Withdrawn by company`; UT uses `FILED FOR USE` (file-and-use) and `REJECTED` (equivalent to other states' `Disapproved`); MT uses `Rates Reviewed and Filed` and `Received and Filed` (both file-and-use, equivalent to `Filed`/`Approved`); NV uses `Approved`, `Approved with Stipulations` (approval with conditions, treated as `rate_change`), and `Open` (undisposed/in-review, equivalent to `Pending`); NM uses `File & Use With Review` (file-and-use, equivalent to `Filed`/`Approved`) and `Disapproved`. Casing preserved as filed. The `rate_activity` classifier maps `REJECTED → rate_change_disapproved` and `Open → rate_change_pending` alongside the standard `WITHDRAWN`/`DISAPPROVED`/`PENDING` substring patterns (`Withdrawn by company` → `rate_change_withdrawn` via the `WITHDRAWN` match). 2026-06 back-extension surfaced `Received and Filed` (MT), `Approved with Stipulations` (NV), and `Withdrawn by company` (OR) — all fall through / match correctly with no classifier change needed.
- **Filing-vehicle subsidiary exclusion:** When a customer-facing-brand filing's per-company rate table lists subsidiary names that are themselves filing vehicles or out-of-scope specialty acquisitions (`LM General Insurance Company`, `LM Insurance Corporation`, `Standard Fire Insurance`, `Integon`, `National General`, `Esurance`, `Drive Insurance`, `United Financial`, `American Economy`, `Peerless`), those individual rows are dropped at emission time — the parent filing is kept but the filing-vehicle row is suppressed. Enforced in `run_final_rates.py:_is_excluded_subsidiary`.
- **Disposition cases (AZ):** AZ uses `Acknowledged` (file-and-use: the AZ DOI acknowledges the filing and the filer's filed rate takes effect — there is no separate state-approved figure, so as-filed = in-effect and no stipulated-rate divergence arises). `Disposition Status: Acknowledged` / `State Status: Filing Acknowledged`. Classified `rate_change`. Reports per-subsidiary indicated/impact percentages in standard format. *(Corrected 2026-06-03: earlier text said "Approved" — both the original and re-collected AZ data show `Acknowledged`.)*

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

## Arizona expansion (added 2026-05-26)

AZ was added bringing the dataset to 6 states / 392 rows (+77 AZ rows). Expansion notes:

- **Search:** 232 raw filings across 9 brand keywords (Allstate=76, Travelers=43, Liberty Mutual=33, Safeco=20, GEICO=18, Progressive=17, State Farm=17, Encompass=5, MGA Insurance=3). MGA Insurance timed out on initial `--all-companies` run and was retried separately, then merged via `merge_az_search.py`.
- **Enrichment:** 50.6 min runtime, 232/232 submission dates populated, 291 PDFs downloaded (248 MB cached). 26 enrichment skips logged (`row not found in results`) — Liberty Mutual 17, Travelers 9. All 6 target-Rate self-recovered via `run_final_rates.py` independent retry; 1 confirmed correct out-of-window exclusion (LBPM-134879025).
- **Final-rates:** 207 target-TOI target-carrier filings → 57 emitted → 83 rows → 77 after filing-vehicle exclusion (6 rows dropped: 3 Peerless Indemnity + others).
- **Per-brand:** Allstate 23, Travelers 13, State Farm 12, Liberty Mutual 11, Progressive 8, Safeco 6, Encompass 2, GEICO 2. Notable: AZ has by far the heaviest Travelers HO presence in the dataset (TRVD-G prefix = Travelers Personal Insurance Company).
- **No new disposition vocabulary discovered:** AZ uses standard `Approved` casing.
- **Anchor:** ID SFMA-134676753 still validates 14/14 (unchanged).
- **Issue surfaced and resolved during AZ:** `NEW_PRODUCT_RE` false positive on the SERFF supporting-document boilerplate `"Rate Transition Modification - New Program Table"`. Fixed via `\bNew Program\b(?!\s+Table)` negative lookahead. 5 Travelers HO filings recovered across AZ; no prior-state impact (confirmed via dataset-wide cached-PDF sweep).

## AM Best AZ cross-check (AM Best PPA + Homeowners Multi-Peril report, 2026-05-26 export)

The AZ AM Best report is the **first AM Best validation covering BOTH PPA and Homeowners Multi-Peril** for our dataset (UT and OR were PPA-only). PPA bucket folds sub-types 19.0000 / 19.0001 / 19.0002 / 19.0004 (mirrors UT/OR). HO bucket folds sub-types 04.0000–04.0005.

Match keys: `(subsidiary_name_normalized, effective_date_MMDDYY, impact_pct)` Tier 1 — direct match.

| Result | PPA | HO |
|---|---:|---:|
| AM Best in-scope entries (8 brands, 2025-01-01 to 2026-04-17) | 14 | 15 |
| Tier 1 direct match (subsidiary + eff_date + impact) | 14 | 11 |
| Tier 2 date-relaxed | 0 | 4 |
| Tier 3 sub-type reclass | 0 | 0 |
| Still missing | 0 | 0 |
| **In-scope match rate** | **14 / 14 (100%)** | **15 / 15 (100%)** |

The 4 HO Tier-2 matches are all on the same SERFF tracking number group (Travelers Personal Insurance Company eff 03/21/25, multiple sub-TOI variants) where the date-relaxed match falls back to (subsidiary + impact + policyholders).

**In our AZ but not in AM Best:** 33 PPA + 19 HO. Standard pattern documented elsewhere: a mix of (a) 0% rate impacts AM Best reports as N/A, (b) recent filings past the AM Best report's snapshot date, (c) sub-TOI rows (Motorcycle/RV/Tenant) that AM Best may bucket differently.

## MT / WY / NV expansion (added 2026-05-27)

Three states added bringing the dataset to 9 states / 467 rows (+75 from prior 392). Notes:

- **MT: 25 rows** from 348 raw filings → 85 target → 16 emitted → 25 rows. Per-brand: Allstate 8, State Farm 5, Liberty Mutual 4, Progressive 3, GEICO 2, Safeco 2, Travelers 1. Heavy Travelers Form/Rule volume (162 raw, only 1 in-scope target Rate).
- **WY: 0 rows** from 182 raw filings → 34 target-carrier filings, ALL Form-only. Genuine zero — WY's small market (~600K population) means major carriers file routine forms but no standalone rate changes in our 19-month window. Confirmed via direct re-search and AM Best (user-confirmed WY AM Best report had no entries).
- **NV: 50 rows** from 278 raw filings → 106 target → 30+ emitted → 50 rows. Per-brand: State Farm 19, Allstate 10, GEICO 8, Progressive 8, Liberty Mutual 2, Safeco 2, Travelers 1. NV also has 4 RV (19.0003 Recreational Vehicle) filings — first state with RV sub-TOI volume outside UT.

### Search-phase observations

- **SERFF rate-limiting under concurrent multi-state searches:** Running MT/WY/NV `--all-companies` searches in parallel triggered SERFF Public Access rate-limiting — after the first 2-3 brand keywords per state, subsequent brand searches failed with `Locator.click: Timeout 30000ms exceeded` on "Begin Search". Sequential per-brand retries with no other concurrent SERFF activity recovered all failed brands. **Lesson:** parallel searches across states from a single IP trip SERFF's rate limit; future multi-state expansions should serialize the search phase OR throttle to a single state at a time.
- **NV Liberty Mutual silent-zero bug:** Initial NV retry sweep reported 0 Liberty Mutual filings without an explicit failure message; verification re-run revealed 42 actual filings. The "silent zero" mode (search submits but result page never populates) is a known SERFF degradation pattern under rate-limiting. **Lesson:** any `Total filings: 0` for a brand known to be active should be verified by re-running in isolation.

### New disposition vocabulary (Issue 4 in Phase 2 backlog)

MT and NV introduced two new disposition statuses not seen in ID/WA/CO/OR/UT/AZ:

- **MT: `Rates Reviewed and Filed`** — Montana's file-and-use phrasing, semantically equivalent to other states' `Filed` / `Approved`. Classified as `rate_change` by the activity classifier's fall-through (correct).
- **NV: `Open`** — Nevada's undisposed/in-review status, conceptually equivalent to `Pending`. Added explicit handling in `run_final_rates.py:rate_activity` classifier: `Open → rate_change_pending`.

The disposition vocabulary catalog now spans 8 distinct statuses across 9 states: `APPROVED`/`Approved`/`Filed`/`FILED`/`FILED FOR USE`/`REJECTED`/`Rates Reviewed and Filed`/`Open` (+ `Withdrawn`/`Disapproved`/`Pending` shared across states).

### no_pdf audit (per the Issue 3 methodology from AZ session)

After Open→Pending fix and full re-emit, MT and NV no_pdf cases:
- **NV: 0 genuine losses** (was 19 no_pdf; all resolved during re-emit because PDF cache had warmed from prior `run_*_full.py` enrichment runs).
- **MT: 1 genuine loss recovered + 1 confirmed correct exclusion**:
  - Recovered: `SFMA-134524072` (State Farm Fire and Casualty, 04.0005 Other Homeowners, eff 07/15/2025, 0.0% impact) via the fresh-context recovery pattern (`recover_sfma_134524072.py`).
  - Confirmed correct exclusion: `SFCI-134249794` (State Farm Classic Insurance, 19.0000 Personal Auto Combinations) — PDF parses cleanly but the rate-data table is genuinely blank (filer reported no percentage impacts, 0 policyholders). Not a parser bug; this is a Rate-shell filing with no actual rate impact data.

### NEW_PRODUCT_RE narrative-context fix (Issue 5, added 2026-05-27)

The `\bnew product\b` clause was too broad — it matched narrative/regulator-commentary references like "discussing this new product with the Division" (NV ALSE-134362303, a 47%-rate-change filing) and false-positively excluded 7 legitimate filings across CO/AZ/MT/NV. Fixed via introduction-context anchoring:

```python
# Before (too broad — matches narrative references)
r"|\bnew product\b"

# After (anchored to introduction/rollout context within 40 chars)
r"|\b(?:introduc\w+|launch\w+)\b[\s\S]{0,40}\bnew product\b"
r"|\bnew product\b[\s\S]{0,40}\b(?:will\s+be\s+(?:offered|available|launched|introduced)|to\s+new\s+business\s+only)\b"
```

**Validation:** Dataset-wide dry-run across 1,244 cached PDFs:
- 7 PDFs went `is_new_product` True → False (recovered: CO 2, AZ 3, MT 1, NV 1)
- 0 PDFs went False → True (sanity check confirmed fix only narrows)
- 94 PDFs unchanged (true new-product launches still caught by other patterns)

**Row impact:** Only +1 net row in dataset (NV ALSE-134362303 — Allstate Vehicle & Property HO 20.5% 40,758 policyholders). The other 6 recovered filings were Form-only or otherwise excluded by downstream filters, so no row delta — but the classification is now correct.

**Forward-looking note (Phase 2 cleanup candidate):** The NEW_PRODUCT_RE regex has now been refined twice (`\bNew Program\b(?!\s+Table)` in the AZ session, anchored-context for `\bnew product\b` in this session). Both narrowed narrative/contextual matches that weren't actual product introductions. Future false-positive variations are possible — consider refactoring to rely primarily on `Project Name/Number:` and `Company Tracking #:` field anchors in a future cleanup, since those are reliable filer-level signals while body-text patterns are heuristic.

### Travelers NV HO PDF recovery (added 2026-05-27)

3 Travelers HO filings (TRVD-G134570380, TRVD-G134503411, TRVD-G134806398) failed to cache during the original NV run_final_rates pass — JSF ViewState skip pattern. Recovered via `recover_nv_travelers_ho.py` (fresh-context per target). Only TRVD-G134570380 emitted a row (Travelers Property Casualty Insurance Company HO 14.4% eff 09/26/2025); the other two are Rule-only (excluded) and Personal Interline 35.0001 (out of TOI scope).

**Recovery-script caveat (lesson):** TRVD-G tracking numbers do NOT map directly to the SERFF `filing_id`. Other carrier prefixes (LBPM-, SFMA-, ALSE-, etc.) typically use `filing_id = tracking_suffix`, but TRVD-G filings have distinct filing_ids that must be looked up in the search workbook. Recovery scripts must read filing_id from `{state}_all_companies_search.xlsx` rather than derive it from the tracking string.

## AM Best MT cross-check (2026-05-26 export, PPA + Homeowners Multi-Peril)

MT AM Best report contains both PPA and HO Multi-Peril filings (mirrors AZ format).

| Result | PPA | HO |
|---|---:|---:|
| AM Best in-scope entries (8 brands, 2025-01-01 to 2026-04-17) | 17 | 3 |
| Tier 1 direct match | 16 | 3 |
| Tier 2 date-relaxed | 0 | 0 |
| Tier 3 sub-type reclass | 0 | 0 |
| Still missing | 1 | 0 |
| **In-scope match rate** | **16 / 17 (94.1%)** | **3 / 3 (100%)** |

**1 PPA miss:** `GMMX-134564734` Encompass Indemnity Company eff 09/29/2025, 0.0% impact, 0 policyholders. PDF analysis confirms this is a TRUE new-product launch ("In introducing this new product, EI will offer the following enhancements"). Correctly excluded per scope rules. AM Best includes it as filing-of-record. Same scope-boundary pattern as documented for CO GECC-134650382 in the AZ session.

**MT validation effectively 100% of in-scope filings** (excluding the documented scope-boundary new-product case).

## AM Best NV cross-check (2026-05-26 export, PPA + Homeowners Multi-Peril)

NV AM Best report contains both PPA and HO Multi-Peril filings.

| Result | PPA | HO |
|---|---:|---:|
| AM Best in-scope entries (8 brands, 2025-01-01 to 2026-04-17) | 33 | 8 |
| Tier 1 direct match | 23 | 5 |
| Tier 2 date-relaxed | 5 | 0 |
| Tier 3 sub-type reclass | 0 | 0 |
| Still missing | 5 | 3 |
| **In-scope match rate** | **28 / 33 (84.8%)** | **5 / 8 (62.5%)** |

**5 PPA misses classified:**
- 1 scope-boundary new-product: Allstate North American eff 03/17/26 0%/0pol
- 4 SERFF Public Access visibility gaps (NOT in our search workbook):
  - State Farm Mutual Automobile Insurance Company eff 02/13/25 — 0 SF Mutual Auto PPA filings discoverable via SERFF keyword search
  - State Farm Fire and Casualty Company eff 02/13/25 — same filing pair
  - Liberty Mutual Insurance Company eff 06/23/25 8.1% — 0 LM PPA filings discoverable via SERFF
  - Liberty Mutual Personal Insurance Company eff 06/23/25 — same filing pair

**3 HO misses classified:**
- 2 State Farm Fire and Casualty Company HO eff 05/15/25 + 03/15/25 (9.94%, 214k policyholders each) — SERFF visibility gap (10 SFMA HO filings in search, only 1 is Rate/Rule with different eff date)
- 1 Travelers Property Casualty Insurance Company eff 02/16/25 (0.007%, 63k pol) — likely Rule-only Rule filing excluded by scope

**NV cross-check pattern:** Significantly more SERFF visibility gaps than other states (similar to WA's 12/14 pattern). NV has 4 + 2 = 6 filings where AM Best has them but our SERFF search can't find them under any keyword combination. These are filer-controlled Public Access Indicator=No filings — same structural limitation documented for WA. Not actionable via search-keyword changes.

**In-scope match rates for state coverage comparison:**

| State | PPA match | HO match |
|---|---:|---:|
| UT | 19/19 (100%) | — (no AM Best HO report) |
| OR | 29/29 (100%) | — (no AM Best HO report) |
| AZ | 14/14 (100%) | 15/15 (100%) |
| MT | 16/17 (94.1%) | 3/3 (100%) |
| NV | 28/33 (84.8%) | 5/8 (62.5%) |
| NM | 36/37 (97.3%) | 15/17 (88.2%) |
| GA (8-brand) | 93/103 (90.3%) | 30/32 (93.8%) |
| GA (13-brand) | 129/139 (92.8%) | 66/70 (94.3%) |
| WA | 12/14 (86%) | — |

## New Mexico expansion (added 2026-06-08)

NM is the first **validated-expansion** state under `CROSS_CHECK_STANDARD.md` — both lines cross-checked at ingestion with a re-derivable per-row corroboration artifact before being folded into the canonical deliverable. It completes the western cluster and brings the dataset to **10 states / 1,136 rows** (+131 NM).

- **Search:** 441 raw filings across 9 brand keywords (Travelers 100, Liberty Mutual 87, State Farm 73, Allstate 82, GEICO 39, Progressive 25, Safeco 21, MGA Insurance 8, Encompass 6). **Progressive silent-fail recovery:** Progressive timed out on the "Begin Search" link during the sequential all-companies sweep and returned 0 rows — the OR/NV silent-fail pattern. Verify-retry in isolation recovered 25 Progressive filings (`merge_nm_search.py`); the original 0 was a false zero, not a genuine absence.
- **Final-rates funnel:** 209 target-TOI target-carrier filings → 77 emitted → 132 rows → **131** (1 filing-vehicle row dropped). Stage exclusions: Form/Rule 96, new-product 9, out-of-effective-window 20, rate-data-N/A 6, no-PDF 1 (the 0% anomaly below). Counts converged 112 → 129 → 131 → 131 across four passes as flaky downloads (SERFF throttled heavily under sustained load) succeeded on fresh-context retry.
- **Per-brand:** State Farm 29, Liberty Mutual 28, Allstate 26, Progressive 21, GEICO 15, Safeco 5, Encompass 4, Travelers 3. Lines: PPA 94 / HO 37.
- **New disposition vocabulary:** `File & Use With Review` (NM file-and-use, 129 rows) + `Disapproved` (2 rows). The `&` required widening `_FS_DISP_STATUS_RE` / `_FS_STATE_STATUS_RE` (additive; 1,005 prior rows unchanged) — see the disposition catalog above.
- **PDF-present 0-row anomaly:** `ALSE-134500230` — a 0.0%/0.0% Allstate PPA filing with a wrapped subsidiary name + `$0`-formatted/collapsed columns no row pattern matches. Documented, **not fixed** (zero rate signal; AM Best lists 0% as N/A so it doesn't affect the cross-check; not worth a shared-parser change). See `final_pass_investigation.md` item 5.
- **Anchor:** ID SFMA-134676753 still validates 14/14 (no pipeline regression from the disposition-regex change).

## AM Best NM cross-check (2026-06-08 export, PPA + Homeowners Multi-Peril)

Single PDF, both lines (AZ/MT/NV layout). 30,165 parsed rows → 441 unique after dedup. In-scope (8 brands × Rate × eff 2025-01-01→2026-04-17): **37 PPA + 17 HO**. Window-filtered to `DATE_TO=2026-04-17` so the ~7 weeks of AM Best entries to 2026-06-08 don't generate false "missing from ours" flags.

| Result | PPA | HO |
|---|---:|---:|
| AM Best in-scope entries | 37 | 17 |
| Tier 1 direct (subsidiary + eff_date + impact) | 29 | 15 |
| Tier 2 date-relaxed | 0 | 0 |
| Tier 3 sub-type reclass | 7 | 0 |
| Still missing | 1 | 2 |
| **In-scope match rate** | **36 / 37 (97.3%)** | **15 / 17 (88.2%)** |

**Strong corroboration — zero date-relaxed matches** (the opposite of UT's flagged 100%-date-relaxed soft case). The 7 PPA reclassified are all GEICO/Progressive **RV (19.0003)** filings AM Best buckets under PPA; our rows sit in the RV sub-TOI — correct reclassification, matched on subsidiary + impact + policyholders.

**3 misses — all structural (the public-SERFF ceiling, not scraper bugs):**

1. **PPA — Safeco "General Insurance Company of America" 15.3% eff 02/28/25** (disp 11/08/24): not discoverable under any Safeco search keyword; our Safeco PPA filings enumerate only "Safeco Insurance Company of America". A **SERFF Public Access visibility gap** (filer Public-Access-Indicator=No), same structural limitation as WA/NV.
2–3. **HO — "Liberty Insurance Corporation" eff 02/13/25 (−6.3%) & eff 01/09/26 (3.0%)**: the rate *events* ARE captured — our Liberty Mutual Insurance/Personal/Fire rows from the same filings (LBPM-134314003/134314125 and LBPM-134758200/134758580) matched AM Best **direct**. AM Best's Disposition Page Data additionally enumerates "Liberty Insurance Corporation" as a subsidiary on those events, but that name is **absent from the SERFF Filing Summary PDF's Company Rate Information table** we parse. A **subsidiary-coverage difference** between AM Best's licensed DOI feed and the public PDF — not recoverable via public scraping.

Per-row artifacts: `output/corroboration/nm_ppa_corroboration.csv`, `nm_ho_corroboration.csv` (+ `*_missing.csv`). The "in our NM but not in AM Best" extras are the standard pattern: eff-2024 rows (below the AM Best 2025+ window), 0% impacts AM Best reports as N/A, sub-TOI variants, and filings past the 2026-04-17 export cutoff.

## Georgia expansion (added 2026-06-10)

GA is the first eastern state, the largest single-state addition (+268 rows → **11 states / 1,404 rows**), and the first state collected through the B1 pipeline-era infrastructure. Its collection story spans three sessions and produced four durable pipeline improvements.

- **Search:** 872 raw filings across 9 brand keywords. **Four brands silent-failed** in the all-companies sweep (Allstate, Travelers, Liberty Mutual, Encompass — the OR/NV/NM silent-zero pattern under load) and were recovered by isolated verify-retries (`merge_ga_search.py`): Allstate 153, Travelers 300, Liberty Mutual 138, Encompass 55; plus State Farm 71, Safeco 58, GEICO 49, Progressive 38, MGA 10.
- **Throttle wall → root cause MEASURED (2026-06-10):** the original run hard-stalled at 85/326 PDFs and a 6h-cooldown retry added only 14 before re-arming. New failure-signature diagnostics (`src/search.DIAG_DIR` ledger + snapshots) captured the wall for the first time: **HTTP 405 from `awselb/2.0` with `x-amzn-waf-action: captcha` serving a "Human Verification" page** — an AWS WAF rate-based bot challenge, not server overload. Strategy that worked: a 2–3 day full rest, then **batched downloads** (`DOWNLOAD_BATCH_SIZE=8` per fresh search session, validated in-vivo 8/8 with 4 cell-level parse-identical re-fetch probes) cut fresh Begin-Search submissions ~8× — the remaining 227 PDFs landed in ~2h with only intermittent, self-recovering challenges.
- **Final-rates funnel:** 326 target filings → 145 emitted → 272 rows → **268** (4 filing-vehicle rows dropped). Exclusions: Form 71, new-product 18, out-of-window 31, no-PDF/zero-row 52. Converged 259 → 268 → 268 across three passes.
- **THREE new GA vocabulary traps, all found via the 0-row deliverable the first build produced:**
  1. **Filing types:** GA labels rate filings `Rate/Rule PPA-Prior Approval`, `Rate/Rule PPA- File and Use`, `Rate/Rule other than PPA` (prior states: bare `Rate`/`Rate/Rule`). The exact-membership check excluded all 247 — replaced with the `_is_rate_filing_type` prefix predicate.
  2. **New-product false positives:** GA filing summaries embed a DOI questionnaire whose literal field `New Program (Type Yes or No): No` matched the bare `\bNew Program\b` keyword on 225/237 rate filings; plus `introduction of <Discount/rating-plan factor> … line of business` phrasing false-matched 4 more. Fixed with an answered-No lookahead (+ an answered-Yes trust-the-declaration alternative) and a discount/rating-plan/factor gap exclusion. NM/UT/ID regression after both regex changes: 0 cell diffs, anchor 14/14.
  3. **Disposition vocabulary:** `Received` (58 rows) and `Exam` (1) are GA's in-review statuses → `rate_change_pending` (like NV's `Open`); `Acknowledged`/`Filed`/`Approved` are terminal-accepted.
- **Zero-row audit (49 filings, `rate_data_applies=True`, 0 rows):** all 49 are genuinely rate-effect-free — 35 per-company tables with blank `%` cells, 14 `Rate Information for Multiple Company Filings` layouts with all-zero values; **0 nonzero values missed** (`tools/diag_ga_classify_zero_rows.py`). GA's broad `Rate/Rule` filing-type labels sweep rule-only changes into the rate funnel; prior states' `Rule` label excluded them earlier.
- **Structural download misses (2):** TRVD-G134718262, TRVD-G134818683 (both Travelers HO) — row-not-found through batch + fresh-per-target fallback across three passes; neither corresponds to an AM Best in-scope miss.
- **Anchor:** ID SFMA-134676753 still validates 14/14.

## AM Best GA cross-check (2026-06-08/09 exports, PPA + Homeowners Multi-Peril)

Three effective-date-range PDFs tile the window `[2024-01-01, 2026-06-08]` with no real gap; the 2024-10-31 boundary overlap (3 keys) collapses under dedup. 89,616 raw rows → 1,373 unique. In-scope (8 brands × Rate × eff 2025-01-01→2026-04-17): **103 PPA + 32 HO** — by far the largest AM Best denominators in the dataset.

| Result | PPA | HO |
|---|---:|---:|
| AM Best in-scope entries | 103 | 32 |
| Tier 1 direct (subsidiary + eff_date + impact) | 73 | 22 |
| Tier 2 date-relaxed | 15 | 7 |
| Tier 3 sub-type reclass | 5 | 1 |
| Still missing | 10 | 2 |
| **In-scope match rate** | **93 / 103 (90.3%)** | **30 / 32 (93.8%)** |

**All 12 misses classified — none are scraper bugs:**

1. **8 PPA = 2 Progressive filing events we CAPTURED with different values** (PRGS-134611011 + PRGS-134655228, both eff 12/05/25, same subsidiaries; ours −4.1%/0.6%/2.3% vs AM Best −2.7%/1.9%/3.6%). GA PPA is **prior-approval** (`Rate/Rule PPA-Prior Approval`): AM Best's Disposition Page Data reports disposed/approved figures, the public filing-summary PDF reflects the filed amendment. First state in the dataset where filed-vs-approved divergence is observable — a stage difference, not an extraction error.
2. **1 PPA Travelers (eff 02/15/26, 0.3%)** = TRVD-G134746302, captured and parsed but its public rate table is blank (one of the 35 blank-table filings); the 0.3% exists only in AM Best's licensed DOI feed.
3. **1 PPA Allstate North American (0.0%, 0 pol) + 1 HO Encompass (0.0%, 0 pol):** zero-impact entries matching the blank-table pattern — no rate signal in the public PDF.
4. **1 HO Safeco of Oregon (eff 07/27/25, 18.5%):** event captured — we hold the same date's filed 9.9% (LBPM-134521388) plus a withdrawn 19.9% (LBPM-134467944); AM Best's 18.5% is again a disposition-stage figure.

Per-row artifacts: `output/corroboration/ga_ppa_corroboration.csv`, `ga_ho_corroboration.csv` (+ `*_missing.csv`).

## 13-brand expansion — validated on GA (2026-06-10)

Five carriers added under the SCOPE.md operative test ("what brand does the
customer believe they bought?"): **USAA, Farmers, Nationwide, American Family,
Country Financial**. Validation method: re-run GA (the freshest committed
state and the only one where all 5 appear in both AM Best and SERFF) with all
13 brands against its known 268-row 8-brand baseline, demanding the baseline
stay byte-identical so every new row is attributable.

- **Guardrail: CLEAN.** All 268 baseline rows cell-identical through the full
  pipeline (verified on base columns post-build AND all 21 columns post-tiers).
  Zero keyword bleed. NM/UT/ID regression with the expanded exclusion lists:
  0 diffs; anchor SFMA-134676753 14/14.
- **+212 rows** (GA 268 → 480): Farmers 76 (57 PPA / 19 HO), Nationwide 44
  (36/8), Country Financial 41 (33/8), USAA 40 (24/16), American Family 11
  (6/5). Modest by design — honest exclusions (no CONNECT/Homesite/Foremost/
  Bristol West/Allied/Noblr inflation).
- **Cross-check improved:** PPA 93/103 (90.3%) → **129/139 (92.8%)**, HO
  30/32 (93.8%) → **66/70 (94.3%)**. The new carriers added 36 PPA + 38 HO
  in-scope AM Best entries and missed only 2 (both Farmers Insurance Exchange
  HO at 0.0% impact — the blank-public-table pattern). Every PPA miss is one
  of the 10 already-classified 8-brand misses.
- **Munich Re / American Modern = KNOWN COLLISION CLUSTER.** "American Family
  Home Insurance Company" (NAIC 23450) was pre-excluded after web/NAIC
  verification; the sibling "American Modern *" entities then rode a kept
  filing's rate table into 3 unclassified rows and were caught by the Phase 3
  guardrail differ. Both pattern families are excluded
  (`american family home`, `american modern`). If a third sibling surfaces in
  IL/OH/VA, it's the same cluster — exclude it.
- **Search-phase reality under the WAF:** 10 keywords took 4 rounds with
  cooldowns (silent-zero false failures + a pagination stall at exactly 100
  rows + one workbook clobbered by a 0-row retry — retries now write to
  `--out-suffix` files and `merge_ga_newcarriers.py` unions all generations,
  dated copies winning). Final universe: 872 → 1,542 filings, 540 targets.
- **Structural download miss (new):** NWPP-134378106 (Nationwide) — row not
  found through batch + fresh-per-target across two passes; joins GA's TRVD-G
  ledger of structural misses (the two TRVD-G HO misses from the 8-brand run
  recovered during this re-run and emitted 0 rows). Persistent count: 1.
- **Known caveats:** 53 new-carrier rows ship blank `filing_date` (mostly
  Country — WAF-challenged date fetches; backfillable via
  `backfill_submission_dates.py` sidecar; no tiering/cross-check impact).
  The AM Best parser's blank-subsidiary-name artifact silently drops some
  entries from cross-check denominators (USAA PPA: all 3 in-window entries
  blank-named → unmeasured); fix scheduled before IL/OH/VA — measurement
  only, deliverable rows unaffected.

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

### 5. Safeco brand retirement — window-extension contingency (added 2026-05-26)

Liberty Mutual retired the Safeco brand on 2026-04-25 ([LMG announcement](https://www.libertymutualgroup.com/about-lm/news/articles/liberty-mutual-insurance-retires-safeco-brand)). For this dataset's effective-date window (cutoff 2026-04-17), Safeco was a distinct customer-facing brand throughout, so its inclusion is correct and unchanged.

**Contingency:** If a future expansion extends the effective-date window past 2026-04-25, Safeco's scope classification must be re-evaluated. Post-retirement, Safeco filings would represent a wound-down brand (analogous to Drive Insurance / Esurance) rather than an active customer-facing one. Default treatment in that scenario: exclude post-2026-04-25 Safeco filings as a wound-down brand, but document and revisit if filing volume suggests Safeco continues as a meaningful filer entity in transition.

Not actionable today — purely a forward-looking note tied to window-extension decisions.

### 6. ~~Peerless Insurance / Peerless Indemnity scope inclusion.~~ — RESOLVED 2026-05-26: EXCLUDE

**Decision:** Excluded as a filing vehicle, matching LM General / American Economy / Standard Fire pattern. Added `"peerless"` to `EXCLUDED_SUBSIDIARY_PATTERNS` in `run_final_rates.py` and `compare_ut_ambest.py`; removed `"peerless"` from `TARGET_KEYWORDS["Liberty Mutual"]` in `compare_ut_ambest.py`.

**Research findings (2026-05-26):** Liberty Mutual phased out the consumer-facing Peerless brand in 2013 ([Agency Checklists](https://agencychecklists.com/2013/01/22/peerlesschangingtolibertymutual-8717/), [Keene Sentinel](https://www.keenesentinel.com/news/local/liberty-mutual-axes-peerless-brand/article_b0a561b8-542f-59db-92a7-5f903333bff5.html)). Peerless Insurance Company (PIC) and Peerless Indemnity Insurance Company (PIIC) persist as legal/filing entities within Liberty Mutual Holding Company but have no consumer-facing presence — no standalone website, no own agent channel, AM Best rating consolidated under Liberty Mutual.

| Signal | Safeco (in scope) | Peerless |
|---|---|---|
| Standalone consumer website | safeco.com ✓ | None — brand retired 2013 |
| Own agent channel | Independent-agent network ✓ | Personal lines routed through Safeco's channel pre-2026 |
| Standalone AM Best rating | Member-rated ✓ | Consolidated under Liberty Mutual Holding |
| Marketed as a distinct brand | Yes ✓ | No — brand discontinued 13 years ago |
| Premium volume tracked separately | Yes ✓ | Bundled into LM/Safeco consolidated reporting |

**Impact on dataset (2026-05-26):**
- 8 Peerless Indemnity rows dropped (3 CO + 1 OR + 1 UT + 3 AZ).
- Net dataset delta: pre-Peerless-fix → post-Peerless-fix (CO 100→97, OR 48→47, UT 85→84, AZ 74→71).

### 7. Enrichment row-click flakiness — JSF ViewState staleness (added 2026-05-26)

**Symptom:** During `run_*_full.py` enrichment, `_click_row_to_detail` intermittently fails for target-Rate filings, logging `[skip] {tracking}: row not found in results`. Initial concern was that filings were silently dropped from the dataset.

**Root cause:** Long-running browser context degrades JSF ViewState (PrimeFaces/Mojarra session tokens), causing row-clicks to fail later in the run. **Not a pagination issue** — Thread 3 investigation confirmed the failing row was on page 1 of a fresh-context search. The flakiness scales with how long the same browser context has been alive (more enrichment iterations consumed = more stale tokens). Heavy-volume search groups processed later in the run (Travelers/LM/Safeco) hit it more often.

**Observed across the dataset (Thread 4 audit, 2026-05-26):** 120 unique skipped filings across 5 prior states + 26 in AZ. Disposition:
- **115 out-of-scope** (non-target TOI: workers comp, commercial auto, Form-only filings, etc.)
- **16 self-recovered** via `run_final_rates.py`'s independent row-click retry (a separate process invokes a fresh search per carrier group, so most skips don't survive to the canonical output)
- **2 correctly filtered** by other scope rules (`rate_data_applies=False`, `is_new_product=True`)
- **0 genuine losses** after correct classification

**Mitigation in place:** `run_final_rates.py` runs an independent fresh-search per carrier group during PDF download, which already recovers most enrichment skips by giving them a fresh ViewState. The combination of two passes is robust enough that no genuine losses survived in the 387-row dataset.

**Fresh-context recovery pattern (Thread 3 proven):** When a target filing IS genuinely lost (rare — 1 known case across all 6 states: AZ LBPM-134879025, which turned out to be out-of-window scope-correct after recovery anyway), a one-off recovery script works reliably:
1. Open a fresh Playwright browser context
2. Submit the same SERFF search keyword
3. Paginate forward until the row is in view (if needed)
4. Call `download_system_summary_pdf` — the fresh ViewState succeeds on first attempt

See `recover_lbpm_134879025.py` and `recover_gecc_134650382.py` as templates.

**Recommendation:** For one-time Phase 1 collection (current posture), the existing two-pass setup + standalone recovery script is sufficient. If the pipeline is productionized for periodic re-runs, wire the fresh-context retry into `run_*_full.py` and `run_final_rates.py` as an automatic fallback when `_click_row_to_detail` fails — that would eliminate the need for manual recovery scripts.

### 8. Safeco-search false alarm (added 2026-05-26)

During the AZ run, the dedicated `safeco` SERFF search failed all 3 retries in `run_final_rates.py` (PrimeFaces "Begin Search" link click timeout). Initial concern: missing Safeco coverage.

**Resolution:** Safeco filings are filed under the Liberty Mutual filer entity (`LBPM-` tracking number prefix), so they are co-discoverable via the `liberty mutual` search keyword in run_final_rates' `GROUP_SEARCH["Liberty Mutual"] = ["liberty mutual", "safeco", "american states"]` chain. The first keyword succeeded; the failed safeco keyword would only have caught Safeco filings *not* findable under `liberty mutual` — and there were none. **No data loss.**

**Lesson:** Multi-keyword GROUP_SEARCH chains provide natural redundancy for brand-keyword search failures. When auditing post-run logs, "search keyword X failed" needs cross-reference to other keywords in the same group's chain before being treated as data loss.

### 9. Skip-audit methodology note (added 2026-05-26)

When auditing enrichment skip logs, classification of "GENUINELY LOST" requires checking **all** these conditions, not just (a) and (b):

(a) Filing type is `Rate` or `Rate/Rule` (from search workbook)
(b) Sub-TOI starts with `19.` or `04.` (target lines)
(c) Filing is absent from the state's `_final_rates.xlsx` output
(d) **`rate_data_applies=True`** in the system Filing Summary PDF (else filer-flagged "Rate data does NOT apply")
(e) **`is_new_product=False`** (else excluded as new-program launch per scope)
(f) **Effective date (New, with Renewal fallback) is in window** [2025-01-01, 2026-04-17]
(g) Subsidiary names aren't in `EXCLUDED_SUBSIDIARY_PATTERNS` (filing vehicles)

The initial AZ skip audit (Thread 4 first pass) only checked (a)/(b)/(c) and over-flagged 5 candidates as "lost." After applying (d)/(e)/(f) it dropped to 0 unambiguous losses. Future audits must use the full check.

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
