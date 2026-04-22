"""Cross-validate our WA dataset against the AM Best WA PPA report.

Pivot strategy: extract every Disposition row across the PDF, identify the
parent group from the subsidiary name, then compare against our dataset.

A disposition row looks like:
  Allstate North American Insurance Company0.000% �2.400% $�313,375 8,451 $13,057,296 0.000% �5.000%

Numbers run together with the subsidiary name (no space before the first %).
"""
import re, csv
from pathlib import Path
from collections import Counter
from datetime import datetime

TEXT = Path("output/ambest_wa_ppa_text.txt").read_text(encoding="utf-8")

# Subsidiary -> group mapping (covers the names actually seen in WA PPA filings)
SUB_TO_GROUP = {
    # Allstate
    "Allstate Fire and Casualty Insurance Company": "Allstate",
    "Allstate Indemnity Company": "Allstate",
    "Allstate Insurance Company": "Allstate",
    "Allstate North American Insurance Company": "Allstate",
    "Allstate Property and Casualty Insurance Company": "Allstate",
    "Allstate Vehicle and Property Insurance Company": "Allstate",
    "Encompass Indemnity Company": "Allstate",
    "Encompass Insurance Company": "Allstate",
    "Encompass Property and Casualty Company": "Allstate",
    "Castle Key Indemnity Company": "Allstate",
    "Castle Key Insurance Company": "Allstate",
    "Esurance Insurance Company": "Allstate",
    "Esurance Property and Casualty Insurance Company": "Allstate",
    # State Farm
    "State Farm Mutual Automobile Insurance Company": "State Farm",
    "State Farm Fire and Casualty Company": "State Farm",
    "State Farm General Insurance Company": "State Farm",
    "State Farm Indemnity Company": "State Farm",
    # GEICO / Berkshire
    "GEICO General Insurance Company": "GEICO",
    "Government Employees Insurance Company": "GEICO",
    "GEICO Indemnity Company": "GEICO",
    "GEICO Advantage Insurance Company": "GEICO",
    "GEICO Choice Insurance Company": "GEICO",
    "GEICO Secure Insurance Company": "GEICO",
    "GEICO Casualty Company": "GEICO",
    "GEICO County Mutual Insurance Company": "GEICO",
    # Progressive
    "Progressive Casualty Insurance Company": "Progressive",
    "Progressive Direct Insurance Company": "Progressive",
    "Progressive Classic Insurance Company": "Progressive",
    "Progressive Max Insurance Company": "Progressive",
    "Progressive Specialty Insurance Company": "Progressive",
    "Progressive Universal Insurance Company": "Progressive",
    "Progressive Northwestern Insurance Company": "Progressive",
    "Progressive American Insurance Company": "Progressive",
    "Progressive Northern Insurance Company": "Progressive",
    "Progressive Preferred Insurance Company": "Progressive",
    "Progressive Premier Insurance Company of Illinois": "Progressive",
    "Progressive Mountain Insurance Company": "Progressive",
    "Progressive Select Insurance Company": "Progressive",
    "Progressive Advanced Insurance Company": "Progressive",
    # Travelers
    "Travelers Home and Marine Insurance Company": "Travelers",
    "Travelers Property Casualty Insurance Company": "Travelers",
    "Travelers Personal Insurance Company": "Travelers",
    "Travelers Commercial Insurance Company": "Travelers",
    "Travelers Personal Security Insurance Company": "Travelers",
    "Standard Fire Insurance Company, The": "Travelers",
    "Standard Fire Insurance Company": "Travelers",
    "Premier Insurance Company of Massachusetts": "Travelers",
    "Automobile Insurance Company of Hartford, Connecticut, The": "Travelers",
    "Automobile Insurance Company of Hartford, Connecticut": "Travelers",
    "Charter Oak Fire Insurance Company, The": "Travelers",
    # Liberty Mutual
    "Liberty Mutual Fire Insurance Company": "Liberty Mutual",
    "Liberty Insurance Corporation": "Liberty Mutual",
    "Liberty Mutual Insurance Company": "Liberty Mutual",
    "LM General Insurance Company": "Liberty Mutual",
    "LM Insurance Corporation": "Liberty Mutual",
    "Safeco Insurance Company of America": "Liberty Mutual",
    "Safeco Insurance Company of Illinois": "Liberty Mutual",
    "Safeco Insurance Company of Oregon": "Liberty Mutual",
    "First National Insurance Company of America": "Liberty Mutual",
    "American States Insurance Company": "Liberty Mutual",
    "American Economy Insurance Company": "Liberty Mutual",
    "Indiana Insurance Company": "Liberty Mutual",
    "General Insurance Company of America": "Liberty Mutual",
}

