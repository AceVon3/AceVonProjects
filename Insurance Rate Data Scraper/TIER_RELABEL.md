# Validation-tier relabel — separating provenance from external validation

**Date:** 2026-06-04 · **Scope:** label/schema columns only, **no rate-value mutation** (verified: 0 rate-value cells changed vs the original 468).

## The bug
`validation_tier` conflated two different things and, worse, claimed an AM Best
check that was never performed per-row:
- It labeled **all 468** original rows `ambest_validated`, implying each had been
  validated against AM Best.
- In reality the per-state cross-checks were **aggregate coverage analyses**
  (directional "did AM Best's N entries appear in ours"), not per-row
  validations — and they didn't cover every state.

## Substantiation investigation (what actually happened)
| State | Artifact | What it actually established |
|---|---|---|
| UT | `compare_ut_ambest.py`, `ut_ambest_compare_summary.txt` | **Tier-1 direct (subsidiary+eff_date+impact) = 0**; 11/21 via *date-relaxed* match (eff date did NOT agree). Coverage, not per-row validation. |
| OR/AZ/MT/NV | `compare_*_ambest.py`, `ambest_*_text.txt` | Aggregate match rates (e.g. NV 28/33 PPA, 5/8 HO); directional; matched a *subset*. |
| WA | `ambest_wa_ppa_text.txt` | 12/14 coverage; no per-row validation record. |
| ID | `reconcile_id_ambest.py`, `reconcile_id_ambest.txt` | Presence-only — every entry says `[no rate_changes row — cannot compare values]`. |
| **CO** | **none** | **No AM Best cross-check at all.** |

**The only documented per-row, all-field AM Best Disposition Page Data match is
the anchor `SFMA-134676753`** (14/14 — asserted every ID emit by
`run_final_rates.verify_anchor`). Nothing else substantiates a per-row
"validated" claim.

## Value diff (re-collection vs original 468)
The 2024 back-extension re-collected every state on the fixed nav path. Diffing
all 468 original rows against their pre-extension values (impact/indicated
±0.1%; policyholders/eff/disposition exact): **468/468 unchanged, 0 moved, 0
missing** — including the anchor. So no row is demoted for value drift; the
relabel rests entirely on substantiation.

## Decision rule
A row keeps an external **`validated`** claim **only if** (a) its validation is
*documented per-row* **and** (b) its re-extracted values match the
originally-validated values within tolerance. Never-substantiated **or**
value-changed → cannot claim validated.

## New schema (two orthogonal fields; `validation_tier` re-derived)
- **`source`** — provenance, always true: `original` (in the pre-extension 468)
  | `extension` (added by the 2026-06-02 back-extension).
- **`external_validation`** — external AM Best state:
  - `validated` — documented per-row all-field match, value unchanged → **the anchor only**.
  - `unvalidatable` — back-extension rows inside the AM Best window that
    *postdate* the cross-checks (the 19 window rows; no AM Best export covers them).
  - `unvalidated` — everything else (eff-2024, and the originals whose
    "validated" claim is unsubstantiated).
- **`validation_tier`** — kept for app compatibility, **re-derived 1:1** from
  `external_validation`: `validated→ambest_validated`,
  `unvalidatable→ambest_window_unmatched`, `unvalidated→pipeline_only`. It no
  longer asserts provenance — use `source` for that.

## Outcome
**Original 468 `ambest_validated` → 2 held, 466 demoted** (all for
`unsubstantiated`; **0** for value-change).

Held (`validated`):
- ID `SFMA-134676753` — State Farm Fire and Casualty Company
- ID `SFMA-134676753` — State Farm Mutual Automobile Insurance Company

Demoted per state (466): ID 51, WA 34, CO 97, OR 47, UT 84, AZ 77, MT 25, NV 51.

### Full distribution — `source` × `external_validation` (sums to 1,005)
| source \ external_validation | validated | unvalidatable | unvalidated | total |
|---|--:|--:|--:|--:|
| original | 2 | 0 | 466 | 468 |
| extension | 0 | 19 | 518 | 537 |
| **total** | **2** | **19** | **984** | **1,005** |

Per-row old→new labels for every row: `output/tier_relabel_audit.csv`.

## Honest one-line summary
Of 1,005 rows, **2** are externally AM Best-validated (the anchor), **19** are
unvalidatable (postdate the cross-checks), and **984** are unvalidated. The
dataset is a SERFF-sourced, pipeline-extracted collection; it is **not** an
AM Best-validated dataset beyond the single anchor.
