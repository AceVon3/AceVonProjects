# GA resume state — paused at the SERFF throttle wall (2026-06-09)

> **SERFF REST PERIOD IN EFFECT since 2026-06-10 — NO SERFF TRAFFIC OF ANY KIND**
> (no GA, no mini-passes, no sweeps) until the USER declares the rest done and
> approves the validation burst. Rationale: burst capacity collapsed 85 → 14 →
> ~12 fresh searches across consecutive heavy days — the throttle penalty
> deepens with daily load and appears to decay over DAYS of quiet, not hours.
> Expected rest: 2-3 days (through ~2026-06-12/13). See "RESUME SEQUENCE
> (v2, batched)" below for what happens after.

GA (Georgia) is the first eastern/southeastern expansion. Paused mid-`run_final_rates`
after ~6 hours of cumulative SERFF session load hard-throttled "Begin Search".
**Deferred to a fresh session after a full SERFF + machine cooldown (overnight).**
A short cooldown won't reset the throttle; resume only once it's genuinely cool.

This dataset (NM-complete, 10 states / 1,136 rows) is **unchanged** — GA is not yet
folded in. Nothing committed for GA (incomplete; no deliverable change).

## What is DONE (preserved on disk)

1. **AM Best inventory + parse — COMPLETE and VERIFIED.** 3 effective-date-range
   PDFs (filenames say "6-30-35" = typo for **6-30-25**; verified from data):
   - `output/ambest_ga_text_1.txt` — eff 2024-01-01 → 2024-10-31
   - `output/ambest_ga_text_2.txt` — eff 2024-10-31 → 2025-06-27
   - `output/ambest_ga_text_3.txt` — eff 2025-07-01 → 2026-06-08
   - Coverage: filter axis is **effective date**; the 3 files tile our window
     [2024-01-01, 2026-04-17] with NO real gap (the 2025-06-28..06-30 "gap" is
     weekend+month-end sparsity, 0 in-scope entries). Boundary overlap at
     2024-10-31 (3 keys) is collapsed by dedup — not double-counted.
   - `tools/parse_ambest_ga.py` parses all 3 → `tools/ambest_ga_data.csv`
     (89,616 raw rows). Dedup (6-tuple key, same as compare_nm) → **1,373 unique**.
   - **In-scope (8-brand, Rate, eff 2025-01-01→2026-04-17): PPA 103, HO 32** (135 total).
2. **Search — COMPLETE.** `output/ga_all_companies_search.xlsx` = **872 filings**,
   all 9 brand keywords. Four brands silent-failed in the sweep (Allstate, Travelers,
   Liberty Mutual, Encompass) and were recovered by isolated verify-retries
   (`merge_ga_search.py` already run): Allstate 153, Travelers 300, Liberty Mutual 138,
   Encompass 55; plus State Farm 71, Safeco 58, GEICO 49, Progressive 38, MGA 10.
3. **Enrichment — COMPLETE.** `output/ga_final.xlsx` = 872 filings enriched
   (metadata-only, `download_pdfs=False`). Submission dates 491/872 (the rest get
   blank `filing_date` — metadata only; rate data comes from the PDF). The first
   enrichment run crashed on a flaky row-click; **`src/detail.py` was fixed** to make
   `enrich_filing` treat a `_click_row_to_detail` exception as a per-filing skip
   (was uncaught → crashed the run). `run_ga_full.py` was made **resumable** (loads
   the partial `ga_final.xlsx`, skips already-enriched filings via populated
   `type_of_insurance`). Both changes are on disk, UNCOMMITTED — keep them.
4. **Final-rates — PARTIAL.** `run_final_rates.py GA` identified **326** target-TOI
   target-carrier filings. `output/pdfs/GA/*/filing_summary.pdf` = **99 cached**
   (all >5KB) after the 2026-06-09 evening resume attempt (see addendum below).
   **227 remain** + convergence.
5. **`compare_ga_ambest.py` — BUILT** (2026-06-09 evening, mirror of
   `compare_nm_ambest.py`, points at `tools/ambest_ga_data.csv` +
   `output/ga_final_rates.xlsx`). Not yet run (needs the final-rates xlsx).
6. **Tiering trap — ALREADY DEFUSED** (2026-06-09 evening): "GA" added to
   `CROSS_CHECKED_STATES` and `"ga"` to `ALL` in `apply_validation_tiers.py`.
   Step 3 of the resume sequence below is DONE — do not re-edit.

