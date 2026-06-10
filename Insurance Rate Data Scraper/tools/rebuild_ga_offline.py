"""Offline GA rebuild from cached PDFs after the filing-type vocabulary fix.
No SERFF: load targets, build rows, write ga_final_rates.xlsx, show stats +
GA's disposition vocabulary (a known per-state-surprise field)."""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf

targets, _ = rf.load_targets_search("GA")
backfill_ids = rf._load_backfill_ids("GA")
rows, stats = rf.build_rows("GA", targets, backfill_ids)
out = rf.write_xlsx(rows, "GA")
print("\n=== STATS ===")
for k, v in stats.items():
    print(f"  {k}: {v}")
print(f"\nrows written: {len(rows)} -> {out}")
print("\ndisposition vocabulary:", dict(Counter(r['disposition_status'] for r in rows)))
print("rate_activity:", dict(Counter(r['rate_activity'] for r in rows)))
print("line_of_business:", dict(Counter(r['line_of_business'] for r in rows)))
print("external_validation:", dict(Counter(r['external_validation'] for r in rows)))
