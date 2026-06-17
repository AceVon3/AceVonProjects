# AM Best data path (interim + permanent)

States we have AM Best **industry data** for. They render natively in the app,
backend-tagged `source='ambest_sourced'` (no UI badge, zero-trace API). Two
flavors, both loaded by the identical pipeline:

- **Interim** — not yet directly scraped, but on SERFF Public Access, so they are
  cleanly **replaceable** when scraped. `AMBEST_STATES` minus `AMBEST_PERMANENT_STATES`.
- **Permanent** — **not** on SERFF Public Access (the state runs its own non-SERFF
  system, e.g. CA / CDI). They can **never** be replaced by a normal scrape, so
  they are AM Best-sourced for good. `AMBEST_PERMANENT_STATES` (currently
  `["CA", "NY", "TX"]`). They must NOT be presented as "interim / awaiting scrape"
  and must NEVER be swept by the replacement path below.

Coverage (35 AM Best states):
- IL, OH, VA — interim (built 2026-06-16).
- AK, AR, CT, DE, HI, IA, IN, KS, KY — interim (10-state batch, 2026-06-17).
- ME, MD, MA, MI, MN, MS, MO, NE, NH, NJ, ND, OK, PA, RI, SC, SD, TN, VT, WV, WI
  — interim (22-state batch, 2026-06-17).
- **CA, NY, TX — permanent** (non-SERFF: CA/CDI, NY/DFS, TX/TDI). NY/TX flagged
  from regulatory structure, not a SERFF probe — confirm if scraping them is ever
  considered (not load-blocking).

Interim states are "interim" on the *assumption* they're SERFF-PA; that has
**not** been portal-probed (quiet period). Conservative-safe tagging: when
unsure, prefer permanent — mis-tagging a scrapeable state permanent only means
"revisit manually"; mis-tagging a non-scrapeable state interim lets the
replacement sweep delete it with no replacement (the CA landmine).

**Excluded — do not re-attempt from this source:**
- AL, FL, LA — header-only exports (no disposition data). A re-pull WITH the
  disposition supplement is the fix. (FL is also non-SERFF.)
- **NC — STRUCTURAL, not fixable here.** NC rates auto/home through the NC Rate
  Bureau (NCRB) collectively, so AM Best has no per-carrier disposition data
  (68.1% Data-N/A → only 26 thin filings). A re-pull will NOT help. NC is **not**
  on any re-pull list; if it ever matters it needs a different source (NCRB
  direct or another vendor), not this AM Best export.

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
- **No row badge / no visual marker** — AM Best provenance is BACKEND-ONLY
  (FilingsTable + PositioningCard guard it; the API strips the `AMB-` surrogate
  key from the payload — zero-trace). `states.ts source:"ambest"` +
  `constants.AMBEST_STATES` drive coverage only.
- Methodology page is the one public surface that names the AM Best states,
  split into interim vs. permanent (CA) — it does not misrepresent CA as
  "awaiting scrape".

## Replacement (when an INTERIM state is directly scraped)
**Only for interim states. NEVER run this for a state in `AMBEST_PERMANENT_STATES`
(CA) — it isn't getting scraped, so sweeping it would just delete real data.**
```sql
DELETE FROM filings_raw WHERE state='<ST>' AND source='ambest_sourced';
DELETE FROM filings     WHERE state='<ST>' AND source='ambest_sourced';
```
…then drop `<ST>` from `AMBEST_STATES` (in both `import_filings.py` and
`constants.ts`), scrape into `all_states_final_rates.xlsx`, and re-run
`import_filings.py` (the scrape imports as `serff_scraped`). The mixed-source
guard + the `source` tag make it a clean swap with no double-count. Idempotent:
re-running the import always regenerates identical AM Best keys.