# Disposition row regex: name + 7 fields. Replace unicode minus with ASCII for parsing.
DISP_LINE_RE = re.compile(
    r"^([A-Z][A-Za-z &\.,'/\-]+?(?:Company|Co|Inc|Corp|Corporation|of America|of Illinois|of Oregon|Connecticut|Insurance Co|Insurance Company))"
    r"\s*([\-\u2013\u2014\u2212\u00ad]?[\d,\.]+%|N/A)\s*"
    r"([\-\u2013\u2014\u2212\u00ad]?[\d,\.]+%|N/A)\s*"
    r"\$([\-\u2013\u2014\u2212\u00ad]?[\d,]+)\s+"
    r"([\d,]+)\s+"
    r"\$([\d,]+)\s*"
    r"([\-\u2013\u2014\u2212\u00ad]?[\d,\.]+%|N/A)\s*"
    r"([\-\u2013\u2014\u2212\u00ad]?[\d,\.]+%|N/A)\s*$",
    re.MULTILINE,
)

def neg(s: str) -> str:
    return s.replace("\u2013", "-").replace("\u2014", "-").replace("\u2212", "-").replace("\u00ad", "-")

# Build list of (subsidiary, indicated, impact, wpc, pol, wp, max, min, group)
disp_rows = []
for m in DISP_LINE_RE.finditer(TEXT):
    sub = m.group(1).strip()
    grp = SUB_TO_GROUP.get(sub)
    if not grp:
        continue
    disp_rows.append({
        "sub": sub, "group": grp,
        "ind": neg(m.group(2)), "imp": neg(m.group(3)),
        "wpc": neg(m.group(4)), "pol": m.group(5),
        "wp": m.group(6),
        "max": neg(m.group(7)), "min": neg(m.group(8)),
        "match_text": m.group(0),
    })

print(f"Total disposition rows for target groups: {len(disp_rows)}")
print("By group:", Counter(r["group"] for r in disp_rows))

# Now match each disposition row back to its filing block to get filing-added & effective dates.
# Each row is inside a block ending in "Further information may be available".
# Find the block start (preceded by another "Further information" or BOF).
END_TOKEN = "Further information may be available"

block_starts = [0] + [m.end() for m in re.finditer(END_TOKEN, TEXT)]
block_ranges = list(zip(block_starts, block_starts[1:] + [len(TEXT)]))

# For each disp_row, find the block and parse header info
HEADER_RE = re.compile(
    r"(Approved|Disapproved|Withdrawn|Pending|Filed|New Program)\s+WA\s+"
    r"(\d{2}/\d{2}/\d{2})\s*Passenger.*?Number:\s+\*+\s+\d+\s+"
    r"(Rate/Rule|Rate|Rule|Form|New Program\s*[\u2013\u2014\-]\s*Rate/Rule|New Program\s*[\u2013\u2014\-]\s*Rate)\s+"
    r"(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})",
    re.DOTALL,
)

def find_block(pos: int) -> tuple[int, int]:
    for s, e in block_ranges:
        if s <= pos < e:
            return s, e
    return -1, -1

for r in disp_rows:
    pos = TEXT.find(r["match_text"])
    s, e = find_block(pos)
    block = TEXT[s:e]
    h = HEADER_RE.search(block)
    if h:
        r["status"] = h.group(1)
        r["added"] = h.group(2)
        r["action"] = h.group(3)
        r["eff"] = h.group(4)
        r["filed"] = h.group(5)
    else:
        r["status"] = r["added"] = r["action"] = r["eff"] = r["filed"] = ""

# Filter to our window
WIN_START = datetime(2025, 1, 1)
WIN_END = datetime(2026, 4, 17)
def to_dt(s):
    try:
        return datetime.strptime(s, "%m/%d/%y")
    except Exception:
        return None

in_window = [r for r in disp_rows if (d := to_dt(r["eff"])) and WIN_START <= d <= WIN_END]
# Debug: any ANA rows at all with -13.7%?
ana_137 = [r for r in disp_rows if "North American" in r["sub"] and "13.7" in r["imp"]]
print(f"DEBUG all disp_rows ANA -13.7%: {len(ana_137)}; sample eff/action: " + ", ".join(f"{r['eff']}/{r['action']}" for r in ana_137[:5]))

