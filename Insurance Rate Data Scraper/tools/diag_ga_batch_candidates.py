"""Diagnostic: per-group cached/uncached counts for GA batch-validation selection."""
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf
import validate_batch_download as v

targets, _ = rf.load_targets_search("GA")
d = defaultdict(lambda: {"c": 0, "u": 0, "c_term": 0, "u_term": 0})
for t in targets:
    p = v.cache_pdf("GA", t.filing_id)
    cached = p.exists() and p.stat().st_size > 5000
    term_ok = rf.GROUP_SEARCH[t.group][0] in (t.company or "").lower()
    d[t.group]["c" if cached else "u"] += 1
    if term_ok:
        d[t.group]["c_term" if cached else "u_term"] += 1
print("group            cached(all/term)  uncached(all/term)")
for g, x in sorted(d.items()):
    print(f"  {g:16s} {x['c']:3d}/{x['c_term']:3d}        {x['u']:3d}/{x['u_term']:3d}")