## ADDENDUM — 2026-06-09 evening resume attempt (~6h cooldown: INSUFFICIENT)

Resumed `run_final_rates.py GA` after ~6h cooldown. Result: **+14 PDFs (85→99)**
in ~10 min, then a sustained throttle wall — stopped cleanly per plan.

Observed pattern (log: `output/ga_final_rates_pass1.log`):
- First 11 Allstate fetches: clean, no retries (cooldown looked good).
- Filing 12: "Begin Search" timeout storm (~5 min, 7 retries), then a brief
  recovery burst (filings 15–18 ok), then a second storm with NO recovery
  (~10 min, retries 8→17+, ok frozen at 14). That is the wall, not a transient.
- Filings skipped by retry exhaustion (12–14, plus 5) are picked up by
  convergence passes — nothing lost.

Conclusion: ~6h is not enough cooldown; SERFF's throttle state persists longer
(or re-arms after a small burst of new searches). Next attempt should be after
a FULL overnight+ cooldown, and per the prior recommendation, **validating the
B refactor first** (halving detail-page round-trips) is now the better path
than re-fighting the throttle for the remaining 227.

## Why paused

After ~6h (872 searches + 591 brand-retry searches + ~1,150 enrichment detail-opens
+ 85 download searches), SERFF hard-throttled "Begin Search" — filings 104-147 all
timed out across both search terms, ~90s of retries each, near-zero yield. Continuing
would hammer a throttled service for hours against the "limit sustained load" goal.
`run_final_rates` skips cached PDFs (`exists() and size>5000`), so stopping lost
nothing.

## RESUME SEQUENCE (v2, batched — 2026-06-10 plan, supersedes v1 below)

Built and smoke-tested during the rest period (no SERFF): `download_all_pdfs`
now batches `DOWNLOAD_BATCH_SIZE=8` downloads per fresh search session
(primary path) with the proven fresh-per-target loop as FALLBACK and a
2-consecutive-miss early-abort guard (the OR degradation signature). GA's 227
remaining ≈ ~30 fresh searches ≈ 3-4 bursts even at depressed capacity.

After the user ends the rest and approves:

