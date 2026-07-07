# Session checkpoint — 2026-07-06 (MA)  ·  MA INTERIM→REAL IMPORT SHIPPED + VALIDATED (19th scraped state; first medium tier)

MA's 129-row SERFF scrape (281/282 in-target, 0 true misses) replaced its AM
Best interim; cross-checked (9th point — VALUE-AGREEMENT 53/53 = 100%, INTERIM
49/49 = 100%, **HO 27/27 = 100% on ROBUST N for the first time**), shipped
validated:{auto:true, home:true}. db md5 `14f12fab` (supersedes post-B6
`8941a436`). **NEW BASELINE: 19 states, raw 3,092 / rolled 1,890 / active 566.**

- **Gate:** 18 prior scraped states byte-identical (incl. B6-corrected
  IL/WV/GA); CA/NY/TX intact; MA delta exact; **6 interim states consciously
  enriched** (TravCo/Phoenix → Travelers brand-map fix: MI/ND/SD/PA/RI/TN,
  +13 raw/+6 rolled — the WV/NH globally-correct precedent; NJ/WI reverted to
  byte-identical after the Wausau exclusion).
- **COVERAGE VERDICT: richness-only** — GEICO/Progressive/Farmers AM-Best-0
  adjudicated form/rule-heavy per-brand; dense mature markets are AM-Best-
  complete (coverage-thinness = isolated-market phenomenon, the AK lesson).
  +1 marginal GEICO enrichment (GECC-134365103 +3.7%/18,651ph).
- **Exclusion doctrine resolved:** LM P&C + Wausau family excluded (retired-
  brand/no-consumer-channel LM vehicles, Peerless-consistent — Peerless was
  already excluded on the same MA filing). Near-miss recorded: bare "wausau"
  substring almost mapped an independent WI mutual into Liberty; the import
  gate caught it (specific-name patterns only).
- **NICOA paginator-glitch save end-to-end:** +6.1%/4,038ph HO renders live,
  matches AM Best. B8 opened (glitch, 3rd occurrence). MA in COVERED_STATES;
  AMBEST_STATES → 26; methodology 19 rows, MA ✓✓.
- **HEADs (post-deploy):** insurancewebscraper `09cdf15`->**`09a4305`**
  (HEAD==origin). agent-intel/master `8b5f858`->**`81fba2b`** (subtree-FF, 0
  deletions; Vercel LIVE — MA Prospect serves incl. the NICOA +6.1% signal).
  Monorepo `ea2c1ad`+`fa44056` (local). `filings.db` **`14f12fab`**.
- **Gates:** import ALL CHECKS PASSED (3092/1890/19/566), verify_subtype 566
  (deltas == exactly MA), 8 verify + tsc + build 12/12 + 13 e2e green.
  Localhost-approved.

---

# Session checkpoint — 2026-07-07  ·  B6 COMPLETE: comma-percent parser fix + 18-state retro-verification + 7-state gated re-import

The "wrapped-name" backlog bug root-caused to the shared parser's row regexes
rejecting thousands-comma percentages ("1,830.500%") → silent 0-row / PARTIAL /
WRONG-VALUE extraction. Fixed additively (`_FS_PCT` comma-tolerant core + shapes
H/I/J), verified by a FULL 5,113-PDF old-vs-new parse diff across all 18 scraped
states (5,098 byte-identical, exactly 15 adjudicated diffs), then a 7-state
surgical gated re-import. **Deployed; localhost-approved (IL Defend renders).**

- **NEW BASELINE (SUPERSEDES post-AK `2947`/`1826`/550 / `23f0bf29`):** **18
  states**, raw **2963**, rolled **1832**, active@2026-06-11 **551**, db md5
  **`8941a436`**, anchor +93.70% WA (unchanged). as-of pin held (2026-06-11).
- **THE RECOVERED SIGNAL: IL CFPC-134419708 — a LIVE Defend row** (COUNTRY
  Financial −4.38% rolled / 334,163 ph / eff 09/21/2025, Personal Auto). Both
  gates had missed it: IL shipped before the funnel gate existed, and the AM Best
  cross-check is Country-blind (the AK coverage-thin lesson, IL instance).
