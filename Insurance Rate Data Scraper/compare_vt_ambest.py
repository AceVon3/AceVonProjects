"""VT scrape vs AM Best VT cross-check (offline, no SERFF, no app changes).

Adapts compare_nh_ambest.py to VT. Same 3-part structure:

  (a) STANDARD  — of the AM Best VT in-scope rows (our 13 brands, Rate, 2025+
      window), how many corroborate our scrape? Tier1 direct (entity+eff+impact),
      Tier2 date-relaxed (entity+impact+ph), Tier3 sub-type reclass.
  (b) INTERIM QUALITY — for (entity, eff) pairs present in BOTH, do the rate
      impacts AGREE? Disagreements are the interim-vs-real divergences. The 6th
      interim->real data point (VA 97.7% / OH 100% / IL 99.4% / WV clean / NH 100%).
  (c) REVERSE — what does the scrape have that AM Best lacks (extras: withdrawn,
      0%, finer entities, pre-2025 back-extension) and which AM Best rows have no
      scraped counterpart (truly_missing).

VT is small-N. HO especially small (read the % with the counts -- the VA small-N
HO precedent). Gap class closed this state: General Insurance Co of America is
captured (7 General-Insurance rows total), so expect the cleanest soft-miss
profile yet -- likely routine recency / immaterial AM-Best-only rows.

Parser-bug watch: any OUR row with blank max/min % is flagged (the historical
blank-max/min / non-ASCII-minus false-negative family). If a "disagreement"
appears, check the source PDF -- may be AM Best's error (the VA SFMA precedent),
not the scrape's. No app/db writes; no external_validation upgrades (that is the
later, deliberate import step).
"""
from __future__ import annotations

import csv
from collections import Counter
from datetime import datetime
from pathlib import Path

import openpyxl

AMBEST_CSV = Path("tools/ambest_vt_data.csv")
DATASET_XLSX = Path("output/vt_final_rates.xlsx")
DATASET_SHEET = "rates"

# 13-brand keyword/exclusion sets, inlined verbatim from compare_nh_ambest.py.
TARGET_KEYWORDS: dict[str, tuple[str, ...]] = {
    "State Farm":     ("state farm", "mga insurance"),
    "GEICO":          ("geico", "government employees"),
    "Allstate":       ("allstate", "north american insurance"),
    "Encompass":      ("encompass",),
    "Travelers":      ("travelers",),
    "Liberty Mutual": ("liberty", "american states"),
    "Safeco":         ("safeco", "first national insurance company of america", "general insurance company of america"),
    "Progressive":    ("progressive", "artisan and truckers"),
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
    "lm general insurance company", "lm insurance corporation", "standard fire insurance",
    "integon ", "national general", "esurance", "drive insurance", "united financial",
    "american economy", "peerless", "noblr", "foremost", "bristol west", "coast national",
    "toggle insurance", "economy fire", "economy premier", "economy preferred",
    "amco insurance", "allied property and casualty", "depositors insurance",
    "titan indemnity", "victoria fire", "american family home", "american modern",
    "american family connect", "homesite", "midvale", "main street america",
    "permanent general", "general automobile",
)


def _norm_name(s: str) -> str:
    return " ".join((s or "").lower().replace(",", "").replace(".", "").split())


def _to_dt_yy(s: str) -> datetime | None:
    if not s: return None
    try: return datetime.strptime(s.strip(), "%m/%d/%y")
    except ValueError: return None


def _to_dt_yyyy(s) -> datetime | None:
    if s is None: return None
    s = str(s).strip()
    if not s: return None
    for fmt in ("%m/%d/%Y", "%m/%d/%y"):
        try: return datetime.strptime(s, fmt)
        except ValueError: continue
    return None


def _norm_eff(d: datetime | None) -> str:
    return d.strftime("%m/%d/%y") if d else ""


def _round_pct(v) -> float | None:
    if v is None or v == "": return None
    try: return round(float(v), 3)
    except (ValueError, TypeError): return None


def carrier_brand(name: str) -> str | None:
    n = (name or "").lower()
    if any(p in n for p in EXCLUDED_SUBSIDIARY_PATTERNS):
        return None
    for brand, kws in TARGET_KEYWORDS.items():
        if any(k in n for k in kws):
            return brand
    return None


DATE_FROM = datetime(2025, 1, 1)
DATE_TO   = datetime(2026, 12, 31)


# ---- Load + dedupe AM Best VT -------------------------------------------------
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
print(f"AM Best VT: {len(raw_rows):,} raw rows -> {len(ambest_unique):,} unique after dedup")

