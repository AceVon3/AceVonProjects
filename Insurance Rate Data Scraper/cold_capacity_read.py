"""Cold-capacity read (Workstream 2b) — the decisive post-rest measurement.

Runs a small number of FRESH Begin-Searches with diagnostics armed, records
exactly where the WAF wall lands, and STOPS at the first sustained wall.
MEASUREMENT ONLY — no row enrichment, no submission-date fetches, no PDF
downloads, no collection. The number it prints (clean Begin-Searches before the
first wall) is the deliverable; it replaces the unverified "85" prose with a
measured value to drive the resume_state.md DECISION TREE.

    python cold_capacity_read.py                       # defaults: VA, budget 20
    python cold_capacity_read.py --state OH --n 20 --sustained 2

Reference points: VA overnight 8 / VA 72h 17 / OH 14.

Run this WHEN THE DECLARED REST ENDS (the quiet-period guard refuses it while a
rest window is active — that's intentional; the read itself ends the rest).
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

import src.search as _serff_search
from src.config import HEADLESS, USER_AGENT, TARGET_COMPANIES
from src.search import _submit_search
from src.quiet_period import guard


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--state", default="VA", help="state to probe (budget is IP-keyed/global, so any works)")
    ap.add_argument("--n", type=int, default=20, help="max Begin-Searches to attempt (probe budget; 20 detects recovery >>17)")
    ap.add_argument("--sustained", type=int, default=2, help="consecutive walls treated as a sustained wall -> STOP")
    ap.add_argument("--diag", default="output/serff_diagnostics", help="DIAG_DIR for the ledger")
    ap.add_argument("--delay", type=float, default=3.0, help="seconds between probes")
    args = ap.parse_args()

    guard("cold_capacity_read")  # refuses while a rest window is still active

    _serff_search.DIAG_DIR = Path(args.diag)
    terms = TARGET_COMPANIES
    print(f"=== COLD-CAPACITY READ: state={args.state}, budget={args.n}, "
          f"stop after {args.sustained} consecutive walls ===", flush=True)
    print(f"diagnostics -> {args.diag}/search_ledger.csv", flush=True)
    print("MEASUREMENT ONLY — no enrichment, no downloads, no collection.\n", flush=True)

    clean_before_wall = 0
    first_wall_at: int | None = None
    consecutive = 0
    results: list[tuple[int, str, bool]] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        try:
            for i in range(args.n):
                term = terms[i % len(terms)]
                ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=True)
                page = ctx.new_page()
                ok = False
                try:
                    ok = bool(_submit_search(page, args.state, term))
                except Exception as e:
                    print(f"  probe {i+1}/{args.n}: {term!r} -> EXC {type(e).__name__}", flush=True)
                finally:
                    try:
                        ctx.close()
                    except Exception:
                        pass
                results.append((i + 1, term, ok))
                if ok:
                    if first_wall_at is None:
                        clean_before_wall += 1
                    consecutive = 0
                    print(f"  probe {i+1}/{args.n}: {term!r} -> ok", flush=True)
                else:
                    consecutive += 1
                    if first_wall_at is None:
                        first_wall_at = i + 1
                    print(f"  probe {i+1}/{args.n}: {term!r} -> WALL ({consecutive} consecutive)", flush=True)
                    if consecutive >= args.sustained:
                        print(f"\n  sustained wall ({consecutive} consecutive) at probe {i+1} "
                              f"— STOPPING (no grind).", flush=True)
                        break
                time.sleep(args.delay)
        finally:
            browser.close()

    n_ok = sum(1 for *_x, ok in results if ok)
    print("\n=== COLD CAPACITY ===")
    if first_wall_at is None:
        print(f"  {n_ok}/{args.n} clean, NO wall within budget -> capacity >= {args.n}")
        verdict = f">= {args.n} (no wall in budget)"
    else:
        print(f"  {clean_before_wall} clean Begin-Searches before the first wall "
              f"(first non-ok at probe {first_wall_at})")
        verdict = str(clean_before_wall)
    print("  reference: VA overnight 8 / VA 72h 17 / OH 14")
    print(f"  >>> MEASURED COLD CAPACITY: {verdict} <<<")
    print("\n  DECISION (see resume_state.md):")
    print("   - >> 17 (toward high tens): penalty decayed -> expansion viable; resume VA then OH")
    print("   - ~14-17 plateau:           ratchet confirmed -> measured multi-cycle grind; decide scope")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
