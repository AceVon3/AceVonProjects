"""Before/after blank-subsidiary counts for the wrapped-name parser fix."""
import csv
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

for st in ("az", "nm", "ga"):
    for label, p in (("BEFORE", f"tools/ambest_{st}_data.pre_wrapfix.csv"),
                     ("AFTER ", f"tools/ambest_{st}_data.csv")):
        rows = list(csv.DictReader(open(p, encoding="utf-8")))
        blank = sum(1 for r in rows if not (r["subsidiary"] or "").strip())
        print(f"{st.upper()} {label}: total={len(rows):6d} blank={blank:6d} named={len(rows)-blank:6d}")
    print()
