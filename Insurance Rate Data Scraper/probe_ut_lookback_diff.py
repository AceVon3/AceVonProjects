"""Phase B PoC diff: compare ut_final_rates.xlsx (post-lookback) vs
ut_final_rates_pre_lookback.xlsx (pre-lookback) and categorize the changes.

Outputs:
- Newly captured rows (in new, not in old) — these are the recovered filings
- Dropped rows (in old, not in new) — these were dropped by the new effective-
  date emit filter or by a different parse outcome
"""
from pathlib import Path
import openpyxl


def _load(path: Path):
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    hdr = list(rows[0])
    return hdr, [dict(zip(hdr, r)) for r in rows[1:]]


def _key(r):
    """Match on (serff_tracking_number, company_name, effective_date) — same
    grain as the dataset's row uniqueness."""
    return (r["serff_tracking_number"], r["company_name"], str(r["effective_date"]))


old_hdr, old = _load(Path("output/ut_final_rates_pre_lookback.xlsx"))
new_hdr, new = _load(Path("output/ut_final_rates.xlsx"))

print(f"OLD (pre-lookback): {len(old)} rows")
print(f"NEW (lookback):     {len(new)} rows")
print(f"DELTA:              {len(new) - len(old):+d}")

old_keys = {_key(r) for r in old}
new_keys = {_key(r) for r in new}

added = [r for r in new if _key(r) not in old_keys]
dropped = [r for r in old if _key(r) not in new_keys]

print(f"\n{'=' * 90}")
print(f"NEWLY CAPTURED ROWS ({len(added)}) — by carrier")
print(f"{'=' * 90}")
from collections import defaultdict
by_carrier = defaultdict(list)
for r in added:
    # crude classification by SERFF prefix
    pfx = r["serff_tracking_number"][:4]
    carrier = {
        "ALSE": "Allstate", "GECC": "GEICO", "LBPM": "Liberty Mutual",
        "LWCM": "Liberty Mutual", "PRGS": "Progressive", "SFMA": "State Farm",
        "TRVD": "Travelers",
    }.get(pfx, pfx)
    by_carrier[carrier].append(r)

for carrier in sorted(by_carrier):
    rows = by_carrier[carrier]
    print(f"\n  {carrier} ({len(rows)} rows):")
    for r in rows:
        print(f"    {r['serff_tracking_number']:22s} {r['company_name']:50s} "
              f"eff={r['effective_date']} imp={r['overall_rate_impact']!s:>10s} "
              f"filed={r['filing_date']} toi={r['sub_type_of_insurance']}")

print(f"\n{'=' * 90}")
print(f"DROPPED ROWS ({len(dropped)})")
print(f"{'=' * 90}")
for r in dropped:
    print(f"  {r['serff_tracking_number']:22s} {r['company_name']:50s} "
          f"eff={r['effective_date']} imp={r['overall_rate_impact']!s:>10s} "
          f"toi={r['sub_type_of_insurance']}")

print(f"\n{'=' * 90}")
print(f"SPOT-CHECK: 3 rows present in both old and new — values unchanged?")
print(f"{'=' * 90}")
common = sorted(old_keys & new_keys)[:3]
old_by_key = {_key(r): r for r in old}
new_by_key = {_key(r): r for r in new}
for k in common:
    o = old_by_key[k]
    n = new_by_key[k]
    diff_fields = [c for c in old_hdr if o.get(c) != n.get(c)]
    print(f"\n  {k[0]} / {k[1]} / eff={k[2]}")
    if diff_fields:
        for c in diff_fields:
            print(f"    DIFF {c}: old={o.get(c)!r}  new={n.get(c)!r}")
    else:
        print(f"    OK — all {len(old_hdr)} fields match")
