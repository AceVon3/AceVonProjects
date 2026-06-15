# AM Best parser — block-extraction bug history & hardening backlog

The per-state AM Best parsers (`tools/parse_ambest_{az,ga,mt,nm,nv}.py`, plus the
separate `parse_ambest_ut.py`) turn extracted PDF text into `tools/ambest_*_data.csv`.
They have now had **three** block-extraction bugs of the same family: a
per-subsidiary `Disposition Page Data` row fails the row regex, and the whole
filing block degrades to a single blank-subsidiary `data_n_a=False` placeholder
row — silently dropping real AM Best entries and producing cross-check FALSE
NEGATIVES (our scraped rows scored `none` though AM Best had the entry).

| # | Date | Bug | Fix |
|---|------|-----|-----|
| 1 | 2026-06-?? `0362b02` | "blank-indicated" — `indicated` column blank (`%`) made the row unparseable | made `(?P<ind>…)?%` optional |
| 2 | 2026-06-11 `aa4fe36` | UT header-drop — starred overall without trailing `%` dropped 6,780/11,996 blocks; also wrapped subsidiary names | `HDR_RE` star-without-% branch; `ambest_subline.py` wrapped-name matcher |
| 3 | **2026-06-15 (this fix)** | **blank max/min** — `maximum %`/`minimum %` columns blank (`… % %`) made the row unparseable; whole two-company blocks dropped (e.g. AZ State Farm `SFMA-134114404`, raw text had both companies + `Approved AZ 04/21/25`, CSV had a blank row) | made `(?P<max>…)?%` / `(?P<min>…)?%` optional in all 5 shared parsers; guarded `None` in extraction; added non-ASCII minus/dash normalization at load |

## This fix (2026-06-15)
Root cause confirmed against raw text: the dropped rows end in blank max/min
(`… $1,481,618,390 % %`); the impact's non-ASCII minus (U+00AD-class) was already
handled by the `[­\-]` class, so the killer was the required-numeric max/min.
- `SUB_LINE_RE` max/min numbers made optional (mirrors the indicated fix).
- `extract_subsidiary_rates` guards `None` max/min.
- Load step normalizes the minus/dash family (`U+00AD U+2010–2015 U+2212`) to
  ASCII `-` before the regexes (defensive; covers minus variants the char class
  would miss).
- Applied to az, ga, mt, nm, nv. UT (`parse_ambest_ut.py`) already handled blank
  max/min + dash normalization; its stale CSV was simply regenerated.

Validated (offline): re-parse → re-compare → `apply_validation_tiers AZ GA`.
**+12 genuine `direct` matches** (AZ State Farm 2; GA Mid-Century/GEICO/Safeco/
Farmers 10), 0 spurious, base-column hashes unchanged (zero rate-cell change),
anchor SFMA-134676753 still 14/14.

## ⚠️ BACKLOG: comprehensive extractor rewrite (recommended)
Three same-family bugs in near-duplicate per-state parsers is a recurring
liability. Each fix is a per-column patch to five copies of the same regex.
Recommend consolidating the 6 parsers into ONE shared block extractor with a
single, tolerant `Disposition Page Data` table parser (every numeric column
optional/blank-safe; dash normalization centralized; wrapped-name handling
already shared in `ambest_subline.py`), driven by per-state config (markers,
text-file paths, schema). This would end the per-character-patch cycle and let
new states reuse a tested extractor. Sizing: ~1 focused session; gate on the
existing harness (`confirm_blast_radius.py`) + base-column zero-diff + anchor.

## Known SEPARATE issues (NOT this bug — do not conflate)
- **UT date-column assignment**: for some UT filings the parsed `effective_date`
  is the report's filing/disposition date, not the effective date (e.g. State
  Farm `SFMA-134298166`: our eff 01/01/2025 vs parsed AM Best eff 11/26/24 →
  out of window, won't match). Own investigation.
- **GA/HO Safeco value discrepancy** (⚠️ possible DELIVERABLE concern, not a
  label issue): AM Best records impact **9.9%** where our scrape has **19.6%**
  on a filing BOTH have (Safeco Insurance Company of Indiana, eff 07/27/25,
  ph 20,226). Because the policyholders + date + entity all agree but the rate
  impact differs ~2x, this could be a SCRAPED-SIDE capture error (SERFF filing-
  summary PDF parser reading the wrong % — e.g. indicated vs impact, or a
  multi-entity/program mismatch) rather than an AM Best curation difference.
  Needs its own investigation: is the 19.6% our mis-capture, AM Best's
  disposed-vs-filed value, or a multi-entity row mismatch? If scraped-side, it
  affects a rate cell in the deliverable. Do NOT fold into the parser fix.
- **4 NV/HO Allstate genuine absences** (Allstate Insurance 27.8%, P&C 10.5%,
  Indemnity 36.2%, eff 12/01/2025): policyholder counts absent from NV raw text
  — real AM Best gap or NV/HO coverage problem. Correctly NOT recovered here.
