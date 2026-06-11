"""Match GA dataset against AM Best GA PPA + Homeowners Multi-Peril reports.

AM Best GA data comes from THREE effective-date-range PDFs (parsed by
tools/parse_ambest_ga.py into tools/ambest_ga_data.csv, with a source_file
column): eff 2024-01-01->2024-10-31, 2024-10-31->2025-06-27, 2025-07-01->
2026-06-08. The files tile the window with a boundary overlap at 2024-10-31
that the 6-tuple dedup below collapses (source_file is deliberately NOT part
of the dedup key). Both PPA and HO are in the same export, same layout as NM.

Reads our GA rows from output/ga_final_rates.xlsx (sheet "rates") so the
cross-check runs at ingestion BEFORE GA is folded into all_states (per
CROSS_CHECK_STANDARD.md). Window-filtered to DATE_TO=2026-04-17 so AM Best
entries past our cutoff (file 3 runs to 2026-06-08) don't generate false
"missing from ours" flags.

Match keys: (subsidiary_name_normalized, effective_date_MMDDYY, impact_pct),
with tiered relaxation (date-relaxed by policyholders+impact, sub-type reclass)
mirroring compare_nm_ambest.py / compare_ut_ambest.py.
"""
from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path

import openpyxl

AMBEST_CSV = Path("tools/ambest_ga_data.csv")
DATASET_XLSX = Path("output/ga_final_rates.xlsx")
DATASET_SHEET = "rates"

