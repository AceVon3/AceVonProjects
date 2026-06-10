"""Follow-up B (B1) validation harness — prove enrichment is redundant field-by-field.

Per followup_B_enrichment_redundancy.md: for each test state, build the deliverable
rows TWO ways and demand ZERO cell diffs across every row x every column:

  A (legacy):  rf.load_targets_enriched() from output/{state}_final.xlsx
  B (B1):      rf.load_targets_search() — the PRODUCTION loader (search-workbook
               universe + layered submission_date resolution), so this harness
               validates the deployed code path, not a copy. For legacy states
               the blanks resolve from the enriched workbook (the oracle); for
               new states from the backfill_submission_dates.py sidecar.

OFFLINE by design: all filing_summary.pdfs are cached for completed states, so
build_rows never touches SERFF, and the canonical output/{state}_final_rates.xlsx
is never written (rows are dumped to output/b1_validation/ instead).

The backfill values are sourced from the enriched workbook itself. That is the
point, not a shortcut: B's claim is that submission_date-for-search-failures is
the ONLY thing enrichment uniquely contributes. If the claim holds, backfilling
exactly that and nothing else must reproduce the deliverable cell-for-cell. The
production fetch of those dates (backfill_submission_dates.py) is validated
separately, live, with --validate (compares fetched dates vs this oracle).

A search-vs-enriched submission_date disagreement is impossible by construction
(scrape_detail_fields only fills submission_date when blank) and would surface
in the target-set comparison anyway, which compares submission_date per target.

Also diffs path-A rows against the COMMITTED {state}_final_rates.xlsx (excluding
the three columns apply_validation_tiers.py rewrites in place) so the comparison
is anchored to the real deliverable, and runs the ID anchor check on B rows.

    python validate_b1.py NM UT ID
"""
from __future__ import annotations

import csv
import sys
from collections import Counter
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf

OUT_DIR = Path("output/b1_validation")
# apply_validation_tiers.py rewrites these in place in the committed file
# (LABEL-ONLY upgrade pass), so the emitter can't be expected to reproduce them.
TIER_MUTABLE = {"external_validation", "match_strength", "validation_tier"}


def _norm(v) -> str:
    if v is None:
        return ""
    return str(v)


def row_tuple(r: dict, cols) -> tuple:
    return tuple(_norm(r.get(c)) for c in cols)


def diff_row_sets(rows_a: list[dict], rows_b: list[dict], cols, label_a: str, label_b: str) -> int:
    """Multiset compare of full-row tuples; on mismatch, drill into per-column
    diffs keyed by (tracking, company, sub_toi). Returns total cell-diff count."""
    ms_a = Counter(row_tuple(r, cols) for r in rows_a)
    ms_b = Counter(row_tuple(r, cols) for r in rows_b)
    if ms_a == ms_b:
        print(f"  {label_a} vs {label_b}: {len(rows_a)} rows x {len(cols)} cols -> 0 cell diffs (multisets identical)")
        return 0

    print(f"  {label_a} vs {label_b}: MULTISETS DIFFER ({len(rows_a)} vs {len(rows_b)} rows)")

    def key(r):
        return (_norm(r.get("serff_tracking_number")), _norm(r.get("company_name")),
                _norm(r.get("sub_type_of_insurance")))

    by_a: dict[tuple, list[dict]] = {}
    for r in rows_a:
        by_a.setdefault(key(r), []).append(r)
    by_b: dict[tuple, list[dict]] = {}
    for r in rows_b:
        by_b.setdefault(key(r), []).append(r)

    only_a = sorted(set(by_a) - set(by_b))
    only_b = sorted(set(by_b) - set(by_a))
    for k in only_a:
        print(f"    ROW ONLY IN {label_a}: {k}")
    for k in only_b:
        print(f"    ROW ONLY IN {label_b}: {k}")

    cell_diffs = 0
    col_counter: Counter = Counter()
    for k in sorted(set(by_a) & set(by_b)):
        la = sorted(by_a[k], key=lambda r: row_tuple(r, cols))
        lb = sorted(by_b[k], key=lambda r: row_tuple(r, cols))
        if len(la) != len(lb):
            print(f"    KEY CARDINALITY {k}: {len(la)} vs {len(lb)}")
        for ra, rbn in zip(la, lb):
            for c in cols:
                va, vb = _norm(ra.get(c)), _norm(rbn.get(c))
                if va != vb:
                    cell_diffs += 1
                    col_counter[c] += 1
                    if col_counter[c] <= 5:
                        print(f"    DIFF {k} [{c}]: {label_a}={va!r} {label_b}={vb!r}")
    cell_diffs += (len(only_a) + len(only_b)) * len(cols)
    if col_counter:
        print(f"    per-column diff counts: {dict(col_counter)}")
    print(f"    TOTAL CELL DIFFS: {cell_diffs}")
    return cell_diffs


def load_committed(state: str) -> list[dict]:
    p = Path(f"output/{state.lower()}_final_rates.xlsx")
    wb = openpyxl.load_workbook(p, read_only=True)
    ws = wb["rates"]
    rows = list(ws.iter_rows(values_only=True))
    hdr = list(rows[0])
    out = [dict(zip(hdr, r)) for r in rows[1:]]
    wb.close()
    return out


