"""Match UT dataset against AM Best UT PPA report.

AM Best report is PPA-only; our PPA bucket aggregates sub_types 19.0001 (PPA),
19.0000 (Personal Auto Combinations), and 19.0002 (Motorcycle) — same fold as
the OR cross-check (compare_or_ambest.py).

Match keys: (subsidiary_name_normalized, effective_date_MMDDYY, impact_pct).
"""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

import openpyxl

AMBEST_CSV = Path("tools/ambest_ut_data.csv")
DATASET_XLSX = Path("output/all_states_final_rates.xlsx")

# Subsidiary keywords identifying our 8 customer-facing brands.
# A subsidiary belongs to one of these IFF a keyword appears in its name.
TARGET_KEYWORDS: dict[str, tuple[str, ...]] = {
    "State Farm":     ("state farm", "mga insurance"),
    "GEICO":          ("geico", "government employees"),
    "Allstate":       ("allstate", "north american insurance"),
    "Encompass":      ("encompass",),
    "Travelers":      ("travelers",),
    "Liberty Mutual": ("liberty", "peerless", "american states", "american economy"),
    "Safeco":         ("safeco", "first national insurance company of america", "general insurance company of america"),
    "Progressive":    ("progressive", "artisan and truckers"),
}

# Subsidiary-name patterns that are out-of-scope filing vehicles or specialty
# acquisitions (mirrors run_final_rates.EXCLUDED_SUBSIDIARY_PATTERNS).
EXCLUDED_SUBSIDIARY_PATTERNS = (
    "lm general insurance company",
    "lm insurance corporation",
    "standard fire insurance",
    "integon ",
    "national general",
    "esurance",
    "drive insurance",
    "united financial",
)

DATE_FROM = datetime(2025, 1, 1)
DATE_TO = datetime(2026, 4, 17)


def _norm_name(s: str) -> str:
    return " ".join((s or "").lower().replace(",", "").replace(".", "").split())


def _to_dt_yy(s: str) -> datetime | None:
    """Parse MM/DD/YY."""
    if not s: return None
    s = s.strip()
    try:
        return datetime.strptime(s, "%m/%d/%y")
    except ValueError:
        return None


