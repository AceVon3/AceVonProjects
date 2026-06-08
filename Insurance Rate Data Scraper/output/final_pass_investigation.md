# Final-pass investigation list (2024 back-extension)

Items deferred to the end-of-all-states cleanup pass (before final commit).

## 1. TRVD recovery queue — RESOLVED 2026-06-03 (pagination fix)
- Root cause was the `_click_row_to_detail` page-1-only bug + batch-loop
  context contamination, NOT a SERFF visibility gap (live search confirmed all
  9 residual OR TRVD data-rk present in results). Fixed: `_goto_row_page`
  paginates by stable data-rk across all pages; `download_all_pdfs` now uses a
  fresh context per uncached target. Validated 7/7 anchors + 9/9 OR residual.
- Queue of 21 (MT 5, WA 6, OR 10) fully drained: all download now (TRVD
  not-found = 0 everywhere). Net **+3 in-scope rows** (MT +1, OR +2); the
  other 18 were legitimately non-emitting (Form/Rule, rate-data-N/A,
  out-of-window). `trvd_recovery_queue.csv` retained as an audit record.
- No further TRVD batch-recovery script needed. AZ/CO will be collected with
  the fixed path from the start.
- **Queue rebuilt from the final emit (2026-06-08): persistent TRVD gap = 0.**
  All 21 provisional first-run entries (incl. TRVD-134151094, which was queued
  but later downloaded) are resolved. `trvd_recovery_queue.csv` now reflects 0
  persistent rows. The only persistent `no_pdf` rows dataset-wide are the 4
  non-TRVD genuinely-empty anomalies in item 2 (MT 1, ID 1, AZ 2).

## 2. PDF-present / 0-rows-parsed anomalies — RESOLVED 2026-06-04

Investigated all five. The "Allstate-layout parser gap" was largely benign:
- **4 of 5 genuinely empty** (summary-table rate cells blank — `% % % %`, zero
  numeric % in the entire PDF; the rate impact lives only in attached rate
  manuals, which we don't parse). Correct to emit 0 rows.
  - AZ `ALSE-134165850`, `ALSE-134168079` (Allstate, manual-override filings)
  - ID `GNSC-134159934` (MGA/State Farm — not Allstate)
  - MT `SFCI-134249794` (State Farm Classic; carries the "rate data does NOT
    apply" marker — the confirmed-blank Rate-shell documented in the prior MT
    session; not a parser bug, not the Allstate layout)
- **1 real parse-miss**: ID `ALSE-133788858` (Encompass Indemnity, all
  `0.000%` / 0 policyholders) — layout `name ind% imp% $prem_chg ph max% min%`
  with the `$prem_for` column OMITTED, matched by no existing pattern. Fixed
  with **Pattern G** in `src/utils.py` (additive; dataset-wide sweep of 1,985
  cached PDFs found this is the ONLY filing it newly matches; anchor still
  14/14). The recovered row is **eff 08/28/2023 → out-of-window**, so it does
  not emit — **net +0 rows**, dataset stays 1,005. Pattern G is kept as a
  correctness fix (closes the silent-0-row diagnostic; handles the layout for
  future runs).

(Original notes retained below for history.)

## 2-orig. PDF-present / 0-rows-parsed anomalies
- **ID: 2 filings** flagged `rate_data_applies=True but 0 rows extracted`
  (counted under `filings_excluded_no_pdf`, but PDFs ARE present — not a
  download gap). Could be legitimately empty rate tables OR a parser miss on
  an unusual layout. Enumerate (re-run prints `! {tracking}: rate_data_applies
  =True but 0 rows extracted`) and inspect each PDF.
- **AZ: 2 filings** — same class: `ALSE-134165850`, `ALSE-134168079`
  (Allstate; rate_data_applies=True, 0 rows extracted). Inspect PDFs — likely
  an Allstate layout the parser's row patterns miss.
- UT/MT clean (MT's 1 no_pdf is this same class — enumerate in final pass).
- Watch for the same pattern in CO and add any here.

## 3. Convergence — DONE 2026-06-04
- Full re-emit across all 9 states; counts stabilized (no_pdf settled to the 4
  genuinely-empty anomalies; TRVD-not-found 0). all_states rebuilt = 1,005.

## 4. ID 0-row anomalies (the originally-flagged "2 ID") — RESOLVED 2026-06-08
- `ALSE-133788858` (Encompass): resolved by Pattern G — now parses its
  all-0.000% row; eff 08/28/2023 is out-of-window, so it correctly emits 0 rows
  (no longer a silent 0-row anomaly).
- `GNSC-134159934` (MGA): genuinely empty (0 numeric % in the PDF; rate impact
  only in attachments). Documented as a known-empty filing — not a parser bug.
- Both confirmed 2026-06-08; neither is a TRVD/download issue. Remaining
  persistent no_pdf dataset-wide = these genuinely-empty cases (MT 1, ID 1,
  AZ 2), all accepted as correct 0-row emissions.
