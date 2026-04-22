# Insurance Rate Filings — Three-State Dataset

**Canonical deliverable:** `output/all_states_final_rates.xlsx` (sheet `rate_filings`) and `output/all_states_final_rates.csv`.

## What this dataset contains

146 rate-filing rows for personal-lines insurance across **Idaho, Washington, and Colorado**, structured to match AM Best's Disposition Page Data export. Each row represents one carrier subsidiary's per-program rate impact under a specific SERFF filing.

| State | Rows |
|------:|-----:|
| ID    |   39 |
| WA    |   19 |
| CO    |   88 |
| **Σ** | **146** |

### Per-state per-brand breakdown

| State | State Farm | GEICO | Allstate | Encompass | Travelers | Liberty Mutual | Safeco | Progressive | Total |
|------:|----:|----:|----:|----:|----:|----:|----:|----:|----:|
| ID    |   5 |   4 |  16 |   4 |   0 |   4 |   3 |   3 |  39 |
| WA    |   1 |   6 |   8 |   2 |   0 |   0 |   2 |   0 |  19 |
| CO    |  19 |  18 |  18 |   4 |   4 |  11 |   4 |  10 |  88 |
| **Σ** |  25 |  28 |  42 |  10 |   4 |  15 |   9 |  13 | **146** |

## Methodology

1. **Discover.** Search SERFF Public Filing Access (`filingaccess.serff.com`) per state by carrier-group keyword.
2. **Filter.** Keep only target NAIC TOI codes (19.0 Personal Auto, 04.0 Homeowners) for the six target carrier groups (State Farm, GEICO, Progressive, Allstate, Travelers, Liberty Mutual + named subsidiaries) plus two major distinct-channel brands (**Safeco** — Liberty Mutual's independent-agent brand; **Encompass** — Allstate's independent-agent brand). Each brand requires its own SERFF search keyword because filings are submitted under the brand name and do not surface under a parent-group search. Excluded as out-of-scope (specialty / wound-down): Drive Insurance (Progressive subsidiary, retired), Esurance (Allstate subsidiary, wound down 2020), United Financial (Progressive specialty), other niche specialty subsidiaries.
3. **Download.** From each filing's detail page, click "Download Zip File" with **no checkboxes selected** to receive a ~20 KB minimal zip containing the system-generated Filing Summary PDF.
4. **Parse.** Extract the Disposition / Company Rate Information table from the PDF. Three row layouts are handled (full / blank-indicated / sparse).
5. **Exclude.** Drop Form-only / Rule-only filings, new-program launches ("Introduction of …"), and filings the filer flagged with "Rate data does NOT apply to filing."
6. **Expand.** One row per subsidiary listed in the per-company rate table. For multi-company filings the `Multiple` company label is replaced by the actual subsidiary name from the table.

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

## Field completion (146 rows)

All 17 columns are 100% populated **except** `overall_indicated_change` (95.2%), `written_premium_change`, `policyholders_affected`, `written_premium_for_program`, `maximum_percent_change`, `minimum_percent_change` (each 99.3%), and `effective_date` (99.3%) — the remainder are blank because the filer omitted the value (sparse-row pattern, kept as `None` rather than guessed).

## Scope and limitations

- **States:** ID, WA, CO only.
- **Lines:** Personal Auto (TOI 19.0) and Homeowners (TOI 04.0) only. Farmowners explicitly out of scope.
- **Carriers:** Six national groups (State Farm, GEICO, Progressive, Allstate, Travelers, Liberty Mutual) + their named subsidiaries; plus two major distinct-channel brands (Safeco, Encompass) searched separately. Out-of-scope: Drive Insurance (Progressive, retired), Esurance (Allstate, wound down 2020), United Financial (Progressive specialty), and other niche specialty subsidiaries; no regional or single-state carriers.
- **Date range:** Whatever was visible in SERFF Public Access at run time (2026-04-22). No explicit date filter applied.
- **Filer flag:** When the filer flagged "Rate data does NOT apply to filing," the row is excluded — this flag is taken at face value.
- **PDF parsing:** Three Disposition row patterns are supported. Layouts outside these patterns may be missed (none observed in the 248 filings probed).
- **Disposition cases:** ID uses ALL-CAPS (`APPROVED`); WA uses `Approved`; CO uses `Filed` (file-and-use). Casing preserved as filed.
- **WA row count is genuinely thin (19 vs ID 39, CO 88).** Verified — not a scraper gap:
  - Same date window applied to all three states (2025-01-01 → 2026-04-17).
  - Fresh re-search (State Farm WA): 28 filings vs 28 in raw archive (100% match).
  - Most WA target-TOI target-carrier filings are Form-only (no rate impact) or filer-flagged "Rate data does NOT apply to filing." (heavily Travelers).
  - 2026-effective WA rows are sparse because Allstate's 2026 WA submissions are mostly Form-only and Travelers' are filer-flagged "does not apply." This is filer behavior, not missing data.
  - WA OIC publishes rate filings via SERFF Filing Access (no separate portal).

## AM Best WA cross-check (2025-01-01 to 2026-04-17, PPA only)

| Result | Count |
|---|---:|
| Matched (subsidiary + policyholders + impact %) | 11 |
| In AM Best, missing from ours | 3 |
| In ours, not in AM Best report | 8 |

The 3 unmatched-from-AM-Best entries:
1. **Progressive Casualty 03/07/25** (4.5%, 46,504 pol) — submission date 12/12/2024, before our 2025-01-01 search window.
2. **Allstate North American 07/24/25** (-2.9%, 472 pol) — `NEW_PRODUCT_RE` false-positive: regex matches "introduction of Early Signing Factors" (a rating-factor change, not a new product). Bug, not yet fixed.
3. **Encompass Indemnity 07/12/25** (19.6%, 6,098 pol) — filed under tracking ALSE-134095154; submission date appears to be before 2025-01-01, outside search window.

The 8 in-ours-not-in-AM-Best entries are all expected: 5 are Homeowners filings (AM Best PPA report excludes HO), and 3 are 0% PPA filings that AM Best Disposition reports as N/A for trivial 0% changes.

## Recommended use

- Comparative analysis of approved/filed rate changes across ID/WA/CO for the named carriers.
- Cross-reference to AM Best Disposition Page Data using `serff_tracking_number`.
- **Not** a substitute for full-state market analysis — scope is bounded by the carrier and line filters above.

## Reproducibility

```bash
.venv/Scripts/python run_final_rates.py ID
.venv/Scripts/python run_final_rates.py WA
.venv/Scripts/python run_final_rates.py CO
.venv/Scripts/python build_all_states.py
```

System PDFs are cached idempotently under `output/pdfs/{state}/{filing_id}/filing_summary.pdf`, so re-runs only re-parse.
