# Validation relabel — four-tier external_validation (honest evidence gradient)

**Dates:** 2026-06-04 (separate provenance from validation) → 2026-06-08 (refine
to a four-tier evidence gradient with per-row corroboration). **Label/schema
columns only — 0 rate-value cells changed** (verified across all 1,005 rows).

## The problem
The original dataset labeled all 468 rows `ambest_validated`, implying each was
validated against AM Best. Investigation showed the per-state cross-checks were
**aggregate coverage analyses, not per-row validations** (UT Tier-1 direct = 0,
all date-relaxed; ID `reconcile` was presence-only; CO had no cross-check at
all). A binary validated/unvalidated then *under*-corrects, lumping a row that
matched AM Best on subsidiary+eff+impact together with a CO row never checked.

## Four-tier scheme (ordinal evidence gradient)
`external_validation`, with `source` orthogonal (provenance, always true) and
`validation_tier` a coarse app-compat alias.

| `external_validation` | meaning | count |
|---|---|--:|
| `field_validated` | documented all-field per-row AM Best match (the `SFMA-134676753` anchor, value unchanged) | **2** |
| `ambest_cross_checked` | matched an AM Best entry on subsidiary + impact (+ eff_date or policyholders); per-row record in `output/corroboration/`. `match_strength` records direct/date_relaxed/reclassified | **134** |
| `pipeline_extracted_in_validated_window` | eff ≥ 2025-01-01 in a cross-checked state (AZ/MT/NV/OR/UT/WA), not individually matched | **202** |
| `pipeline_extracted` | CO (no cross-check), ID non-anchor, all eff-2024 extension | **667** |

`match_strength` (for `ambest_cross_checked`): `direct` (subsidiary+eff_date+impact
agree) / `date_relaxed` (subsidiary+impact+policyholders agree, eff differs) /
`reclassified` (agree but our row in a different sub-TOI). `field` for the anchor.

## Decision rules (per your sign-off)
1. **CO eff≥2025 (97) → `pipeline_extracted`** — no cross-check existed.
2. **ID non-anchor in-window (51) → `pipeline_extracted`** — only the 2 anchor
   rows are `field_validated`; ID's `reconcile` was presence-only.
3. **WA (12 documented matches) → `pipeline_extracted_in_validated_window`** —
   no reusable artifact built; documented 12/14 only. **Limitation noted.**
4. `ambest_cross_checked` includes `date_relaxed`/`reclassified`, but
   `match_strength` distinguishes them so soft corroboration (UT) is visible.

## Original vs extension (the matches did NOT inflate via the extension)
| source | field_validated | ambest_cross_checked | in_window_unmatched | pipeline_extracted | total |
|---|--:|--:|--:|--:|--:|
| **original** | 2 | **128** | 189 | 149 | 468 |
| **extension** | 0 | **6** | 13 | 518 | 537 |
| **total** | **2** | **134** | **202** | **667** | **1,005** |

Of the 134 cross-checked, **128 are original-468, 6 are extension-recovered**
(rows the back-extension added that genuinely matched AM Best). **130 of the
original 468 carry external corroboration** (2 field + 128 cross-checked).

## Per-state × per-tier
| st | field_validated | cross_checked | in_window_unmatched | pipeline | total |
|---|--:|--:|--:|--:|--:|
| AZ | 0 | 29 | 48 | 102 | 179 |
| CO | 0 | 0 | 0 | 191 | 191 |
| ID | 2 | 0 | 0 | 110 | 112 |
| MT | 0 | 19 | 6 | 32 | 57 |
| NV | 0 | 39 | 26 | 44 | 109 |
| OR | 0 | 29 | 18 | 84 | 131 |
| UT | 0 | 18 | 66 | 58 | 142 |
| WA | 0 | 0 | 38 | 46 | 84 |

## match_strength breakdown (ambest_cross_checked)
| state | direct | date_relaxed | reclassified |
|---|--:|--:|--:|
| AZ | 25 | 4 | 0 |
| OR | 29 | 0 | 0 |
| MT | 18 | 1 | 0 |
| NV | 28 | 7 | 4 |
| **UT** | **0** | **17** | **1** ← mostly date_relaxed (soft) |
| **overall** | **100** | **29** | **5** |

## Honest one-liner
> Of 1,005 rows: **2 field-validated** (anchor), **134 AM Best cross-checked**
> (100 direct / 34 date-relaxed+reclassified), **202 in a validated window but
> not individually matched**, **667 pipeline-extracted** (CO, ID non-anchor, all
> 2024). **130 of the original 468 carry external corroboration.** A
> SERFF-sourced, pipeline-extracted collection — corroborated where shown,
> honest where not.

## Mechanics
- Per-row corroboration emitted by each `compare_{state}_ambest.py` via
  `crosscheck_artifact.py` → `output/corroboration/{state}_{line}_corroboration.csv`.
- Earned tier applied by `apply_validation_tiers.py` (post-cross-check).
- `run_final_rates.py` emits base labels; `validation_tier` coarse alias:
  `field_validated`/`ambest_cross_checked` → `ambest_validated`, else `pipeline_only`.
- Going forward, new states earn tiers at ingestion per `CROSS_CHECK_STANDARD.md`.
