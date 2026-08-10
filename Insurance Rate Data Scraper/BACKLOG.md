# Backlog

Tracked-but-deferred work. Each item: rationale + spec pointer + sizing.

## B24 — Pending-disposition recheck at every refresh (statuses freeze at scrape time)
**Opened:** 2026-08-10 (user asked after the OR Farmers FAIG-134959263 UI fix).
**Size:** small script + one refresh-recipe step. **Run at the NEXT refresh.**
Cached filings are NEVER re-fetched (the burst cache-check skips any filing
whose `filing_summary.pdf` exists), so a `rate_change_pending` status is a
frozen snapshot of scrape day — approvals never land in our data on their
own. As of the 26h2 import (as_of 2026-08-10): **145 pending rolled filings,
112 with passed effective dates** (the ones showing the "Rate in effect;
state review still open" UI verbiage shipped 2026-08-10):
GA 75 · NV 9 · OR 8 · MD 5 · ID 5 · AK 5 · CA 2 · VT 1 · VA 1 · OH 1.
**Recheck mechanism:** before the refresh bursts, enumerate pending-status
filings from the workbooks and delete (or sideline) their cached
`filing_summary.pdf` — the normal burst then re-downloads them with the
CURRENT disposition; harvest picks up flips to approved automatically.
Cost is modest (they ride existing group searches; no extra Begin-Search
budget beyond batch size).
**GA caveat — triage before burning searches:** GA's 75 include effective
dates back to 2024-01-01. Pendings that old are likely a state-practice
artifact (GA DOI appears not to update disposition in SERFF public access),
not live reviews. Sample 2-3 old GA filings FIRST; if their live pages still
say pending after 2+ years, tag GA (and the similar old AK rows) as a
permanent no-disposition class and exclude them from the recheck loop so
they don't waste spend every cycle. The recent-effective cohort (NV/OR/ID/
MD/VT/VA/OH 2026 effectives + the 3 SF-CA pending-with-waiver HO, which
ALSO have the 8/31 CDI closed-list as their disposition channel) is the
real payload.

## B12 — 2× external background-task kill at ~30-min age (RI harvest)
**Opened:** 2026-07-07 (RI). **Size:** investigate before the LARGE tier.
During the RI harvest, two burst tasks were killed externally at ~30-31 min
of task age (burst-2 at 18:20 mid-LBPM-batch; burst-4 at ~19:24 mid-travco
batch) — NOT WAF walls (both were running clean), not user stops (unconfirmed),
not crashes (no tracebacks). Tasks under ~30 min never got killed; one 49-min
task (rest+retry) survived, so the boundary is fuzzy. Both kills were
MISS-SAFE (cache-and-resume lost nothing) — but a large-tier burst (PA/IN/TN)
will routinely exceed 30 min, so an environmental timeout would fragment
bursts and waste Begin-Search budget. Investigate: harness background-task
limits, Windows power/idle policies, OneDrive/AV interference. Mitigation if
unresolved: schedule long harvests as several sub-30-min capped bursts
(--burst N) with 15-min rests — the adaptive cadence already supports this.

## B10 — Stale 8-brand-era tests in insurancewebscraper tests/
**Opened:** 2026-07-07 (B9-audit deploy). **Size:** small. Two pre-existing
failures (fail identically on unmodified `9645a69`; NOT B9-related):
`tests/test_parsers.py::test_match_target_company_no_match` asserts
"USAA Casualty Insurance" is a non-match (predates the 13-brand expansion
adding USAA to TARGET_COMPANIES) and
`tests/test_output.py::test_write_excel_smoke` expects the pre-
New-Product-Launches sheet list. Refresh both to the 13-brand basis. Also:
the checkout's `.venv` didn't survive the repos/ relocation — tests now run
under system Python 3.14 + pip-installed pytest.

## B11 — American Standard (AmFam) UT/GA historical footnote
**Opened:** 2026-07-07 (B9 audit). **Size:** note-only, likely no action.
American Standard Insurance Company of Wisconsin/Ohio (genuine AmFam auto
subs, no brand string in the legal name) appear ONLY in the UT/GA AM Best
cross-check CSVs — **every row 0.0% impact** (immaterial by the WV/NH
precedent). The UT/GA SERFF scrapes had no "american standard" search term,
so any solo filings were never harvested; forward-closed 2026-07-07 (B9-audit
deploy: derive_brand allowlist + GROUP_KW + a TARGET_COMPANIES search term).
Only revisit if a future AmFam cross-check surfaces a MATERIAL
American-Standard-only row in UT/GA.

