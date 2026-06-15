# Backlog

Tracked-but-deferred work. Each item: rationale + spec pointer + sizing.

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
