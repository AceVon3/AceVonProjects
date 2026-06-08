"""Match MT dataset against AM Best MT PPA + Homeowners Multi-Peril reports.

AM Best MT PDF (2026-05-26 export) contains BOTH PPA and Homeowners Multi-Peril
filings — this is the first AZ run validating BOTH personal-lines families. The
PPA bucket folds sub-types 19.0000/19.0001/19.0002/19.0004 (matching UT/OR).
The HO bucket folds sub-types 04.0000-04.0005.

Match keys: (subsidiary_name_normalized, effective_date_MMDDYY, impact_pct),
with tiered relaxation (date-relaxed by policyholders+impact, sub-type reclass)
mirroring compare_ut_ambest.py / compare_or_ambest.py.
"""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

import openpyxl

AMBEST_CSV = Path("tools/ambest_mt_data.csv")
DATASET_XLSX = Path("output/all_states_final_rates.xlsx")

TARGET_KEYWORDS: dict[str, tuple[str, ...]] = {
    "State Farm":     ("state farm", "mga insurance"),
    "GEICO":          ("geico", "government employees"),
    "Allstate":       ("allstate", "north american insurance"),
    "Encompass":      ("encompass",),
    "Travelers":      ("travelers",),
    "Liberty Mutual": ("liberty", "american states"),
    "Safeco":         ("safeco", "first national insurance company of america", "general insurance company of america"),
    "Progressive":    ("progressive", "artisan and truckers"),
}

EXCLUDED_SUBSIDIARY_PATTERNS = (
    "lm general insurance company",
    "lm insurance corporation",
    "standard fire insurance",
    "integon ",
    "national general",
    "esurance",
    "drive insurance",
    "united financial",
    "american economy",
    "peerless",
)

DATE_FROM = datetime(2025, 1, 1)
DATE_TO   = datetime(2026, 4, 17)


def _norm_name(s: str) -> str:
    return " ".join((s or "").lower().replace(",", "").replace(".", "").split())


def _to_dt_yy(s: str) -> datetime | None:
    if not s: return None
    s = s.strip()
    try:
        return datetime.strptime(s, "%m/%d/%y")
    except ValueError:
        return None


def _to_dt_yyyy(s) -> datetime | None:
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


# ---- Load AM Best MT rows and dedupe ----------------------------------------
seen: set[tuple] = set()
raw_rows = list(csv.DictReader(open(AMBEST_CSV, encoding="utf-8")))
ambest_unique: list[dict] = []
for r in raw_rows:
    k = (r["major_line"], r["subsidiary"], r["effective_date"],
         r["disposition_date"], r["impact_pct"], r["policyholders_affected"])
    if k in seen:
        continue
    seen.add(k)
    ambest_unique.append(r)
print(f"AM Best MT: {len(raw_rows):,} raw rows -> {len(ambest_unique):,} unique after dedup")

# ---- Filter to in-scope ------------------------------------------------------
ambest_ppa: list[dict] = []
ambest_ho:  list[dict] = []
for r in ambest_unique:
    if not r.get("subsidiary"):
        continue  # N/A filings have no per-subsidiary data
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
    row = {
        "brand": brand,
        "subsidiary": r["subsidiary"],
        "effective_date": eff,
        "impact_pct": _round_pct(r.get("impact_pct")),
        "indicated_pct": _round_pct(r.get("indicated_pct")),
        "policyholders": int(float(r["policyholders_affected"])) if r.get("policyholders_affected") else None,
        "wpp": int(float(r["written_premium_for_program"])) if r.get("written_premium_for_program") else None,
    }
    if r["major_line"] == "PPA":
        ambest_ppa.append(row)
    elif r["major_line"] == "HO":
        ambest_ho.append(row)

print(f"AM Best MT in-scope PPA: {len(ambest_ppa)}")
print(f"AM Best MT in-scope HO:  {len(ambest_ho)}")
from collections import Counter
print(f"  PPA per-brand: {Counter(r['brand'] for r in ambest_ppa).most_common()}")
print(f"  HO  per-brand: {Counter(r['brand'] for r in ambest_ho).most_common()}")


# ---- Load our AZ rows --------------------------------------------------------
wb = openpyxl.load_workbook(DATASET_XLSX, read_only=True)
ws = wb["rate_filings"]
rows = list(ws.iter_rows(values_only=True))
hdr = list(rows[0])
data = [dict(zip(hdr, r)) for r in rows[1:]]
mt_rows = [d for d in data if d["state"] == "MT"]


def _is_ppa(d):
    s = d.get("sub_type_of_insurance") or ""
    return s.startswith("19.0001") or s.startswith("19.0000") or s.startswith("19.0002") or s.startswith("19.0004")


def _is_ho(d):
    s = d.get("sub_type_of_insurance") or ""
    return s.startswith("04.")


mt_ppa = [d for d in mt_rows if _is_ppa(d)]
mt_ho  = [d for d in mt_rows if _is_ho(d)]
mt_other = [d for d in mt_rows if not _is_ppa(d) and not _is_ho(d)]
print(f"\nOur AZ total: {len(mt_rows)} | PPA bucket: {len(mt_ppa)} | HO bucket: {len(mt_ho)} | other: {len(mt_other)}")