1. **`validate_batch_download.py GA`** — TRIPLE DUTY: (a) batch validation —
   ONE fresh search, one batch of 8 (4 cached re-fetch probes at positions
   1/3/5/8 parse-compared cell-level vs the known-good cache + the 4 remaining
   "allstate"-keyword uncached); (b) capacity probe; (c) failure-signature
   capture — `src/search.DIAG_DIR` is enabled, so every fresh search writes a
   timestamped row to `output/serff_diagnostics/search_ledger.csv` and any
   failure dumps HTTP statuses/headers (Retry-After), page title/body/HTML to
   `output/serff_diagnostics/fail_*/`. NOTE: we have NEVER measured what SERFF
   serves when it walls (84/84 logged failures are bare Begin-Search-link
   click timeouts; goto always succeeded, so it's NOT connection-level) —
   "rate limiting" is still an inference. This burst captures it either way.
   `--plan` previews offline (verified: loader reproduces 326/99/227).
   CLEAN → step 2. Misses mid-batch or any parse diff → set
   `DOWNLOAD_BATCH_SIZE=1` (legacy) and report before proceeding.
2. **`run_final_rates.py GA`** — batched resume of the remaining ~223 +
   convergence passes until row count + `no_pdf` stabilize (NM took 4 passes).
3. **`compare_ga_ambest.py`** — already built. Then `apply_validation_tiers.py
   GA` (GA already in `CROSS_CHECKED_STATES` — do not re-edit),
   `build_all_states.py`, both-line cross-check report, COMMIT + sync
   (per v1 steps 2-5 below, which remain the reference for that half).

## RESUME SEQUENCE (v1, fresh-per-target — superseded by v2 above)

Run from `Insurance Rate Data Scraper/`, using `./.venv/Scripts/python.exe`:

1. **`run_final_rates.py GA`** — skips the 85 cached, fetches the remaining 241 +
   parses. Re-run for convergence until row count + `no_pdf` stabilize (NM took
   4 passes: 112→129→131→131). Each pass re-fetches only `no_pdf` misses (cached
   skip confirmed). Watch for the same throttle; if it recurs, pause and resume later.
2. **`compare_ga_ambest.py`** — BUILD THIS (mirror `compare_nm_ambest.py`): point
   `AMBEST_CSV = tools/ambest_ga_data.csv`, `DATASET_XLSX = output/ga_final_rates.xlsx`,
   `DATASET_SHEET = "rates"`, state filter `== "GA"`, labels GA, `emit_from_tiers("GA"...)`.
   Dedup key already proven. Expect in-scope PPA 103 / HO 32 as the denominators.
   Window-filter `DATE_TO = 2026-04-17` (file 3 runs to 2026-06-08 — exclude the tail).
3. **`apply_validation_tiers.py GA`** — GA already added to `CROSS_CHECKED_STATES`?
   CHECK: it is NOT yet (only through NM). **Add "GA" to `CROSS_CHECKED_STATES` and
   `ALL`** in `apply_validation_tiers.py` before running, else GA's eff≥2025 unmatched
   rows wrongly fall to `pipeline_extracted` instead of `pipeline_extracted_in_validated_window`.
4. **`build_all_states.py`** — GA already in its `STATES` list and `src/config.py`
   `STATES` (done). Rebuilds the canonical deliverable (will become 1,136 + GA rows).
5. **Both-line cross-check report + COMMIT.** Report per the NM pattern (raw→target→
   emitted funnel, per-brand, tier distribution, match_strength split for PPA+HO,
   in-scope match rates, classified misses, anchor SFMA-134676753 still 14/14). Then
   sync to `insurancewebscraper` (restore the Temp checkout from HEAD first if purged;
   stage explicitly by path; `git add -f` the gitignored `output/` deliverables +
   `output/corroboration/ga_*`; verify 0 `D` lines; confirm HEAD==origin/master).

Update `output/dataset_summary.md` for GA at commit time: row count, tier distribution,
GA disposition vocabulary (check for new terms — GA was not yet inspected; NM was
"File & Use With Review"), the 4 silent-fail recoveries, the 3-file concatenation +
boundary-overlap handling, any structural misses.

## Last-sync reference

`insurancewebscraper` HEAD == `0f79765` (pipeline optimization A/C + B writeup).
GA work is all uncommitted in the monorepo working copy. Uncommitted-but-essential
for resume: `src/detail.py` (crash fix), `run_ga_full.py` (resume logic),
`src/config.py` + `build_all_states.py` (GA in STATES), `merge_ga_search.py`,
`tools/parse_ambest_ga.py`, `tools/inventory_ga_ambest.py`.

## B refactor — moved UP the priority list (GA is concrete evidence)

GA's throttle wall is direct evidence for **Follow-up B** (`followup_B_enrichment_redundancy.md`):
the duplicate detail-page visit (enrichment opens all 872, then final-rates re-opens
each of 326 targets) roughly **doubled** GA's SERFF load and was a major contributor
to hitting the wall. B would ~halve detail-page round-trips.

**But do NOT rush B because of GA frustration.** It still gets the FULL field-by-field
validation in `followup_B_enrichment_redundancy.md` (0-cell-diff on TWO existing states,
keyed by (tracking, company, sub_TOI); confirm `filing_date`/`submission_date` especially)
BEFORE any real run. Silent-data-loss risk = re-run of all existing states.

**Recommendation: validate B between heavy states — ideally before IL and OH**, which
are even heavier than GA (IL: 3 AM Best files; OH: 2) and would hit the wall harder
without it. Sequence: finish GA on the current (proven) pipeline → validate B properly
→ then run IL/OH with the halved load.

**UPDATE 2026-06-10: B1 VALIDATED + DEPLOYED (user-approved).** Offline: 0 cell
diffs on NM/UT/ID, anchor 14/14. Live: submission-date mini-pass 13/13 exact vs
the NM oracle. `run_final_rates.py` is now the B1 pipeline (search-universe
loader + enforced universe rule + `backfill_submission_dates.py` sidecar). See
`followup_B_enrichment_redundancy.md`.

**TWO-TRACK PLAN (user decision, 2026-06-10):**
- **Track A (GA):** B does NOT help GA — enrichment already done, the remaining
  227 are final-rates PDF visits B keeps. GA needs a genuine overnight+ SERFF
  cooldown (6h proven insufficient; 2026-06-10 data point: even after overnight,
  the throttle re-armed after ~14 fresh searches), then resume per the sequence
  above. Do NOT attempt before a real long cooldown.
- **Track B (IL/OH/VA + future):** run search → mini-pass → final-rates directly
  (no enrichment), ~halved SERFF load per state.
