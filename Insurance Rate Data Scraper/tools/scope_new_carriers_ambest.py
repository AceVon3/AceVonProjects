"""Phase 1B — confirm the 5 candidate carriers in the actual AM Best reports.

For AZ / NM / GA (full-state parsed AM Best CSVs on disk), enumerate every
entry whose group_company or subsidiary matches a candidate-carrier pattern:
exact AM Best entity names, PPA vs HO presence, and in-window Rate counts
(eff 2025-01-01 -> 2026-04-17, filing_action=Rate) — the would-be cross-check
denominators. Offline; no SERFF.
"""
import csv
import re
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

CARRIER_PATTERNS = {
    "USAA":             r"usaa|garrison",
    "Farmers":          r"\bfarmers\b|mid-?century|foremost|bristol west|21st century|fire insurance exchange|truck insurance exchange",
    "Nationwide":       r"nationwide|allied|\bamco\b|depositors|titan|victoria",
    "American Family":  r"american family|homesite|midvale|main street america|\bconnect\b|permanent general|the general",
    "Country":          r"\bcountry\b",
}
D_FROM, D_TO = datetime(2025, 1, 1), datetime(2026, 4, 17)


def parse_d(s):
    s = (s or "").strip()
    for fmt in ("%m/%d/%y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


for st in ("az", "nm", "ga"):
    p = Path(f"tools/ambest_{st}_data.csv")
    rows = list(csv.DictReader(open(p, encoding="utf-8")))
    # dedup on the 6-tuple key used by the compare scripts
    seen, uniq = set(), []
    for r in rows:
        k = (r["subsidiary"], r["major_line"], r["effective_date"], r["impact_pct"],
             r["policyholders_affected"], r["filing_action"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    print(f"\n{'=' * 74}\n=== {st.upper()} — {len(uniq)} unique AM Best entries ===")
    for carrier, pat in CARRIER_PATTERNS.items():
        rx = re.compile(pat, re.I)
        hits = [r for r in uniq if rx.search(r["group_company"] or "") or rx.search(r["subsidiary"] or "")]
        if not hits:
            print(f"\n  {carrier}: NOT PRESENT in this state's report")
            continue
        groups = sorted({r["group_company"] for r in hits})
        per = defaultdict(lambda: {"PPA": 0, "HO": 0, "PPA_rate_win": 0, "HO_rate_win": 0})
        for r in hits:
            line = r["major_line"]
            per[r["subsidiary"]][line] += 1
            d = parse_d(r["effective_date"])
            if (r["filing_action"] or "").strip() == "Rate" and d and D_FROM <= d <= D_TO:
                per[r["subsidiary"]][f"{line}_rate_win"] += 1
        n_win = sum(v["PPA_rate_win"] + v["HO_rate_win"] for v in per.values())
        print(f"\n  {carrier}: {len(hits)} entries | group_company values: {groups}")
        print(f"    in-window Rate entries (would-be denominators): "
              f"PPA {sum(v['PPA_rate_win'] for v in per.values())} / "
              f"HO {sum(v['HO_rate_win'] for v in per.values())} (total {n_win})")
        for sub in sorted(per):
            v = per[sub]
            print(f"    {sub:55s} PPA {v['PPA']:3d} (win {v['PPA_rate_win']:2d}) | "
                  f"HO {v['HO']:3d} (win {v['HO_rate_win']:2d})")