- **Also corrected:** WV FAIG-134672434 wrong-value 0.000%→2.800% (old parser
  fell through to a stale pre-amendment row — adjudicated at source PDF); GA
  rollups → source-true (CFPC-133859077 16.98→17.56%, CFPC-134294144 3.376→3.467%
  == the PDF's own filing-level value); IL CFPC-133968582 +12.95%/98k back-ext;
  immaterial 0% completeness VT+2/NM+1/VA+1/WA+1. AZ/AK deliverables unchanged
  (AK native parse == recover_ak_cfpc adjudication exactly — no-op).
- **GATE (import_gate_verify capture-diff): 38 states byte-identical** incl.
  CA/NY/TX permanent; ONLY the 7 allowed states changed; per-state deltas exact
  (IL +6 raw/+2 rolled/+1 active; GA +5/+1; VT +2/+1; NM/VA +1/+1; WA +1 raw;
  WV hash-only). Import ALL CHECKS PASSED (re-keyed 2963/1832/551);
  verify_subtype 551 (Auto-Comb 81→82 == exactly the IL filing); 8 verify + tsc
  + build 12/12 + 13 e2e green (run on top of the 2026-07-06 copy change set).
- **LESSONS (recorded in scraper resume_state.md):** (1) a symptom sweep catches
  0-row failures; only a full old-vs-new parse diff catches partial/wrong-value
  corruption — the diff found 6 cases the sweep couldn't. (2) GA/AZ/NM
  deliverables carry post-build AM-Best tier enrichment a raw re-finalize
  silently downgrades (314 rows) → surgical append-only for enriched states.
- **HEADs (post-deploy):** insurancewebscraper `97a7edf`->**`a439e2b`** (HEAD==
  origin). agent-intel/master `016ea60`->**`8b5f858`** (subtree-FF, 0 deletions;
  Vercel LIVE — the IL COUNTRY Defend row confirmed serving from the production
  API). Monorepo `a548964`+`dc50272` (local). `filings.db` **`8941a436`**.
- **BACKLOG:** root-cause the Temp-purge (~12th strike, happens in non-harvest
  sessions). Next state: MA (medium tier; parser now hardened for comma values).

---

# Session checkpoint — 2026-07-06  ·  COPY/CLARITY CHANGE SET SHIPPED (6 items — UI copy + spec + e2e)

Copy-only iteration (no data, query, or routing changes; `filings.db` untouched —
md5 still `23f0bf29`, baseline 2947/1826/18/550 intact). Six confirmed items,
all localhost-reviewed on all four surfaces before commit:

- **Overview title** → **"Overview of Rate Change Activity"** (`page.tsx` main
  h1 + the error-state h1; nav label stays "Overview").
- **Prospect/Defend subtitles per agent type:** captive *"Rate increases/decreases
  filed by {brand}'s competitors in your states…"* / independent *"…in your states
  from competitors and carriers you sell…"*. Captive P/D excludes the own brand so
  "competitors" is literally true; independent includes sold carriers so it can't
  say that — the split is the point, don't unify it.
- **Positioning date-range note** (new, under the subtitle, testid
  `date-range-note`): *"Comparisons cover filings effective in the last 12 months
  (since {Month YYYY}), plus announced changes not yet effective. Data as of
  {Mon D, YYYY}."* — derived dynamically from `asOf`
  (`src/lib/positioningExplainer.ts` `dateRangeNote`). **DELIBERATELY 12-month
  wording, NOT "since 2024"** — recon proved Positioning applies the rolling
  window (`effective_date >= date(asOf,'-12 months')`, no upper bound), not the
  full dataset range. If the window ever changes, the note changes with it.
- **Plain-language explainer** (new `buildExplainer` + "How to read this" box on
  /positioning): interprets ONE real comparison from the agent's own view — the
  richest cell's largest-|spread| **high-confidence** comparison.
  **Both-averages-plus-spread template** — the differential is the spread
  (compAvg − agentAvg), NEVER a side's own average; keeps the word "filed";
  embedded rate-change-not-price caveat. **No render when zero high-confidence
  comparisons exist** (thin ones carry no spread to explain).
  **Blocklist-locked via e2e:** `e2e_positioning` scans the RENDERED text against
  the determination-language blocklist (the same line `verify_office_summary` /
  `verify_briefing_language` hold), captive AND independent views.
- **Tab rename** → **"Competitive Positioning"** (`NavBar.tsx`; never "Pricing" —
  it would contradict the page's own rate-changes-not-prices band).
- **spec.md updated alongside the code (the conflict rule):** copy table, Overview
  header, nav section, new Positioning date-note + explainer sections. e2e
  re-keyed: `e2e_setup` Overview heading; `e2e_nav` label arrays + route↔label
  pairs (added the /positioning pair); `e2e_positioning` + date-note & explainer
  checks.
- **Gates:** tsc clean, 8 verify scripts, prod build 12/12, 13/13 e2e
  (`e2e_mobile`'s pass banner is "MOBILE LAYOUT CHECKS PASSED", not "ALL CHECKS
  PASSED" — don't grep it as a failure). Localhost-approved.
- **Deployed via subtree-FF to agent-intel/master `016ea60`** (clean FF from
  `b9caaa7`, delta exactly the 11 files; Vercel auto-deploying). Monorepo
  `6f10cc5` (feat) + this docs(state) line.

---

# Session checkpoint — 2026-07-05  ·  AK INTERIM→REAL IMPORT SHIPPED + VALIDATED (18th scraped state)

AK's 100-row SERFF scrape (189/189 in-target, 0 true misses) replaced its AM Best
interim; cross-checked, a material recovery, shipped `validated:{auto:true,
home:true}`. Deterministic rebuild of `filings.db` (md5 `d3075558` → `23f0bf29`);
deployed via subtree-FF to **agent-intel/master** (Vercel LIVE — AK renders
directly-scraped, methodology 18). AK is a COVERAGE-THIN AM Best state — the 8th
interim→real point, and the first where AM Best undercounts a SPECIFIC major writer.

- **NEW BASELINE (SUPERSEDES post-HI `2847`/`1773`/527 / `d3075558`):** **18 states**,
  raw **2947**, rolled **1826**, active@2026-06-11 **550**, db md5 **`23f0bf29`**,
  anchor +93.70% WA (AK max active +32.9% below it).
- **EVERY delta == AK:** raw +100, rolled +53, active +23, states +1. **17 prior
  scraped states proven BYTE-IDENTICAL** (via `import_gate_verify.py`: ALL GATES
  PASS); CA/NY/TX permanent intact (91/65, 183/101, 384/249).
- **CROSS-CHECK (8th point, TWO reads):** (1a) VALUE-AGREEMENT on shared filings
  **41/41 = 100%** (values correct); PPA in-window 34/34 / HO 13/13 = 100%; headline
  PPA 85% deflated PURELY by 6 recency/immaterial AM-Best-only. (2) INTERIM 41/41,
  0 disagreements. (3) REVERSE: 59 scrape-only. 0 material soft-miss, 0 parser flags.
- **⚠️ COVERAGE-THIN finding (CORRECTED):** AM Best undercounts **COUNTRY
  specifically** (32 real in-target vs 2 shown; 6 rolled rate filings vs 2) — the
  genuine enrichment, with live Country Prospect signals AM Best lacks (CFPC-134388842
  +11.5%/13,794ph; recovered CFPC-134283900 +9.59%/9,644ph). **Liberty/Farmers are
  NOT a gap** — their AK in-target-by-line filings are ALL Form/Rule (no rates), so
  AM Best's 0 is correct. LESSON: verify undercount via RATE-filing presence, not
  brand/line presence. AK's rate-writing brands = the 7 AM Best also sees.
- **MATERIAL RECOVERY:** 2 COUNTRY CFPC (wrapped-name parser bug, VT PRGS family
  2nd occurrence — now MATERIAL) recovered via `recover_ak_cfpc.py` (targeted,
  AK-only, asserted vs adjudication). B6 backlog: shared-parser fix (MEDIUM).
- AK dropped from `AMBEST_STATES` (→ 27), KEPT in `COVERED_STATES` (NH trap);
  methodology 17→18. Covered total unchanged (45 = 18 scraped + 27 AM Best).
- **Gates:** import ALL CHECKS PASSED (2947/1826/18/550), verify_subtype (550) + 7
  verify, tsc clean, build 12/12, e2e_methodology re-keyed 18 rows. Localhost-approved.

---

# Session checkpoint — 2026-07-01  ·  HI INTERIM→REAL IMPORT SHIPPED + VALIDATED (17th scraped state)

HI's 71-row SERFF scrape (138/138 in-target, 0 true misses) replaced its AM Best
interim; cross-checked FIRST (cleanest yet), shipped `validated:{auto:true,
home:true}`. Deterministic rebuild of `filings.db` (md5 `be5417b7` → `d3075558`);
deployed via subtree-FF to **agent-intel/master** (Vercel LIVE — HI renders
directly-scraped, methodology 17 cross-checked). HI is the SMALLEST scraped state
(138 targets) and the FULL hardened-pipeline payoff: 100/100 standard, 0 interim
disagreements, 0 soft-misses, 0 parser flags SIMULTANEOUSLY.

- **NEW BASELINE (SUPERSEDES post-VT `2776`/`1738`/510 / `be5417b7`):** **17 states**,
  raw **2847**, rolled **1773**, active@2026-06-11 **527**, db md5 **`d3075558`**,
  anchor +93.70% WA (HI max active +28.5% below it).
- **EVERY delta == HI:** raw +71, rolled +35, active +17, states +1. **16 prior
  scraped states proven BYTE-IDENTICAL** (id-excluded content hash both tables +
  active counts); CA/NY/TX permanent intact (91/65, 183/101, 384/249). Proven by
  the new **`import_gate_verify.py`** — a REUSABLE interim→real import gate
  (generalized from HI; every future import runs it): ALL GATES PASS.
- HI dropped from `AMBEST_STATES` (→ 28 states), KEPT in `COVERED_STATES` (the NH
  trap); as-of PINNED 2026-06-11 (xlsx mtime restored → window didn't slide);
  methodology derived 16→17. Covered total unchanged (45 = 17 scraped + 28 AM Best).
- **Gates:** import ALL CHECKS PASSED (2847/1773/17/527), verify_subtype (527) + 7
  verify, tsc clean, build 12/12, e2e_methodology re-keyed 17 rows. Localhost-approved.

- **CROSS-CHECK (7th interim→real point, CLEANEST YET — `compare_hi_ambest.py`):**
  (a) STANDARD **PPA 44/44 = 100%** (34 direct + 10 date-relaxed, 0 AM-Best-only)
  / **HO 7/7 = 100%** (6 direct + 1 date-relaxed). (b) INTERIM **41/41 impact
  agreement, 0 disagreements** — no AM-Best-side dispute (no SFMA-style case).
  (c) REVERSE richer: 30 extras (22 pre-2025 back-extension + 4 withdrawn + 10
  rate-neutral 0%) + 6 sub-types; **0 AM-Best-only, 0 soft-misses, 0 recoveries,
  0 blank max/min (clean parser).** HO small-N at 7 read in-context: 100% + robust
  PPA leg 44/44 → `validated:home` sound. **AmFam pre-resolved = 0 genuine**
  (AM Best HI 0 in-scope AmFam; our 0 AmFam-brand = all excluded subs — Munich Re
  Home + Connect). **VA 97.7 / OH 100 / IL 99.4 / WV clean / NH 100 / VT 100 /
  HI 100 — the AM Best interim is sound 7×.**
- **DELIVERABLE `hi_final_rates.xlsx` = 71 rows** (PPA 59 / HO 12; funnel 138 =
  42 emitted (79 − 8 filing-vehicle) + 85 form/rule + 4 new-product + 7 out-of-window).
- **Scraper-side banked:** insurancewebscraper `e93d5ea`→`f27785c` (compare +
  cross-check checkpoint) → `55c9268` (all_states regen + import-gate tool).

---

# Session checkpoint — 2026-06-30  ·  VT INTERIM→REAL IMPORT SHIPPED + VALIDATED (16th scraped state)

VT's 103-row SERFF scrape (154/154 in-target) replaced its AM Best interim;
cross-checked FIRST, shipped `validated:{auto:true, home:true}`. Deterministic
rebuild of `filings.db` (md5 `5c821d8b` → `be5417b7`); deployed via subtree-FF to
**agent-intel/master `74b6082`** (Vercel LIVE — /,/methodology,/prospect 200,
"15 of 16 cross-checked states", Vermont ✓✓).

- **FIRST FULLY-HARDENED-PIPELINE STATE.** VT is the payoff of the root-pattern
  gap-class closure: proactive capture replaced reactive recovery. WV/NH each had
  to RECOVER a material soft-miss mid-import (Liberty Insurance Corp 7894ph; Safeco
  General Insurance Co of America 3711ph) via a search-term fix. VT's universe
  already carried those terms → clean collection → clean cross-check → **0
  recoveries**. General Insurance Co of America captured proactively (4 rows live,
  incl. the +32.3%/113ph and +17.0%/10,531ph Prospect signals that ARE the
  gap-class entity).
- **CROSS-CHECK (6th interim→real point, CLEANEST YET):** corroboration PPA 26/32
  (81.2%) / HO 16/17 (94.1%); the **7 AM-Best-only rows are ALL recency or
  immaterial** (3 recency eff > 04/17/26 window: Farmers ×2 04/20/26, Allstate HO
  05/21/26; 4 zero-impact: the USAA 02/21/26 0%/0ph cluster) → **material in-window
  42/42 = 100%, 0 soft-misses**. Interim quality **37/37 = 100%, 0 disagreements**
  (no SFMA-style AM-Best-wrong cases). **VA 97.7 / OH 100 / IL 99.4 / WV clean /
  NH 100 / VT 100 — the AM Best interim is sound 6×.** Richer: 54 back-extension +
  17 rate-neutral 0% + 9 sub-types. 0 blank max/min (clean parser).
- **NEW SCRAPED BASELINE (SUPERSEDES post-NH `2673`/`1673`/495 / `5c821d8b`):**
  **16 states**, `filings_raw` serff_scraped **2776**, `filings` **1738**,
  active@2026-06-11 **510**, db md5 **`be5417b7`**, anchor +93.70% WA (unchanged —
  VT's max active below it).
- **EVERY delta == VT:** raw +103, rolled +65, active +15, states +1. **15 prior
  scraped states proven BYTE-IDENTICAL** (count + id-excluded content hash, both
  tables); CA/NY/TX permanent intact (CA `0dc2e017`, NY `f7bd2df4`, TX `2ab8a852`).
  VT dropped from `AMBEST_STATES` (→ 29 AM Best states; kept in `COVERED_STATES` —
  the NH near-miss trap, verified VT stays covered). Methodology **16 rows, VT ✓✓**.
- **GATES:** import 16/16, verify_subtype (510) + 7 verify, tsc clean, build 12/12,
  e2e 13/13 (fixed the one stale `15 rows`→`16 rows` methodology assertion).
  Localhost-reviewed + approved. Scraper-side: `compare_vt_ambest.py` + all_states
  regen → insurancewebscraper `6b8a7d1`. Monorepo `de4e003` (local).
- **⚠️ OPERATIONAL FLAGS carried:** (1) **browser-launch-kill** — the env kills
  Playwright launches; the parse-only finalize (load_targets + build_rows, no
  download phase) avoided it. WATCH if the NEXT state's download harvest gets killed
  at launch. (2) **wrapped-company-name parser bug** (`no_pdf==1`, PRGS-134029613) —
  a Company Rate Information row whose company name wraps to a 2nd line yields 0
  extracted rows; here maximally immaterial (0%/$0/0ph symbol update), dropped per
  the WV/NH precedent. Fix DELIBERATELY in isolation (SHARED parser; re-verify all
  states byte-identical) — backlogged, no urgency. (3) harvest-early
  tail-over-stop (NH b4, VT b2 — 3rd occurrence, minor tuning backlog).

---

# Session checkpoint — 2026-06-29  ·  NH INTERIM→REAL IMPORT SHIPPED + VALIDATED (15th scraped state)

NH's 113-row SERFF scrape (214/214 in-target) replaced its AM Best interim;
cross-checked FIRST, shipped `validated:{auto:true, home:true}`. Deterministic
rebuild of `filings.db` (md5 `1147ba06` → `5c821d8b`); deployed via subtree-FF to
**agent-intel/master `cd796bd`** (Vercel LIVE).

- **CROSS-CHECK (5th interim→real point, CLEANEST YET):** in-window PPA **22/22
  (100%)**, HO **14/14 (100%)**, interim **33/33 (100%, ZERO disagreements)**. The
  headline (PPA 75.9% / HO 87.5%) was deflated ONLY by **9 AM-Best-only 2026-eff
  RECENCY** filings (May-2026 effective, beyond the scrape window — incl. big-ph
  Progressive Universal 107k / State Farm Fire 86k) — coverage/recency, not errors.
  **VA 97.7 / OH 100 / IL 99.4 / WV clean / NH 100** — the AM Best interim is sound
  5×. 0 blank max/min (clean parser; no SF `% %`, no minus-family bug).
- **2nd SYSTEMATIC SEARCH-TERM GAP FIXED GLOBALLY (after Liberty):** the lone genuine
  soft-miss was Safeco **General Insurance Company of America** (PPA, eff 01/19/25,
  +15.8%, **3,711ph** — a Prospect signal). A subsidiary whose legal name lacks the
  brand string — the **ROOT PATTERN** shared with Liberty Insurance Corporation.
  Missed in WV (2039ph, dropped) AND NH. Fixed in `TARGET_COMPANIES` +
  `GROUP_SEARCH["Liberty Mutual"]` ("general insurance"; GROUP_KW already classified
  it). Targeted search recovered `LBPM-134225435` = EXACT match (AM Best PPA-buckets
  its 19.0002 Motorcycle TOI). 0 genuine soft-misses remain.
- **NEW SCRAPED BASELINE (SUPERSEDES post-WV `2560`/`1607`/480 / `1147ba06`):**
  **15 states**, `filings_raw` serff_scraped **2673**, `filings` **1673**,
  active@2026-06-11 **495**, db md5 **`5c821d8b`**, anchor +93.70% WA (unchanged).
- **EVERY delta == NH:** raw +113, rolled +66, active +15, states +1. **14 prior
  scraped states proven BYTE-IDENTICAL** (count + content hash); CA/NY/TX intact.
  NH dropped from `AMBEST_STATES` (kept in `COVERED_STATES`); methodology **15 rows,
  NH ✓✓**.
- **GATES:** import 16/16, verify_subtype (495) + 7 verify, tsc, build 12/12, e2e
  13/13. **Localhost-reviewed + approved.** Scraper-side: `compare_nh_ambest.py` +
  config fix + all_states → insurancewebscraper `7261209`. Monorepo `1e14362`.
- **⚠️ BACKLOG (root-pattern gap class — 2 systematic gaps found so far):**
  (1) retro-audit shipped states (VA/OH/IL/WV) for missed "General Insurance" /
  "Liberty Insurance" filings with the fixed terms — recover MATERIAL ones (a small
  targeted pass per state). (2) PROACTIVE `TARGET_COMPANIES` audit for OTHER
  subsidiary entities whose legal name lacks the brand string (the class Liberty
  Insurance Corp + General Insurance Co of America belong to) — close the whole gap
  class before scraping more states.

---

# Session checkpoint — 2026-06-26  ·  WV INTERIM→REAL IMPORT SHIPPED + VALIDATED (14th scraped state)

WV's 113-row SERFF scrape (207/207 collected) replaced its AM Best interim;
cross-checked FIRST, shipped `validated:{auto:true, home:true}`. Deterministic
rebuild of `filings.db` (md5 `19a94a1f` → `1147ba06`); deployed via subtree-FF
to **agent-intel/master `a53592d`** (Vercel LIVE).

- **RANKING-FIRST:** ranked the remaining ~29 AM Best interim states offline by
  AM Best in-target count (the cross-check in-scope rule); WV (43) was the
  smallest clean candidate → harvested smallest-first. AM Best in-target RANKS
  reliably even though absolute scrape size differs (WV 43→113, ~ the VA/OH/IL
  proxy held the ordering).
- **CROSS-CHECK (4th interim→real point):** PPA **30/33 (90.9%)**, HO **9/10
  (90%, lone miss pure recency → 9/9 in-window)**, interim **37/40** — the 3
  "disagreements" ALL AM-Best-side (scrape correct vs source PDFs; the VA SFMA
  pattern: AM Best wrong/disposition-stage, not the scrape). **Effectively clean:
  VA 97.7 / OH 100 / IL 99.4 / WV** — the AM Best interim is sound 4×, strong
  evidence the remaining ~28 interim states serve good data.
- **MATERIAL SOFT-MISS RECOVERED (new precedent):** the cross-check surfaced 1
  MATERIAL AM-Best-only — Liberty Insurance Corporation HO eff 01/09/25 −5% /
  **7,894ph** (a real Defend signal). Root cause: a search-term gap (the
  Allstate/Encompass family) — "Liberty Insurance Corporation" has no "mutual".
  Fixed `GROUP_KW`+`GROUP_SEARCH` (globally correct), recovered `LBPM-134273638`
  = EXACT AM Best match, **pre-import**. **Precedent: recover MATERIAL soft-misses
  before importing; drop only IMMATERIAL ones** (Allstate 243ph + Safeco 2039ph
  dropped per the VA/OH/IL tradeoff; Liberty 7894ph recovered).
- **NEW SCRAPED BASELINE (SUPERSEDES post-IL `2447`/`1536`/461 / `19a94a1f`):**
  **14 states**, `filings_raw` serff_scraped **2560**, `filings` **1607**,
  active@2026-06-11 **480**, db md5 **`1147ba06`**, anchor +93.70% WA (unchanged).
- **EVERY delta == WV:** raw +113, rolled +71, active +19, states +1. **13 prior
  scraped states proven BYTE-IDENTICAL** (count + content hash, old vs new db);
  CA/NY/TX permanent intact. WV `ambest_sourced` remnants **0/0**.
- **WV dropped from `AMBEST_STATES`** (→ 31 AM Best; CA/NY/TX permanent intact).
  Methodology → **14 cross-checked rows, WV ✓✓**.
- **GATES:** import verify 16/16, verify_subtype (480) + 7 verify scripts, tsc
  clean, build 12/12, e2e 13/13. **Localhost-reviewed + approved.** Scraper-side:
  `compare_wv_ambest.py` + `all_states` regen → insurancewebscraper `e3c8bf9`.
  Monorepo `d4adf7d` (local, origin-behind norm).

---

# Session checkpoint — 2026-06-25 (cont.)  ·  IL INTERIM→REAL IMPORT SHIPPED + VALIDATED (13th scraped state)

IL's 303-row SERFF scrape (600/602 collected) replaced its AM Best interim; cross-
checked FIRST (the VA order), shipped `validated:{auto:true, home:true}`. Full
deterministic rebuild of `filings.db` (md5 `3e7d83fe` → `19a94a1f`); deployed via
subtree split to **agent-intel/master**.

- **CROSS-CHECK (offline, before import):** PPA **93.8%** (122/130), HO **95.2%**
  (60/63), interim agreement **155/156 (99.4%)** — the lone differ a 0.1% rounding
  diff. **3rd interim→real data point: VA 97.7% / OH 100% / IL 99.4% — the AM Best
  interim is confirmed sound 3×**, strengthening confidence the ~29 remaining
  interim states serve good data (less pressure to scrape them). Scrape richer:
  64 neutral-0% + 6 withdrawn + 134 back-extension + 11 sub-types. 0 parser drops.
- **NEW SCRAPED BASELINE (post-IL — SUPERSEDES post-OH `2144`/`1330`/392):**
  **13 states**, `filings_raw` serff_scraped **2447 rows `26a01779`**, `filings`
  **1536 rows `2510c9da`**, active@2026-06-11 **461**, db md5 **`19a94a1f`**,
  anchor +93.70% WA (unchanged — IL max below it).
- **EVERY delta == IL, nothing more:** raw 2144→2447 (+303), rolled 1330→1536
  (+206), active 392→461 (+69). IL `ambest_sourced` remnants **0/0**.
- **BYTE-IDENTICAL PROOF:** the **44 non-IL states** identical in BOTH tables
  (count + content hash), incl. **VA `be861571` + OH `5c9ba09e`** (prior
  interim→real) and **CA/NY/TX permanent**. As-of pinned 2026-06-11.
- **LBPM-134662340 OPTION-A RESOLUTION:** IL's one multi-brand co-filing (PPA,
  0.0%, Liberty+Safeco under an LBPM tracking#) resolves to **Liberty Mutual**
  (Group filer; Montgomery→Liberty precedent). Scoped to the EXACT
  `{Liberty Mutual, Safeco}` span — every other multi-brand span still FATALs;
  **proven isolated** (44 non-IL states byte-identical, standalone Safeco still
  Safeco). Rolled to 1 Liberty row, entity_count 3, impact 0.0.
- **UNIVERSE SOFT-MISSES (tracked, immaterial):** the Liberty HO (eff 04/25/25,
  5.9%) AM Best-only row + the Truck-Ins-Exch first-sweep clean-0 — both single
  individual filings the "complete" universe didn't surface. AM Best-covered, not
  value errors. Lesson: even a verified-complete universe can miss the occasional
  individual filing.
- **IL dropped from `AMBEST_STATES`** (→ 32 AM Best states; CA/NY/TX permanent
  intact). Methodology data-driven → **13 cross-checked rows, IL ✓✓**.
- **GATES:** import verify 16/16, verify_subtype (active 461) + 7 verify scripts,
  tsc clean, build 12/12, e2e 13/13. Localhost-reviewed (IL + WA/GA/VA/OH).
  Scraper-side: `all_states_final_rates.xlsx` 2144→2447, `compare_il_ambest.py`
  → insurancewebscraper.

---

# Session checkpoint — 2026-06-25  ·  OH AM Best CROSS-CHECK DONE → OH VALIDATED (closes the open follow-up)

Offline cross-check (`compare_oh_ambest.py`, adapted from `compare_va_ambest.py`;
no SERFF, **`filings.db` NOT mutated** — md5 still `3e7d83fe`). OH's
`validated:{false,false}` → **`{auto:true, home:true}`** (states.ts + e2e). The
open follow-up from the import session is now CLOSED.

- **(a) STANDARD — scrape values correct:** PPA **74/77 = 96.1%**, HO **34/35 =
  97.1%** corroboration (combined 108/112 = 96.4%). **Beats VA (92.3% PPA) & GA
  (93.8%)**; OH HO especially strong vs VA's small-N 68.6%.
- **(b) INTERIM-QUALITY — 105/105 (entity,eff) impact agreement, 0 disagreements**
  (VA was 97.7%/127-of-130). **2nd interim→real data point, even cleaner than VA**
  → strong evidence the AM Best interim is sound across the remaining **33** AM
  Best states. Zero disagreements → no SFMA-style "AM Best is wrong" case.
- **(c) REVERSE — scrape richer:** 57 rate-neutral 0% filings + 128 pre-2025
  back-extension + 10 sub-types AM Best omits. **4 AM Best-only rows, all 0.0%
  overall** (1 recency: Farmers eff 05/04/**26** > scrape max 2025-12-20; 3
  immaterial 0% coverage: SF Fire/Mutual 04/15/25, Liberty 05/19/25) — coverage/
  recency, **not value errors** (the VA pattern).
- **WATCH cleared:** 6 blank-max/min rows = 3 State Farm co-filed pairs with
  POPULATED impacts (documented SF `% %` source pattern, 3× precedent); none
  coincide with the 4 AM Best-only → no parser drop. No parser-family-bug signature.
- **Methodology now 10 of 12 cross-checked** (OH joins; CO still the lone scraped-
  but-unvalidated, "— —"). Gates: tsc clean, build 12/12, e2e_methodology + 13 e2e
  + verify_subtype + 7 verify scripts green. `compare_oh_ambest.py` → insurancewebscraper.

---

# Session checkpoint — 2026-06-24 (cont.)  ·  OH INTERIM→REAL IMPORT SHIPPED (12th scraped state)

Combined **VA-refresh (+5) + OH import (246-row scrape)** replaced OH's AM Best
interim in `filings.db`. Full deterministic rebuild (`import_filings.py`), same
surgical pattern as the VA import. **filings.db rebuilt** (md5 `a1c5cda4` →
`3e7d83fe`); deployed via subtree split to **agent-intel/master**.

**Shipped HEADs (all HEAD==origin):** agent-intel/master **`c3e92da`** (Vercel
LIVE — root/methodology/prospect HTTP 200, methodology renders "Ohio · directly
scraped") · insurancewebscraper **`49bdacd`** · monorepo **`83580c5`** (local,
origin-behind norm). Deploy was a clean FF onto agent-intel/master (subtree
split produced content-identical trees w/ divergent hashes → committed the new
tree onto the real 4372224, no force-push, 0 file deletions).

### ▶ OPEN FOLLOW-UP (next session) — OH AM Best cross-check
OH currently ships **`validated:{false,false}`** — HONEST: directly-scraped real
data, NOT yet AM Best cross-checked (renders "— —" in methodology, like CO).
**Pick up here:**
1. Adapt `compare_va_ambest.py` → `compare_oh_ambest.py` (the GA/VA 13-brand
   method) against AM Best OH (`tools/ambest_oh_data.csv`, Rate, 2025+).
2. Run the 3-part check: **(a) corroboration** (PPA/HO % agreement),
   **(b) interim-quality** (did the shipped AM Best OH interim match the scrape?),
   **(c) richer** (the scrape's 47 neutral-0% / withdrawn / 10 sub-types AM Best omits).
3. **If it corroborates → flip OH to `validated:{true,true}`** in a small commit:
   2 booleans in `states.ts` + the `OH` line in `e2e_methodology.ts` EXPECTED map
   (`{false,false}`→`{true,true}`, "—"→"✓") + methodology count auto-updates.
   Re-deploy via the same subtree-FF path.
4. **WATCH (VA precedent):** the AM-Best-parser-family bugs AND the
   "AM-Best-is-wrong-not-the-scrape" pattern (VA's `SFMA-134526917` entity
   transposition the scrape got right). Treat AM Best as a cross-check, not ground
   truth — investigate disagreements at the source PDF before assuming a scrape error.

### Collection status & remaining backlog
- **VA + OH collection COMPLETE** (VA 98.7% / 444-of-450 cached, OH 100% / 397-of-397),
  **both live as directly-scraped** (`serff_scraped`). VA `validated:{true,true}`,
  OH validation pending the cross-check above.
- **Backlog (none urgent):** AL/FL/LA AM Best re-pull (header-only, fixable) ·
  NC structural NCRB gap (not fixable — needs a different source) · 3 harvest
  tooling fixes (`BACKLOG.md`: harvest-early ordering re-enable, per-group
  not-found stop, **B5** front-of-batch grace) · monorepo `origin` ~96 behind
  (established norm; deploy path is agent-intel, not origin).

- **NEW SCRAPED BASELINE (post-OH — the intended new normal; SUPERSEDES the
  post-VA tags `filings_raw a1aa7a2e`/1893 · `filings ea8ba81e`/1176 · 342):**
  **12 states**, `filings_raw` serff_scraped **2144 rows `1d9b7e74`**, `filings`
  serff_scraped **1330 rows `a9945257`**, active@2026-06-11 **392**, anchor
  +93.70% WA SFMA-134315091 (unchanged). Future guards key on THIS.
- **EVERY delta == VA + OH, nothing more:** raw 1893→2144 (VA 277→282 = +5, OH
  +246); rolled 1176→1330 (VA 178→182 = +4, OH +150); active 342→392 (VA 49→51 =
  +2, OH +48). OH `ambest_sourced` remnants: **0 raw / 0 rolled** (clean swap).
- **BYTE-IDENTICAL PROOF:** the **43 non-VA/OH states** identical in BOTH tables
  (count + content hash, id-excluded); **CA/NY/TX permanent hashes unchanged**
  (CA `5c54d9b4`, NY `085e3a52`, TX `19598b24`). As-of **pinned 2026-06-11**
  (all_states xlsx mtime) so the 12-mo window didn't slide → western active
  counts identical. **VA `validated:{auto,home}` true; OH `validated:{false,
  false}`** — OH is directly-scraped REAL data but NOT YET AM Best cross-checked
  (CO-like; `compare_oh_ambest` is the immediate follow-up). OH richer-scraped:
  47 rate-neutral 0% filings, 10 sub-types, 0 `AMB-` keys, 12 brands.
- **OH dropped from `AMBEST_STATES`** (import_filings.py + constants.ts);
  AM Best now **33 states** (CA/NY/TX permanent intact). Methodology
  data-driven → **12 cross-checked-table rows** (OH/CO show "— —").
- **GATES:** import verify 16/16, verify_subtype + 7 verify scripts, tsc clean,
  build 12/12, e2e 13/13 (all re-keyed to 2144/1330/12/392). Localhost-reviewed
  (OH/VA/WA/GA) before deploy.
- **VA collection delta:** the +5-row VA refresh (282 vs the shipped 277) is now
  live too. Scraper-side `all_states_final_rates.xlsx` regenerated 1893→2144 →
  insurancewebscraper. Full scraper history: `resume_state.md`.

---

# Session checkpoint — 2026-06-24  ·  OH COLLECTION COMPLETE (scraper-side); import pending

SERFF session — OH download harvest resumed from 45% and **finished to 100%** in
8 cold bursts. **filings.db / the app were NOT touched this session** — pure
scraper-side work. Live db remains the post-VA import (`a1c5cda4` / `8b813c0`).

- **OH COLLECTION COMPLETE: 397/397 (100%)**, all 10 carrier groups (Allstate,
  American Family, Farmers, GEICO, Liberty, State Farm, Nationwide, Progressive,
  Travelers, USAA). **246-row `oh_final_rates.xlsx`**, **0 true misses**,
  `filings_excluded_no_pdf: 0` (authoritative completeness). Committed
  **insurancewebscraper `ceb279a`** (HEAD==origin).
- **Universe resolved:** the "361 distinct" estimate → **397 actual target
  filings** (per-group lists; dedup estimate was low); all cached.
  **AmFam/Liberty 100-cap confirmed a non-issue** (both closed out clean).
- **WAF held all session:** full-burst 405-challenge series **40→36→30→42→20%**;
  the 42% (burst 7) was a heavy-load tail (walls all post-completion), **not**
  cumulative depression — no bank-signal ever materialized. The long cold rest
  before burst 8 (90+ min, incl. a host suspend) restored a full ceiling that
  swept all 4 remaining groups in one 24.7-min run. **8 clean banks**, Temp-purge
  caught once (burst 1) + handled, HEAD==origin every time.
- **Q2 RECOVERY proven in vivo** (first time since VA): RECOVERY-1 landed all 4
  transient `NWPP-G`/`TRVD` misses in-burst. The re-pool works on transient
  misses. Every miss across all 8 bursts (`GECC`/`LBPM`/`GNSC`/`NWPP-G`/`TRVD`)
  was transient and recovered — hence 0 true misses.
- **BACKLOG B5 recorded** (`Insurance Rate Data Scraper/BACKLOG.md`):
  front-of-batch grace — the 2-consecutive-miss early-stop can abort a whole
  group when 2 transient misses hit the FRONT of the batch before the bulk +
  later search terms run (killed State Farm on burst 6; recovered on a fresh
  full-rest burst 7). Efficiency/throughput fix, not blocking.
- **IMPORT PENDING:** combined **VA-refresh (+5 rows)** + **OH import (246-row
  scrape)** into `filings.db` — the next deliberate app-side step (surgical
  rebuild-and-re-key, like VA). `filings.db` UNTOUCHED all session.
- Full scraper history: `Insurance Rate Data Scraper/output/resume_state.md`.

---

# Session checkpoint — 2026-06-23  ·  VA COLLECTION COMPLETE (scraper-side); OH not started

SERFF session — first contact since the 06-22 VA harvest. **VA scraping is now
effectively complete**; OH recon is the next step (not yet started this checkpoint).
**filings.db / the app were NOT touched this session** — pure scraper-side work.

- **VA COLLECTION COMPLETE: 444/450 in-target cached (98.7%)**, `va_final_rates.xlsx`
  = **282 rows** (was 277 at session start, +5). Two targeted bursts:
  burst-1 (warm-tail) +17 → 436/450, burst-2 (clean cold) +8 → 444/450.
  Committed scraper-side **insurancewebscraper `22988d1`** (HEAD==origin); the
  repair+burst-1 was `11a7163`. 0 deletions staged on both (Temp-purge struck once
  pre-commit — restored 8 purged tracked files from HEAD, then explicit-path staged).
- **`TRVD-G` "coverage-gap" HYPOTHESIS DISPROVEN.** The G-series is **normal,
  downloadable Travelers data that surfaces under bare `travelers`** — NOT a hidden
  sub-entity and NOT a new-search-term gap. The apparent gap was (a) download-
  completion (WAF-interrupted empty dirs) + (b) a **tracking#≠filingId keying
  artifact** (e.g. `TRVD-G134180979` → filingId `134191017`; PDFs cache by filingId).
  The fallback recovered G-series directly once WAF allowed. This is the 4th VA
  "limit" to turn out an artifact — consistent with the whole VA arc (row-wall,
  harvest-early ordering, ceiling-decay, now TRVD-G all were tooling/measurement,
  not hard walls).
- **6 genuinely uncollectable** (survived TWO full attempts incl. a clean cold burst):
  `TRVD-133971305`, `TRVD-133994502`, `TRVD-134013553`, `TRVD-G134247790`
  (fid 134248929), `TRVD-G134526332` (fid 134528113), `TRVD-G134881614`
  (fid 134883989) — all Quantum Home/Auto. Accepted as uncollectable-under-`travelers`;
  AM Best-covered in the app. **Not grinding further** (one-shot rule).
- **RE-IMPORT DEFERRED.** The +5-row delta does not change validation/tiers; the app's
  live VA is still the shipped 277-row scrape (`8b813c0`), unchanged and fine. Fold a
  VA refresh into a later **combined VA-refresh + OH import** when OH lands.
- **WAF:** two bursts spent today; **ceiling held** (no slow-penalty depression —
  consistent with yesterday's heavier single-day load). Cold refill behaved as modeled.
- Full scraper history: `Insurance Rate Data Scraper/output/resume_state.md`.

---

# Session checkpoint — 2026-06-22  ·  VA interim→real import SHIPPED (11th scraped state)

VA's directly-scraped SERFF data (277 rows, AM Best-validated) replaced the AM Best
interim. Full deterministic rebuild of `filings.db`; the first change to `filings.db`
since the 45-state load. **Deployed (agent-intel/master): `8b813c0`** — live
`agent-intelligence-sigma.vercel.app` HTTP 200, VA renders directly-scraped.
Monorepo local `5ffd1b3` (`origin` ~96 behind, established norm). tsc clean, build
12/12, 6 verify + 10 e2e green.

- **NEW SCRAPED BASELINE (post-VA — the intended new normal; SUPERSEDES the old
  10-state tags `filings_raw 784f77e6` / `filings b6f83d78`):** **11 states**,
  `filings_raw` serff_scraped **1893 rows `a1aa7a2e`**, `filings` serff_scraped
  **1176 rows `ea8ba81e`**, active@2026-06-11 **342**. The 10 original scraped
  states + CA/NY/TX permanent stayed **byte-identical** (rows AND active counts —
  as-of pinned at 2026-06-11). `verify()` + `verify_subtype` EXPECTED re-keyed to
  1893/1176/342; future guards key on THIS baseline, not the pre-VA tags.
- **VA**: now `source=serff_scraped` (178 rolled), 0 `AMB-` surrogate keys, richer
  data (89 neutral-0%, 2 withdrawn, 10 sub-types). Dropped from `AMBEST_STATES`;
  `states.ts` `validated:{auto:true, home:true}`. `derive_brand`: Montgomery Mutual
  → Liberty Mutual (VA LBPM co-filer; VA-only, 10 states unaffected). AM Best
  ambest_sourced now 34 states (CA/NY/TX permanent intact).
- **Scraper-side** (insurancewebscraper `b1ffb28`): `all_states_final_rates.xlsx`
  regenerated 1616→1893 (VA appended last). VA collection itself ~91% (452/498) —
  the 46 uncollected (Travelers `TRVD-G` coverage-gap + ~14 scattered) are a future
  targeted offline run; OH partial still parked. Full scraper history:
  `Insurance Rate Data Scraper/output/resume_state.md`.

---

# Session checkpoint — 2026-06-19  ·  Two UI/profile iterations shipped (45-state data)

Iterate-and-deploy mode, not building. **Two iterations shipped this session**,
both UI/profile-data only — the scraped baseline stayed byte-identical and
`filings.db` was never in any changeset.

- **Deployed (agent-intel/master): `546d3e4`** (office addresses — latest of the
  two). HEAD==origin, Vercel auto-deploying. Monorepo local `8545992`
  (`origin/master` `fc11c86`, ~96 behind — established norm; deploy path is
  agent-intel). tsc clean, prod build 12/12, all 13 e2e + verify green. Scraped
  baseline **untouched all session** (`md5(filings.db)=82e423fd9d51e7d523b644b368188e98`;
  tags `filings_raw 784f77e6` / `filings b6f83d78`).
- **Quiet period ACTIVE until 2026-06-21** — fully offline session, zero
  SERFF/WAF/guard contact. The June-21 cold-capacity read is still the next
  pending scraper action (carry-forward below).

## Iteration 1 — Recent Changes rows: two-block flex layout (dashboard, `554d90a`)

Replaced the dashboard Recent Changes **full-width column table** with a
**two-block flex row**. The column-spread approach kept creating gaps (impact
floated to the far-left edge; a void opened in the middle). New structure:
- **Left block** (flex:1): impact % (62px, right-aligned, category-colored —
  Prospect green / Defend red) sitting **directly next to** carrier · line ·
  state, with **"date · N policyholders"** as a muted secondary line beneath
  (policyholders folded back inline — no standalone column; count omitted on AM
  Best rows that have none).
- **One clean gap**, then the **right cluster** (shrink:0): category pill + muted
  time badge. Whole row still navigates (role=link + keyboard).
- Defend/Prospect tables left untouched (real tables with their own
  Policyholders/Effective columns — they read fine).
- **LESSON (recorded for future spacing work):** this content is light for a
  full-width container — **group into tight blocks, don't spread across the
  width**. Took 4 iterations to land. Start future Recent-Changes-style spacing
  from "group tight," not "spread wide."

## Iteration 2 — Office addresses replace standalone home state / ZIP (Agency Profile, `546d3e4`)

The Agency Profile's standalone **Home state** + **ZIP** fields were replaced by
a repeatable **"Office addresses"** section. UI + profile-data change; no
filings.db / scraped-data impact.
- **Form:** each office = optional label, street, city, state, ZIP. One office by
  default ("Primary office"); **+ Add another office** appends, **×** removes;
  **can't drop below one** (× hidden when a single office remains). No standalone
  home-state/ZIP fields anymore.
- **Data model:** `AgentProfile` **dropped `home_state`/`zip_code`, gained
  `offices: Office[]`** (`offices[0]` = primary = agency home state/ZIP). New
  `primaryOffice(p)` accessor. **Validation:** ≥1 office; street/city/state/ZIP
  required per office (label optional, ZIP 5 digits); errors keyed per office
  (`offices.<i>.<field>`); `ValidationError.field` broadened to `string`.
- **Migration (no data loss):** `loadProfile` runs `migrateProfile` in place — a
  legacy profile (`home_state:"WA"`, `zip_code:"99224"`, no `offices`) becomes
  `offices:[{state:"WA", zip:"99224", street:"", city:"", label:""}]`. Street/city
  blank until next save. Verified WA/99224 on localhost + a verify_profile
  round-trip; the injected-fixture e2e suites (old-shape profiles) migrate
  transparently and all pages render.
- **`home_state` HAD downstream consumers** (it drove the **/compliance briefing
  order**). All **3** direct reads re-pointed to `primaryOffice(profile).state`:
  `OfficeSummary` "Office location" + briefing-anchor, and the compliance page's
  `ComplianceBriefing` `homeState` prop. The pure briefing helpers
  (`orderedBriefingStates`, `primaryBriefingState`, `briefingSectionAnchorId`,
  `ComplianceBriefing`) take a state-**string param** — unchanged, just fed from
  the primary office now. **`zip_code` had no logic consumers.** tsc confirms no
  orphaned reads (both fields are gone from the type).
- **FUTURE NOTE:** office addresses are **recorded profile data only** — they
  don't yet DRIVE anything beyond the primary feeding home-state. If offices
  should ever be functional (per-office compliance, multi-state licensing by
  office), that's a future feature with its own scope. The data is there, ready
  to be used.

## ⚠️ Recurring gremlin — stale "CA non-covered" test assertion

Fixed **twice** now (`e2e_setup`, `verify_profile`, both CA→WY). CA/NY/TX became
**permanent covered** states in the 45-state expansion. **If a 3rd surfaces,
sweep ALL tests at once** for hardcoded CA/NY/TX non-covered assumptions — the
covered set grew and any test still treating them as non-covered is stale. (This
session's profile work touched verify_profile + e2e_setup again; both already on
the correct WY basis.)

## Carry-forward state (unchanged this session)

- **App covers 45 states:** 998 scraped (10 states) + 32 AM Best interim + 3
  permanent (CA/NY/TX, non-SERFF, excluded from the replacement sweep). All AM
  Best states render identically to scraped (no badge).
- Prior **UI polish pass** (agent-perspective color system, table restyle) live.
- **June-21 cold-capacity read = next pending decision.** Clear the guard →
  `cold_capacity_read.py` **BEFORE any collection** (collecting first
  contaminates it). Low pressure — the app already has near-national coverage.
  Parked scrapes: VA 165/498 PDFs, OH partial.
- **Re-pull list** (header-only exports, fixable): AL/FL/LA. **Structural gap:**
  NC (rates via NCRB collectively — not fixable via AM Best). **WY:** no rows.
- Monorepo `origin/master` ~96 behind (`fc11c86`) by established norm; deploy
  path is agent-intel/master. Left as norm (not synced).

---

# Session checkpoint — 2026-06-18  ·  UI polish pass (tables + dashboard) on 45-state data

The build is finished and live. We are in **iterate-and-deploy mode, not
building**.

- **Deployed (agent-intel/master): `95534d5`** (UI polish pass, UI-only).
  Monorepo `755a357` (local; `origin/master` `fc11c86`, ~96 commits behind — see
  the drift note below, left as the norm). tsc clean, prod build 12/12, all 13 e2e
  + 8 verify green. Scraped baseline **byte-identical, untouched all session**
  (`filings_raw 784f77e6`, `filings b6f83d78`; `md5(filings.db)=82e423fd…`).

## Latest iteration — UI polish pass: tables + dashboard (2026-06-18, UI-only)

A presentation-only restyle of the Prospect/Defend tables and the Overview
dashboard. **No data, query, filtering, or routing changes** — same rows, same
counts, purely how they read. Shipped `95534d5` after localhost review of all
three surfaces.

- **COLOR SYSTEM — agent-perspective (the organizing idea).** Everything is colored
  by what a move MEANS FOR THE AGENT, not by raw rate direction: **Prospect = green**
  (competitor raised → your opportunity), **Defend = red** (competitor cut → your
  risk). Applied consistently to the category pills, the impact %, AND the dashboard
  card "View all" links across all three surfaces, so a row never clashes (pill and
  number always agree). My Carriers keeps its own-carrier mapping (own increase =
  retention-risk red, own decrease = opportunity green) — already agent-perspective.
  Uses real design tokens (`green-fill/text`, `red-fill/text`, `ink-3`), no hardcoded hex.
- **Tables (shared `FilingsTable`, all three modes).** State folded into the carrier
  cell ("Allstate · ID"); **sub-type + its info bubble moved to a muted secondary
  line** (`SubtypeCell` now inline) — State and Sub-type columns dropped, which frees
  the room Policyholders was losing. Compact **status dot + muted label** (no pill;
  Approved=green, Pending=amber). Impact + Policyholders **right-aligned**; impact
  colored by category. Lighter header (`ink-3`), tightened summary band, Prospect
  "Largest move" now green. The repeated **"Customers may already be shopping"**
  per-row callout was removed (the page header states it once) → defend in-effect
  badge is now the factual **"In effect N weeks"** (`computeWindowBadge`); Approved
  status color changed blue→green in `computeStatusBadge`.
- **Dashboard.** Four cards are flex-columns with **bottom-aligned "View all" links**
  (Defend red / Prospect green / Compliance neutral); My Carrier's two counts are
  smaller than the big Prospect/Defend numbers (retention red / opportunity green).
  **Recent Changes rebuilt as a fixed-layout `<table>`** (was a flex list that
  clustered at the edges): leading category-colored impact, `carrier · line · state`
  with the **effective date anchored as a muted line beneath it** (a standalone date
  column read as orphaned — reverted to date-under-carrier), a right-aligned
  **Policyholders column** (count over a muted label, graceful **"—" when missing** so
  AM Best rows stay consistent), category pill, quiet right-aligned time badge. Whole
  row still navigates (`role="link"` + keyboard). The Defend/Prospect tables were
  left as-is — their date is already anchored in the Effective column (date stacked
  above the window badge), so no floating-date problem there.
- **Tests.** e2e updated for the new column layout (`row-brand`/`row-state` testids,
  shifted `nth-child` indices, defend in-effect text, capitalized "Defend" pill in
  the feed). **`verify_profile.ts` CA→WY stale-test fix** — its tamper case asserted
  "CA is non-covered", but **CA became a permanent covered state** in the 45-state
  expansion. ⚠️ **This is the 2nd place this exact stale "CA non-covered" assertion
  surfaced** (the first was `e2e_setup`, fixed earlier). **Pattern flag:** if a 3rd
  appears, sweep all tests for hardcoded "CA"/non-covered-state assumptions at once —
  the covered-state set grew and any test still treating CA (or NY/TX) as non-covered
  is now stale.
- **Deploy hygiene — monorepo-origin drift (recorded, left as the norm).** The
  monorepo `origin/master` sits at `fc11c86`, **~96 commits behind** local `master`
  (`755a357`). This is pre-existing: the deploy path is **agent-intel/master** (now
  `95534d5`, Vercel auto-builds), and the monorepo origin has not been kept in
  per-session sync. **Not synced this session** — left as the established norm. Push
  the monorepo to its origin only if we decide to start treating it as a live mirror.
- **Build/dev gotcha (learned this session):** running `npm run build` while
  `npm run dev` is live clobbers the dev server's `.next` chunks → `MODULE_NOT_FOUND`
  500s on every route. Fix: stop dev → build → `rm -rf .next` → restart dev. Don't
  run a prod build against a running dev server.

## Latest iteration — Own-carrier alerts: retention + opportunity (2026-06-17, UI-only)

Surfaced the agent's OWN carrier rate moves as interpreted signals, **distinct
from the competitor-only Prospect/Defend (unchanged)**:
- **`src/lib/retention.ts` (new, shared single source):** `computeRetentionRisk`
  (own-carrier increases **5% or more**) + `computeOpportunity` (own-carrier
  decreases **2% or more**). Both: 6-month window (`RETENTION_WINDOW_MONTHS`, on
  `effective_date`, anchored to data as-of — tighter than the 12-month
  competitive window ON PURPOSE), newest-first. All surfaces call this one helper,
  so band + dashboard **reconcile by construction**.
- **My Carriers page:** band gained **Retention risk** (red) + **Opportunity**
  (green) stats (respect filter chips); a red **Retention Risk section** lists
  recent own-carrier increases. Plain-word wording ("5% or more, last 6 months") —
  no math symbols. (5-stat band fits one row at desktop, reflows 3+2 narrow.)
- **Dashboard:** **"Most Urgent" REMOVED** (`computeMostUrgent` dropped) → replaced
  by a two-direction **"My Carrier" alert card** (retention + opportunity counts,
  both → /my-carriers). **"Your Carrier Snapshot" table REMOVED** (`CarrierActivity.tsx`
  deleted, `computeCarrierActivity` dropped). Recent Changes unchanged.
- **Stale test fixed:** `e2e_setup` CA→WY — CA became covered/permanent in the
  batch-13 load, so "California is non-covered" had been silently stale.

**Two parked product questions (resolved/deferred):**
- (a) own-carrier-increase-as-Defend was deliberately NOT folded into competitive
  Defend — lenses kept distinct (resolved by the My Carrier card).
- (b) Opportunity shipped as a band-stat only, **no full section** like Retention
  has. Revisit if the asymmetry ever feels wrong (would word it "down 2% or more").

## Latest iteration — AM Best 22-state batch (2026-06-17)

Added **2,766 AM Best filings** across **22 states** via the SAME `ambest_sourced`
pipeline (no new machinery). The app now covers **45 states**:

- **998 scraped** (13-brand: AZ CO GA ID MT NM NV OR UT WA) — untouched.
- **AM Best (35 states):** 32 INTERIM (replaceable when scraped) + 3 PERMANENT.
  - 22-state batch interim (20): ME MD MA MI MN MS MO NE NH NJ ND OK PA RI SC SD
    TN VT WV WI. Plus the prior 12 interim (IL OH VA AK AR CT DE HI IA IN KS KY).
  - **PERMANENT (3): CA, NY, TX** — non-SERFF (CDI/DFS/TDI), never replaceable.
    `AMBEST_PERMANENT_STATES=["CA","NY","TX"]`, excluded from the replacement
    sweep, methodology says "AM Best-sourced rather than scraped". NY/TX
    non-SERFF flagged from regulatory structure, not a SERFF probe (confirm if
    scraping them is ever considered; not load-blocking). **Conservative-safe
    tag: when unsure, prefer permanent** (mis-tag scrapeable→permanent = "revisit
    manually"; mis-tag non-scrapeable→interim = replacement sweep deletes with no
    replacement, the CA landmine).
- All AM Best states render **identically to scraped (no UI badge)**.

Per-state rolled topped by TX 249 (permanent), MO 215, MN 188, TN 181, MI 176.
NJ + NY are **0-Defend, confirmed real** (active windows all 0%→positive, nothing
mis-classified — DOBI/DFS prior-approval regimes). B2: prior-approval NY/NJ/MA
show `eff>disp` dominant (correct); MD/TX `eff<disp` = normal file-and-use, not
a swap.

**DOCUMENTED GAPS (not covered, 5 states):**
- **AL, FL, LA — re-pull list (FIXABLE).** Header-only exports (no disposition
  data). Re-export from AM Best WITH the disposition supplement. (FL also non-SERFF.)
- **NC — STRUCTURAL, NOT fixable via this source, NOT on the re-pull list.** NC
  rates auto/home through the NC Rate Bureau (NCRB) collectively → AM Best has no
  per-carrier data (68.1% Data-N/A → 26 thin filings). A re-pull will NOT help;
  needs a different source (NCRB direct / another vendor) if ever wanted.
- **WY — no rows** (listed, no filings).

## Latest iteration — AM Best 10-state batch (2026-06-17)

Added **1,055 AM Best filings** across **10 states** via the SAME `ambest_sourced`
pipeline as IL/OH/VA (no new machinery). The app now covers **23 states**:

- **998 scraped** (13-brand: AZ CO GA ID MT NM NV OR UT WA) — untouched.
- **AM Best INTERIM (12, replaceable when scraped):** IL, OH, VA + IN, KY, IA,
  AR, CT, KS, DE, AK, HI.
- **AM Best PERMANENT (1, NOT replaceable):** **CA** — non-SERFF (CDI runs its
  own system). New `AMBEST_PERMANENT_STATES=["CA"]` in both `import_filings.py`
  and `constants.ts`; CA is **excluded from the replacement sweep** and the
  methodology page describes it as "AM Best-sourced rather than scraped" (NOT
  "awaiting scrape"). **NEVER run the replacement-delete for a permanent state.**
- All AM Best states render **identically to scraped (no UI badge)**; distinct
  only in backend (`source`, `AMB-` key stripped from UI+API, replacement path).

Per-state rolled (PA/HO): IN 188, KY 139, IA 135, AR 132, CT 113, KS 103, DE 87,
CA 65, AK 52, HI 41. **B2** clean: prior-approval CA/CT show `eff>disp` dominant
(no column swap). **CA 0-Defend is real** — its active window is 0%→positive only
(no approved decreases; Prop-103 regime), not a sign/classification artifact.

**RE-PULL LIST (excluded from this batch — header-only exports, a PULL problem):**
- **AL** (100% "Disposition Page Data N/A"), **FL** (100% N/A, and ALSO non-SERFF
  like CA), **LA** (86.8% N/A — only a 14-filing sliver was usable).
- These exports lack the disposition supplement → no rate-effect % (the core
  product). Re-export from AM Best WITH disposition data, then inventory + load.
- **Quality gate for any future AM Best batch:** check the `Disposition Page
  Data N/A` rate before loading. Loadable states sat at 1.9–43.4% (normal);
  ~100% = unusable header-only pull.

Deploy this batch went agent_intelligence → agent-intel/master via a **git
worktree** (root-layout worktree, copy changed files, `push HEAD:master`). The
older `git subtree push` method below still works; same resulting tree.

## Latest iteration — AM Best interim data for IL/OH/VA (2026-06-16)

Added **596 AM Best interim filings** (IL 244, OH 158, VA 194) alongside the
**998 scraped** (13-brand, 10 states). IL/OH/VA render **identically to scraped
states — NO UI marker**. The distinction is **backend-only**:
- `source` column (`'serff_scraped'` | `'ambest_sourced'`) on both tables.
- Backend-only surrogate key `AMB-<ST>-<line>-md5(block_id|brand)` (block-stable,
  idempotent, collision-proof) — **stripped from UI AND API payload** via
  `toClientFiling` (relabeled "AM Best"; raw key never leaves the server).
- `build_ambest_df()` in `import_filings.py`: dedup → window-filter → premium-
  weighted rollup → fail-loud mixed-source guard. Source-aware `verify()` keeps
  the scraped baseline **byte-identical** (1,616/998/293, +93.70% anchor).
- Coverage: IL/OH/VA in `COVERED_STATES` + `AMBEST_STATES` + `states.ts
  source:'ambest'`. Methodology validation table stays **10 cross-checked**;
  interim shown separately (37 not covered).
- **Design + replacement path: `docs/AMBEST_INTERIM.md`.** Replace when scraped:
  `DELETE … WHERE source='ambest_sourced'` → import scrape → re-rollup.
- Cross-cutting state (WAF/quiet period/scraper) lives in the scraper repo's
  `output/resume_state.md`. SERFF quiet period active until **2026-06-21**;
  the June-21 cold-capacity read decides whether to upgrade IL/OH/VA interim→real.

## Latest iteration — GA+NM data expansion + 13 brands + rate-neutral suppression (2026-06-16)

Big data + scope expansion of the rate-filing product (NOT the compliance
briefing — that's the prior iteration, still intact). The source xlsx was
re-collected with Georgia + New Mexico added and the effective-date floor pushed
back a year. Everything below was reconciled against an independent read-only
recon of the source before any build change, then re-keyed.

### 🔒 New verification baseline (REPLACES 468/314)

- **1,616 raw → 998 rolled → 293 active-window** (12mo from data as-of
  **2026-06-11**; `rate_change`/`rate_change_pending`; eff ≥ 2025-06-11).
- **13 brands, 10 states** (was 8/8). Date range **2024–2026**.
- Anchor **+93.70% `SFMA-134315091`** (State Farm WA Homeowners) UNCHANGED.
- multi-entity rollups 351/998 (35.2%). 0 unmatched company_names.
- Prospect/Defend re-key (active window): Independent AZ+NV **13/9**, all-8
  **48/38**, all-10 **81/51**; Captive SF AZ+NV **12/7**, all-8 **40/28**;
  Captive Allstate AZ+NV **9/6**. GA-only Independent 27/7; NM-only 6/6.
- My Carriers (POST rate-neutral suppression, see below): SF+TRV AZ+NV **10**,
  SF+TRV+PRG AZ+CO+NV **26**, Allstate+Liberty+Safeco all-8 **78**, captive SF
  AZ+NV **6**.
- `import_filings.py` `verify()` is re-keyed to all of the above (raw/rolled/
  active/13-brand/10-state/anchor; GECC-134661852 rollup spot-check + 11 distinct
  sub_types still hold unchanged).

### ⚠️ Intentional-but-odd states — DO NOT "fix" these as bugs

1. **The 5 new carriers are GA-ONLY on data, on purpose.** Farmers, COUNTRY
   Financial, American Family, Nationwide, USAA were adopted with full brand
   plumbing (in `BRANDS`, so pickers/positioning/validation all flow from it),
   but the source only has their filings in Georgia so far. **Backfilling the
   existing 8 states with these 5 carriers is the next data task.** A WA agent
   authorizing Farmers seeing no WA Farmers data is EXPECTED, not a gap to fix.

2. **GA + NM render compliance as COMING-SOON even though they have rate data.**
   `data_coverage:true` governs rate-data selectability ONLY; the compliance
   briefing gate is `sectionsForState()` (WA/ID/UT only). Rate-data coverage ≠
   compliance coverage — this is the designed separation, not a missing wire.

3. **Rate-neutral (0.0%) filings are hidden from My Carriers + Overview only.**
   Many GA State Farm PPA filings are declared rate-NEUTRAL refiles (SERFF "Rate
   Change Type: Neutral" — verified against PDF `SFMA-134315020`: indicated
   15.3%/3.0% but implemented 0.0%). They're suppressed on the unfiltered
   own-carrier surfaces (`getMyCarriersFilings` adds `overall_rate_impact != 0`).
   Prospect/Defend exclude 0% via thresholds already; **Positioning and the
   coverage map are deliberately NOT filtered.** A "N rate-neutral filings (0.0%)
   hidden" note explains the count gap; the Overview footnote says "No recent
   **rate-moving** filings…". A carrier whose filings are ALL neutral shows the
   normal no-data empty state (NOT coverage-gap — it IS covered).

4. **Positioning is COVERAGE-AWARE.** A brand counts as a competitor in a cell
   only where we actually collect its data (`getBrandStateCoverage`). Without
   this the 5 GA-only brands registered as phantom "insufficient" competitors in
   every non-GA cell (insufficient jumped 29→79). Fixed → captive SF all-8 totals
   10/6/41/**23**/**18**/**25**; independent SF/TRV/PRG comparable **64**, higher
   **30** (independently reconciled, not rubber-stamped).

5. **Coverage-gap empty state is data-driven + self-healing.** A selectable brand
   with zero rows in the agent's state(s) shows "covers {states}, {state} coming"
   instead of silent emptiness; the note clears automatically once backfill lands
   a row (it reads `SELECT DISTINCT brand,state FROM filings`, which counts ALL
   rows incl. 0.0% — that's why neutral-only ≠ coverage-gap).

### Brand derivation (`derive_brand`) additions

- **Safeco affiliates** folded into Safeco by full legal name (consumer-facing
  Safeco companies Liberty owns post-2008): `general insurance company of
  america`, `first national insurance company of america`, `american states`.
  This was also REQUIRED to get WA importing again (2 WA 2024 rows broke it).
- **5 new carrier families:** USAA (`usaa`/`united services`/`garrison`),
  Farmers (`farmers`/`fire insurance exchange`/`mid-century`/`truck insurance
  exchange`), Nationwide, American Family (guards the Munich Re `american family
  home` NAIC-23450 collision), COUNTRY Financial.
- **Two collision guards (load-bearing — a wrong attribution silently corrupts
  Prospect/Defend):** Safeco rule matches the FULL "general insurance company of
  america" so "Nationwide General Insurance Company" → Nationwide; USAA is
  checked before any generic match so "USAA General Indemnity" → USAA.

### states.ts / coverage

- **GA + NM `data_coverage:true`.** Their `validated` flags' VALUES come from the
  AM Best cross-check logs — GA `{auto:true,home:true}` (PPA 92.8% / HO 94.3%),
  NM `{auto:true,home:true}` (PPA 97.3% / HO 88.2%) — but the ROWS themselves are
  fully scraped SERFF data (480 GA / 131 NM raw rows, all with scraped
  `source_pdf`, sub-types + withdrawn dispositions present). `validated` is a
  state/line CROSS-CHECK flag, NOT a "this data is AM Best-sourced" marker — no
  app row is AM Best data; the four-tier `external_validation` gradient isn't even
  imported. `constants.ts` `COVERED_STATES` → 10. Methodology text updated
  (2024–2026; 13 brands; "{50-n} states not covered"; newer/thinner-coverage note).

New lib: `src/lib/coverage.ts` (pure coverage-gap note), `getBrandStateCoverage`
+ `getMyCarriersNeutralHiddenCount` in `filings.ts`. `/api/filings` returns
`coverage` + `neutralHidden`. Monorepo `cd86a5c` → deploy `d3470cb`.

## Earlier iteration — Compliance briefing goes MULTI-STATE: +ID +UT (2026-06-16)

The compliance office briefing expanded beyond WA to **Idaho and Utah** via a
**per-state section model** — and in doing so PROVED the multi-state template
the remaining 5 covered states (AZ, CO, MT, NV, OR) will reuse.

- **Per-state section model** (`briefing.ts`): each built state declares its own
  ordered section list. `WA_SECTIONS` is the original 6 (incl. PFML + WA Cares),
  **unchanged** so WA renders exactly as before. `FEDERAL_DEFAULT_SECTIONS` (ID,
  UT) is 5 — wage, salary, leave, at-will, business tax — **no WA Cares**.
  `SECTIONS_BY_STATE` maps state→list; `sectionsForState()` /
  `salaryWarningForState()` / `isBriefingReady()` all key off it. A new state
  with its own structure (CO's salary threshold + FAMLI, OR regional wages) gets
  its own list — that's the whole extension point.
- **Honesty bar preserved on the new states.** ID/UT salary sections defer to the
  **federal FLSA** (no invented threshold figure); **UT at-will is intentionally
  left COMING-SOON** (no clean official Utah .gov source — grounding it weakly was
  rejected, per the WA bar); business tax framed as **income-on-net-profit**, not
  a B&O-style "your rate." UT business-tax guidance scopes the **$100 minimum to
  C-corps only** so it can't read as a universal obligation. Per-state salary
  warning names **L&I** (WA) vs the **U.S. DOL** (federal-default states).
- **Verified content.** The generated ID/UT summaries in `complianceData.ts` were
  produced under per-state generator guidance (`GUIDANCE_BY_STATE` in
  `generate_compliance.ts`) and checked; the UT business_tax entry in the tree is
  the corrected **entity-distinct** version (C-corp franchise + $100 min vs the
  4.5% individual flat rate on pass-through/sole-prop owners), not an early draft.
- **Coming-soon sections no longer assert size applicability.** The generic
  "Applies regardless of company size." note now renders **only on grounded
  sections** — a coming-soon section hadn't grounded that claim. (UT at-will, AZ
  blocks no longer show it.)
- **Not-yet-built states** (AZ/CO/MT/NV/OR + any non-covered employee state) still
  render the whole-state coming-soon block, surfaced not dropped — multi-state mix
  WA+ID+AZ confirmed: WA first (primary), ID its own block, AZ coming-soon.

Tests: new `verify_briefing_language.ts` runs the determination-language
blocklist over **WA+ID+UT** grounded content (guards that ID/UT meet WA's honesty
bar, not just WA); `verify_office_summary.ts` expectations updated for ID now
being briefing-ready (was the stale "only WA" world — no logic regression); new
`e2e_compliance` cases (ID-only, UT-only coming-soon at-will + no size note,
WA+ID+AZ mix). All green: tsc · 7 verify · e2e_compliance + e2e_nav · build 12/12.
Monorepo `a5c11a2` → deploy `50ef430`.

## Earlier checkpoint — 2026-06-02 (office summary + accordion)

- Monorepo `b3a94ac feat(compliance): office summary + accordion briefing`.
- **Deployed (agent-intel/master): `71d448c`** — in sync with the monorepo
  subtree at that checkpoint. All suites green (6 verify + 13 e2e).

## Latest iteration — Compliance office summary + accordion (2026-06-02, deployed)

Two new profile inputs feed a personalized office summary at the top of
`/compliance`, and the briefing is now a collapsed accordion.

- **Profile inputs:** `pay_type` (Hourly/Salary/Both) and `remote_count` (whole
  number, validated at entry to not exceed `employee_count`). Both required. Old
  saved profiles predate them: `loadProfile` stays tolerant; **`needsProfileUpgrade()`**
  drives a prompt (banner on `/setup`, upgrade card on `/compliance`) — never
  errors or wipes. New lib `src/lib/officeSummary.ts`; new verify
  `scripts/verify_office_summary.ts`.
- **Office summary** (`src/components/OfficeSummary.tsx`, above the disclaimer
  band): factual recap of the agent's inputs; **"Worth reviewing for your office"**
  relevance pointers (fact + their number, point at sections, NEVER a
  determination — blocklist-tested); and the **load-bearing out-of-state remote
  flag** (prominent amber callout, always visible, fires when remote workers are
  in states the WA briefing doesn't cover).
- **Accordion briefing:** each topic is an accessible accordion item (button +
  aria-expanded/aria-controls, chevron, keyboard-operable), collapsed by default,
  content in a `role=region` toggled via `hidden`. The **Salary** header carries a
  visible **"affects exempt status"** caution pill while collapsed; the full
  misclassification warning stays inside. The "not legal/tax advice" band stays
  sticky + always-visible.
- **Relevance links = primary nav into the briefing.** Expansion state lifted to
  `compliance/page.tsx`; clicking a pointer EXPANDS its target section then scrolls
  (rAF → `scrollIntoView`, honoring `scroll-mt-[88px]` so it lands below the sticky
  band) — never a collapsed empty row. No-dead-link rule intact:
  `briefingSectionAnchorId` only resolves when the target renders (no-WA profile →
  zero links; remote pointer has no section → plain text).

Structure/presentation only; no change to grounded summary content or
determination-language honesty. Monorepo `b3a94ac` → deploy `71d448c`.

## Earlier iteration — Overview: carrier-activity recent-filings card (2026-06-02, deployed)

Replaced the aggregated per-(brand,line,state) averages in the "Your carrier's
activity" card with a curated recent slice of the carrier's own INDIVIDUAL
filings. Selection order: (1) **coverage floor** — most-recent filing from each
licensed state the carrier filed in (every filed state guaranteed ≥1 row);
(2) **fill** — next-most-recent by recency only, capped at `CARRIER_ACTIVITY_EXTRA
= 3` on top of the floor (busy state earns a 2nd row only after coverage);
(3) licensed states with no filings noted at the card foot ("No recent filings
from your carrier in: {states}", suppressed when the list is entirely empty —
the empty message covers that). Each row: carrier/line/sub-type, signed change,
state, effective date (with year), abbreviated policyholders — reusing
`formatEffectiveDate`/`formatPolicyholders`/`formatRateImpact`/`rateImpactColor`
+ `resolveSubtype` label cleanup. Added a "See all →" link to `/my-carriers`.
**No new query path** — same own-carrier set `/my-carriers` renders, a different
slice; reconciles by construction. `computeCarrierActivity(filings, licensedStates)`
now returns `{ rows: Filing[], noFilingStates: string[] }`.

Tests: `verify_overview` rewritten (reconciliation, coverage floor, floor/
no-filings partition, +3 cap, newest-first order); `e2e_overview` updated for
the row-based card + "See all" link + a captive-Progressive-all-8 case (floor +
ID/UT/WA no-filings note). Full suite green (5 verify + 13 e2e). Monorepo
`cde0c95` → deploy `cc7bf2a`.

## Earlier iteration — Methodology: Positioning section (2026-06-02, deployed)

Added a "How Rate Positioning compares carriers" section to `/methodology`
(between the thresholds and excluded-brands sections). Static documentation,
no logic change; facts sourced from the Feature 7 spec. Leads with the
load-bearing "rate changes, not prices" frame in the feature's own amber band
(`bg-amber-fill text-amber-text`), then documents the premium-weighted
computation (same active 12-month set as Prospect/Defend), the
higher-confidence vs thin tiering + anchored-cell / insufficient-data honesty
mechanics, and the sparsity limit. Deliberately omits the internal
verification counts (10/41/24) and phrases the null-premium fallback durably
rather than hardcoding "1 of 180." New section carries `data-testid=
"section-positioning"`. Monorepo `48cb173` → deploy `6e261ea`.

## Status: done

All 13 build-order steps + all polish complete; Features 7, 8, 9 shipped & live.

```
1–13  v1 build order + polish                       done (deployed)
+  Post-v1 iterations (all shipped & deployed):
    - effective-date year fix
    - left sidebar nav + Defend table polish
    - click-to-sort headers + three-state sort affordance
    - Recent Changes restyle + enriched feed; window-badge wrap fix
    - My Carriers opened to captives (singular "My Carrier")
    - "Your carrier's activity" Overview summary
    - Feature 7: Rate Positioning (/positioning)
    - Feature 8: Sub-type column + click-based info bubble (filings tables)
    - Feature 9: Compliance office briefing (/compliance)   ← newest
```

## Feature 9 — Compliance office briefing (complete, deployed)

Personalized grounded briefing at the top of `/compliance`, scoped to the
agent's employee states, ordered by primary state; the existing 8-topic card
grid stays below.

- **Grounded figures shown** (decision B, reversed from the earlier qualitative
  decision A): min wage $17.13 (2026, up from $16.66); overtime 1.5×; WA Cares
  0.58%; **insurance-commissions B&O rate 0.484%** (grounded via the DOR
  classifications page, framed for agencies + classification/confirm-with-DOR
  caveat). PFML & B&O *general* rates honestly deferred (not on the fetched
  pages — no number invented).
- **Salary/exempt threshold**: shows the formula for transparency
  (`2.25 × $17.13 × 40 = $1,541.70/week`, keeps "tiers currently match in 2026"),
  a **derived annual ≈$80,168/yr** computed in the UI as weekly × 52 (ties by
  construction), and its **own strong inline misclassification warning** (not
  the generic band). Its generic size-gate was dropped (tiers match this year);
  **PFML keeps its 50+ size-gate**.
- **Two-tier disclaimer**: top band covers staleness; the salary box carries the
  stronger figure-specific warning. **Per-section "as of {date}"** on each figure.
- **Source links** show a distinguishing path segment (e.g.
  `dor.wa.gov/…/business-occupation-tax-classifications`), not bare domain.
- **WA-complete.** All other employee states (covered-but-unmapped AND
  non-covered) render the honest **coming-soon** block — surfaced, not dropped.
  State expansion is a separate effort.

## ⏰ Standing maintenance obligation — regenerate compliance figures yearly

The Compliance **office briefing (Feature 9)** prints **live grounded figures**
(minimum wage, the overtime-exempt salary threshold, the WA Cares premium rate
0.58%, and the insurance-commissions B&O rate 0.484%). **These MUST be
regenerated at least once a year** — most WA figures reset on **January 1**
(the B&O rate changes by legislation, re-verify it each refresh). A stale
printed figure is the feature's main risk (the salary threshold can cause a
real misclassification).

Each January (and after any known mid-year change):
1. `ANTHROPIC_API_KEY=… npx tsx scripts/generate_compliance.ts --only WA/wage_hour,WA/salary_threshold,WA/leave,WA/wa_cares,WA/business_tax`
2. Verify the new numbers against the official source pages.
3. Commit + subtree-push → redeploy.

The UI shows a per-section "as of {last_checked}" date so staleness is visible,
but that does not remove the obligation to refresh. (Spec: Feature 9 →
"Standing maintenance obligation".)

## Live deployment

- **Live URL:** https://agent-intelligence-sigma.vercel.app/
- **Deploy source of truth:** GitHub `AceVon3/agent_intelligence` (private),
  branch `master`, at `7bc5bf8`.
- **Host:** Vercel project connected to that repo (project Root Directory =
  repo root `/`; auto-builds on push to master).
- **No env vars** required in prod (`ANTHROPIC_API_KEY` is offline-regen only).
- **Runtime DB tracing:** `/api/filings`, `/api/positioning`, and
  `/methodology` read `data/filings.db` / `last_updated.txt` at request time.
  They are force-included via `experimental.outputFileTracingIncludes` in
  `next.config.mjs` (next@14.2.x). **Any NEW dynamic route that reads the db
  MUST be added there or it 500s in prod (invisible at build time).**

## Deploy workflow (two-repo topology — read before shipping)

This working copy is the **monorepo** `AceVon3/browser-games`, project under
`agent_intelligence/`. The deploy repo has the project at its root.

To ship a change:
1. Commit in the monorepo (paths `agent_intelligence/...`).
2. `git subtree push --prefix=agent_intelligence agent-intel master`
   (from the monorepo root; remote `agent-intel` → the standalone repo).
3. Vercel auto-builds `master`.

Do NOT plain-`git push` to `agent-intel` (path layouts differ). After each
deploy, update this file and subtree-push it so the deploy repo's record
matches.

## Test suites — all green at acd848c (5 verify + 13 e2e)

verify_queries · verify_profile · verify_overview · verify_positioning · verify_subtype
e2e: setup · prospect · defend · my-carriers · overview · compliance · nav ·
methodology · filters · empty_states · skeleton · mobile · positioning

- e2e_*.ts run against a running dev server:
  `npm run dev` then `E2E_BASE=http://localhost:3000 npx tsx scripts/e2e_<name>.ts`.
- verify_*.ts are node-only (no browser). **verify_positioning is the Feature 7
  answer-key gate** — captive State Farm all-8 must produce 10 anchored /
  6 unanchored / 41 comparable / 24 higher-confidence / 17 thin / 29
  insufficient; independent {SF,Travelers,Progressive} → 69 / 34. If these
  drift, the positioning query diverged from recon.

---

_History below is the original build log, retained for reference._

## Item 6 — badge color audit (2026-05-29): CLEAN, no code change

Swept every `*-fill` / `*-text` usage across `src/` against the five
design-system color families in `tailwind.config.ts` (blue, green,
amber, red, gray). Findings:

- **All badge (fill, text) pairs are family-consistent.** Every pairing
  is stored as an inseparable class-pair string in a lookup map
  (`FilingsTable.BADGE_CLASS`, `RecentChanges.PILL_CLASS`,
  `ComplianceCard.TOPIC_TAG_CLASS`), so a cross-family mismatch is
  structurally impossible, not just absent.
- **Window/status badge logic matches the spec's per-page tables.**
  Verified `computeWindowBadge` (prospect/defend/my-carriers) and
  `computeStatusBadge` in `lib/format.ts` against the spec.
- **`amber` is the correct single token for the spec's "Yellow" AND
  "Orange" window-badge slots.** The design system (both
  `tailwind.config.ts` and the reference HTML) defines exactly 5 badge
  families — there is no separate orange/yellow token — so both
  semantic slots correctly resolve to `amber`. Confirmed: no
  orange/yellow tokens exist anywhere.
- **Status "Approved" = blue is intentional.** Spec prose says
  "green-ish," but the authoritative reference mockup
  (`ui-reference.html`) renders Approved as `b-blue`. Per the conflict
  rule (reference wins on appearance), blue is correct.
- Non-badge fills reviewed too: error/coverage banners use red
  fill+text (family-consistent; red is right for errors), and
  `CARD_URGENT` reuses `red-text` as a 2px danger border (intentional
  per spec; no `red-border` token exists).

### Decision: coverage-warning banner NOT implemented in v1 (2026-05-29)

Surfaced during the item-6 sweep: the spec's amber coverage-warning
banner ("{State} isn't covered yet. Showing your other states.",
spec → UI / design system → Coverage warning) has no implementation in
`src/`. **This is intentional, not a bug.** Two existing layers already
make the condition unreachable:
- the setup UI disables uncovered (`data_coverage: false`) states, and
- save-validation rejects any non-covered licensed state (the tamper
  guard from build step 4).

So an uncovered state in a saved profile can't occur in normal
operation — the banner would only fire on hand-edited `localStorage`.
Building display-time UI for a validation-unreachable condition isn't
worth it for v1. Revisit only if profile state ever becomes
server-sourced or shareable (a profile arriving without passing through
this app's save-validation). Recorded in spec.md "Resolved decisions".

## Decisions logged from end of item 5

User answered three open items from the mobile-layout report:

1. **Tap targets at 28–30px: accepted.** The filter chips (30px) and
   the state checkbox option rows (28px) clear WCAG AA per the user's
   reading; not changing them to a touch-only size. Desktop info
   density preserved.

2. **SERFF row tooltip + entity-spread `i` info dot: accepted as
   desktop-only.** Both surface via the `title` attribute, which
   doesn't fire on touch. v1 audience is desk-bound; agents on mobile
   look up the SERFF number via carrier+state+impact if needed.
   Revisit if mobile usage data later warrants surfacing.

3. **Tailwind cache gotcha → CLAUDE.md.** Added (this commit) under a
   new "## Gotchas" section so the next bulk-className edit doesn't
   hit a stale `.next` cache for the third time.

## Outstanding verification — RESOLVED 2026-05-29

**Info-dot circular `i` glyph visibility on mobile — VERIFIED.**
Confirmed at 375×800 on `/prospect` (independent AZ+NV profile).

How: added a `[multi-entity info-dot]` block to `scripts/e2e_mobile.ts`
that sets the profile, loads `/prospect`, `scrollIntoViewIfNeeded()`s the
first `entity-spread-dot`, asserts its computed style, and saves a tight
clipped screenshot (`polish/mobile-info-dot.png`).

Results (all OK):
- 2 info-dots present in the table; first rolled up 3 entities
  (tooltip "Premium-weighted across 3 entities. Range: 1.0% to 10.6%.").
- Box 14×14, `border-radius: 9999px` (circular), background
  `rgb(241,239,232)` (`bg-soft`, filled — not transparent),
  `font-style: italic`, text content `"i"`, scrolled into the viewport
  horizontally, premium-weighted `title` present.
- **Visual confirmation:** the clipped PNG shows the circular gray dot
  with an italic serif "i" — the shape renders, not just the text.

As predicted, font-load state is irrelevant: the dot is a styled
`<span>` with a Georgia-serif inline style, not the Tabler iconfont.

## Remaining work

1. ~~Info-dot mobile check~~ — DONE (verified 2026-05-29, see above).
2. ~~Item 6: badge color audit~~ — DONE (2026-05-29, clean; see the
   "Item 6 — badge color audit" section above. No code change.)
3. **Step 13: deploy to Vercel** — IN PROGRESS. Deploy-prep done; the
   Vercel project setup is the next live action (do together).

### Deploy-prep (2026-05-29)

Readiness verified before any Vercel action:
- **SQLite**: `db.ts` opens readonly; `data/filings.db` +
  `data/last_updated.txt` committed (240K / 12B).
- **No runtime env vars needed.** `@anthropic-ai/sdk` is imported only
  in `scripts/generate_compliance.ts` (offline regen), never in `src/`.
  Compliance page reads the committed `complianceData.ts`. So Vercel
  needs NO env vars; `ANTHROPIC_API_KEY` is only for local regen.
- **`npm run build` clean** (next@14.2.35; 11/11 pages).
- **File-tracing fix applied** (commit below): empty `next.config.mjs`
  had no `outputFileTracingIncludes`, so the runtime `process.cwd()`
  reads of `data/` would NOT be bundled into the Vercel lambdas →
  guaranteed 500s, invisible at build. Added
  `experimental.outputFileTracingIncludes` (experimental-scoped for
  14.2.x; top-level is Next 15) mapping `/api/filings` →
  filings.db + last_updated.txt, `/methodology` → last_updated.txt.
  **Verified from `.nft.json` trace manifests** that both files are
  traced and the relative entries resolve to the real files — proven,
  not inferred from a green build.

### GitHub repo created (2026-05-29)

Pushed to a NEW dedicated repo: **`AceVon3/agent_intelligence`**
(private, default branch `master`). The project lives at the REPO ROOT
there (package.json at `/`), extracted from this monorepo subdir via
`git subtree split --prefix=agent_intelligence` — full 26-commit history
preserved. `data/filings.db` (240K) + `last_updated.txt` confirmed
present on the remote.

**Two-repo topology now in play.** This working copy is still the
monorepo (`AceVon3/browser-games`) with the project under
`agent_intelligence/`. The standalone deploy repo has it at root.
- Remote `agent-intel` → the standalone repo.
- Push future changes with:
  `git subtree push --prefix=agent_intelligence agent-intel master`
  (run from the monorepo root). Do NOT plain-`git push` to agent-intel.

Still TODO (live, do together):
- Vercel project: connect **`AceVon3/agent_intelligence`**. Because the
  project is now at the repo root, **Root Directory = `/`** (NOT
  `agent_intelligence` — that note applied to the old monorepo plan).
- Connect repo + deploy. No env vars needed.

## Launch-blocker status

12.a (compliance generation gate) was the only pinned launch blocker.
**Cleared at commit `daa484b`**:
- `scripts/generate_compliance.ts` ran against the live Anthropic API
  with a real key.
- WA `wage_hour` and WA `leave` generated summaries were independently
  verified against the fetched source pages — every factual claim
  traced to source content, no fabrications.
- Fetch-fail fallback test passed (typed URL → entry absent from
  `complianceData.ts`, no invented content).
- DOR business-licensing URL fixed (the old one 404'd).
- Refusal-detection added to the generator so models that decline to
  ground a topic store `title/summary: null` and render the
  coming-soon card variant.

No other launch blockers tracked.

## Regression state

All 12 E2E suites pass at the most-recent commit:
  setup · prospect · defend · my-carriers · overview · compliance ·
  nav · methodology · filters · empty_states · skeleton · mobile

Verification harnesses kept in `scripts/`:
- `verify_queries.ts`, `verify_profile.ts`, `verify_overview.ts` (Node
  unit-style, no browser).
- `e2e_*.ts` (Playwright, headless chromium, against a running dev
  server).
- `screenshot_pages.ts` (full-page before/after PNG snapshots into
  `polish/`, gitignored).

## Dev environment quirks

- Two non-default ports may still be held by background processes; use
  `Get-NetTCPConnection -LocalPort @(3000..3010) -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
  to clear them if 3000 is busy at start.
- Tailwind cache: see `## Gotchas` in `agent_intelligence/CLAUDE.md`.

## Working-tree state at checkpoint

- `agent_intelligence/`: clean.
- The rest of the repo (`baseball_model_v1/`, root `Test`): pre-existing
  dirty state from before this session, not touched here.
