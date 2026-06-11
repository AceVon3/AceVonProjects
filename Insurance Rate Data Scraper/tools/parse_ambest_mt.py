"""Parse AM Best MT rate-filings PDF text into a structured CSV.

Input:  output/ambest_mt_text.txt (extracted via pypdf)
Output: tools/ambest_mt_data.csv

Each filing block in the PDF is delimited by the "Further information may be
available for this filing" trailer. Within a block we extract:
  - Major line (Private Passenger Auto / Homeowners Multi-Peril / other)
  - Group name
  - Effective date, disposition date, overall rate effect
  - Per-subsidiary rate data from the "Disposition Page Data" table

Filings flagged "Disposition Page Data N/A" have no per-subsidiary rates and
emit no rows (they're filings AM Best knows about but has no rate-effect data
for — usually because no rate impact was reported).
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ambest_subline import iter_subsidiary_matches

INPUT_TXT = Path("output/ambest_mt_text.txt")
OUTPUT_CSV = Path("tools/ambest_mt_data.csv")

# Filing block end marker
END_MARKER = "Further information may be available for this filing"

# Header line — appears once per block: starts with "Approved AZ MM/DD/YY"
APPROVED_RE = re.compile(r"^Approved AZ (\d{2}/\d{2}/\d{2})", re.MULTILINE)

# Major-line detection (case-insensitive, multi-word ok). PDF uses soft hyphen
# U+00AD in "Multi­Peril" — include it in the dash character class.
PPA_MAJOR = re.compile(r"Private\s+Passenger\s+Auto", re.IGNORECASE)
HO_MAJOR  = re.compile(r"Homeowners\s+Multi[\-­‐‑‒–—]Peril", re.IGNORECASE)

# Date+impact line:
#   "{pages} Rate {EFFECTIVE_DATE} {DISPOSITION_DATE} {impact_pct} %" possibly
#   followed by "*****" (or "{impact_pct}%" if percentage exists).
#   pypdf preserves the dash as "­" (soft-hyphen) or "-" for negative.
RATE_LINE_RE = re.compile(
    r"(\d{1,5})\s+Rate\s+(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+"
    r"([­\-]?\d+\.\d+\s*%|\*+)\s*(\*+)?"
)

# Per-subsidiary line in Disposition Page Data table.
# Format: "{Name} {ind_pct}% {imp_pct}% ${prem_chg} {pol_holders} ${prem_pgm} {max_pct}% {min_pct}%"
# Name has at least one space before the indicated %. Written-premium-change
# is optional (some filings omit it: e.g., "Star Casualty Insurance Company
# 7.200% 7.200% 425 9.600% 7.100%" lacks the $prem_chg column).
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
    """Remove commas and normalize soft-hyphen to '-'."""
    return s.replace(",", "").replace("­", "-") if s else ""


def split_filings(text: str) -> list[str]:
    """Split full text into per-filing blocks delimited by END_MARKER."""
    parts = text.split(END_MARKER)
    # Each block (except possibly the last) ends just before the marker.
    return [p.strip() for p in parts if "Approved AZ" in p or "Approved" in p]


def classify_major(block: str) -> str:
    if PPA_MAJOR.search(block):
        return "PPA"
    if HO_MAJOR.search(block):
        return "HO"
    return "OTHER"


def extract_rate_meta(block: str) -> dict | None:
    """Pull effective date, disposition date, overall rate effect from header."""
    m = RATE_LINE_RE.search(block)
    if not m:
        return None
    pages, eff, disp, impact_raw, _ = m.groups()
    impact = None
    if impact_raw and "*" not in impact_raw:
        impact = float(impact_raw.replace("­", "-").rstrip(" %").rstrip("%"))
    return {
        "pdf_pages": int(pages),
        "effective_date": eff,
        "disposition_date": disp,
        "overall_rate_effect": impact,
    }


def extract_group(block: str) -> str | None:
    """First line ending in 'Group' (e.g., 'State Farm Group', 'Allstate Group')."""
    for line in block.splitlines():
        s = line.strip()
        # Pattern: "{Group Name} Group ***** *****"
        m = re.match(r"^(.+?Group)\s+\*+\s+\*+", s)
        if m:
            return m.group(1).strip()
    return None


def extract_subsidiary_rates(block: str) -> list[dict]:
    """Extract per-subsidiary rate rows from the Disposition Page Data table.
    Returns empty list if 'Disposition Page Data N/A' or no parseable rows."""
    if "Disposition Page Data N/A" in block:
        return []
    rows = []
    # Wrapped-name-aware matching (2026-06-11 fix — see tools/ambest_subline.py):
    # single-line matches behave exactly as before; rows whose long subsidiary
    # name wrapped across lines are now recovered instead of silently dropping.
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


def main() -> int:
    text = INPUT_TXT.read_text(encoding="utf-8")
    # pypdf extraction uses non-breaking space (U+00A0) between words instead of
    # regular ASCII space. Normalize so our literal markers and regexes match.
    text = text.replace("\xa0", " ")
    blocks = split_filings(text)
    print(f"Filings detected: {len(blocks)}", flush=True)

    rows = []
    skipped_no_meta = 0
    skipped_no_match = 0
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
            # Filings with "N/A" or no parseable subsidiary rows still recorded
            # at filing-meta level (impact may live in header)
            rows.append({
                "major_line": major,
                "group_company": group or "",
                "subsidiary": "",
                "effective_date": meta["effective_date"],
                "disposition_date": meta["disposition_date"],
                "overall_rate_effect_header": meta["overall_rate_effect"],
                "indicated_pct": None, "impact_pct": None,
                "written_premium_change": None, "policyholders_affected": None,
                "written_premium_for_program": None,
                "maximum_pct": None, "minimum_pct": None,
                "filing_action": "Rate",
                "data_n_a": "Disposition Page Data N/A" in b,
            })
            continue
        for sr in sub_rates:
            rows.append({
                "major_line": major,
                "group_company": group or "",
                "subsidiary": sr["subsidiary"],
                "effective_date": meta["effective_date"],
                "disposition_date": meta["disposition_date"],
                "overall_rate_effect_header": meta["overall_rate_effect"],
                "indicated_pct": sr["indicated_pct"],
                "impact_pct": sr["impact_pct"],
                "written_premium_change": sr["written_premium_change"],
                "policyholders_affected": sr["policyholders_affected"],
                "written_premium_for_program": sr["written_premium_for_program"],
                "maximum_pct": sr["maximum_pct"],
                "minimum_pct": sr["minimum_pct"],
                "filing_action": "Rate",
                "data_n_a": False,
            })

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    if rows:
        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        print(f"Wrote {len(rows)} rows to {OUTPUT_CSV}", flush=True)
    else:
        print(f"No rows parsed!", flush=True)

    # Quick distribution check
    from collections import Counter
    print("By major_line:", Counter(r["major_line"] for r in rows))
    print(f"  filings skipped (no rate meta): {skipped_no_meta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
