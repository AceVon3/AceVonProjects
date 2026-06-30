"""HI universe-completion sweep — searches only, --no-dates, the 6 walled terms.

Recovers the HI partial-sweep gaps (2026-06-30 first sweep walled after 19 clean
Begin-Searches; the tail 6 terms hit 405 timeouts, NOT genuine absence):
  - Farmers: a REAL HI brand (1 PPA in AM Best HI) -> expect results on a clean
    retry. The bare "Farmers" term walled before capture.
  - Mid-Century, Fire Insurance Exchange, Truck Insurance Exchange: the Farmers
    family. Capture any in-target, OR confirm clean-0 ON RETRY (the IL
    Truck-Ins-Exch lesson: a walled-0 is not absence; even a clean-0 needs
    retry-verification before accepting as genuine HI absence).
  - United Services, Garrison: the USAA family. USAA's 15 in-target likely
    already co-cover these (co-filed), but a WALL is not a confirm -> retry.

Ordered high-value first (Farmers + family, then USAA subs) so an early WAF wall
still banks the important captures. Writes output/hi_universe_completion_retry.xlsx
(separate workbook; merge into the universe after with merge_hi_search.py). Diag
ledger armed for the 2nd-contact cold-capacity read. No detail/date fetches.

100-cap check: if any retried term returns exactly 100 raw, paginate past (the
Travelers/IL pattern) via a date-windowed follow-up.
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
print(f"[hi-completion] diagnostics armed -> {search_mod.DIAG_DIR}", flush=True)

# High-value first: the real HI Farmers brand + its family, then the USAA subs.
TERMS = [
    "Farmers",                   # REAL HI brand (1 PPA AM Best) — walled before capture
    "Mid-Century",               # Farmers family
    "Fire Insurance Exchange",   # Farmers family
    "Truck Insurance Exchange",  # Farmers family (confirm clean-0 vs capture)
    "United Services",           # USAA family (likely co-covered by USAA's 15)
    "Garrison",                  # USAA family
]
pairs = [("HI", t) for t in TERMS]

out = Path(OUTPUT_DIR) / "hi_universe_completion_retry.xlsx"
print(f"[hi-completion] {len(pairs)} terms vs HI; dates OFF; out={out}", flush=True)


def _checkpoint(so_far):
    write_excel(so_far, out)
    print(f"    [checkpoint] saved {len(so_far)} filings -> {out}", flush=True)


filings = search_all(pairs, checkpoint_cb=_checkpoint, fetch_submission_dates=False)
write_excel(filings, out)

print("\n=== Summary (raw rows by target_company) ===", flush=True)
by_group: dict[str, int] = {}
for f in filings:
    by_group[f.target_company] = by_group.get(f.target_company, 0) + 1
for company, n in sorted(by_group.items()):
    print(f"  {company}: {n}", flush=True)
print(f"Total: {len(filings)} rows -> {out}", flush=True)