## B1 — Consolidate the 6 AM Best parsers into one blank-safe shared extractor
**Opened:** 2026-06-15. **Size:** ~1 session. **Gate:** existing harness
(`confirm_blast_radius.py`) + base-column zero-diff + anchor 14/14.

The per-state AM Best parsers (`tools/parse_ambest_{az,ga,mt,nm,nv,ut}.py`) are
near-duplicates and have now had **three** same-family block-extraction bugs
(blank-indicated `0362b02`; UT header-drop `aa4fe36`; blank max/min 2026-06-15).
Each fix is a per-column patch applied to five copies of the same regex —
a recurring liability. Consolidate into ONE tolerant `Disposition Page Data`
table extractor (every numeric column optional/blank-safe; dash normalization
centralized; wrapped-name handling already shared in `ambest_subline.py`),
driven by per-state config (markers, text paths, schema). Ends the
per-character-patch cycle; lets new states reuse a tested extractor.
**Spec:** `tools/AMBEST_PARSER_NOTES.md` (history + rationale).

## B6 — Wrapped-company-name bug in `parse_filing_summary_pdf` (SHARED scrape parser)
**CLOSED 2026-07-07.** Root cause was NOT the name wrap — the row regexes rejected
thousands-comma percentages ("1,830.500%"), so the data line failed every pattern
(silent 0-row / partial / wrong-value extraction). Fixed via `_FS_PCT`
comma-tolerant core + additive shapes H/I/J (`src/utils.py`); gate =
`test_b6_parser_shapes.py` (41 PASS) + a FULL 5,113-PDF old-vs-new parse diff
(5,098 byte-identical, 15 adjudicated diffs) + 7-state gated re-import
(new baseline 2963/1832/551, db `8941a436`). Recovered: IL active Defend
CFPC-134419708 (−4.38%/334k ph), WV wrong-value fix, GA rollup corrections.
Full record: `output/resume_state.md` 2026-07-07.
**Opened:** 2026-06-30 (VT). **Escalated:** 2026-07-01 (AK — 2nd occurrence, now
MATERIAL). **Size:** ~1 standalone session. **Priority:** MEDIUM.
**Gate:** all 17 shipped states' deliverables byte-identical EXCEPT the states
whose wrapped-name rows are newly emitted (re-verify + re-import those).

A Company Rate Information row whose company name wraps to a 2nd line (the numbers
are on the data line; "Insurance Company" is on the next line) yields **0 extracted
rows** + blank disposition/effective — the whole filing drops. **Two occurrences:**
- VT `PRGS-134029613` (2026-06-30): 0.000% / $0 / 0 ph — MAXIMALLY IMMATERIAL →
  dropped (no urgency).
- AK `CFPC-134283900` + `CFPC-133947234` (2026-07-01): **MATERIAL** — Country
  Financial Personal Auto, +9.591%/9,644ph (active Prospect signal) and
  +11.414%/4,486ph. Recovered surgically via `recover_ak_cfpc.py` (targeted
  wrapped-name re-parse of the 2 PDFs, AK-only append, 94→100 rows) per the
  WV Liberty / NH General Insurance material-recovery precedent.

The bug catches MATERIAL filings, not just 0% ones — so it can silently lose real
signal in any state (small regional multi-entity co-files like COUNTRY are the
common shape). **Fix:** patch the wrapped-name extraction in the shared
`parse_filing_summary_pdf` (join a data line with its wrapped continuation before
column-splitting — see the `_DATA` regex + continuation join in
`recover_ak_cfpc.py` for the working approach). Then FULL re-verification: it will
also re-emit VT's 2 immaterial rows (VT deliverable 103→105 → re-verify/re-import
VT) and any other state's wrapped-name filings. DELIBERATE, standalone — NOT
mid-state. Audit shipped states for wrapped-name drops when done.

## Separate issues surfaced 2026-06-15 (NOT the block-drop bug — own fixes)

### B2 — UT date-column mis-assignment (~2-3 rows)
For some UT filings the parsed `effective_date` receives the report's
filing/disposition date instead of the effective date (State Farm
`SFMA-134298166`: parsed AM Best eff `11/26/24` vs our scraped eff
`01/01/2025`), pushing the AM Best row out of the comparison window so it never
matches. Fix `parse_ambest_ut.py` `HDR_RE` date-group assignment; re-compare UT.
Label-only impact (would upgrade ~2-3 UT rows to ambest_cross_checked).

