# Resume state — 2026-06-16 close-out (AM Best interim shipped; scrapers parked)

> **2026-06-18 — offline UI session, NO scraper impact.** A UI polish pass shipped
> to the app (agent-intel/master `95534d5`: Prospect/Defend tables + dashboard
> restyle, UI-only, scraped baseline byte-identical). **The SERFF quiet period was
> NOT touched** — all work was offline in the `agent_intelligence` repo; the guard,
> the WAF, the parked VA/OH scrapes, and **the June-21 cold-capacity read (below)
> are unaffected and remain the next pending action.** Deploy-hygiene note: the
> monorepo `origin/master` is ~96 commits behind (`fc11c86`); the live deploy path
> remains agent-intel/master — left as the norm, not synced. Full UI history:
> `agent_intelligence/SESSION_STATE.md`.

## 🌍 CURRENT STATE OF THE WORLD (2026-06-16)

**Landed & pushed (all HEAD == origin):**
- agent-intel/master **`d21fe1d`** (Vercel auto-deploys) · insurancewebscraper/master
  **`e9f7c78`** · monorepo **`cc39a32`**.
- Gates green: 13 e2e + 7 verify, tsc clean, prod build 12 routes. Scraped
  baseline **byte-identical** (`filings_raw c59633a4`, `filings 0c587e9b`).

**1. APP STATUS — live with full coverage.**
- **998 scraped filings** (13-brand roster, 10 states AZ/CO/GA/ID/MT/NM/NV/OR/UT/WA)
  **+ 596 AM Best interim** (IL 244, OH 158, VA 194).
- IL/OH/VA render **identically to scraped** (no UI badge). Distinct ONLY in
  backend: `source='ambest_sourced'`, the `AMB-<ST>-<line>-<hash>` surrogate key
  (backend-only — stripped from UI + API payload via `toClientFiling`), and the
  clean replacement path. `docs/AMBEST_INTERIM.md` documents the design.
- Methodology page: validation table stays **10 cross-checked states**; IL/OH/VA
  shown separately as interim (not validated). "37 not covered" = 50−13.

**2. PENDING DECISION POINT — June 21 cold-capacity read.**
- FIRST action when the quiet window ends: clear/expire the guard, then run
  `python cold_capacity_read.py` **BEFORE any collection** (collecting first
  contaminates the measurement).
- The number decides whether scraping IL/OH/VA properly + new-carrier backfill
  is a one-cycle win or a multi-week grind. Decision tree below (» 17 → viable;
  ~14–17 → ratchet, scope decision).
- **Lower pressure now:** the app ALREADY has IL/OH/VA via interim AM Best data,
  so scraping them is UPGRADING interim→real, not unblocking coverage.

**3. PARKED SCRAPER STATE.** VA 165/498 PDFs; OH partial universe (14/19 carrier
keywords). Both wait on the same WAF recovery, same shared IP budget.

**4. REPLACEMENT PATH (ready).** When a state is scraped:
`DELETE FROM filings_raw/filings WHERE state=X AND source='ambest_sourced'` →
import the scrape as `serff_scraped` → re-rollup. Mixed-source guard + source
tag = clean swap, no double-count. Idempotent keys.

**5. BACKLOG (none urgent, all recorded in BACKLOG.md):**
- New-carrier backfill into the 8 western states (needs WAF; gated on June 21).
- B1: consolidate the 6 AM Best parsers into one blank-safe extractor (3rd
  same-family bug justifies it).
- B2: UT date-column mis-assignment (~2–3 rows).
- Finish VA/OH scrapes properly (post-cold-read).
- **ROOT-CAUSE THE TEMP-PURGE HAZARD** — struck ~6+ times (again this session:
  119 files), caught every time by explicit-path staging, but one slipped sync
  could do real damage. Fix the cause (likely OneDrive/Temp interaction), not
  just neutralize each time.

