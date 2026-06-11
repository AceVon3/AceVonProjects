"""Parse the 3 GA AM Best rate-filings PDF text files into one structured CSV.

Input:  output/ambest_ga_text_{1,2,3}.txt  (extracted by inventory_ga_ambest.py)
Output: tools/ambest_ga_data.csv  (one combined CSV, with a source_file column)

GA's AM Best export is split into 3 effective-date-range files that tile our
window with inclusive-overlapping boundaries (10-31-24 shared by files 1&2;
6-30-25 shared by files 2&3). We parse all three and concatenate. The
compare_ga_ambest.py dedup key (major_line, subsidiary, effective_date,
disposition_date, impact_pct, policyholders_affected) then collapses BOTH the
in-file page-break repetition AND the cross-file boundary overlap, because a
boundary filing appears with identical field values in both files.

Parsing logic is identical to parse_ambest_nm.py (state-agnostic except the
'Approved GA' block-split fallback).
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ambest_subline import iter_subsidiary_matches

INPUT_TXTS = [
    (1, Path("output/ambest_ga_text_1.txt")),
    (2, Path("output/ambest_ga_text_2.txt")),
    (3, Path("output/ambest_ga_text_3.txt")),
]
OUTPUT_CSV = Path("tools/ambest_ga_data.csv")

END_MARKER = "Further information may be available for this filing"
PPA_MAJOR = re.compile(r"Private\s+Passenger\s+Auto", re.IGNORECASE)
HO_MAJOR  = re.compile(r"Homeowners\s+Multi[\-­‐‑‒–—]Peril", re.IGNORECASE)
RATE_LINE_RE = re.compile(
    r"(\d{1,5})\s+Rate\s+(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+"
    r"([­\-]?\d+\.\d+\s*%|\*+)\s*(\*+)?"
)
SUB_LINE_RE = re.compile(
    r"^(?P<name>[A-Z][A-Za-z .,&\-/]+?)\s+"
    r"(?P<ind>[­\-]?\d+\.\d+)?%\s+"  # number OPTIONAL: bare `%` = blank indicated (2026-06-11 fix)
    r"(?P<imp>[­\-]?\d+\.\d+)%\s+"
    r"(?:\$?(?P<prem_chg>[­\-]?[\d,]+)\s+)?"
    r"(?P<pol>[\d,]+)\s+"
    r"\$?(?P<prem_pgm>[\d,]+)\s+"
    r"(?P<max>[­\-]?\d+\.\d+)%\s+"
    r"(?P<min>[­\-]?\d+\.\d+)%"
)


def _clean_num(s: str) -> str:
    return s.replace(",", "").replace("­", "-") if s else ""


def split_filings(text: str) -> list[str]:
    parts = text.split(END_MARKER)
    return [p.strip() for p in parts if "Approved GA" in p or "Approved" in p]


def classify_major(block: str) -> str:
    if PPA_MAJOR.search(block):
        return "PPA"
    if HO_MAJOR.search(block):
        return "HO"
    return "OTHER"


def extract_rate_meta(block: str) -> dict | None:
    m = RATE_LINE_RE.search(block)
    if not m:
        return None
    pages, eff, disp, impact_raw, _ = m.groups()
    impact = None
    if impact_raw and "*" not in impact_raw:
        impact = float(impact_raw.replace("­", "-").rstrip(" %").rstrip("%"))
    return {"pdf_pages": int(pages), "effective_date": eff,
            "disposition_date": disp, "overall_rate_effect": impact}


def extract_group(block: str) -> str | None:
    for line in block.splitlines():
        s = line.strip()
        m = re.match(r"^(.+?Group)\s+\*+\s+\*+", s)
        if m:
            return m.group(1).strip()
    return None


def extract_subsidiary_rates(block: str) -> list[dict]:
    if "Disposition Page Data N/A" in block:
        return []
    rows = []
    # Wrapped-name-aware matching (2026-06-11 fix — see tools/ambest_subline.py):
    # single-line matches behave exactly as before; rows whose long subsidiary
    # name wrapped across lines are now recovered instead of degrading the
    # block to one blank-subsidiary meta row.
    for m in iter_subsidiary_matches(block, SUB_LINE_RE):
        prem_chg_raw = m.group("prem_chg")
        rows.append({
            "subsidiary": m.group("name").strip(),
            "indicated_pct": float(_clean_num(m.group("ind"))) if m.group("ind") else None,
            "impact_pct": float(_clean_num(m.group("imp"))),
            "written_premium_change": int(_clean_num(prem_chg_raw)) if prem_chg_raw else None,
            "policyholders_affected": int(_clean_num(m.group("pol"))),
            "written_premium_for_program": int(_clean_num(m.group("prem_pgm"))),
            "maximum_pct": float(_clean_num(m.group("max"))),
            "minimum_pct": float(_clean_num(m.group("min"))),
        })
    return rows


def parse_file(idx: int, path: Path, rows: list[dict]) -> int:
    text = path.read_text(encoding="utf-8").replace("\xa0", " ")
    blocks = split_filings(text)
    n0 = len(rows)
    skipped_no_meta = 0
    for b in blocks:
        major = classify_major(b)
        if major == "OTHER":
            continue
        meta = extract_rate_meta(b)
        if not meta:
            skipped_no_meta += 1
            continue
        group = extract_group(b)
        sub_rates = extract_subsidiary_rates(b)
        if not sub_rates:
            rows.append({
                "source_file": idx, "major_line": major, "group_company": group or "",
                "subsidiary": "", "effective_date": meta["effective_date"],
                "disposition_date": meta["disposition_date"],
                "overall_rate_effect_header": meta["overall_rate_effect"],
                "indicated_pct": None, "impact_pct": None, "written_premium_change": None,
                "policyholders_affected": None, "written_premium_for_program": None,
                "maximum_pct": None, "minimum_pct": None, "filing_action": "Rate",
                "data_n_a": "Disposition Page Data N/A" in b,
            })
            continue
        for sr in sub_rates:
            rows.append({
                "source_file": idx, "major_line": major, "group_company": group or "",
                "subsidiary": sr["subsidiary"], "effective_date": meta["effective_date"],
                "disposition_date": meta["disposition_date"],
                "overall_rate_effect_header": meta["overall_rate_effect"],
                "indicated_pct": sr["indicated_pct"], "impact_pct": sr["impact_pct"],
                "written_premium_change": sr["written_premium_change"],
                "policyholders_affected": sr["policyholders_affected"],
                "written_premium_for_program": sr["written_premium_for_program"],
                "maximum_pct": sr["maximum_pct"], "minimum_pct": sr["minimum_pct"],
                "filing_action": "Rate", "data_n_a": False,
            })
    print(f"  file {idx}: {len(blocks)} blocks -> {len(rows)-n0} rows (skipped_no_meta={skipped_no_meta})", flush=True)
    return len(rows) - n0


def main() -> int:
    rows: list[dict] = []
    for idx, path in INPUT_TXTS:
        parse_file(idx, path, rows)
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} combined rows to {OUTPUT_CSV}", flush=True)
    from collections import Counter
    print("By major_line:", Counter(r["major_line"] for r in rows))
    print("By source_file:", Counter(r["source_file"] for r in rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
