"""NC Deviations collection runner — burst the uncached NC rate-family
filings (Deviations reclassified as rate-family 2026-08-10).

Same burst policy as refresh_runner: 18-search bursts / --wall-stop 2 /
--no-harvest-early, 5-min rests on progress, escalating backoff on zero
progress, 3 zero bursts -> BANK and exit (miss-safe; judgment picks it up).
No sweep phase: the universe (nc_all_companies_search.xlsx, 1,139 filings)
already exists from the gap-state collection + later merges.
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

LOG = Path("output/nc_deviations_results.log")


def log(msg: str) -> None:
    line = f"[{time.strftime('%m/%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def uncached() -> int:
    from run_final_rates import load_targets_search
    targets, _ = load_targets_search("NC")
    return sum(1 for t in targets
               if not (Path(f"output/pdfs/NC/{t.filing_id}/filing_summary.pdf").exists()
                       and Path(f"output/pdfs/NC/{t.filing_id}/filing_summary.pdf").stat().st_size > 5000))


zero_streak = 0
for i in range(1, 41):
    before = uncached()
    if before == 0:
        log(f"DONE NC: all targets cached")
        break
    log(f"NC: burst-{i} ({before} uncached)")
    with open(f"output/nc_dev_burst{i}.log", "a", encoding="utf-8") as f:
        subprocess.run([sys.executable, "-u", "run_final_rates.py", "NC",
                        "--burst", "18", "--wall-stop", "2", "--no-harvest-early"],
                       stdout=f, stderr=subprocess.STDOUT, check=False)
    after = uncached()
    if after == 0:
        log(f"DONE NC: all targets cached")
        break
    if after >= before:
        zero_streak += 1
        rest = min(1800 * zero_streak, 3600)
        log(f"NC: burst-{i} zero progress ({after} remain), streak {zero_streak}, backing off {rest}s")
        if zero_streak >= 3:
            log(f"BANKED NC: {after} uncached — judgment picks it up")
            break
    else:
        zero_streak = 0
        rest = 300
        log(f"NC: burst-{i} banked {before - after} ({after} remain), resting {rest}s")
    time.sleep(rest)

log("NC DEVIATIONS CAMPAIGN COMPLETE")
