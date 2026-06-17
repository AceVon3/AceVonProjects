"""Parse AM Best rate-filings text for ANY state into a structured CSV.

    python tools/parse_ambest_generic.py IL

Reads output/ambest_<state>_text_*.txt (date-range-tiled, like GA) and writes
tools/ambest_<state>_data.csv. Identical block-extraction logic to the fixed
parse_ambest_ga.py (blank max/min optional + non-ASCII-minus normalization,
2026-06-15 fix); state-parameterized to avoid yet another near-duplicate parser
(see BACKLOG.md B1 — this is a step toward the shared extractor).
"""
from __future__ import annotations

import csv
import hashlib
import re
import sys
from pathlib import Path


def _block_id(group, eff, disp, major, sub_rates) -> str:
    """Content hash of one END_MARKER-delimited filing block: group + dates +
    line + the sorted (subsidiary, impact, policyholders) fingerprint of its
    entities. Page-break repetitions of the same block hash identically (dedup);
    distinct filings differ. Robust even when group_company is blank."""
    fp = sorted((sr["subsidiary"],
                 round(sr["impact_pct"], 3) if sr["impact_pct"] is not None else None,
                 sr["policyholders_affected"]) for sr in sub_rates)
    sig = f"{group}|{eff}|{disp}|{major}|" + ";".join(f"{n}:{i}:{p}" for n, i, p in fp)
    return hashlib.md5(sig.encode("utf-8")).hexdigest()[:12]

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ambest_subline import iter_subsidiary_matches

END_MARKER = "Further information may be available for this filing"
PPA_MAJOR = re.compile(r"Private\s+Passenger\s+Auto", re.IGNORECASE)
HO_MAJOR = re.compile(r"Homeowners\s+Multi[\-­‐‑‒–—]Peril", re.IGNORECASE)
RATE_LINE_RE = re.compile(
    r"(\d{1,5})\s+Rate\s+(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+"
    r"([­\-]?\d+\.\d+\s*%|\*+)\s*(\*+)?"
)
SUB_LINE_RE = re.compile(
    r"^(?P<name>[A-Z][A-Za-z .,&\-/]+?)\s+"
    r"(?P<ind>[­\-]?\d+\.\d+)?%\s+"
    r"(?P<imp>[­\-]?\d+\.\d+)%\s+"
    r"(?:\$?(?P<prem_chg>[­\-]?[\d,]+)\s+)?"
    r"(?P<pol>[\d,]+)\s+"
    r"\$?(?P<prem_pgm>[\d,]+)\s+"
    r"(?P<max>[­\-]?\d+\.\d+)?%\s+"  # number OPTIONAL: bare `%` = blank max (2026-06-15 fix)
    r"(?P<min>[­\-]?\d+\.\d+)?%"     # number OPTIONAL: bare `%` = blank min (2026-06-15 fix)
)


def _clean_num(s: str) -> str:
    return s.replace(",", "").replace("­", "-") if s else ""


def split_filings(text: str, state: str) -> list[str]:
    parts = text.split(END_MARKER)
    return [p.strip() for p in parts if f"Approved {state}" in p or "Approved" in p]


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
        m = re.match(r"^(.+?Group)\s+\*+\s+\*+", line.strip())
        if m:
            return m.group(1).strip()
    return None


def extract_subsidiary_rates(block: str) -> list[dict]:
    if "Disposition Page Data N/A" in block:
        return []
    rows = []
    for m in iter_subsidiary_matches(block, SUB_LINE_RE):
        prem_chg_raw = m.group("prem_chg")
        rows.append({
            "subsidiary": m.group("name").strip(),
            "indicated_pct": float(_clean_num(m.group("ind"))) if m.group("ind") else None,
            "impact_pct": float(_clean_num(m.group("imp"))),
            "written_premium_change": int(_clean_num(prem_chg_raw)) if prem_chg_raw else None,
            "policyholders_affected": int(_clean_num(m.group("pol"))),
            "written_premium_for_program": int(_clean_num(m.group("prem_pgm"))),
            "maximum_pct": float(_clean_num(m.group("max"))) if m.group("max") else None,
            "minimum_pct": float(_clean_num(m.group("min"))) if m.group("min") else None,
        })
    return rows


def parse_file(idx: int, path: Path, state: str, rows: list[dict]) -> int:
    text = path.read_text(encoding="utf-8").replace("\xa0", " ")
    for _d in "­‐‑‒–—―−":  # non-ASCII minus/dash -> '-' (2026-06-15 hardening)
        text = text.replace(_d, "-")
    blocks = split_filings(text, state)
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
        bid = _block_id(group or "", meta["effective_date"], meta["disposition_date"], major, sub_rates)
        if not sub_rates:
            rows.append({
                "source_file": idx, "block_id": bid, "major_line": major, "group_company": group or "",
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
                "source_file": idx, "block_id": bid, "major_line": major, "group_company": group or "",
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
    print(f"  file {idx} ({path.name}): {len(blocks)} blocks -> {len(rows)-n0} rows "
          f"(skipped_no_meta={skipped_no_meta})", flush=True)
    return len(rows) - n0


def main() -> int:
    state = sys.argv[1].upper() if len(sys.argv) > 1 else sys.exit("usage: parse_ambest_generic.py <STATE>")
    text_files = sorted(Path("output").glob(f"ambest_{state.lower()}_text_*.txt"),
                        key=lambda p: int(re.search(r"_(\d+)\.txt$", p.name).group(1)))
    if not text_files:
        sys.exit(f"FATAL: no output/ambest_{state.lower()}_text_*.txt files found")
    out_csv = Path(f"tools/ambest_{state.lower()}_data.csv")
    rows: list[dict] = []
    for idx, path in enumerate(text_files, 1):
        parse_file(idx, path, state, rows)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows to {out_csv}", flush=True)
    from collections import Counter
    print("By major_line:", Counter(r["major_line"] for r in rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
