# Resume state — 2026-06-11 close-out (13-brand era)

## Current committed state

- **Dataset: 1,616 rows / 11 states / 13 brands** (`output/all_states_final_rates.csv|xlsx`).
  Tier split: 2 field_validated (anchor SFMA-134676753, 14/14) / 388 ambest_cross_checked
  (310 direct) / 276 in-window / 950 pipeline.
- Monorepo commits: `e183718` (GA completion + WAF diagnosis + batched downloads),
  `81269c3` (13-brand expansion, Phase 3 validated), + tonight's parser-fix commit
  (see git log). insurancewebscraper synced at each step (`d607f23`, `a8e42e0`,
  `5a59bc8`, + tonight's); always verify HEAD == origin/master and re-check the
  Temp-purge hazard (it struck again 2026-06-11 — 74 files vanished; restored
  from index per the documented procedure, zero deletions committed).
- Governing scope doc: **`SCOPE.md`** (operative inclusion test + 13-brand roster
  + Munich Re/American Modern KNOWN COLLISION CLUSTER + SERFF name traps).

## FIRST TASK NEXT SESSION — western-state re-measurement (fixed parser)

The AM Best parsers required a numeric "indicated" cell; blank-indicated rows
(bare `%`) silently dropped from cross-check DENOMINATORS. Fixed 2026-06-11
(`tools/ambest_subline.py` + optional `ind` in the three parsers) and applied
to **GA only**. The committed tiers for **NM and AZ (and MT/NV/UT where compare
artifacts exist)** were computed with the broken parser and are under-counted
relative to GA.

**Re-measure them BEFORE IL/OH/VA.** Entirely OFFLINE — re-parse the report
texts already on disk (`output/ambest_*_text*.txt`; AZ/NM already re-parsed,
their CSVs updated in tonight's commit) + re-run the compare scripts + re-apply
tiers + rebuild all-states. **No SERFF traffic, no cooldown needed — start
immediately.**

Integrity gates (same as GA — non-negotiable):
1. **Zero lost matches** (every pre-fix corroboration match survives identically;
   snapshot the corroboration CSVs first, diff with the
   `tools/diag_wrapfix_match_delta.py` pattern).
2. **Gained matches individually verified** (same-named entity, same filing,
   impact agreement — no spurious inflation).
3. **0 rate-cell changes** (tier labels only; verify against the committed
   xlsx via the binary-safe `git show` + 18-base-column diff pattern).
4. Anchor 14/14 after `build_all_states.py`.

Note: MT/NV/UT compare scripts may read their own CSV paths — re-parse needs
the corresponding `parse_ambest_*` (only GA/NM/AZ parsers exist; MT/NV/UT/WA
CSVs came from earlier tooling — check provenance before re-parsing; if no
parser exists for a state, document it as not-re-measurable rather than guess).

## THEN: IL/OH/VA expansion (one state at a time)

All 13 carriers + fixed parser (correct denominators from day one), on the
modern pipeline:
- **B1** (search-universe loader, no enrichment phase) + **mini-pass** for
  date failures + **batched downloads** (8/session) + **diagnostics armed**
  (`src/search.DIAG_DIR` auto-set) + **rested SERFF** (the WAF rations fresh
  Begin-Searches; sweeps in cooldown-separated rounds, retries to
  `--out-suffix` files, `merge_*` unions generations — see the GA Phase 3
  pattern).
- **VA expectation:** prior-approval state — expect filed-vs-disposed value
  divergence in the cross-check (the GA Progressive pattern: events captured,
  values differ by disposition stage; classify, don't chase).
- **Munich Re / American Modern:** known collision cluster — any third sibling
  is the same pattern, exclude on sight (SCOPE.md).
- Guardrail discipline: per-state cross-check at ingestion per
  CROSS_CHECK_STANDARD.md; expect new state-vocabulary surprises (GA produced
  three: filing types, the questionnaire false-positive, Received/Exam).

## Standing caveats (documented, not blocking)

- **53 new-carrier GA rows ship blank `filing_date`** (mostly Country —
  WAF-challenged date fetches). Backfillable anytime via
  `backfill_submission_dates.py GA` (sidecar; run in bursts of ~10-12).
- **NWPP-134378106** (Nationwide GA): persistent structural download miss
  (batch + fresh-per-target across passes), documented in dataset_summary.
- **GA TRVD-G structural misses:** recovered during the 13-brand re-run;
  emitted 0 rows (blank tables). Persistent GA miss count: 1 (the NWPP above).

## SERFF/WAF operating model (measured, see serff_waf_throttle_strategy memory)

AWS WAF rate-based captcha (HTTP 405, `x-amzn-waf-action: captcha`). Scarce
currency = fresh Begin-Search submissions; row clicks are cheap until heavy
sustained load. Batched downloads cut search cost ~8×. One cooldown buys
~4-5 keyword sweeps. Penalty deepens with consecutive heavy days; rest days
recover it. Never attempt to bypass the challenge — stay under the rate.
