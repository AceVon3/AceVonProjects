"""Step 4 checkpoint runner: search-only scrape for a single (state, company) pair.

Writes results to output/{state}_{company}_search.xlsx. Use --all to run the
full matrix of TARGET_COMPANIES x STATES (deferred until the single-pair run
is validated).

    ./.venv/Scripts/python.exe run_search.py                     # State Farm / WA
    ./.venv/Scripts/python.exe run_search.py --company GEICO     # GEICO / WA
    ./.venv/Scripts/python.exe run_search.py --all               # every target x state

Incremental back-fill (fetch only a new submission slice into a separate
workbook, then merge):
    run_search.py --all-companies --state WY \
        --date-to 06/30/2024 --out-suffix _backfill2024
"""
from __future__ import annotations

import argparse
from pathlib import Path

from src.config import DATE_FROM, DATE_TO, OUTPUT_DIR, STATES, TARGET_COMPANIES
from src.output import write_excel
from src.search import search_all


def _slug(s: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in s.lower()).strip("_")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--state", default="WA")
    ap.add_argument("--company", default="State Farm")
    ap.add_argument("--all", action="store_true", help="Run every TARGET_COMPANY x STATE pair")
    ap.add_argument("--all-companies", action="store_true",
                    help="Run all TARGET_COMPANIES against --state (default WA)")
    ap.add_argument("--date-from", default=DATE_FROM,
                    help=f"Submission-window start MM/DD/YYYY (default config {DATE_FROM})")
    ap.add_argument("--date-to", default=DATE_TO,
                    help=f"Submission-window end MM/DD/YYYY (default config {DATE_TO})")
    ap.add_argument("--out-suffix", default="",
                    help="Suffix appended to the output filename stem (e.g. _backfill2024) "
                         "so an incremental slice does not overwrite an existing workbook")
    ap.add_argument("--diag", default="",
                    help="Arm src.search.DIAG_DIR at this path: one search_ledger.csv row "
                         "per Begin-Search + snapshot dir on failure (WAF watch)")
    ap.add_argument("--no-dates", action="store_true",
                    help="Skip per-row submission_date detail fetches (Begin-Search only). "
                         "Minimizes WAF exposure — dates are ship-safe blank (GA/VA precedent) "
                         "and backfillable later via backfill_submission_dates.py. NOTE: this is "
                         "already the DEFAULT for universe sweeps (--all / --all-companies).")
    ap.add_argument("--with-dates", action="store_true",
                    help="Force per-row submission_date fetches even on a universe sweep "
                         "(overrides the sweep default). Heavy WAF exposure (~1 detail fetch "
                         "per result row); use only when dates are essential up front.")
    args = ap.parse_args()

    from src.quiet_period import guard
    guard("run_search")  # refuse during a declared SERFF rest window

    if args.diag:
        import src.search as search_mod
        search_mod.DIAG_DIR = Path(args.diag)
        print(f"[run_search] diagnostics armed -> {args.diag}", flush=True)

    if args.all:
        pairs = [(s, c) for s in STATES for c in TARGET_COMPANIES]
        out_name = f"all_search{args.out_suffix}.xlsx"
    elif args.all_companies:
        pairs = [(args.state, c) for c in TARGET_COMPANIES]
        out_name = f"{_slug(args.state)}_all_companies_search{args.out_suffix}.xlsx"
    else:
        pairs = [(args.state, args.company)]
        out_name = f"{_slug(args.state)}_{_slug(args.company)}_search{args.out_suffix}.xlsx"

    out = Path(OUTPUT_DIR) / out_name

    # Date-fetch policy: universe sweeps default to NO dates (the expensive,
    # WAF-heavy per-row detail fetches yield a ship-safe-blank field — GA/VA
    # precedent; backfillable later). Single-carrier runs (targeted backfill)
    # keep dates by default. Either default is overridable with the explicit
    # flags. --with-dates wins over --no-dates if both are passed.
    is_sweep = bool(args.all or args.all_companies)
    if args.with_dates:
        fetch_dates = True
    elif args.no_dates:
        fetch_dates = False
    else:
        fetch_dates = not is_sweep  # sweep -> no dates; single carrier -> dates
    print(f"[run_search] submission window {args.date_from} -> {args.date_to}; out={out}", flush=True)
    print(f"[run_search] mode={'sweep' if is_sweep else 'single'}; "
          f"submission_date fetch={'ON' if fetch_dates else 'OFF (Begin-Search only, dates blank)'}",
          flush=True)

    def _checkpoint(so_far):
        write_excel(so_far, out)
        print(f"    [checkpoint] saved {len(so_far)} filings -> {out}", flush=True)

    filings = search_all(pairs, checkpoint_cb=_checkpoint,
                         date_from=args.date_from, date_to=args.date_to,
                         fetch_submission_dates=fetch_dates)
    write_excel(filings, out)

    print(f"\n=== Summary ===")
    print(f"Total filings: {len(filings)}")
    by_group: dict[tuple[str, str], int] = {}
    for f in filings:
        key = (f.state, f.target_company)
        by_group[key] = by_group.get(key, 0) + 1
    for (state, company), n in sorted(by_group.items()):
        print(f"  {state} / {company}: {n}")
    print(f"Wrote: {out}")
    return 0 if filings else 1


if __name__ == "__main__":
    raise SystemExit(main())
