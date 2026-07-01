"""AK universe-completion sweep — searches only, the walled terms + Allstate de-cap.

Recovers the AK first-sweep gaps (2026-07-01 cold sweep walled a 5-term cluster
mid-run after ~13-14 clean Begin-Searches; today's HI harvest partially depressed
the cold ceiling). The gaps:

  WALLED (begin_search_link_timeout — NOT genuine absence, must retry):
  - USAA  -> CRITICAL. A PRESENT brand (AM Best AK: 8 in-target, 4 PPA + 4 HO).
    The bare "USAA" term walled before capture; currently 0. MUST come back with
    results; if still walled on a clean retry, that's a wall not an absence.
  - United Services, Garrison -> USAA family (co-filed w/ USAA in most states).
  - MGA Insurance -> State Farm sub, walled.
  - Farmers -> AM Best AK 0 (absent). Confirm clean-0 ON RETRY (the IL
    Truck-Ins-Exch lesson: a walled-0 is not absence).
  - Travelers -> AM Best AK 0 (absent) AND had a paginator glitch on the first
    sweep (disabled next-page + navbar intercept -> 0 saved). Confirm clean-0.

  100-CAP (page-1 cap, NOT absence — paginate past via date slices):
  - Allstate returned EXACTLY 100 raw (44 in-target) on the full window. Re-search
    in 3 non-overlapping date slices so each returns < 100, capturing the full
    Allstate in-target beyond the visible 44.

Ordered high-value first (USAA family, then Allstate slices, then the rest) so an
early WAF wall still banks the critical captures. Writes
output/ak_universe_completion_retry.xlsx (merge with merge_ak_search.py). Diag
ledger armed for the 2nd-contact cold read. No detail/date fetches.
"""
from __future__ import annotations
from pathlib import Path

from src.config import OUTPUT_DIR
from src.output import write_excel
import src.search as search_mod
from src.search import search_all
from src.quiet_period import guard

guard("run_search")  # refuse during a declared SERFF rest window

search_mod.DIAG_DIR = Path("output/serff_diagnostics")
print(f"[ak-completion] diagnostics armed -> {search_mod.DIAG_DIR}", flush=True)

out = Path(OUTPUT_DIR) / "ak_universe_completion_retry.xlsx"
accumulated: list = []


def _checkpoint(so_far):
    # so_far is the current phase's filings; persist the running union each time.
    merged = {f.filing_id: f for f in accumulated}
    for f in so_far:
        merged.setdefault(f.filing_id, f)
    write_excel(list(merged.values()), out)
    print(f"    [checkpoint] saved {len(merged)} filings -> {out}", flush=True)


# --- Phase 1: the walled terms (USAA family first — the critical present brand) ---
WALLED_TERMS = [
    "USAA",                 # CRITICAL present brand (AM Best 8 in-target) — walled
    "United Services",      # USAA family
    "Garrison",             # USAA family
    "MGA Insurance",        # State Farm sub — walled
    "Farmers",              # AM Best 0 — confirm clean-0 on retry
    "Travelers",            # AM Best 0 + paginator glitch — confirm clean-0
]
pairs = [("AK", t) for t in WALLED_TERMS]
print(f"[ak-completion] Phase 1: {len(pairs)} walled terms vs AK; dates OFF; out={out}", flush=True)
phase1 = search_all(pairs, checkpoint_cb=_checkpoint, fetch_submission_dates=False)
for f in phase1:
    if f.filing_id not in {a.filing_id for a in accumulated}:
        accumulated.append(f)
print(f"[ak-completion] Phase 1 done: {len(phase1)} raw rows", flush=True)

# --- Phase 2: Allstate 100-cap de-cap via 3 non-overlapping date slices ---
ALLSTATE_SLICES = [
    ("07/01/2023", "12/31/2024"),
    ("01/01/2025", "09/30/2025"),
    ("10/01/2025", "04/17/2026"),
]
for df, dt in ALLSTATE_SLICES:
    print(f"[ak-completion] Phase 2: Allstate slice {df} -> {dt}", flush=True)
    slice_rows = search_all([("AK", "Allstate")], checkpoint_cb=_checkpoint,
                            fetch_submission_dates=False, date_from=df, date_to=dt)
    n = 0
    for f in slice_rows:
        if f.filing_id not in {a.filing_id for a in accumulated}:
            accumulated.append(f)
            n += 1
    print(f"[ak-completion]   slice {df}->{dt}: {len(slice_rows)} raw, +{n} new distinct", flush=True)

write_excel(accumulated, out)

print("\n=== Summary (raw rows by target_company) ===", flush=True)
by_group: dict[str, int] = {}
for f in accumulated:
    by_group[f.target_company] = by_group.get(f.target_company, 0) + 1
for company, n in sorted(by_group.items()):
    print(f"  {company}: {n}", flush=True)
print(f"Total distinct: {len(accumulated)} rows -> {out}", flush=True)
