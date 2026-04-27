"""Parse AM Best UT PPA report (output/ambest_ut_ppa_text.txt) into a flat CSV.

Each AM Best filing block looks like:

    Approved UT <added_date> Passenger ***** Number: ***** <pages> Rate <filing_date> <effective_date> <overall>% ... Passenger
    Auto ...
    <Group Name> ***** *****
    <Company> *****
    ...
    AMB Filing Description:*****
    SERFF Filing Description:*****
    Disposition Page Data
    Overall %Overall %Written PremiumNumber of Policy Written Maximum % Minimum %
    Company ... headers ...
    <COMPANY NAME> <IND>% <IMPACT>% $<WPC> <PH> $<WPP> <MAX>% <MIN>%
    ...
    Further information may be available...

Output columns (mirrors fields used in compare_or_ambest.py):
    group, subsidiary, filing_date, effective_date, disposition_date,
    indicated_pct, impact_pct, written_premium_change, policyholders,
    written_premium_for_program, max_pct, min_pct, filing_action
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

SRC = Path("output/ambest_ut_ppa_text.txt")
OUT = Path("tools/ambest_ut_data.csv")

# Header line with three dates and overall %
HDR_RE = re.compile(
    r"Approved\s+UT\s+(\d{2}/\d{2}/\d{2})\s+Passenger.*?"
    r"\b(Rate|Form)\s+(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s+([\-\d\.]+|\*+)\s*%",
    re.DOTALL,
)

# Per-company rate row
# Pattern: "Name X.XXX% Y.YYY% $WPC PH $WPP MAX% MIN%"
# Or with blank ind:    "Name % Y.YYY% $WPC PH $WPP MAX% MIN%"
# Or trailing blanks:   "Name X.XXX% Y.YYY% $WPC PH $WPP % %"
PCT = r"(?:[\-\d][\d\.,]*|)"     # signed decimal or empty
NUM = r"(?:[\-\d][\d,\.]*)"       # signed integer/decimal with commas
DOLLAR = r"\$" + NUM

ROW_RE = re.compile(
    r"^(.+?)\s*"                        # name (may have no trailing space before %)
    r"(" + PCT + r")%\s*"               # indicated (empty = blank)
    r"(" + PCT + r")%\s+"               # impact
    r"\$(" + NUM + r"|0)\s+"            # WPC (signed)
    r"(" + NUM + r")\s+"                # PH
    r"\$(" + NUM + r")\s*"              # WPP
    r"(" + PCT + r")%\s*"               # max
    r"(" + PCT + r")%\s*$",             # min
    re.MULTILINE,
)


def _to_pct(s: str) -> float | None:
    s = s.strip()
    if not s:
        return None
    try:
        return round(float(s.replace(",", "")), 3)
    except ValueError:
        return None


def _to_int(s: str) -> int | None:
    s = (s or "").replace(",", "").strip()
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def parse_filings(text: str) -> list[dict]:
    text = text.replace("­", "-").replace("−", "-")
    out: list[dict] = []

    # Find each "Approved UT <date>" header
    headers = list(re.finditer(r"Approved\s+UT\s+\d{2}/\d{2}/\d{2}", text))
    for i, m in enumerate(headers):
        start = m.start()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        block = text[start:end]

        hm = HDR_RE.search(block)
        if not hm:
            continue
        added_date, action, filing_date, effective_date, overall = hm.groups()

        # Group: line containing "Group" but excluding "Group Name"
        gm = re.search(r"\n([^\n]+? Group)\s+\*", block)
        group = gm.group(1).strip() if gm else ""

        # Disposition Page Data table block
        dpd_idx = block.find("Disposition Page Data")
        if dpd_idx < 0:
            continue
        # Table rows are between the column header lines and "Further information"
        rest = block[dpd_idx:]
        end_idx = rest.find("Further information")
        if end_idx < 0:
            end_idx = len(rest)
        section = rest[:end_idx]

        # Skip past the column header rows: split by "Change: Impact:" line if present
        marker_idx = section.find("Change: Impact:")
        if marker_idx >= 0:
            section = section[marker_idx + len("Change: Impact:"):]

        for rm in ROW_RE.finditer(section):
            name, ind, imp, wpc, ph, wpp, mx, mn = rm.groups()
            # Skip header-residue lines
            if "this Program" in name or "Page" in name or "Copyright" in name:
                continue
            out.append({
                "group": group,
                "subsidiary": name.strip(),
                "filing_date_added": added_date,
                "filing_date": filing_date,
                "effective_date": effective_date,
                "filing_action": action,
                "overall_rate_effect_pct": _to_pct(overall),
                "indicated_pct": _to_pct(ind),
                "impact_pct": _to_pct(imp),
                "written_premium_change": _to_int(wpc),
                "policyholders_affected": _to_int(ph),
                "written_premium_for_program": _to_int(wpp),
                "max_pct": _to_pct(mx),
                "min_pct": _to_pct(mn),
            })
    return out


def main() -> int:
    text = SRC.read_text(encoding="utf-8")
    rows = parse_filings(text)
    print(f"parsed {len(rows)} per-subsidiary rate rows")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if rows:
        cols = list(rows[0].keys())
        with open(OUT, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            for r in rows:
                w.writerow(r)
        print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
