"""Blast radius of the AM Best parser-drop false negative. Offline.

Signal: an AM Best CSV row with BLANK subsidiary but data_n_a == 'False' means
AM Best did NOT flag the filing N/A, yet the parser captured no subsidiary/
values -> a dropped block (same class as the prior blank-indicated / header-
dropped parser fixes). Legit N/A rows (data_n_a == 'True') are expected blanks.

We (1) count parser-drop rows per state/line, and (2) estimate how many of our
706 'none' scraped rows could become matchable: in-window, nonzero-impact 'none'
rows that sit on an effective date where AM Best has a parser-drop row.
"""
import csv
import glob
import os
from collections import Counter, defaultdict

import analyze_reverse_crosscheck as A


def amb_rows(state):
    sl = state.lower()
    if sl == "or":
        return []  # OR is inline + complete; no CSV drops to measure
    path = f"tools/ambest_{sl}_data.csv"
    return list(csv.DictReader(open(path, encoding="utf-8"))) if os.path.exists(path) else []


# (1) parser-drop rows per state/line (unique, in-window, Rate)
print("=== AM Best parser-drop rows (blank subsidiary, data_n_a=False, in-window Rate) ===")
drop_dates = defaultdict(set)   # (state,line) -> set of eff MM/DD/YY with a drop
na_true = Counter()
drop_ct = Counter()
for state in ["AZ", "GA", "MT", "NM", "NV", "UT"]:
    seen = set()
    for r in amb_rows(state):
        line = r.get("major_line") or "PPA"
        eff = r.get("effective_date")
        d = A.to_dt_yy(eff)
        if d is None or d < A.DATE_FROM or d > A.DATE_TO:
            continue
        if r.get("filing_action") != "Rate":
            continue
        key = (line, eff, r.get("disposition_date"), r.get("subsidiary"), r.get("data_n_a"))
        if key in seen:
            continue
        seen.add(key)
        if r.get("subsidiary"):
            continue
        if r.get("data_n_a") == "True":
            na_true[(state, line)] += 1
        else:
            drop_ct[(state, line)] += 1
            drop_dates[(state, line)].add(eff)
for k in sorted(set(list(drop_ct) + list(na_true))):
    print(f"  {k[0]}/{k[1]:3s}  parser-drop(blank,na=False)={drop_ct[k]:>3}   legit-N/A(na=True)={na_true[k]:>3}")
print(f"  TOTAL parser-drop rows: {sum(drop_ct.values())}")

# (2) blast radius: our in-window nonzero 'none' rows on a drop date
print("\n=== blast radius: our 'none' rows recoverable if the parser drop is fixed ===")
files = sorted(f for f in glob.glob("output/corroboration/*_corroboration.csv") if ".pre_" not in f)
recoverable = Counter()
amb_cache = {}
for f in files:
    base = os.path.basename(f).replace("_corroboration.csv", "")
    state, line = base.split("_"); state, line = state.upper(), line.upper()
    amb = amb_cache.setdefault(state, A.load_ambest(state))
    for r in csv.DictReader(open(f, encoding="utf-8")):
        if r["match_strength"] != "none":
            continue
        imp = A.parse_pct(r.get("our_impact"))
        if imp is None or imp == 0.0:
            continue
        d = A.to_dt_any(r.get("our_effective_date"))
        if d is None or d < A.DATE_FROM or d > A.DATE_TO:
            continue
        eff_yy = d.strftime("%m/%d/%y")
        if eff_yy in drop_dates.get((state, line), set()):
            recoverable[(state, line)] += 1
for k in sorted(recoverable):
    print(f"  {k[0]}/{k[1]:3s}  {recoverable[k]} recoverable 'none' rows on parser-drop dates")
print(f"  TOTAL estimated recoverable: {sum(recoverable.values())} of 706 'none' rows")
