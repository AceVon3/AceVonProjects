"""Reconciliation v2 (rate_changes.xlsx) vs v3 (rate_changes_v3.xlsx).

Reports:
  1. Per-row value diffs (rows present in both).
  2. v2 rows that got split into multiple v3 rows.
  3. v2 rows dropped entirely in v3 (with reason).
  4. SFMA-134676753 SFM/SFFC row inspection.
  5. Rows where all 3 new fields populated.
"""
from __future__ import annotations
import sys
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")
from src.config import OUTPUT_DIR

V2 = OUTPUT_DIR / "rate_changes.xlsx"
V3 = OUTPUT_DIR / "rate_changes_v3.xlsx"

NEW_COLS = {"overall_indicated_change", "overall_rate_impact", "policyholders_affected"}


def load(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Rate Changes"]
    rows = list(ws.iter_rows(values_only=True))
    hdr = list(rows[0])
    return hdr, [dict(zip(hdr, r)) for r in rows[1:]]


def main():
    h2, r2 = load(V2)
    h3, r3 = load(V3)
    print(f"v2 rows: {len(r2)}  cols: {len(h2)}")
    print(f"v3 rows: {len(r3)}  cols: {len(h3)}")
    new_cols_added = set(h3) - set(h2)
    cols_dropped = set(h2) - set(h3)
    print(f"new cols added: {sorted(new_cols_added)}")
    print(f"cols dropped:   {sorted(cols_dropped)}")

    # Group by serff
    by_serff_v2: dict[str, list[dict]] = {}
    for r in r2:
        by_serff_v2.setdefault(r["serff_tracking_number"], []).append(r)
    by_serff_v3: dict[str, list[dict]] = {}
    for r in r3:
        by_serff_v3.setdefault(r["serff_tracking_number"], []).append(r)

    # Compare per serff
    print("\n" + "=" * 78)
    print("SECTION 1: Row-count changes per serff")
    print("=" * 78)
    same = 0; expanded = []; dropped = []; added = []
    for s in sorted(set(by_serff_v2) | set(by_serff_v3)):
        c2 = len(by_serff_v2.get(s, []))
        c3 = len(by_serff_v3.get(s, []))
        if c2 == c3 and c2 > 0:
            same += 1
        elif c3 > c2 and c2 > 0:
            expanded.append((s, c2, c3))
        elif c2 > 0 and c3 == 0:
            dropped.append(s)
        elif c2 == 0 and c3 > 0:
            added.append((s, c3))
    print(f"  Unchanged row-count serffs: {same}")
    print(f"  Expanded (more rows in v3): {len(expanded)}")
    for s, c2, c3 in expanded:
        print(f"    {s}: v2={c2} -> v3={c3}")
    print(f"  Dropped serffs (in v2, missing in v3): {len(dropped)}")
    for s in dropped:
        print(f"    {s}")
    print(f"  Net-new serffs (added in v3): {len(added)}")

    # Compare values for serffs with same row count
    print("\n" + "=" * 78)
    print("SECTION 2: Value diffs for unchanged-row-count serffs")
    print("=" * 78)
    diffs = 0
    for s in sorted(by_serff_v2):
        l2 = by_serff_v2[s]
        l3 = by_serff_v3.get(s, [])
        if len(l2) != len(l3):
            continue
        for v2_row, v3_row in zip(l2, l3):
            for k in v2_row:
                if k in NEW_COLS:
                    continue
                old = v2_row.get(k)
                new = v3_row.get(k)
                if old != new:
                    diffs += 1
                    co = (v3_row.get("company_name") or "")[:30]
                    print(f"  {s} | {co} | {k}: {old!r}  ->  {new!r}")
    if diffs == 0:
        print("  (no value diffs in non-NEW columns for unchanged-row serffs)")

    # SFMA-134676753 detailed inspection
    print("\n" + "=" * 78)
    print("SECTION 3: SFMA-134676753 in v3")
    print("=" * 78)
    target_rows = by_serff_v3.get("SFMA-134676753", [])
    print(f"  rows: {len(target_rows)}")
    for r in target_rows:
        print(f"\n  Company:                   {r.get('company_name')}")
        print(f"  rate_effect_value:         {r.get('rate_effect_value')}")
        print(f"  rate_effect_source:        {r.get('rate_effect_source')}")
        print(f"  rate_change_type:          {r.get('rate_change_type')}")
        print(f"  overall_rate_impact:       {r.get('overall_rate_impact')}")
        print(f"  overall_indicated_change:  {r.get('overall_indicated_change')}")
        print(f"  policyholders_affected:    {r.get('policyholders_affected')}")
        print(f"  original_value:            {r.get('original_value')}")
        print(f"  correction_note:           {(r.get('correction_note') or '')[:200]}")

    # All-3-fields populated rows
    print("\n" + "=" * 78)
    print("SECTION 4: Rows with all 3 new fields populated (status=complete)")
    print("=" * 78)
    complete = []
    for r in r3:
        if all(r.get(c) for c in NEW_COLS):
            complete.append(r)
    print(f"  Count: {len(complete)}")
    for r in complete:
        print(f"\n  serff:                     {r.get('serff_tracking_number')}")
        print(f"  state:                     {r.get('state')}")
        print(f"  company_name:              {r.get('company_name')}")
        print(f"  rate_effect_value:         {r.get('rate_effect_value')}")
        print(f"  overall_rate_impact:       {r.get('overall_rate_impact')}")
        print(f"  overall_indicated_change:  {r.get('overall_indicated_change')}")
        print(f"  policyholders_affected:    {r.get('policyholders_affected')}")


if __name__ == "__main__":
    main()
