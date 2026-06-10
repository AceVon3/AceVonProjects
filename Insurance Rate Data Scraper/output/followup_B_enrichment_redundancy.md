# Follow-up B — Collapse the duplicate detail-page visit (enrichment ↔ final-rates)

**Status:** DEPLOYED as the standard pipeline (2026-06-10, user-approved).
Offline 3-state validation clean AND the live submission-date mini-pass
validated 13/13 on NM. See the addenda at the bottom. Scope note: B helps
IL/OH/VA and future states (~halved SERFF load); it does NOT shrink GA's
remaining 227 final-rates fetches (GA's enrichment was already paid).
Raised in the 2026-06-08 pipeline efficiency audit alongside decisions A
(`download_pdfs=False`, done) and C (single PDF text read, done). This is the
larger structural win but it changes how every row's data is sourced, so it
carries silent-data-loss risk and must be proven field-by-field before adoption.

## The exact claim

Each in-scope filing's SERFF detail page is currently visited **twice**:

1. **Enrichment** (`run_{state}_full.py` → `enrich_filing` → `scrape_detail_fields`)
   — opens every filing's detail page to populate `type_of_insurance` (parent
   TOI), `disposition_date`, `disposition_status`, and `submission_date`.
2. **Final-rates** (`run_final_rates.py` → `download_all_pdfs` →
   `download_system_summary_pdf`) — re-opens every *Rate/Rule* filing's detail
   page (fresh search + row-click) to download `filing_summary.pdf`, then
   `build_rows` re-derives every rate value, disposition, and effective date
   from that PDF.

**Enrichment is ~95% redundant for the canonical deliverable.** Verified against
the NM search workbook (`nm_all_companies_search.xlsx`, 441 filings):

| Field `run_final_rates.load_targets` needs | Source | Search-workbook population |
|---|---|---|
| `serff_tracking_number`, `filing_id`, `company_name`, `target_company` | search | 100% |
| `sub_type_of_insurance` | search | 441/441 (100%) |
| `filing_type` | search | 441/441 (100%) |
| `type_of_insurance` (parent TOI) | enrichment | 0/441 — **but** `load_targets` derives it from the sub-TOI prefix (`19.`→Personal Auto, `04.`→Homeowners) for all target filings, so not needed from enrichment |
| `submission_date` (→ output `filing_date`) | search, enrichment backfills failures | 399/441 (90%) — **enrichment uniquely adds the other ~42** |
| `disposition_date`, `disposition_status` | enrichment | 0/441 in search — **but loaded into `Target` and never read by `build_rows`** (disposition comes from `filing_summary.pdf` via `fs.disposition_status`) |

So the **only** thing enrichment uniquely contributes to the deliverable is
`submission_date` for the ~42 filings whose search-phase date fetch failed
("could not open detail" during `run_search.py`). Everything else is either
already in the search workbook or re-derived from `filing_summary.pdf`.

`build_rows` confirms it: rate values, `effective_date`, `disposition_status`,
`rate_activity`, and the per-subsidiary expansion all come from
`parse_filing_summary_pdf(filing_summary.pdf)`. `run_final_rates.py` references
none of the enrichment-parsed fields (`overall_rate_effect`,
`requested_rate_effect`, `filing.pdfs`) — grep-confirmed.

## The opportunity

Collapse the two detail visits into one. Two candidate designs:

- **B1 — Skip enrichment entirely.** Run `run_final_rates.py` directly off
  `{state}_all_companies_search.xlsx`, and backfill only the ~42 missing
  `submission_date`s with a tiny targeted pass. Eliminates the whole
  `run_{state}_full.py` phase (~the slower half of a state run) and ~halves
  total SERFF detail round-trips.
- **B2 — Fetch `filing_summary.pdf` during enrichment.** Have enrichment call
  `download_system_summary_pdf` so the summary is cached; `download_all_pdfs`
  then finds it cached and skips its re-visit. One detail visit per filing,
  enrichment keeps its metadata scrape. Less aggressive than B1, lower blast
  radius.

Either way the win is **fewer SERFF round-trips** — the only safe lever on
wall-clock (per the audit: per-request time is SERFF response + the deliberate
2.5s throttle and must not be reduced).

## Validation plan (REQUIRED before adoption)

Run a **controlled before/after on one already-collected state** (suggest a
mid-size one with known cross-check, e.g. **OR** or **MT**) and prove the
deliverable is **field-by-field identical**, not just row-count identical:

1. Snapshot the committed `{state}_final_rates.xlsx`.
2. Regenerate the deliverable via the candidate path (B1: search-workbook +
   submission-date backfill; or B2: enrichment-fetches-summary).
3. Diff **every cell of every row**, keyed by
   `(serff_tracking_number, company_name, sub_type_of_insurance)`:
   - keysets identical (no rows added/dropped),
   - **0 cell diffs** across all 21 columns (especially `filing_date` /
     `submission_date`, `effective_date`, all rate-value columns,
     `disposition_status`, `rate_activity`).
4. Re-run `compare_{state}_ambest.py` — match rates and `match_strength` split
   unchanged.
5. Confirm the ID anchor SFMA-134676753 still 14/14.
6. Repeat the diff on a **second** state before trusting it (one state could
   coincidentally have 0 search-phase date-fetch failures and hide the gap).

Adopt only if **both** states show 0 cell diffs.

