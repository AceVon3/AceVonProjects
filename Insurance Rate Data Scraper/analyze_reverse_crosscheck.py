"""Offline reverse-direction cross-check analysis (no SERFF).

Forward miss (already tracked): AM Best entry with no scraped row -> *_missing.csv.
REVERSE (this script): scraped row with NO AM Best entry -> match_strength=='none'
in *_corroboration.csv. Quantify and classify WHY each has no AM Best counterpart.

Buckets (honest):
  zero_or_blank        0% / blank impact — AM Best lists these as N/A (expected)
  beyond_ambest_recency  eff date later than AM Best's latest compiled entry for
                         that state/line (compilation lag / timing edge)
  brand_absent_line    brand has NO AM Best entries for this line in this state
                         (AM Best didn't compile that brand x line)
  entity_not_enumerated brand IS in AM Best for the line, but this exact legal
                         entity isn't enumerated separately
  anomaly_review       this exact entity IS enumerated by AM Best for this line,
                         yet this filing has no entry — the look-closer case
"""
from __future__ import annotations

import csv
import glob
import os
from collections import Counter, defaultdict
from datetime import datetime

DATE_FROM = datetime(2025, 1, 1)
DATE_TO = datetime(2026, 4, 17)

# 13-brand keyword map (superset; used only to bucket brand presence).
TARGET_KEYWORDS = {
    "State Farm": ("state farm", "mga insurance"),
    "GEICO": ("geico", "government employees"),
    "Allstate": ("allstate", "north american insurance"),
    "Encompass": ("encompass",),
    "Travelers": ("travelers",),
    "Liberty Mutual": ("liberty", "american states"),
    "Safeco": ("safeco", "first national insurance company of america", "general insurance company of america"),
    "Progressive": ("progressive", "artisan and truckers"),
    "USAA": ("usaa", "united services", "garrison"),
    "Farmers": ("farmers", "fire insurance exchange", "truck insurance exchange", "mid-century"),
    "Nationwide": ("nationwide",),
    "American Family": ("american family",),
    "Country Financial": ("country mutual", "country preferred", "country casualty"),
}
EXCLUDED = ("lm general", "lm insurance corporation", "standard fire", "integon ",
            "national general", "esurance", "drive insurance", "united financial",
            "american economy", "peerless", "noblr", "foremost", "bristol west",
            "coast national", "toggle insurance", "economy fire", "economy premier",
            "economy preferred", "amco insurance", "allied property", "depositors insurance",
            "titan indemnity", "victoria fire", "american family home", "american modern",
            "american family connect", "homesite", "midvale", "main street america",
            "permanent general", "general automobile")


def norm(s):
    return " ".join((s or "").lower().replace(",", "").replace(".", "").split())


def brand_of(name):
    n = (name or "").lower()
    if any(p in n for p in EXCLUDED):
        return None
    for b, kws in TARGET_KEYWORDS.items():
        if any(k in n for k in kws):
            return b
    return None


def to_dt_yy(s):
    try:
        return datetime.strptime((s or "").strip(), "%m/%d/%y")
    except ValueError:
        return None