ambest_ppa: list[dict] = []
ambest_ho:  list[dict] = []
na_count = 0
for r in ambest_unique:
    if not r.get("subsidiary"):
        na_count += 1
        continue
    eff = _to_dt_yy(r["effective_date"])
    if eff is None or eff < DATE_FROM or eff > DATE_TO:
        continue
    if r.get("filing_action") != "Rate":
        continue
    brand = carrier_brand(r["subsidiary"])
    if not brand:
        continue
    row = {
        "brand": brand, "subsidiary": r["subsidiary"], "effective_date": eff,
        "impact_pct": _round_pct(r.get("impact_pct")),
        "indicated_pct": _round_pct(r.get("indicated_pct")),
        "policyholders": int(float(r["policyholders_affected"])) if r.get("policyholders_affected") else None,
        "wpp": int(float(r["written_premium_for_program"])) if r.get("written_premium_for_program") else None,
    }
    (ambest_ppa if r["major_line"] == "PPA" else ambest_ho if r["major_line"] == "HO" else []).append(row)

print(f"AM Best VT in-scope (our brands, Rate, {DATE_FROM:%Y-%m-%d}..{DATE_TO:%Y-%m-%d}): "
      f"PPA={len(ambest_ppa)} HO={len(ambest_ho)}  (N/A-subsidiary skipped: {na_count})")
print(f"  PPA per-brand: {Counter(r['brand'] for r in ambest_ppa).most_common()}")
print(f"  HO  per-brand: {Counter(r['brand'] for r in ambest_ho).most_common()}")


# ---- Load our VT rows --------------------------------------------------------
wb = openpyxl.load_workbook(DATASET_XLSX, read_only=True)
ws = wb[DATASET_SHEET]
rows = list(ws.iter_rows(values_only=True))
hdr = list(rows[0])
data = [dict(zip(hdr, r)) for r in rows[1:]]
vt_rows = [d for d in data if d["state"] == "VT"]


def _is_ppa(d):
    s = d.get("sub_type_of_insurance") or ""
    return s.startswith("19.")


def _is_ho(d):
    s = d.get("sub_type_of_insurance") or ""
    return s.startswith("04.")


def _our_eff(d):    return _norm_eff(_to_dt_yyyy(d.get("effective_date")))
def _our_eff_dt(d): return _to_dt_yyyy(d.get("effective_date"))


def _our_impact(d):
    s = (d.get("overall_rate_impact") or "").rstrip("%").strip()
    try: return round(float(s), 3)
    except (ValueError, TypeError): return None


def _our_ph(d):
    v = d.get("policyholders_affected")
    try: return int(float(v)) if v not in (None, "") else None
    except (ValueError, TypeError): return None


def _blank_maxmin(d):
    return (d.get("maximum_percent_change") in (None, "")) or (d.get("minimum_percent_change") in (None, ""))


vt_ppa = [d for d in vt_rows if _is_ppa(d)]
vt_ho  = [d for d in vt_rows if _is_ho(d)]
vt_other = [d for d in vt_rows if not _is_ppa(d) and not _is_ho(d)]
pre2025 = [d for d in vt_rows if (_our_eff_dt(d) and _our_eff_dt(d) < DATE_FROM)]
print(f"\nOur VT total: {len(vt_rows)} | PPA: {len(vt_ppa)} | HO: {len(vt_ho)} | other: {len(vt_other)}"
      f" | pre-2025 back-extension: {len(pre2025)} (no AM Best counterpart expected)")


# ---- (a) STANDARD cross-check: AM Best -> ours, tiered ------------------------
def cross_check(ambest_rows, our_rows, our_other, label):
    my_lookup = {(_norm_name(d["company_name"]), _our_eff(d), _our_impact(d)): d for d in our_rows}
    ph_lookup = {}
    for d in our_rows:
        ph_lookup.setdefault((_norm_name(d["company_name"]), _our_impact(d), _our_ph(d)), d)
    other_lookup = {}
    for d in our_other:
        other_lookup.setdefault((_norm_name(d["company_name"]), _our_impact(d), _our_ph(d)), d)

    t1, rem = [], []
    for r in ambest_rows:
        k = (_norm_name(r["subsidiary"]), _norm_eff(r["effective_date"]), r["impact_pct"])
        (t1 if k in my_lookup else rem).append((r, my_lookup[k]) if k in my_lookup else r)
    t2, still = [], []
    for r in rem:
        k = (_norm_name(r["subsidiary"]), r["impact_pct"], r["policyholders"])
        (t2 if k in ph_lookup else still).append((r, ph_lookup[k]) if k in ph_lookup else r)
    reclass, missing = [], []
    for r in still:
        k = (_norm_name(r["subsidiary"]), r["impact_pct"], r["policyholders"])
        (reclass if k in other_lookup else missing).append((r, other_lookup[k]) if k in other_lookup else r)

    total = len(t1) + len(t2) + len(reclass) + len(missing)
    corrob = len(t1) + len(t2) + len(reclass)
    rate = corrob / total * 100 if total else 0.0
    print(f"\n{'='*68}\n(a) STANDARD cross-check — AM Best VT {label} -> our scrape\n{'='*68}")
    print(f"  AM Best in-scope rows:                  {len(ambest_rows)}")
    print(f"  Tier 1 direct (entity+eff+impact):      {len(t1)}")
    print(f"  Tier 2 date-relaxed (entity+impact+ph): {len(t2)}")
    print(f"  Tier 3 sub-type reclass:                {len(reclass)}")
    print(f"  No scraped counterpart (AM Best-only):  {len(missing)}")
    print(f"  >>> corroboration: {corrob}/{total} ({rate:.1f}%)")
    if missing:
        print(f"  --- AM Best {label} rows with NO scraped counterpart ---")
        for r in missing[:40]:
            print(f"    {r['brand']:14s} {r['subsidiary'][:46]:46s} eff={_norm_eff(r['effective_date'])} "
                  f"imp={r['impact_pct']}% pol={r['policyholders']}")
    return t1, t2, reclass, missing


