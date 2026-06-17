# AM Best interim data path (IL / OH / VA)

States we have AM Best **industry data** for but have **not** directly scraped
yet. They render natively in the app but are backend-tagged `source='ambest_sourced'`
and are cleanly replaceable when scraped. Built 2026-06-16.

## How it flows
1. **Reports → text** — `Insurance Rate Data Scraper/Ambest Reports/*.pdf`
   extracted (pypdf) to `output/ambest_{state}_text_*.txt`.
2. **Parse** — `tools/parse_ambest_generic.py <STATE>` → `tools/ambest_<state>_data.csv`
   (same fixed block-extractor as GA; emits a `block_id` content-hash per filing
   block so page-break repetition collapses and distinct filings stay separate).
3. **Transform + load** — `scripts/import_filings.py` `build_ambest_df()`:
   dedup, window-filter (2024-01-01 → 2026-04-17), in-scope (13-brand mapped
   subsidiary, `Rate`), group entities by `(block_id, brand)` into filings,
   tag `source='ambest_sourced'`, then the SAME premium-weighted rollup.
   - `serff_tracking_number` = **backend-only surrogate** `AMB-<ST>-<PA|HO>-<md5(block_id|brand)[:10]>`
     — block-stable, idempotent (re-import → identical keys), collision-proof
     (block content hash folds in group+eff+disp + the sorted entity
     (impact, policyholders) fingerprint). **NEVER shown to the user** (guarded
     in FilingsTable row title + PositioningCard).
   - `sub_type` = NULL (AM Best is line-level); `rate_activity` = `'rate_change'`
     (AM Best lists only disposed/approved; withdrawn aren't present);
     `disposition_status` = `'Approved'`; `source_pdf` = `"AM Best <ST> interim report"`.
   - A carrier-GROUP block spanning two of our brands (e.g. Liberty Mutual Group
     listing Liberty + Safeco) **splits by brand** into separate filings — the
     app is one-brand-per-filing.

## Guarantees (verified at import)
- Scraped baseline **byte-identical**: `verify()` scopes every scraped invariant
  to `source='serff_scraped'` (1,616 / 998 / 293, +93.70% anchor); non-source
  columns hash unchanged.
- Mixed-source rollup groups **fail loud** (rollup + check 16).
- AM Best rows: `rate_activity` all `rate_change`, `sub_type` all NULL, keys all
  `AMB-`, unique per (key, line) — checks 13–16.

## UI
- Row badge **"AM Best"** (FilingsTable) + `states.ts source:"ambest"` +
  `constants.AMBEST_STATES`. Raw `AMB-` key never rendered.

## Replacement (when a state is directly scraped)
```sql
DELETE FROM filings_raw WHERE state='<ST>' AND source='ambest_sourced';
DELETE FROM filings     WHERE state='<ST>' AND source='ambest_sourced';
```
…then drop `<ST>` from `AMBEST_STATES`, scrape into `all_states_final_rates.xlsx`,
and re-run `import_filings.py` (the scrape imports as `serff_scraped`). The
mixed-source guard + the `source` tag make it a clean swap with no double-count.
Idempotent: re-running the import always regenerates identical AM Best keys.
