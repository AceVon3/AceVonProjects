# OH resume state — 2026-06-15 (search-phase partial, walled)

## ⚠️ SEPARATE from VA — VA is parked at 165/498, do NOT disturb it

OH is its own state. VA's parked progress (165/498 cached, universe complete,
resume via `run_final_rates.py VA`) must stay untouched. See
`output/resume_state.md` for VA. OH and VA share the same IP-keyed SERFF WAF
budget — capacity is global, so OH's load and VA's resume draw on the same pool.

## OH MID-SEARCH STATE (the resume target)

- **Universe: PARTIAL — 14 of 19 carrier keywords captured, 718 raw rows**
  (`output/oh_all_companies_search.xlsx`), **no submission dates** (swept with
  `--no-dates` to minimize WAF exposure; ship-safe blank per GA/VA precedent,
  backfillable via `backfill_submission_dates.py OH`).
- **Captured (14):** State Farm 58, GEICO 70, Progressive 34, Allstate 100,
  Travelers 100, Liberty Mutual 100, Safeco 25, Encompass 11, MGA Insurance 9,
  USAA 23, United Services 22, Garrison 34, Farmers 119, Mid-Century 13.
  (Allstate/Travelers/Liberty Mutual hit the 100-row results cap — may be
  undercounted; re-search or paginate to confirm completeness.)
- **MISSING (5 keywords, walled before capture):** Fire Insurance Exchange,
  Truck Insurance Exchange (both Farmers sub-exchanges), **Nationwide,
  American Family, Country** (3 distinct brands entirely absent). Resume must
  recover these.
- **No PDFs downloaded** (`output/pdfs/OH/` does not exist) — the download
  phase was never started; the search phase walled first. PDFs banked: 0.

## THE WAF READING (2026-06-15 — 4th capacity data point)

- **Date-free Begin-Search sweep: 14 clean, then the wall** — #15 Fire
  Insurance Exchange `results_timeout` (200), #16 Truck Insurance Exchange +
  #17 Nationwide `begin_search_link_timeout` (405). **Identical 405 signature
  to VA** — same WAF mechanism, not state-specific.
- **Capacity comparison:** VA overnight 8 / VA 72h 17 / **OH 14**. OH's 14 was
  achieved AFTER today's VA download session (~33 searches) + OH's first dated
  run (5 searches) — i.e., from an already-loaded shared budget, NOT a fresh
  multi-day rest. Consistent with the IP-keyed accumulated-penalty model: OH
  did not wall harder than VA despite being a different/larger state.
- An earlier OH run WITH date-fetch enabled was stopped: it ground per-row
  detail fetches (Travelers 178 rows, 66+ "could not open detail") for the
  low-value submission_date. `--no-dates` flag added (run_search.py +
  search_all/search_company) to make universe sweeps cheap. USE `--no-dates`
  for all future universe sweeps.

## RESUME SEQUENCE (in order)

1. **Rest SERFF multi-day** (shared budget — rest covers VA + OH load).
2. `python run_search.py --state OH --all-companies --no-dates --diag
   output/serff_diagnostics --out-suffix _retry` — recover the missing 5
   keywords (Fire/Truck Insurance Exchange, Nationwide, American Family,
   Country) + re-confirm the 100-capped carriers. Merge into the universe
   (build an OH analog of `merge_va_search.py`, or union manually).
3. `python run_final_rates.py OH` — batched downloads (harvest-early: take the
   high-leverage first 2-3 batches, STOP before the per-target fallback
   regime; do not grind the wall).
4. Parse + AM Best cross-check (`compare_oh_ambest.py`, needs OH AM Best report
   staged, PPA + HO) per CROSS_CHECK_STANDARD.md.

## Standing notes

- Exclusions live (`EXCLUDED_SUBSIDIARY_PATTERNS`): american-family-home +
  american-modern; watch AMMH-* at parse (American Family group not yet
  captured for OH — collision check pending).
- `build_all_states.py` does NOT list OH yet — add it only when
  `oh_final_rates.xlsx` exists (mid-collection staging pattern).