def _to_dt_yyyy(s) -> datetime | None:
    """Parse MM/DD/YYYY (our dataset format)."""
    if s is None: return None
    s = str(s).strip()
    if not s: return None
    for fmt in ("%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _norm_eff(d: datetime | None) -> str:
    return d.strftime("%m/%d/%y") if d else ""


def _round_pct(v) -> float | None:
    if v is None or v == "": return None
    try:
        return round(float(v), 3)
    except (ValueError, TypeError):
        return None


def carrier_brand(name: str) -> str | None:
    n = (name or "").lower()
    if any(p in n for p in EXCLUDED_SUBSIDIARY_PATTERNS):
        return None
    for brand, kws in TARGET_KEYWORDS.items():
        if any(k in n for k in kws):
            return brand
    return None


# --------------------------------------------------------------------------
# Load AM Best UT (the parsed CSV has heavy duplication from the PDF's
# repeating-header artifacts — dedupe by (subsidiary, filing_date,
# effective_date, impact_pct, policyholders) before filtering).
# --------------------------------------------------------------------------
seen: set[tuple] = set()
raw_rows = list(csv.DictReader(open(AMBEST_CSV, encoding="utf-8")))
ambest_unique: list[dict] = []
for r in raw_rows:
    k = (r["subsidiary"], r["filing_date"], r["effective_date"],
         r["impact_pct"], r["policyholders_affected"])
    if k in seen:
        continue
    seen.add(k)
    ambest_unique.append(r)
print(f"AM Best UT: {len(raw_rows):,} raw rows -> {len(ambest_unique):,} unique after dedup")

ambest_all = []
for r in ambest_unique:
    eff = _to_dt_yy(r["effective_date"])
    if eff is None:
        continue
    if eff < DATE_FROM or eff > DATE_TO:
        continue
    if r.get("filing_action") != "Rate":
        continue
    brand = carrier_brand(r["subsidiary"])
    if not brand:
        continue
    ambest_all.append({
        "brand": brand,
        "subsidiary": r["subsidiary"],
        "effective_date": eff,
        "impact_pct": _round_pct(r.get("impact_pct")),
        "indicated_pct": _round_pct(r.get("indicated_pct")),
        "policyholders": int(float(r["policyholders_affected"])) if r.get("policyholders_affected") else None,
        "wpp": int(float(r["written_premium_for_program"])) if r.get("written_premium_for_program") else None,
        "filing_date": _to_dt_yy(r.get("filing_date")),
    })

print(f"AM Best UT in-scope rows: {len(ambest_all)}")
from collections import Counter
print("  per-brand:", Counter(r["brand"] for r in ambest_all).most_common())

# --------------------------------------------------------------------------
# Load our UT rows (PPA bucket)
# --------------------------------------------------------------------------
wb = openpyxl.load_workbook(DATASET_XLSX, read_only=True)
ws = wb["rate_filings"]
rows = list(ws.iter_rows(values_only=True))
hdr = list(rows[0])
data = [dict(zip(hdr, r)) for r in rows[1:]]
ut_rows = [d for d in data if d["state"] == "UT"]

def _is_ppa(d):
    s = d.get("sub_type_of_insurance") or ""
    return s.startswith("19.0001") or s.startswith("19.0000") or s.startswith("19.0002")

ut_ppa = [d for d in ut_rows if _is_ppa(d)]
ut_other = [d for d in ut_rows if not _is_ppa(d)]
print(f"\nOur UT total: {len(ut_rows)} | PPA bucket: {len(ut_ppa)} | non-PPA (HO+other): {len(ut_other)}")

# --------------------------------------------------------------------------
# Build lookup from our rows: (name_norm, eff, impact) -> row
# --------------------------------------------------------------------------
def _our_eff(d):
    return _norm_eff(_to_dt_yyyy(d.get("effective_date")))

def _our_impact(d):
    s = (d.get("overall_rate_impact") or "").rstrip("%").strip()
    try: return round(float(s), 3)
    except (ValueError, TypeError): return None

my_lookup: dict[tuple, dict] = {}
for d in ut_ppa:
    k = (_norm_name(d["company_name"]), _our_eff(d), _our_impact(d))
    my_lookup[k] = d

# Helpers to read our row's WPP / PH for relaxed matching
def _our_ph(d):
    v = d.get("policyholders_affected")
    try: return int(float(v)) if v not in (None, "") else None
    except (ValueError, TypeError): return None

def _our_wpp(d):
    v = d.get("written_premium_for_program")
    try: return int(float(v)) if v not in (None, "") else None
    except (ValueError, TypeError): return None

# Tier 1: strict (subsidiary, eff_date, impact)
matched_tier1 = []
remaining = []
for r in ambest_all:
    k = (_norm_name(r["subsidiary"]), _norm_eff(r["effective_date"]), r["impact_pct"])
    if k in my_lookup:
        matched_tier1.append((r, my_lookup[k]))
    else:
        remaining.append(r)

# Tier 2: same subsidiary + impact + policyholders (date may shift between AM Best
# and our dataset — typically because AM Best records a later effective date when
# the filing's renewal effective date differs from the new-business effective).
ph_lookup: dict[tuple, dict] = {}
for d in ut_ppa:
    k = (_norm_name(d["company_name"]), _our_impact(d), _our_ph(d))
    ph_lookup.setdefault(k, d)

matched_tier2 = []
still_missing = []
for r in remaining:
    k = (_norm_name(r["subsidiary"]), r["impact_pct"], r["policyholders"])
    if k in ph_lookup:
        matched_tier2.append((r, ph_lookup[k]))
    else:
        still_missing.append(r)

# Tier 3: sub-type reclass — AM Best has it, we have a row with same name+impact+ph
# but in a non-PPA sub-type bucket
ut_all_ph_lookup: dict[tuple, dict] = {}
for d in ut_rows:
    k = (_norm_name(d["company_name"]), _our_impact(d), _our_ph(d))
    ut_all_ph_lookup.setdefault(k, d)
reclass = []
truly_missing = []
for r in still_missing:
    k = (_norm_name(r["subsidiary"]), r["impact_pct"], r["policyholders"])
    if k in ut_all_ph_lookup:
        reclass.append((r, ut_all_ph_lookup[k]))
    else:
        truly_missing.append(r)

matched = matched_tier1 + matched_tier2
still_missing = truly_missing

# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------
print()
print("=" * 70)
print("AM Best UT cross-check")
print("=" * 70)
print(f"AM Best in-scope rows (8 target brands, 2025-01-01 to 2026-04-17, Rate, exclusions applied): {len(ambest_all)}")
print(f"  Tier 1 — Direct match (subsidiary + effective_date + impact):    {len(matched_tier1)}")
print(f"  Tier 2 — Date-relaxed match (subsidiary + impact + ph):          {len(matched_tier2)}")
print(f"  Tier 3 — Sub-type reclass (our row in non-PPA sub-TOI):          {len(reclass)}")
print(f"  Still missing from our UT dataset:                               {len(still_missing)}")
total_in_scope = len(matched) + len(reclass) + len(still_missing)
match_rate = (len(matched) + len(reclass)) / total_in_scope * 100 if total_in_scope else 0
print(f"  In-scope match rate:  {len(matched) + len(reclass)} / {total_in_scope} ({match_rate:.1f}%)")

if still_missing:
    print()
    print("--- Still missing from our UT dataset ---")
    for r in still_missing:
        print(f"  {r['brand']:14s} {r['subsidiary']:55s} eff={_norm_eff(r['effective_date'])} imp={r['impact_pct']}% pol={r['policyholders']}")

if reclass:
    print()
    print("--- Sub-type reclass (AM Best PPA = our 19.0002 Motorcycle / other) ---")
    for r, d in reclass:
        print(f"  {r['subsidiary']:55s} eff={_norm_eff(r['effective_date'])} imp={r['impact_pct']}% -> our sub_type={d['sub_type_of_insurance']}")

# Extra: in our UT PPA but not in AM Best in-scope
ambest_keys = {(_norm_name(r["subsidiary"]), _norm_eff(r["effective_date"]), r["impact_pct"]) for r in ambest_all}
extras = []
for d in ut_ppa:
    k = (_norm_name(d["company_name"]), _our_eff(d), _our_impact(d))
    if k not in ambest_keys:
        extras.append(d)
print()
print(f"--- In our UT PPA but not in AM Best report: {len(extras)} ---")
for d in extras:
    print(f"  {d['serff_tracking_number']:22s} {d['company_name']:48s} eff={d['effective_date']} imp={d['overall_rate_impact']} act={d['rate_activity']}")

print()
print(f"--- Our UT non-PPA (HO etc., excluded from AM Best PPA report by definition): {len(ut_other)} ---")
for d in ut_other:
    print(f"  {d['serff_tracking_number']:22s} {d['company_name']:48s} {d['sub_type_of_insurance']} imp={d['overall_rate_impact']}")