### B3 — GA/HO Safeco "value discrepancy" — RESOLVED 2026-06-15: FALSE ALARM, no deliverable error
Investigated against the cached SERFF PDFs. The 9.9% and 19.6% are **two
DIFFERENT filings** for the same Safeco-of-Indiana HO rate program (same 9/7/25
renewal, same 20,226 policyholders), which the reverse cross-check conflated on
(entity, eff, ph):
- `LBPM-134466356` — **+19.6% impact, WITHDRAWN** (SERFF Status Closed-Withdrawn;
  PDF: "+19.6% overall rate impact"; withdrawn 04/23/25, "a filing will be
  submitted at a later date"). Our capture correct. No AM Best entry (AM Best
  doesn't list withdrawn filings) -> correctly `none`.
- `LBPM-134520474` — **+9.9% impact, ACKNOWLEDGED-as-amended** (amended down from
  18.3%; PDF: "+9.9% overall rate impact"). Our capture correct, and it is a
  **`direct` match to AM Best's 9.9%** in ga_ho_corroboration.
Case **(d)** multi-filing mismatch (withdraw-then-refile pair), with a
disposition-status flavor. NOT case (a)/(b): column assignment is correct
(indicated 23.3 vs impact 19.6/9.9), and the SERFF parser even took the amended
9.9% over the original 18.3%. **Blast radius: zero deliverable rate cells.** The
only footnote is that the reverse-cross-check harness can pair a withdrawn
filing with its refiled successor — a harness-interpretation nuance, not a data
bug. No fix needed.

### B4 — NV Progressive (2 rows) — RESOLVED as genuine absence
`PRGS-134206539` (eff 01/09/2026, −0.094%/−0.034%) is genuinely absent from AM
Best NV; the policyholder count (212,801) coincided with a different Progressive
filing in the raw text, which over-counted the blast-radius harness. Correctly
left as `none`. No action — recorded so it isn't re-flagged.

## B5 — Front-of-batch grace for the 2-consecutive-miss early-stop
**Opened:** 2026-06-24 (OH harvest, burst 6). **Size:** small. **Gate:**
`test_recovery_harvest.py` (add a front-of-batch transient-miss case).

The batch downloader's "2 consecutive misses → end session early" guard can
abort an ENTIRE group when 2 transient row-fetch misses land at the FRONT of
the batch, before the productive bulk + later search terms run. OH burst 6:
State Farm's `state farm` batch hit `GNSC-133748377` + `GNSC-133954835` misses
as filings 1-2 → the guard fired and deferred all 29, never reaching the SFMA-*
bulk or the `mga insurance` term. 0 WAF walls — purely transient front misses
(same family as the GECC-/LBPM- misses that landed clean on retry). Same shape
as the harvest-early mis-ordering bug fixed for VA (judge yield only AFTER all
terms/recovery run). **Fix:** grant a front-of-batch grace window (e.g. don't
arm the consecutive-miss early-stop until N filings have been attempted, or
until at least one later search term has run) so transient front misses can't
abort an otherwise-healthy group. Not blocking — a deferred group is re-attempted
clean on the next burst; this is an efficiency/throughput fix.

## B7 — Root-cause the recurring Temp-checkout purge (Windows wipes the working tree)
**ROOT-CAUSED + RELOCATED 2026-07-08.** Cause CONFIRMED: the checkout lived in
%TEMP% itself, and Windows **Storage Sense** (policy 04 = "delete temporary
files apps aren't using", ENABLED, auto-triggered on low free disk) + the
`SilentCleanup` scheduled task reaped unaccessed working-tree files (`.git`
survived because git ops keep it recently-accessed — explains the selective
pattern; irregular timing = low-disk triggers during disk-heavy sessions).
**Fix: relocated to `C:/Users/ryanc/repos/insurancewebscraper`** (outside
%TEMP%, outside OneDrive). Verified: 9,884 files moved intact, git status
clean, fetch OK, HEAD==origin. Status: **HIGH-CONFIDENCE, confirmed-over-time**
— the trigger is irregular, so the proof is the next disk-heavy session
(harvest / big scan) passing with no strike at the new path. Don't declare
100% closed until then. If purge symptoms EVER recur, check the new path
isn't also being reaped.
**Opened:** 2026-07-07. **Size:** small investigation. **Priority:** LOW-MEDIUM
(mitigated by the restore-from-index procedure, but it keeps recurring).

The insurancewebscraper checkout under `%LOCALAPPDATA%\Temp` has had its working
tree purged ~12 times (tracked files deleted, `.git` survives — most recently
2026-07-06, a NON-harvest session, 1,918 files). Working theory: Windows Storage
Sense / disk-cleanup removes old files under Temp on a schedule. Mitigation in
use: `git checkout -- .` restore + explicit-path staging (NEVER `git add -A`).
**Fix candidates:** (a) move the checkout OUT of Temp to a stable path (then
retire the hazard memory), (b) confirm/exclude Storage Sense as the culprit,
(c) a pre-commit purge-check script. (a) is likely the whole fix.

### B6 residual (ND 2026-07-07, immaterial): row-shape variant "pct pct $0 0 + blank premium-for-program + blank %-only max/min"
ND adjudication of 14 cached-but-0-rows filings (all 14 PDFs read at source):
12/14 genuinely all-blank Company Rate Information ("% % % %" — 10 FARM
Mid-Century quarterly Auto Symbols Updates, 1 FMIN, 1 ALSE credit/symbol
filing) = correct 0, dropped. 2/14 (FMIN-134183412, FMIN-134243214) carry a
populated-but-all-zero row — `0.000% 0.000% $0 0 % %` (premium change $0, ph
0, premium-for-program BLANK, max/min blank-%) — a sibling of shape H
(`$0 $0` blank-ph) that the B6-fixed parser still rejects → 0 rows. BOTH
maximally immaterial (0.000%/$0/0ph, rate-neutral page corrections) →
dropped per the WV/NH/AK materiality rule. Fix additively as shape K next
time the shared parser is touched (test first: both PDFs cached under
output/pdfs/ND/134183412 + 134243214).

## B9 — bare-"farmers" substring mislabeled 13 independent mutuals as Farmers (LIVE in interim; 2nd substring-over-match after Wausau)
**FIXED 2026-07-07 (combined gated import pending).** The ND cross-check's
brand sweep found `derive_brand`'s `"farmers" in name -> Farmers` rule had
**~86 live interim raw rows across 13 independent mutuals** (Farmers Alliance
18 KS/NE/ND/OK/SD, Pekin's "The Farmers Automobile Insurance Association" 18
IN/WI, National Farmers Union P&C 11, Farmers Mutual of Nebraska 10, Indiana
Farmers Mutual 7, American Farmers & Ranchers 6 OK, Tennessee Farmers Mutual
2, + PA/NJ/OK fire mutuals) served as brand=Farmers — the Mutual-of-Wausau
class, but LIVE and uncaught (Wausau was caught by the MA import gate; this
one shipped). The 19 SCRAPED states were clean (0 such rows). ND's scrape
also swept FMN/FAMI (7 deliverable rows incl. material +24.1%/+19.9% —
MISLABELED independents, not Farmers data).
**Fix (both layers, both repos):** importer `_FIG_FARMERS_PATTERNS` explicit
FIG allowlist (21 patterns; "Farmers Insurance Company of <state>" enumerated
because "...of Flemington" is an independent — never wildcard) replacing the
bare substring + independents added to `_AMBEST_EXCLUDE`; scraper
`INDEPENDENT_COMPANY_PATTERNS` (decisive in `carrier_group` — no
target_company fallback; folded into `_is_excluded_subsidiary` for row drops;
deliberately SEPARATE from `EXCLUDED_SUBSIDIARY_PATTERNS`, whose filing-
vehicle entries like Standard Fire keep filing-level classification).
**Gates:** `tests/test_farmers_scope.py` 8/8 PASS;
`scripts/test_brand_mapping.py` ALL PASS (47 cases); full-surface old-vs-new
derive_brand diff over 828 distinct real names (filings_raw + all AM Best
CSVs + deliverables) = exactly the 14 independents Farmers->None, 0
unexpected.
**⚠️ OPEN (the ROOT PATTERN): audit derive_brand/GROUP_KW for OTHER
bare-substring rules that could catch unaffiliated entities** — 2nd
occurrence (Wausau in MA, Farmers in ND). Candidates to audit: "liberty"
(bare! e.g. hypothetical "Liberty Farm Mutual"), "nationwide", "american
family" (guarded once already), "travelers", "country" label fallback. The
828-name current surface shows 0 other mis-maps, but the audit should reason
about FUTURE-state names (the TARGET_COMPANIES-audit precedent). ~1 short
session.

## B7b — OneDrive dehydration exposure of the monorepo HARVEST workspace (PINNED 2026-07-07)
**CLOSED AT ROOT 2026-07-07 (pin).** Surfaced during the ND mid-burst shutoff
assessment: the harvest reads/writes the MONOREPO working copy
(`OneDrive\Desktop\ClaudeCodeTest\Insurance Rate Data Scraper`), which lives
INSIDE OneDrive — and Storage Sense has OneDrive **dehydration enabled with a
30-day threshold** (provider subkey `02=1`, `128=30`; same low-disk trigger as
the B7 Temp purge). Files unopened 30 days would become online-only
placeholders mid-tree. Distinct from B7: B7 relocated the repos/ PUBLISH
checkout out of %TEMP%; this pins the monorepo HARVEST workspace in place.
**Fix: `attrib +p ... /s /d`** (FILE_ATTRIBUTE_PINNED = "Always keep on this
device") on the whole scraper folder — verified 11,203/11,203 cached PDFs
pinned, 0 placeholders, dirs pinned too (new files inherit). Lower severity
than the Temp purge (dehydration deletes nothing — cloud + GitHub both hold
copies; failure mode was mid-harvest stalls/placeholder reads, not loss).
Both protection mechanisms now in place, one per exposure:
repos/ = relocated (B7); monorepo = pinned (B7b).

## B8 — SERFF search paginator glitch on big result sets (3rd occurrence)
**FIXED + LIVE-VERIFIED 2026-07-08.** Root cause was THREE stacked defects in
`src/search.py` plus a missing guard: (1) `_set_rows_per_page_100` swallowed
the RPP-100 AJAX re-render timeout on big result sets -> extraction read the
mid-render emptied tbody -> false clean-ok 0 (the AK/MA signature); (2)
`_click_next_page` bare .click() died on navbar pointer-interception ->
silent partial stop; (3) `_has_next_page` read ui-state-disabled off a stale
mid-render paginator. Fix: re-render completion wait + retry (loud on
failure), scroll+JS-click fallback + data-rk progress verification, a
first-extract-empty re-wait, and the **reconciliation guard** — rows saved
vs the paginator's own "of N" total; any shortfall = ledger outcome
`extract_mismatch_*`, never "ok" (kills the false-clean-0 CLASS, including
unmet future variants). LIVE VERIFY: bare-term MA Travelers captured **206
rows natively** (== the date-slice ground truth; pre-fix the same term
false-0'd twice), 0 paginator warnings, ledger ok. Date-slicing remains
available but is no longer required for big-footprint carriers.
**Opened:** 2026-07-06 (MA). **Size:** small-medium. **Priority:** MEDIUM (it
hides ENTIRE PRESENT BRANDS silently).

A bare company-term search whose result set is large returns **clean-ok with 0
rows saved** (disabled next-page / navbar intercept) — indistinguishable from a
genuine-0 in the ledger. 3 occurrences: AK Travelers (2026-07-01), MA Travelers
(206 raw hidden), MA Nationwide (116 raw hidden — incl. a live +6.1%/4,038ph HO
signal; caught ONLY because AM Best contradicted the 0). **Workaround in use:**
non-overlapping date slices (each slice < ~100 rows renders clean). **Rule until
fixed: a clean-ok 0 for a big-footprint carrier is SUSPECT — date-slice before
accepting.** Fix: detect the disabled-next-page state in search_all and either
fail loudly (status != ok) or auto-slice.

## NOTE — Wausau name-fold duplicate (dissolved in MA, parser nuance recorded)
MA LBPM-133878161 emitted the same entity twice: "Wausau Underwriters" AND
"Wausau Underwriters Insurance Company" (identical values) — the wrapped name
folded in one disposition section but not another, and the first-seen-by-name
dedup treated them as different entities. Dissolved in MA because the Wausau
family became EXCLUDED (Decision 2). If a future filing shows same-tracking
duplicate rows with identical values and prefix-related names, this is the
cause; the fix is name-normalized dedup (prefix-match) in
parse_filing_summary_pdf — SHARED parser, so B6-style full re-verify required.