def to_dt_any(s):
    s = str(s or "").strip()
    for f in ("%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, f)
        except ValueError:
            continue
    return None


def parse_pct(s):
    s = str(s or "").strip().rstrip("%").strip()
    if s == "":
        return None
    try:
        return round(float(s), 3)
    except ValueError:
        return None


def _blank_out():
    return {"PPA": {"subnames": set(), "brands": set(), "eff_max": None, "records": []},
            "HO": {"subnames": set(), "brands": set(), "eff_max": None, "records": []}}


def _accum(out, line, sub, eff, imp=None):
    if line not in out or not sub:
        return
    if eff is None or eff < DATE_FROM or eff > DATE_TO:
        return
    out[line]["subnames"].add(norm(sub))
    out[line]["records"].append((norm(sub), imp, eff))
    b = brand_of(sub)
    if b:
        out[line]["brands"].add(b)
    if out[line]["eff_max"] is None or eff > out[line]["eff_max"]:
        out[line]["eff_max"] = eff


def ambest_has_impact(amb, line, sub, imp):
    """Does AM Best list this exact entity with ~this impact at ANY date?
    (a date near-miss the tiers didn't relax to, vs a genuine absence)"""
    if imp is None:
        return False
    ns = norm(sub)
    for rsub, rimp, _eff in amb.get(line, {}).get("records", []):
        if rsub == ns and rimp is not None and abs(rimp - imp) <= 0.15:
            return True
    return False


def load_ambest(state):
    """Return {line: {'subnames': set, 'brands': set, 'eff_max': dt|None}} in-scope.
    Schema-tolerant: GA/AZ/MT/NM/NV CSV (has major_line); UT CSV (PPA-only, no
    major_line); OR inline AMBEST list in compare_or_ambest.py (PPA-only). No
    dedup needed — we build sets + a max, which are idempotent."""
    out = _blank_out()
    sl = state.lower()
    if sl == "or":
        import ast
        import re
        txt = open("compare_or_ambest.py", encoding="utf-8").read()
        m = re.search(r"AMBEST\s*=\s*(\[.*?\n\])", txt, re.S)
        for tup in (ast.literal_eval(m.group(1)) if m else []):
            _accum(out, "PPA", tup[0], to_dt_yy(tup[1]), tup[3])
        return out
    path = f"tools/ambest_{sl}_data.csv"
    if not os.path.exists(path):
        return out
    for r in csv.DictReader(open(path, encoding="utf-8")):
        if r.get("filing_action") != "Rate":
            continue
        line = r.get("major_line") or "PPA"  # UT CSV is PPA-only, no major_line
        _accum(out, line, r.get("subsidiary"), to_dt_yy(r.get("effective_date")),
               parse_pct(r.get("impact_pct")))
    return out


def classify(row, line, amb):
    imp = parse_pct(row.get("our_impact"))
    if imp is None or imp == 0.0:
        return "zero_or_blank"
    eff = to_dt_any(row.get("our_effective_date"))
    if eff and eff < DATE_FROM:
        return "outside_ambest_window"   # our row predates AM Best's coverage window
    a = amb.get(line, {"subnames": set(), "brands": set(), "eff_max": None})
    if eff and a["eff_max"] and eff > a["eff_max"]:
        return "beyond_ambest_recency"   # later than AM Best's latest compiled entry
    sub = row.get("our_subsidiary")
    if norm(sub) in a["subnames"]:
        return "anomaly_review"
    b = brand_of(sub)
    if b is None or b not in a["brands"]:
        return "brand_absent_line"
    return "entity_not_enumerated"


BUCKETS = ["zero_or_blank", "outside_ambest_window", "beyond_ambest_recency",
           "brand_absent_line", "entity_not_enumerated", "anomaly_review"]


def main():
    files = sorted(f for f in glob.glob("output/corroboration/*_corroboration.csv") if ".pre_" not in f)
    ambest_cache = {}
    grand = Counter()
    anomalies = []
    print(f"{'state/line':12s} {'none':>5} | " + " ".join(f"{b[:10]:>11s}" for b in BUCKETS))
    print("-" * 92)
    for f in files:
        base = os.path.basename(f).replace("_corroboration.csv", "")
        state, line = base.split("_")
        state, line = state.upper(), line.upper()
        amb = ambest_cache.setdefault(state, load_ambest(state))
        rows = [r for r in csv.DictReader(open(f, encoding="utf-8")) if r["match_strength"] == "none"]
        c = Counter()
        for r in rows:
            bkt = classify(r, line, amb)
            c[bkt] += 1
            grand[bkt] += 1
            if bkt == "anomaly_review":
                anomalies.append((state, line, r))
        print(f"{state+'/'+line:12s} {len(rows):>5} | " + " ".join(f"{c[b]:>11d}" for b in BUCKETS))
    print("-" * 92)
    print(f"{'TOTAL':12s} {sum(grand.values()):>5} | " + " ".join(f"{grand[b]:>11d}" for b in BUCKETS))

    # Sub-classify anomalies: AM Best has this entity+impact at a DIFFERENT date
    # (a date near-miss the tiers didn't bridge) vs no such impact at all (a
    # genuine absence of an enumerated entity — the real look-closer case).
    near, absent = [], []
    for state, line, r in anomalies:
        amb = ambest_cache[state]
        if ambest_has_impact(amb, line, r.get("our_subsidiary"), parse_pct(r.get("our_impact"))):
            near.append((state, line, r))
        else:
            absent.append((state, line, r))

    def show(tag, rows):
        print(f"\n=== {tag} ({len(rows)}) ===")
        for state, line, r in rows:
            print(f"  {state}/{line}  {r.get('our_serff_tracking_number',''):22s} "
                  f"{(r.get('our_subsidiary') or '')[:44]:44s} "
                  f"eff={r.get('our_effective_date','')} imp={str(r.get('our_impact','')):>8s} "
                  f"ph={r.get('our_policyholders','')}")

    show("anomaly: DATE NEAR-MISS — AM Best has this entity+impact at another date "
         "(tier date-relax gap, not a true absence)", near)
    show("anomaly: GENUINE ABSENCE — entity enumerated by AM Best for this line, but no "
         "matching rate change at any date (the real look-closer cases)", absent)


if __name__ == "__main__":
    main()