## The risk (why this is deferred, not done)

If any field is **uniquely enrichment-sourced** and the diff misses it (e.g. a
field that's blank in the search workbook but populated by `scrape_detail_fields`
and silently consumed somewhere), skipping/relocating enrichment would cause
**silent data loss across every future state** — and would require **re-running
all existing 10 states** to repair. The current double-visit is wasteful but
*safe*: the deliverable is provably correct today. The field-by-field diff on two
states is the gate that converts "probably redundant" into "proven redundant."

The `submission_date` backfill for the ~42 search-failure filings (B1) is itself
a mini-pipeline that must be validated — those are exactly the filings whose
detail page was hard to open during search, so a naive backfill may re-hit the
same failures.

**Do not attempt before GA.** GA should run on the current proven pipeline
(with A + C applied). Validate B afterward as a standalone task.

## Validation result — B1 CLEAN on three states (2026-06-10)

Harness: `validate_b1.py` (offline — all PDFs cached, zero SERFF traffic).
Path A = `load_targets` from enriched `{state}_final.xlsx`; Path B =
search-workbook universe + submission_date backfilled only where the
search-phase fetch failed (oracle = enriched values; a production B1 fetches
those few dates in a tiny targeted pass).

| State | Rows | A-vs-B cell diffs (21 cols) | A-vs-committed (18 cols) | backfilled | date disagreements |
|---|---|---|---|---|---|
| NM | 131 | 0 | 0 | 13 | 0 |
| UT | 142 | 0 | 0 | 48 | 0 |
| ID | 112 | 0 | 0 | 34 | 0 |

- Target sets identical on every field `build_rows` consumes (tracking,
  filing_id, company, toi, sub_toi, filing_type, submission_date, group).
- Anchor SFMA-134676753: **14/14 under the B pipeline**.
- Confirms the premise: submission_date-for-search-failures is the ONLY thing
  enrichment uniquely contributes to the deliverable.

**One trap found and fixed (first run, 2026-06-09 evening, verdict was
DIFFS FOUND):** for legacy states the `{state}_mga_insurance_search.xlsx`
side-workbook (MGA added as a keyword 2026-05-15) was merged into the enriched
final but never folded into `{state}_all_companies_search.xlsx` — path B missed
7 UT + 2 ID GNSC targets (42+21 cell diffs, all row-presence). Not
enrichment-sourced data; purely search-workbook coverage. Fix: B's universe =
union of the state's search workbooks deduped by filing_id
(`_search_universe_paths`). **Production rule: a B1 state run must source from
the complete merged search universe (all 9 keywords / all side workbooks)** —
new-state sweeps (e.g. GA, 872 incl. MGA 10) already satisfy this in one
workbook.

Logs: `output/b1_validation/rerun_validation.log` (clean run),
`ut_id_validation.log` + `nm_validation.log` (first run, MGA gap),
per-state row dumps `{state}_rows_pathA/B.csv`.

## Deployment (2026-06-10, user-approved)

`run_final_rates.py` now loads targets from the search universe
(`load_targets_search`: union of `{state}_all_companies_search.xlsx` + side
workbooks per `_search_universe_paths`, deduped by filing_id). The legacy
enriched loader survives as `load_targets_enriched` (validation reference
path). `validate_b1.py`'s path B calls the PRODUCTION loader, and the
re-run against it stayed 0-cell-diff on NM/UT/ID with anchor 14/14
(`output/b1_validation/production_loader_validation.log`).

**Universe rule is ENFORCED, not advisory:** `verify_search_universe` hard-fails
the run if any non-archive `{state}_*_search*.xlsx` side workbook contains a
filing_id missing from the universe (a future legacy-style unmerged scrape
cannot silently drop rows). Audited clean across all 11 states
(`tools/audit_search_universe.py`: every side workbook + every backfill2024
slice is a strict subset of all_companies + mga_insurance).

submission_date resolution order in the loader: search value → legacy enriched
workbook (if one exists) → mini-pass sidecar
(`output/{state}_submission_date_backfill.csv`) → blank.

## Mini-pass validation — LIVE, 13/13 CLEAN (2026-06-10)

`backfill_submission_dates.py NM --validate` re-fetched submission_date for
NM's 13 search-phase failures (fresh context per filing, both group terms,
2 attempts each) and compared against the enriched oracle:

- First burst: 11/13 fetched, **11/11 exact matches, 0 value mismatches**.
  The 2 failures (SFMA-133822725, SFMA-133947505) were "Begin Search" timeout
  storms — the SERFF throttle re-arming after ~14 fresh searches (the GA
  signature), NOT flaky detail pages.
- Retry after a 25-min cooldown: both fetched on the FIRST attempt →
  **13/13 exact matches, 0 mismatches, verdict CLEAN**
  (`nm_minipass_validation.log`, `nm_minipass_retry.log`).

**Fallback policy (documented in the script):** a filing that still fails after
all attempts ships with a blank filing_date — precedented (OR's committed
deliverable has 5 blank-submission rows) and safe (tiering keys on
backfill-slice membership, not dates). Failures are recorded in the sidecar
(status column); re-runs skip successes and retry failures, so stragglers can
be picked up at any later SERFF touch. Operational lesson: run the mini-pass
in bursts of ~10-12 filings; the throttle re-arms around 14.
