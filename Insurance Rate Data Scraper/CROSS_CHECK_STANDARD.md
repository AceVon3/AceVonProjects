# AM Best cross-check standard (governs all states added after 2026-06-08)

Purpose: new states earn their validation tier with a re-derivable per-row
record — fixing the original gap where aggregate match rates (e.g. UT 19/19)
could not be reconstructed because no per-row artifact existed.

This standard does **not** alter the existing 1,005 rows (they keep their honest
relabel). It governs every state ingested from now on.

## 1. Per-row corroboration artifact (required)
Every `compare_{state}_ambest.py` MUST emit `output/corroboration/{state}_{line}_corroboration.csv`
via the shared helper `crosscheck_artifact.write_corroboration` — one row per
**our** in-scope row:

| column | meaning |
|---|---|
| `state` | two-letter state |
| `line` | `PPA` or `HO` |
| `our_serff_tracking_number` | our filing tracking # |
| `our_subsidiary` | our row's company_name |
| `our_effective_date`, `our_impact`, `our_policyholders` | our values |
| `matched_ambest_subsidiary` | the AM Best entry matched (blank if none) |
| `ambest_effective_date`, `ambest_impact`, `ambest_policyholders` | AM Best values |
| `agreed_subsidiary` / `agreed_impact` / `agreed_eff_date` / `agreed_policyholders` | per-field TRUE/FALSE |
| `match_strength` | `direct` \| `date_relaxed` \| `reclassified` \| `none` |

`match_strength` taxonomy:
- **direct** — subsidiary + effective_date + impact all agree (the bar).
- **date_relaxed** — subsidiary + impact + policyholders agree, effective_date does not.
- **reclassified** — subsidiary + impact + policyholders agree but our row sits in a
  different sub-TOI bucket than AM Best's classification.
- **none** — no AM Best entry matched this row.

A companion `output/corroboration/{state}_missing.csv` records AM Best in-scope
entries with no match in our data (coverage gaps).

## 2. Target tier
- Normal bar: **`ambest_cross_checked`** with `match_strength=direct`.
- **`field_validated`** (all-field per-row, e.g. the SFMA-134676753 anchor) is
  reserved for a deliberate per-state anchor spot-check (1–2 filings) — not
  attempted for every row; the marginal evidence isn't worth the effort.

## 3. Both lines, every state
Pull BOTH the **PPA** and **Homeowners Multi-Peril** AM Best reports and run the
cross-check on each. PPA-only validation hides HO-specific bugs (the AZ
`NEW_PRODUCT_RE` HO false-positive proved this). **HO rows in a state without an
HO cross-check stay in `pipeline_extracted_in_validated_window` (or lower) —
they do not get `ambest_cross_checked`.**

## 4. Report the strength split
Each new state's cross-check reports `direct / date_relaxed / reclassified /
none` counts per line. **Flag** any state that is mostly `date_relaxed` (as UT
was 100%) — softer corroboration, must stay visible, never buried inside an
undifferentiated `ambest_cross_checked` bucket. `match_strength` is recorded
per row precisely so this stays auditable.

## 5. Earned tier at ingestion
When a state is added: pull both AM Best reports → run `compare_{state}_ambest.py`
(emits the artifacts) → matched rows receive `external_validation =
ambest_cross_checked` (or `field_validated` for anchors) with `match_strength`
copied from the corroboration CSV, at ingestion. Unmatched in-window rows →
`pipeline_extracted_in_validated_window`; eff-2024 / no-cross-check →
`pipeline_extracted`. Never retro-guessed.

## Ingestion checklist (new state)
- [ ] Pull AM Best PPA report → `tools/ambest_{state}_ppa.csv`
- [ ] Pull AM Best Homeowners Multi-Peril report → `tools/ambest_{state}_ho.csv`
- [ ] Run `compare_{state}_ambest.py` (uses `crosscheck_artifact`) for both lines
- [ ] Review `output/corroboration/{state}_*_corroboration.csv` + strength split
- [ ] Apply earned `external_validation` + `match_strength` to the state's rows
- [ ] Report: matched/total per line, direct/date_relaxed/reclassified split,
      any mostly-date_relaxed flag, HO coverage

## Standing per-refresh audits (added 2026-08-10 — run at EVERY data refresh)

The AM Best pipeline above is retired (all states scraped). These are the
live standing audits; run all three during every refresh's judgment day:

1. **CDI CA closed-list arbitration** (prior-approval state — the APPROVED
   number is the product). Download the latest YTD xlsx from
   https://www.insurance.ca.gov/0250-insurers/0800-rate-filings/0100-rate-filing-lists/rate-filing-approvals/
   into `tools/cdi_closed_lists/`, diff new rows vs the prior snapshot,
   filter in-brand personal lines, and for any approved % that differs from
   our parsed filed % add a value_override (or supplement) to
   `output/ca_cdi_overlay.json`, then run `b23_apply_ca_cdi.py` (idempotent,
   run after EVERY CA harvest regardless). Watch list rides here: pending-
   with-waiver filings (2026-08: 3 SF HO — 17/9.3/32.8%, one 1.22M ph).
2. **TDI TX census** (suppression/recency audit). Fresh pull of
   https://data.texas.gov/resource/iubg-btfs.json ($limit=50000), compare
   in-brand/in-window nonzero-% rows vs our TX universe by SERFF id; any
   material absent row is a harvest gap to chase.
3. **B24 pending-disposition recheck** (see BACKLOG.md B24): pending-status
   filings freeze at scrape time — sideline their cached filing_summary.pdf
   pre-burst so the refresh re-pulls current dispositions. Triage GA's
   2024-era pendings first (likely permanent no-disposition practice).
