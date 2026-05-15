"""One-shot diff: identify the row(s) dropped by the new effective-date filter
between ut_final_rates_pre_lookback.xlsx (old) and ut_final_rates.xlsx (new)."""
from pathlib import Path
import openpyxl


def _load(path: Path) -> tuple[list, list[dict]]:
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    hdr = list(rows[0])
    return hdr, [dict(zip(hdr, r)) for r in rows[1:]]


def _key(r: dict) -> tuple:
    return (r["serff_tracking_number"], r["company_name"], str(r["effective_date"]))


old_hdr, old = _load(Path("output/ut_final_rates_pre_lookback.xlsx"))
new_hdr, new = _load(Path("output/ut_final_rates.xlsx"))

print(f"old: {len(old)} rows")
print(f"new: {len(new)} rows")

new_keys = {_key(r) for r in new}
dropped = [r for r in old if _key(r) not in new_keys]
print(f"\nDropped from new ({len(dropped)} rows):")
for r in dropped:
    print(f"  {r['serff_tracking_number']:22s} {r['company_name']:50s} "
          f"eff={r['effective_date']} imp={r['overall_rate_impact']} "
          f"toi={r['sub_type_of_insurance']}")

old_keys = {_key(r) for r in old}
added = [r for r in new if _key(r) not in old_keys]
print(f"\nAdded in new ({len(added)} rows):")
for r in added:
    print(f"  {r['serff_tracking_number']:22s} {r['company_name']:50s} "
          f"eff={r['effective_date']} imp={r['overall_rate_impact']}")
