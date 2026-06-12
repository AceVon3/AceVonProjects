# Resume state — 2026-06-11 close-out (VA mid-collection checkpoint)

## Session summary (2026-06-11, two efforts)

1. **Western re-measurement — DONE and locked** (monorepo `aa4fe36`, sync
   `b3c55db`): all artifact-standard states re-measured with the fixed AM Best
   parsers; +44 upgrades / 0 downgrades / 0 rate-cell changes; tiers now
   2 / 432 (332 direct) / 232 / 950 across 1,616 rows. UT's parser had been
   dropping 57% of report blocks (starred overall without `%` in HDR_RE).
   Exceptions documented: OR hand-transcribed-correct; WA on the old
   documented-12/14 basis (backlog #0 = build its artifact).
2. **VA collection — search phase COMPLETE, downloads 27%, STOPPED at the
   WAF wall** (this checkpoint). One state only; IL/OH untouched.

## VA MID-COLLECTION STATE (the resume target)

- **Universe: 1,103 filings** (`output/va_all_companies_search.xlsx`), all 13
  brands resolved across 19 keywords: 12 sweep-clean or retry-recovered;
  **Country Financial = verified genuine zero** (retry searched ok/HTTP-200,
  0 results — VA not in its 19-state footprint). 7 retry workbooks
  (`va_*_search_retry2.xlsx`) unioned via `merge_va_search.py` (glob-based,
  dated-rows-win; re-run safe).
- **In-scope target funnel: 498 filings** — Allstate 184, Travelers 70,
  Liberty Mutual 53, Farmers 52, Nationwide 41, Progressive 25, State Farm 23
  (+MGA 9 folds in), GEICO 22, American Family 15, USAA 13. Safeco/Encompass
  search hits produced 0 in-scope targets (verify at parse — likely
  Form/out-of-TOI).
- **Downloads: 135/498 filing-summary PDFs cached** (`output/pdfs/VA/`),
  ~363 remaining ≈ 46 batches of 8. 19 misses (17 distinct) when the run was
  stopped — all retryable, cache skips the 135.
- **276 in-scope targets ship blank submission_date** (620/1,052 sweep date
  fetches were WAF-challenged). Ship-safe per the GA precedent (tiering does
  not key on dates); backfillable via `backfill_submission_dates.py VA` in
  bursts of ~10-12. Do NOT attempt the full 276 in one session.
- **No `va_final_rates.xlsx` yet** — parse phase never reached.
  **`build_all_states.py` will NOT run clean until it exists** (VA is in its
  STATES list). This is the GA-staging pattern: mid-collection, deliberate.
- Anchor SFMA-134676753 untouched (all-states deliverable unchanged this
  session after `aa4fe36`).

## THE WAF READING (2026-06-11 — first direct evidence)

The new `--diag` sweep ledger (`output/diag_va_sweep/search_ledger.csv` +
three `fail_*` snapshots) captured the first confirmed WAF response codes:
**HTTP 405 on the Begin-Search document** — measurement, no longer inference.

- **Cold capacity after ONE quiet day + overnight: exactly 8 fresh
  Begin-Searches**, then three consecutive 405s (~90s), then partial
  recovery rationed at ~1-3 per window.
- 180s-spaced single retries: 7/7 first-try success.
- Row-click date fetches challenged far harder than GA: 620/1,052 failed.
- Download batches: ~19 batch Begin-Searches → 135 PDFs, then a
  **15-consecutive-miss wall** mid-afternoon (intra-day penalty deepening);
  stopped cleanly rather than grind.
- **CONCLUSION: overnight rest is NOT enough for heavy eastern states.
  Multi-day rest required before the VA download resume.**

## Munich Re watch — AMMH-* (likely the 3rd sibling)

`AMMH-*` tracking numbers surfaced under the American Family keyword (their
detail fetches were among the WAF failures). Likely American Modern Home —
the predicted third Munich Re/American Modern sibling (SCOPE.md collision
cluster). Exclusions are live in `EXCLUDED_SUBSIDIARY_PATTERNS`;
**CONFIRM AT PARSE** via the guardrail differ (any unclassified
AmFam-adjacent name = same cluster, exclude on sight, don't re-research).

## RESUME SEQUENCE (in order)

1. **Rest SERFF multi-day** (not overnight — proven insufficient 2026-06-11).
2. `python run_final_rates.py VA` — skips the 135 cached PDFs, fetches ~363
   + convergence passes for the 17 distinct misses. Watch the ledger; stop
   cleanly if 15-miss-class walls return.
3. Parse phase runs in the same command → `va_final_rates.xlsx`.
   **VA disposition vocabulary surfaces HERE** (first prior-approval state —
   expect new terms; classify via fall-through per CROSS_CHECK_STANDARD).
   **Prior-approval filed-vs-disposed divergence expected** (the GA
   Progressive pattern: events captured, values differ by disposition stage —
   classify, don't chase).
4. `compare_va_ambest.py` — **HOLD: requires the VA AM Best report staged,
   BOTH PPA + HO** (user stages it; not on disk as of this checkpoint).
   Build per CROSS_CHECK_STANDARD.md (artifact from day one, fixed-parser
   denominators).
5. `apply_validation_tiers.py VA` → `build_all_states.py` (anchor 14/14
   gate) → report.
6. Optional, budget-permitting: `backfill_submission_dates.py VA` bursts.

## Standing caveats (unchanged)

- 53 GA rows blank filing_date (Country-heavy) — backfillable.
- NWPP-134378106 (Nationwide GA): persistent structural miss, documented.
- WA on documented-12/14 basis until backlog #0 builds its artifact.
- Temp-purge hazard on insurancewebscraper sync: verify 0 spurious `D`
  lines before pushing; restore from index if struck (see memory +
  dataset_summary).