t1p, t2p, rcp, missp = cross_check(ambest_ppa, vt_ppa, vt_ho + vt_other, "PPA")
t1h, t2h, rch, missh = cross_check(ambest_ho,  vt_ho,  vt_ppa + vt_other, "HO")


# ---- (b) INTERIM QUALITY: (entity, eff) in BOTH — do impacts agree? ----------
print(f"\n{'='*68}\n(b) INTERIM QUALITY — impact agreement on (entity, eff) in BOTH\n{'='*68}")
amb_by_ent_eff: dict[tuple, list[float]] = {}
for r in ambest_ppa + ambest_ho:
    amb_by_ent_eff.setdefault((_norm_name(r["subsidiary"]), _norm_eff(r["effective_date"])), []).append(r["impact_pct"])
agree, disagree = 0, []
for d in vt_rows:
    key = (_norm_name(d["company_name"]), _our_eff(d))
    if key in amb_by_ent_eff:
        ours = _our_impact(d)
        amb_vals = amb_by_ent_eff[key]
        if any(av is not None and ours is not None and abs(av - ours) < 0.05 for av in amb_vals):
            agree += 1
        else:
            disagree.append((d, amb_vals))
print(f"  (entity,eff) pairs present in both with MATCHING impact:   {agree}")
print(f"  present in both but impact DIFFERS:                        {len(disagree)}")
for d, amb_vals in disagree[:30]:
    flag = "  <-- BLANK max/min (parser-bug watch)" if _blank_maxmin(d) else ""
    print(f"    {d['serff_tracking_number']:20s} {d['company_name'][:38]:38s} eff={d['effective_date']} "
          f"ours={d['overall_rate_impact']} ambest={amb_vals} disp={d['disposition_status']}{flag}")


# ---- (c) REVERSE: scrape richness + AM Best-only ----------------------------
print(f"\n{'='*68}\n(c) REVERSE — is the scrape richer? what is AM Best-only?\n{'='*68}")
amb_keys = {(_norm_name(r["subsidiary"]), _norm_eff(r["effective_date"]), r["impact_pct"])
            for r in ambest_ppa + ambest_ho}
extras = [d for d in vt_rows
          if (_norm_name(d["company_name"]), _our_eff(d), _our_impact(d)) not in amb_keys]
ex_withdrawn = [d for d in extras if (d.get("disposition_status") or "").lower() not in ("filed", "approved")]
ex_zero = [d for d in extras if _our_impact(d) == 0.0]
ex_pre2025 = [d for d in extras if (_our_eff_dt(d) and _our_eff_dt(d) < DATE_FROM)]
print(f"  Our scraped rows NOT in AM Best (extras): {len(extras)} of {len(vt_rows)}")
print(f"    - pre-2025 back-extension (expected):   {len(ex_pre2025)}")
print(f"    - non-Filed/Approved disposition:       {len(ex_withdrawn)} (withdrawn/returned — AM Best curates these out)")
print(f"    - 0.0% rate-neutral filings:            {len(ex_zero)} (AM Best typically omits)")
print(f"  Distinct scraped sub_types (granularity AM Best's PPA/HO lacks):")
print(f"    {Counter((d.get('sub_type_of_insurance') or '?') for d in vt_rows).most_common()}")
print(f"  Scraped per-brand (company prefix via brand keywords):")
brand_counts = Counter()
for d in vt_rows:
    b = carrier_brand(d.get("company_name") or "")
    brand_counts[b or "?"] += 1
print(f"    {brand_counts.most_common()}")
tot_missing = len(missp) + len(missh)
print(f"  AM Best-only (no scraped counterpart) total: {tot_missing}")

# Parser-bug watch summary
blank_mm = [d for d in vt_rows if _blank_maxmin(d)]
print(f"\n[parser-bug watch] our VT rows with blank max OR min %: {len(blank_mm)} "
      f"(inspect if any coincide with an AM Best 'missing' — could be a parser drop, not a real miss)")
for d in blank_mm[:20]:
    print(f"    {d['serff_tracking_number']:20s} {d['company_name'][:38]:38s} eff={d['effective_date']} "
          f"imp={d['overall_rate_impact']} max={d['maximum_percent_change']} min={d['minimum_percent_change']}")