def _our_eff(d):
    return _norm_eff(_to_dt_yyyy(d.get("effective_date")))


def _our_impact(d):
    s = (d.get("overall_rate_impact") or "").rstrip("%").strip()
    try: return round(float(s), 3)
    except (ValueError, TypeError): return None


def _our_ph(d):
    v = d.get("policyholders_affected")
    try: return int(float(v)) if v not in (None, "") else None
    except (ValueError, TypeError): return None


from crosscheck_artifact import emit_from_tiers


def cross_check(ambest_rows: list[dict], our_rows: list[dict], our_other: list[dict], label: str):
    """Tier-1/2/3 cross-check, mirrors compare_ut_ambest.py logic."""
    my_lookup: dict[tuple, dict] = {}
    for d in our_rows:
        k = (_norm_name(d["company_name"]), _our_eff(d), _our_impact(d))
        my_lookup[k] = d

    ph_lookup: dict[tuple, dict] = {}
    for d in our_rows:
        k = (_norm_name(d["company_name"]), _our_impact(d), _our_ph(d))
        ph_lookup.setdefault(k, d)

    other_lookup: dict[tuple, dict] = {}
    for d in our_other:
        k = (_norm_name(d["company_name"]), _our_impact(d), _our_ph(d))
        other_lookup.setdefault(k, d)

    matched_tier1, remaining = [], []
    for r in ambest_rows:
        k = (_norm_name(r["subsidiary"]), _norm_eff(r["effective_date"]), r["impact_pct"])
        if k in my_lookup:
            matched_tier1.append((r, my_lookup[k]))
        else:
            remaining.append(r)

    matched_tier2, still = [], []
    for r in remaining:
        k = (_norm_name(r["subsidiary"]), r["impact_pct"], r["policyholders"])
        if k in ph_lookup:
            matched_tier2.append((r, ph_lookup[k]))
        else:
            still.append(r)

    reclass, truly_missing = [], []
    for r in still:
        k = (_norm_name(r["subsidiary"]), r["impact_pct"], r["policyholders"])
        if k in other_lookup:
            reclass.append((r, other_lookup[k]))
        else:
            truly_missing.append(r)

    matched = matched_tier1 + matched_tier2
    total_in_scope = len(matched) + len(reclass) + len(truly_missing)
    match_rate = (len(matched) + len(reclass)) / total_in_scope * 100 if total_in_scope else 0.0

    print()
    print("=" * 70)
    print(f"AM Best MT {label} cross-check")
    print("=" * 70)
    print(f"AM Best in-scope rows: {len(ambest_rows)}")
    print(f"  Tier 1 — Direct (sub + eff + impact):    {len(matched_tier1)}")
    print(f"  Tier 2 — Date-relaxed (sub + imp + ph):  {len(matched_tier2)}")
    print(f"  Tier 3 — Sub-type reclass:               {len(reclass)}")
    print(f"  Still missing from our dataset:          {len(truly_missing)}")
    print(f"  In-scope match rate:  {len(matched) + len(reclass)} / {total_in_scope} ({match_rate:.1f}%)")

    if truly_missing:
        print(f"\n--- Still missing from our AZ {label} dataset ({len(truly_missing)}) ---")
        for r in truly_missing:
            print(f"  {r['brand']:14s} {r['subsidiary']:50s} eff={_norm_eff(r['effective_date'])} imp={r['impact_pct']}% pol={r['policyholders']}")

    if reclass:
        print(f"\n--- Sub-type reclass ({label}) ---")
        for r, d in reclass:
            print(f"  {r['subsidiary']:50s} eff={_norm_eff(r['effective_date'])} imp={r['impact_pct']}% -> our sub_toi={d['sub_type_of_insurance']}")

    emit_from_tiers("MT", label, our_rows, matched_tier1, matched_tier2, reclass, truly_missing,
                    norm_name=_norm_name, our_eff=_our_eff, our_impact=_our_impact,
                    our_ph=_our_ph, norm_eff=_norm_eff)
    return matched, reclass, truly_missing


cross_check(ambest_ppa, mt_ppa, mt_ho + mt_other, "PPA")
cross_check(ambest_ho,  mt_ho,  mt_ppa + mt_other, "HO")

# Extras: in our dataset but not in AM Best
def report_extras(ambest_rows, our_rows, label):
    ambest_keys = {(_norm_name(r["subsidiary"]), _norm_eff(r["effective_date"]), r["impact_pct"]) for r in ambest_rows}
    extras = []
    for d in our_rows:
        k = (_norm_name(d["company_name"]), _our_eff(d), _our_impact(d))
        if k not in ambest_keys:
            extras.append(d)
    print(f"\n--- Our AZ {label} not in AM Best ({len(extras)}) ---")
    for d in extras:
        print(f"  {d['serff_tracking_number']:22s} {d['company_name']:48s} eff={d['effective_date']} imp={d['overall_rate_impact']} act={d['rate_activity']}")


report_extras(ambest_ppa, mt_ppa, "PPA")
report_extras(ambest_ho,  mt_ho,  "HO")
