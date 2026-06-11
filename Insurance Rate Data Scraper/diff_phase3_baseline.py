"""Phase 3 GUARDRAIL: the committed 268-row GA 8-brand baseline must survive
the 13-carrier re-run untouched — new carriers are pure addition.

    python diff_phase3_baseline.py            # base cols (pre-tier-apply)
    python diff_phase3_baseline.py --full     # all 21 cols (post-tier-apply)

Compares output/phase3_baseline_ga_final_rates.xlsx (snapshot of the
committed deliverable) against output/ga_final_rates.xlsx:
  - every baseline row must appear cell-identical in the new file
    (multiset semantics, same machinery as validate_b1),
  - all other new-file rows are NEW — listed per carrier group.
Base-cols mode excludes the three tier-mutable columns because a fresh
run_final_rates emits base labels until compare + apply_validation_tiers
re-upgrade them; --full (after the tier pipeline) demands total identity.
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf

TIER_MUTABLE = {"external_validation", "match_strength", "validation_tier"}
BASELINE = Path("output/phase3_baseline_ga_final_rates.xlsx")
CURRENT = Path("output/ga_final_rates.xlsx")


def load(path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb["rates"]
    rows = list(ws.iter_rows(values_only=True))
    hdr = list(rows[0])
    out = [dict(zip(hdr, r)) for r in rows[1:]]
    wb.close()
    return out


def norm(v) -> str:
    return "" if v is None else str(v)


def main() -> int:
    full = "--full" in sys.argv
    cols = rf.COLUMNS if full else [c for c in rf.COLUMNS if c not in TIER_MUTABLE]
    base = load(BASELINE)
    cur = load(CURRENT)
    key = lambda r: tuple(norm(r.get(c)) for c in cols)
    ms_base, ms_cur = Counter(map(key, base)), Counter(map(key, cur))

    missing = ms_base - ms_cur          # baseline rows damaged/lost
    new = ms_cur - ms_base              # pure additions
    print(f"baseline rows: {len(base)} | current rows: {len(cur)} | "
          f"cols compared: {len(cols)} ({'FULL incl. tiers' if full else 'base, tier-mutable excluded'})")
    if missing:
        print(f"\nGUARDRAIL VIOLATION — {sum(missing.values())} baseline row(s) changed or lost:")
        ic = {c: i for i, c in enumerate(cols)}
        for t, n in list(missing.items())[:10]:
            print(f"  x{n} {t[ic['serff_tracking_number']]} | {t[ic['company_name']]}")
        print("\nVERDICT: FAIL — a new keyword is bleeding into existing scope")
        return 1
    print(f"\nall {len(base)} baseline rows present cell-identical ✓")

    per_group: Counter = Counter()
    per_line: Counter = Counter()
    companies: dict[str, set] = {}
    ic = {c: i for i, c in enumerate(cols)}
    for t, n in new.items():
        grp = rf.carrier_group(t[ic["company_name"]]) or "?UNCLASSIFIED?"
        per_group[grp] += n
        per_line[(grp, t[ic["line_of_business"]])] += n
        companies.setdefault(grp, set()).add(t[ic["company_name"]])
    print(f"\nNEW rows: {sum(new.values())}")
    for g in sorted(per_group):
        ppa = sum(v for (gg, lob), v in per_line.items() if gg == g and lob.startswith("19."))
        ho = sum(v for (gg, lob), v in per_line.items() if gg == g and lob.startswith("04."))
        print(f"  {g}: {per_group[g]} (PPA {ppa} / HO {ho})")
        for c in sorted(companies[g]):
            print(f"      {c}")
    print("\nVERDICT: CLEAN — baseline intact, new carriers are pure addition")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