print(f"In-window (eff {WIN_START.date()} to {WIN_END.date()}): {len(in_window)}")
print("By group:", Counter(r["group"] for r in in_window))
print("By action:", Counter(r["action"] for r in in_window))

# Restrict to Rate / Rate/Rule
rate_only = [r for r in in_window if r["action"] in ("Rate", "Rate/Rule")]
print(f"Rate or Rate/Rule only: {len(rate_only)}")

# Load our WA rows
import csv as _csv
ours = []
with open("output/all_states_final_rates.csv", encoding="utf-8") as f:
    rd = _csv.DictReader(f)
    for row in rd:
        if row["state"] != "WA":
            continue
        ours.append(row)
print(f"Our WA rows: {len(ours)}")

# Build match key: (subsidiary normalized, effective date mm/dd/yy)
def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower().replace(",", ""))

def to_short(d: str) -> str:
    # Our dates are MM/DD/YYYY -> mm/dd/yy
    try:
        return datetime.strptime(d, "%m/%d/%Y").strftime("%m/%d/%y")
    except Exception:
        return d

def norm_pct(s: str) -> str:
    return (s or "").strip().lstrip("-").replace("%", "").rstrip("0").rstrip(".")

def norm_int(s: str) -> str:
    return (s or "").replace(",", "").replace("-", "").replace("$", "").strip()

# Match by (subsidiary, policyholders, impact-%) — effective date can differ
# between AM Best and SERFF (AM Best sometimes uses NB eff date vs renewal)
ours_keys = {(norm(r["company_name"]), norm_int(r["policyholders_affected"]), norm_pct(r["overall_rate_impact"])): r for r in ours}
amb_keys = {(norm(r["sub"]), norm_int(r["pol"]), norm_pct(r["imp"])): r for r in rate_only}

print(f"\nUnique (sub, pol, imp%) keys — ours: {len(ours_keys)}, AM Best: {len(amb_keys)}")

# Dump all Allstate North American amb keys for debugging
ana_keys = [k for k in amb_keys if "north american" in k[0]]
print(f"\nAM Best ANA keys: {len(ana_keys)}")
for k in sorted(ana_keys):
    print(f"  {k}  -> eff={amb_keys[k]['eff']}  filed={amb_keys[k]['filed']}")

# And ours
ours_ana = [k for k in ours_keys if "north american" in k[0]]
print(f"Our ANA keys: {len(ours_ana)}")
for k in sorted(ours_ana):
    print(f"  {k}  -> tk={ours_keys[k]['serff_tracking_number']} eff={ours_keys[k]['effective_date']}")


matched = ours_keys.keys() & amb_keys.keys()
missing_from_ours = amb_keys.keys() - ours_keys.keys()
extra_in_ours = ours_keys.keys() - amb_keys.keys()
print(f"  Matched (in both): {len(matched)}")
print(f"  In AM Best but NOT in ours: {len(missing_from_ours)}")
print(f"  In ours but NOT in AM Best: {len(extra_in_ours)}")

# Detail
print("\n=== MATCHED (subset) ===")
for k in sorted(matched, key=lambda x: x[1]):
    o = ours_keys[k]; a = amb_keys[k]
    print(f"  {k[1]}  {a['sub']:55s}  ours_imp={o['overall_rate_impact']}  amb_imp={a['imp']}  ours_tk={o['serff_tracking_number']}")

print("\n=== IN AM BEST, MISSING FROM OURS ===")
for k in sorted(missing_from_ours, key=lambda x: x[1]):
    a = amb_keys[k]
    print(f"  {a['eff']}  {a['action']:9s}  {a['group']:14s}  {a['sub']:55s}  ind={a['ind']:>9s}  imp={a['imp']:>9s}  pol={a['pol']:>8s}  WP=${a['wp']:>15s}")

print("\n=== IN OURS, NOT IN AM BEST PPA REPORT ===")
for k in sorted(extra_in_ours, key=lambda x: x[1]):
    o = ours_keys[k]
    print(f"  {k[1]}  {o['company_name']:55s}  sub_toi={o['sub_type_of_insurance']:35s}  tk={o['serff_tracking_number']}")