TARGET_KEYWORDS: dict[str, tuple[str, ...]] = {
    "State Farm":     ("state farm", "mga insurance"),
    "GEICO":          ("geico", "government employees"),
    "Allstate":       ("allstate", "north american insurance"),
    "Encompass":      ("encompass",),
    "Travelers":      ("travelers",),
    "Liberty Mutual": ("liberty", "american states"),
    "Safeco":         ("safeco", "first national insurance company of america", "general insurance company of america"),
    "Progressive":    ("progressive", "artisan and truckers"),
    # 13-brand expansion (2026-06-10, SCOPE.md) — anchored on the exact
    # entity names the AM Best reports use (Phase 1 confirmation).
    "USAA":             ("usaa", "united services", "garrison"),
    "Farmers":          ("farmers insurance exchange", "fire insurance exchange",
                         "truck insurance exchange", "mid-century",
                         "farmers insurance company", "farmers casualty",
                         "farmers property and casualty", "farmers direct",
                         "farmers group property"),
    "Nationwide":       ("nationwide",),
    "American Family":  ("american family",),
    "Country Financial": ("country mutual", "country preferred", "country casualty"),
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
    # 13-brand expansion exclusions (SCOPE.md). Checked BEFORE brand keywords
    # in carrier_brand, which is what keeps the Munich Re "American Family
    # Home" (NAIC 23450) collision out of the American Family bucket.
    "noblr",
    "foremost",
    "bristol west",
    "coast national",
    "toggle insurance",
    "economy fire",
    "economy premier",
    "economy preferred",
    "amco insurance",
    "allied property and casualty",
    "depositors insurance",
    "titan indemnity",
    "victoria fire",
    "american family home",
    "american modern",
    "american family connect",
    "homesite",
    "midvale",
    "main street america",
    "permanent general",
    "general automobile",
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


# ---- Load AM Best GA rows and dedupe -----------------------------------------
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
print(f"AM Best GA: {len(raw_rows):,} raw rows -> {len(ambest_unique):,} unique after dedup")

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

print(f"AM Best GA in-scope PPA: {len(ambest_ppa)}")
print(f"AM Best GA in-scope HO:  {len(ambest_ho)}")
from collections import Counter
print(f"  PPA per-brand: {Counter(r['brand'] for r in ambest_ppa).most_common()}")
print(f"  HO  per-brand: {Counter(r['brand'] for r in ambest_ho).most_common()}")


# ---- Load our GA rows --------------------------------------------------------
wb = openpyxl.load_workbook(DATASET_XLSX, read_only=True)
ws = wb[DATASET_SHEET]
rows = list(ws.iter_rows(values_only=True))
hdr = list(rows[0])
data = [dict(zip(hdr, r)) for r in rows[1:]]
ga_rows = [d for d in data if d["state"] == "GA"]


def _is_ppa(d):
    s = d.get("sub_type_of_insurance") or ""
    return s.startswith("19.0001") or s.startswith("19.0000") or s.startswith("19.0002") or s.startswith("19.0004")


def _is_ho(d):
    s = d.get("sub_type_of_insurance") or ""
    return s.startswith("04.")


ga_ppa = [d for d in ga_rows if _is_ppa(d)]
ga_ho  = [d for d in ga_rows if _is_ho(d)]
ga_other = [d for d in ga_rows if not _is_ppa(d) and not _is_ho(d)]
print(f"\nOur GA total: {len(ga_rows)} | PPA bucket: {len(ga_ppa)} | HO bucket: {len(ga_ho)} | other: {len(ga_other)}")


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
    """Tier-1/2/3 cross-check, mirrors compare_nm_ambest.py logic."""
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
    print(f"AM Best GA {label} cross-check")
    print("=" * 70)
    print(f"AM Best in-scope rows: {len(ambest_rows)}")
    print(f"  Tier 1 — Direct (sub + eff + impact):    {len(matched_tier1)}")
    print(f"  Tier 2 — Date-relaxed (sub + imp + ph):  {len(matched_tier2)}")
    print(f"  Tier 3 — Sub-type reclass:               {len(reclass)}")
    print(f"  Still missing from our dataset:          {len(truly_missing)}")
    print(f"  In-scope match rate:  {len(matched) + len(reclass)} / {total_in_scope} ({match_rate:.1f}%)")

    if truly_missing:
        print(f"\n--- Still missing from our GA {label} dataset ({len(truly_missing)}) ---")
        for r in truly_missing:
            print(f"  {r['brand']:14s} {r['subsidiary']:50s} eff={_norm_eff(r['effective_date'])} imp={r['impact_pct']}% pol={r['policyholders']}")

    if reclass:
        print(f"\n--- Sub-type reclass ({label}) ---")
        for r, d in reclass:
            print(f"  {r['subsidiary']:50s} eff={_norm_eff(r['effective_date'])} imp={r['impact_pct']}% -> our sub_toi={d['sub_type_of_insurance']}")

    emit_from_tiers("GA", label, our_rows, matched_tier1, matched_tier2, reclass, truly_missing,
                    norm_name=_norm_name, our_eff=_our_eff, our_impact=_our_impact,
                    our_ph=_our_ph, norm_eff=_norm_eff)
    return matched, reclass, truly_missing


cross_check(ambest_ppa, ga_ppa, ga_ho + ga_other, "PPA")
cross_check(ambest_ho,  ga_ho,  ga_ppa + ga_other, "HO")

# Extras: in our dataset but not in AM Best
def report_extras(ambest_rows, our_rows, label):
    ambest_keys = {(_norm_name(r["subsidiary"]), _norm_eff(r["effective_date"]), r["impact_pct"]) for r in ambest_rows}
    extras = []
    for d in our_rows:
        k = (_norm_name(d["company_name"]), _our_eff(d), _our_impact(d))
        if k not in ambest_keys:
            extras.append(d)
    print(f"\n--- Our GA {label} not in AM Best ({len(extras)}) ---")
    for d in extras:
        print(f"  {d['serff_tracking_number']:22s} {d['company_name']:48s} eff={d['effective_date']} imp={d['overall_rate_impact']} act={d['rate_activity']}")


report_extras(ambest_ppa, ga_ppa, "PPA")
report_extras(ambest_ho,  ga_ho,  "HO")