**6. KEY MEASURED FACTS (don't re-derive from prose):**
- WAF = AWS rate-based CAPTCHA (HTTP 405, `x-amzn-waf-action`), IP-keyed shared
  budget, decays over **days not hours**.
- Only ledger-MEASURED cold capacities: GA 06-10 = **10**, VA overnight = **8**,
  VA 72h = **17**, OH warm = **14**. The "**85**" is UNVERIFIED prose — the
  June 21 cold read replaces it with a measured number.
- Scraped dataset verified correct from multiple angles (forward + reverse
  cross-check, 3 parser-fix passes, value spot-checks): rate values right,
  corroboration honestly tiered. AM Best reverse-cross-check B3 (Safeco 9.9 vs
  19.6) resolved = withdrawn-vs-amended filings, not an error.

---

## ⚠️ STATE SEPARATION — VA is PARKED; OH is a SEPARATE effort

VA is parked mid-collection at **165/498 cached**. OH is being started as its
own state. **Do NOT let OH's session, downloads, or commits disturb VA's parked
progress** — VA's cached PDFs, universe workbooks, ledger rows, and this note
must stay untouched while OH runs. Resume VA only via `run_final_rates.py VA`
(cache-skips the 165, no re-download of parked progress). OH gets its own
universe/targets/PDF dir under `output/pdfs/OH/` and its own resume tracking.

## 🛑 QUIET PERIOD ACTIVE until **2026-06-21 16:06** — NO SERFF until then

Armed 2026-06-15 for **6 days** (WAF penalty recovery + cold-capacity decision
test). The guard is wired into all five SERFF entry points (`run_final_rates`,
`run_search`, `backfill_submission_dates`, `validate_batch_download`,
`cold_capacity_read`) — all verified to REFUSE with exit 3 + banner, no SERFF.
State file: `quiet_period.json`. Status: `python src/quiet_period.py status`.
Override only if intentional: `SERFF_QUIET_OVERRIDE=1` or
`python src/quiet_period.py clear`.

### ⚠️ FIRST ACTION WHEN THE REST ENDS (2026-06-21): the COLD-CAPACITY READ — BEFORE any collection
```
python cold_capacity_read.py --state VA --n 20 --sustained 2
```
**This measurement IS the decision point. Do NOT collect first** — running
`run_final_rates`/`run_search` before the read would consume the recovered WAF
budget and CONTAMINATE the cold-capacity number, destroying the whole point of
the 6-day rest. Read first, then act on the DECISION TREE below.

### DECISION TREE (act on the measured cold-capacity number)

- **Cold read climbs toward high tens (» 17)** → penalty decays fully on a long
  rest; expansion is viable. Resume VA (`run_final_rates.py VA`, cache-skips
  165) then OH — both draw the same IP-keyed pool, so do them back-to-back
  within the restored budget, harvest-early.
- **Cold read plateaus at ~14–17** → ratchet confirmed; eastern states are a
  measured multi-cycle grind. Decide scope: finish VA/OH slowly across many
  rests, OR pivot to building on the existing 11-state dataset (1,616 rows) and
  treat VA/OH as best-effort.
- Either way the number is now MEASURED (VA overnight 8 / VA 72h 17 / OH 14 are
  the existing points), replacing the unverified "85" prose.

Efficiency wins for the resume burst are built + offline-tested (see
`PIPELINE_EFFICIENCY.md`): re-batched recovery (⚠️ VALIDATE-IN-VIVO on the
first rested batch), harvest-early stop, `--no-dates` default for sweeps.

## Session summary (2026-06-15) — VA 72hr-rest download resume

- **VA downloads advanced 135 → 165/498 cached (+29, 33%)**, then STOPPED
  cleanly when the WAF wall returned in the fresh-search-per-target FALLBACK
  pass (not the batched pass). Only the **Allstate group** was reached this
  session; the other 12 carrier groups remain untouched. No grinding past the
  wall (per the don't-deepen-the-penalty rule).
- **WAF capacity reading (72hr rest): 17 clean cold searches before the first
  405**, vs 8 after the overnight rest — multi-day rest roughly doubled cold
  capacity (decay-over-days model holds). Cold-window challenge rate 8% (vs
  GA 20%). Analysis concluded: VA is NOT intrinsically harder per request —
  GA→VA capacity decline is accumulated penalty + recent load + VA's larger
  volume. Walls are anti-correlated with request velocity (bursts succeed,
  idle precedes walls) — the velocity/batching-caused-walls hypothesis was
  tested against the ledger and REFUTED; slowing bursts is NOT the fix.
- Parse phase NOT reached → still no `va_final_rates.xlsx` (deliberate).
  AMMH-* American Modern exclusion still pending parse-time confirmation
  (those filings sit in the American Family group, never reached this session).

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
- **Downloads: 165/498 filing-summary PDFs cached** (`output/pdfs/VA/`),
  **~333 remaining ≈ 42 batches of 8**. Updated 2026-06-15 (+29; Allstate
  group only — ALSE + GMMX prefixes). Cache skips the 165 on resume; the other
  12 carrier groups (Travelers, Liberty Mutual, Farmers, Nationwide,
  Progressive, State Farm, GEICO, American Family, USAA, + folds) are entirely
  un-downloaded. Resume picks up from the Allstate stragglers, then proceeds
  through those groups.
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

1. **Rest SERFF multi-day** (not overnight — proven insufficient 2026-06-11;
   72hr gave 17 cold searches on 2026-06-15). If OH has run in between, rest
   accounts for OH's load too — capacity is shared across all SERFF activity.
2. `python run_final_rates.py VA` — **skips the 165 cached PDFs**, fetches the
   ~333 remaining + convergence. Picks up from the Allstate stragglers, then
   the other 12 carrier groups. Watch the ledger; stop cleanly if walls return
   and sustain (do not grind into the fallback pass — that deepens penalty).
3. Parse phase runs in the same command → `va_final_rates.xlsx`.
   **VA disposition vocabulary surfaces HERE** (first prior-approval state —
   expect new terms; classify via fall-through per CROSS_CHECK_STANDARD).
   **Prior-approval filed-vs-disposed divergence expected** (the GA
   Progressive pattern: events captured, values differ by disposition stage —
   classify, don't chase).
4. `compare_va_ambest.py` — **HOLD: requires the VA AM Best report staged,
   BOTH PPA + HO** (user stages it; **STILL NOT on disk as of 2026-06-15** —
   verified no VA AM Best report among the staged AM Best files). Cross-check
   blocked until staged. Build per CROSS_CHECK_STANDARD.md (artifact from day
   one, fixed-parser denominators).
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
