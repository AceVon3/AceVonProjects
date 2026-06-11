"""Wrap-fix validation: old matches must survive identically; new matches
must be genuine recoveries; list the delta. Compares the pre-fix corroboration
snapshots against the post-fix re-run."""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf


def load(p):
    rows = list(csv.DictReader(open(p, encoding="utf-8")))
    key = lambda r: (r["line"], r["our_serff_tracking_number"], r["our_subsidiary"],
                     r["matched_ambest_subsidiary"], r["ambest_impact"], r["match_strength"])
    return {key(r): r for r in rows if r["match_strength"] not in ("", "none")}


old, new = {}, {}
for line in ("ppa", "ho"):
    old.update(load(f"output/corroboration/ga_{line}_corroboration.pre_wrapfix.csv"))
    new.update(load(f"output/corroboration/ga_{line}_corroboration.csv"))

lost = set(old) - set(new)
gained = set(new) - set(old)
print(f"pre-fix matches: {len(old)} | post-fix matches: {len(new)}")
print(f"LOST matches (must be 0): {len(lost)}")
for k in sorted(lost):
    print(f"  LOST {k}")
print(f"\nGAINED matches: {len(gained)} — each must be a genuine recovery:")
per_carrier = {}
for k in sorted(gained):
    line, tk, our_sub, am_sub, imp, strength = k
    g = rf.carrier_group(our_sub) or "?"
    per_carrier.setdefault(g, []).append(k)
for g in sorted(per_carrier):
    print(f"  [{g}] {len(per_carrier[g])}:")
    for line, tk, our_sub, am_sub, imp, strength in per_carrier[g]:
        print(f"    {line.upper():3s} {tk} {our_sub[:42]:42s} ~ AMB:{am_sub[:38]:38s} imp={imp} ({strength})")