def dump_csv(rows: list[dict], cols, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            w.writerow([_norm(r.get(c)) for c in cols])


def compare_targets(ta: list[rf.Target], tb: list[rf.Target]) -> None:
    """Pre-build sanity: same target filings reach build_rows on both paths?
    Compares every Target field build_rows consumes (disposition_date /
    disposition_status_xlsx excluded — loaded but never read, proven by grep)."""
    def tkey(t):
        return (t.tracking, t.filing_id, t.company, t.toi, t.sub_toi,
                t.filing_type_xlsx, _norm(t.submission_date), t.group)
    sa, sb = Counter(map(tkey, ta)), Counter(map(tkey, tb))
    if sa == sb:
        print(f"  target sets: {len(ta)} targets, all consumed fields identical")
        return
    print(f"  TARGET SETS DIFFER: {len(ta)} (A) vs {len(tb)} (B)")
    for k in (sa - sb):
        print(f"    only A: {k}")
    for k in (sb - sa):
        print(f"    only B: {k}")


def validate_state(state: str) -> dict:
    print(f"\n{'=' * 72}\n=== B1 VALIDATION — {state} ===\n{'=' * 72}")
    backfill_ids = rf._load_backfill_ids(state)

    print(f"\n--- path A (legacy: enriched {state.lower()}_final.xlsx) ---")
    targets_a = rf.load_targets_enriched(state)
    print(f"  {len(targets_a)} targets")
    rows_a, stats_a = rf.build_rows(state, targets_a, backfill_ids)
    print(f"  {len(rows_a)} rows emitted; stats: {stats_a}")

    print(f"\n--- path B (B1 PRODUCTION loader: rf.load_targets_search) ---")
    targets_b, rep = rf.load_targets_search(state)
    print(f"  {len(targets_b)} targets")
    for name, n in rep["universe_files"]:
        print(f"  search universe: {name} -> +{n} filings")
    backfilled = rep["filled_enriched"] + rep["filled_sidecar"]
    print(f"  submission_date backfilled (search-phase fetch failures): {len(backfilled)}"
          f" ({len(rep['filled_enriched'])} enriched, {len(rep['filled_sidecar'])} sidecar)")
    for tk, v in backfilled:
        print(f"    backfill {tk}: {_norm(v)}")
    if rep["still_blank"]:
        print(f"  still blank after resolution: {rep['still_blank']}")
    rows_b, stats_b = rf.build_rows(state, targets_b, backfill_ids)
    print(f"  {len(rows_b)} rows emitted; stats: {stats_b}")

    print("\n--- target-set comparison (pre-build) ---")
    compare_targets(targets_a, targets_b)

    print("\n--- CELL-LEVEL DIFF: A vs B (all emitted columns) ---")
    diffs_ab = diff_row_sets(rows_a, rows_b, rf.COLUMNS, "A", "B")

    print("\n--- CELL-LEVEL DIFF: A vs COMMITTED deliverable (tier-mutable cols excluded) ---")
    base_cols = [c for c in rf.COLUMNS if c not in TIER_MUTABLE]
    committed = load_committed(state)
    diffs_ac = diff_row_sets(rows_a, committed, base_cols, "A", "committed")

    dump_csv(rows_a, rf.COLUMNS, OUT_DIR / f"{state.lower()}_rows_pathA.csv")
    dump_csv(rows_b, rf.COLUMNS, OUT_DIR / f"{state.lower()}_rows_pathB.csv")

    anchor = None
    if state == "ID":
        matched, mismatches = rf.verify_anchor(rows_b)
        anchor = (matched, mismatches)
        print(f"\n--- ANCHOR under B pipeline (SFMA-134676753) ---")
        print(f"  matched: {matched}/14 fields")
        for m in mismatches:
            print(m)

    return {"state": state, "rows": len(rows_a), "diffs_ab": diffs_ab,
            "diffs_a_committed": diffs_ac, "backfilled": len(backfilled),
            "still_blank": len(rep["still_blank"]), "anchor": anchor}


def main():
    states = [s.upper() for s in sys.argv[1:]] or ["NM", "UT", "ID"]
    results = [validate_state(s) for s in states]
    print(f"\n{'=' * 72}\n=== B1 VALIDATION SUMMARY ===\n{'=' * 72}")
    for r in results:
        anchor = f" anchor={r['anchor'][0]}/14" if r["anchor"] else ""
        print(f"  {r['state']}: rows={r['rows']} | A-vs-B cell diffs={r['diffs_ab']} | "
              f"A-vs-committed diffs={r['diffs_a_committed']} | "
              f"backfilled={r['backfilled']} | still_blank={r['still_blank']}{anchor}")
    verdict = all(r["diffs_ab"] == 0 and r["diffs_a_committed"] == 0 for r in results)
    print(f"\n  VERDICT: {'CLEAN — 0 cell diffs everywhere' if verdict else 'DIFFS FOUND — do not deploy'}")


if __name__ == "__main__":
    main()
