# Pipeline efficiency wins + rest-test tooling (2026-06-15)

Built offline, 0 SERFF traffic. Deliverable/anchor unaffected (changes are
download-scheduling + search date-policy only; no parse code touched —
anchor SFMA-134676753 re-verified 14/14 offline after the changes).

## Workstream 1 — efficiency wins (download path)

### 1a. Re-batched recovery pass  — VALIDATE-IN-VIVO
`run_final_rates._batched_with_recovery` + `download_all_pdfs`.
Batch misses are mostly JSF-degradation misses (row was findable; the reused
session was contaminated), not true not-founds. Before paying the per-target
fresh-search price (1 walling Begin-Search per straggler), misses are re-pooled
into NEW fresh-context batches and retried at batch rate (`batch_size`:1). Only
what survives the recovery rounds drops to the per-target fallback (true
not-founds). A recovery round that recovers nothing stops the recovery loop.
- Config: `REBATCH_RECOVERY_ROUNDS = 1` (0 = legacy straight-to-per-target).
- Preserved: per-batch degradation guard (`BATCH_ABORT_CONSECUTIVE_MISSES = 2`)
  and stable-filing_id keying both live in `_run_batch`, untouched.
- ⚠️ **VALIDATE-IN-VIVO**: on the first rested burst, run ONE batch and confirm
  the recovery pass actually lands degradation-misses at batch rate before
  trusting it on a full run. (Offline unit tests prove the *scheduling* logic;
  in-vivo confirms the JSF assumption that a fresh batch recovers the miss.)

### 1b. Harvest-early stopping rule
`run_final_rates._HarvestEarlyGuard`. Run-level yield watchdog: after a warm-up,
trips when recent landed/attempted collapses toward the per-target 1:1 regime,
so collection STOPS before grinding the wall. Banks the high-leverage early
batches; defers the rest to the next burst (no status loss).
- Config: `HARVEST_EARLY = True`, `HARVEST_EARLY_MIN_BATCHES = 3`,
  `HARVEST_EARLY_WINDOW = 3`, `HARVEST_EARLY_COLLAPSE_RATIO = 0.34`.
- Deliverable-neutral: it only changes how many PDFs are collected per run; the
  deliverable is re-derived from cached PDFs, so no parsed row changes. A
  fully-cached state downloads nothing -> guard never fires.

### 1c. `--no-dates` (default for universe sweeps)
`run_search.py` + `search_all`/`search_company`. Skips per-row submission_date
detail fetches (~1 detail fetch per result row; heavy WAF exposure for a field
that is ship-safe blank per GA/VA precedent, backfillable later).
- **Universe sweeps (`--all` / `--all-companies`) now default to NO dates.**
- Single-carrier runs (targeted backfill) keep dates by default.
- Overrides: `--with-dates` forces on (wins over `--no-dates`); `--no-dates`
  forces off.

Tests: `python test_recovery_harvest.py` (15 cases, offline, mock SERFF).

## Workstream 2 — rest-test tooling

### 2a. Quiet-period guard
`src/quiet_period.py`. Durable rest-window record (`quiet_period.json` at repo
root) + a guard every SERFF-touching entry point calls at startup
(`run_final_rates`, `run_search`, `backfill_submission_dates`,
`validate_batch_download` live path, `cold_capacity_read`). During an active
window those refuse to run (exit 3) with a loud banner, so an accidental run
cannot reset the WAF penalty clock.
- Start a rest:  `python src/quiet_period.py start --days 14 --reason "..."`
- Status / clear: `python src/quiet_period.py status` / `clear`
- Intentional override: env `SERFF_QUIET_OVERRIDE=1`.
Tests: `python test_quiet_period.py` (offline).

### 2b. Cold-capacity read  — THE decisive post-rest measurement
`cold_capacity_read.py`. Runs a small number of FRESH Begin-Searches with
diagnostics armed, records where the wall lands, STOPS at the first sustained
wall. MEASUREMENT ONLY (no enrichment, no downloads). Prints the measured cold
capacity — replaces the unverified "85" prose.
- `python cold_capacity_read.py --state VA --n 20 --sustained 2`
- Refuses while a rest window is active (the read itself ends the rest; run it
  when the declared rest ends).

### 2c. Decision tree
Documented in `output/resume_state.md`. Drives what to do with the measured
cold-capacity number (expansion viable vs ratchet-confirmed scope decision).

## HOLD
The 1a re-batched recovery and the 2b cold read both wait for the user to start
the actual rest period before any SERFF validation. Nothing here has touched
SERFF.
