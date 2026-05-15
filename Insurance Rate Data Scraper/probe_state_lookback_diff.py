"""Generic state-level diff: pre-lookback vs post-lookback final_rates.
Usage: python probe_state_lookback_diff.py ID|WA|CO|OR
"""
import sys
from pathlib import Path
from collections import defaultdict
import openpyxl


def _load(path: Path):
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    hdr = list(rows[0])
    return hdr, [dict(zip(hdr, r)) for r in rows[1:]]


def _key(r):
    return (r["serff_tracking_number"], r["company_name"], str(r["effective_date"]))


CARRIER_BY_PFX = {
    "ALSE": "Allstate", "GECC": "GEICO", "LBPM": "Liberty Mutual",
    "LWCM": "Liberty Mutual", "PRGS": "Progressive", "SFMA": "State Farm",
    "TRVD": "Travelers", "GMMX": "Encompass", "AGNY": "Encompass",
}


def main():
    state = sys.argv[1].lower()
    old_p = Path(f"output/{state}_final_rates_pre_lookback.xlsx")
    new_p = Path(f"output/{state}_final_rates.xlsx")
    _, old = _load(old_p)
    _, new = _load(new_p)

    print(f"OLD: {len(old)} rows | NEW: {len(new)} rows | DELTA: {len(new) - len(old):+d}")
    old_keys = {_key(r) for r in old}
    new_keys = {_key(r) for r in new}
    added = [r for r in new if _key(r) not in old_keys]
    dropped = [r for r in old if _key(r) not in new_keys]

    print(f"\nADDED ({len(added)}):")
    by_carrier = defaultdict(list)
    for r in added:
        by_carrier[CARRIER_BY_PFX.get(r["serff_tracking_number"][:4], "?")].append(r)
    for c in sorted(by_carrier):
        for r in by_carrier[c]:
            print(f"  {c:14s} {r['serff_tracking_number']:22s} {r['company_name']:48s} "
                  f"eff={r['effective_date']} imp={r['overall_rate_impact']!s:>10s} "
                  f"filed={r['filing_date']}")

    print(f"\nDROPPED ({len(dropped)}):")
    for r in dropped:
        print(f"  {r['serff_tracking_number']:22s} {r['company_name']:48s} "
              f"eff={r['effective_date']} imp={r['overall_rate_impact']!s:>10s} "
              f"toi={r['sub_type_of_insurance']}")


if __name__ == "__main__":
    main()
