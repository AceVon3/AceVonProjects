# AM Best data path (interim + permanent)

States we have AM Best **industry data** for. They render natively in the app,
backend-tagged `source='ambest_sourced'` (no UI badge, zero-trace API). Two
flavors, both loaded by the identical pipeline:

- **Interim** — not yet directly scraped, but on SERFF Public Access, so they are
  cleanly **replaceable** when scraped. `AMBEST_STATES` minus `AMBEST_PERMANENT_STATES`.
- **Permanent** — **not** on SERFF Public Access (the state runs its own non-SERFF
  system, e.g. CA / CDI). They can **never** be replaced by a normal scrape, so
  they are AM Best-sourced for good. `AMBEST_PERMANENT_STATES` (currently
  `["CA"]`). They must NOT be presented as "interim / awaiting scrape"
  and must NEVER be swept by the replacement path below.

> **PERMANENT-DOCTRINE UNWIND (2026-07-28/30).** NY and TX sat on the permanent
> list from regulatory-structure inference alone ("NY/DFS, TX/TDI run their own
> systems") — never probed. 2026-07-28 probes proved **both live on SERFF Filing
> Access**; both were fully scraped (NY 324/324 targets, TX 701/701) and imported
> as the 45th/46th scraped states on 2026-07-30, replacing their `ambest_sourced`
> rows via the standard replacement path. FL probed ZERO filings (true non-SERFF —
> OIR I-File) but was never AM Best-loaded. **CA is the only remaining permanent
> state**, and its non-SERFF status (CDI) is structural fact. Lesson: "permanent"
> requires a probe, not an org-chart inference.

Coverage (35 AM Best states):
- IL, OH, VA — interim (built 2026-06-16).
- AK, AR, CT, DE, HI, IA, IN, KS, KY — interim (10-state batch, 2026-06-17).
- ME, MD, MA, MI, MN, MS, MO, NE, NH, NJ, ND, OK, PA, RI, SC, SD, TN, VT, WV, WI
  — interim (22-state batch, 2026-06-17).
- **CA — permanent** (non-SERFF: CA/CDI).
- ~~NY, TX~~ — were listed permanent; probed live on SERFF 2026-07-28, scraped +
  imported 2026-07-30 (45th/46th states) — see the doctrine-unwind note above.

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

## PROGRAM COMPLETE — the full doctrine unwind (2026-08-03)

**Every AM Best state has been replaced by a direct scrape. `AMBEST_STATES`
and `AMBEST_PERMANENT_STATES` are both EMPTY; the import loads zero
`ambest_sourced` rows.** This document is now a historical record of the
interim program (2026-06-16 → 2026-08-03) and the pipeline is retained only
for a hypothetical future re-use.

The "permanent" class died in three probes:
- **NY + TX (2026-07-28)**: listed permanent from regulatory-structure
  inference alone; single probes proved both live on SERFF Filing Access.
  Scraped + imported 07-30 (45th/46th states).
- **CA (2026-08-03)**: the founding member — the state the CA-landmine
  warning above was written about — fell the same way. CDI's own
  viewing-room page states P&C filings are public on SFA (SERFF e-filing
  mandatory since 2015). Probed, fully collected (726-filing universe,
  252/252 targets), and imported as the 47th state IN ONE DAY. The 66
  ambest_sourced CA rows were retired by the state-scoped replacement
  (6089 − 66 + 63 scraped rollups = 6086, exact).

Postmortem (upgraded from the NY/TX lesson): **"permanent" requires a probe,
not an org-chart inference — and the probe costs one afternoon.** Nothing may
ever be tagged permanent again without one.

CA-specific successor doctrine: CA is prior-approval, so the PDF-parsed filed
% is not always the customer-facing outcome. The CDI "Rate Filing Approvals"
closed-lists (scraper `tools/cdi_closed_lists/`, refreshed from
insurance.ca.gov) carry requested AND approved %; `b23_apply_ca_cdi.py`
applies the arbitration overlay (approved-value overrides + CDI-only
supplements) after every CA harvest — the TDI-for-TX standing-audit pattern.

Remaining coverage gaps (NOT AM Best matters): FL (OIR I-File, probed zero
SERFF filings), NC (NCRB rate bureau), WY (structurally empty; ships 0 rows).
