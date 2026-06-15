"""Offline diagnostic: for each reverse-cross-check 'genuine absence' anomaly,
show what the AM Best CSV actually holds at that effective date — to tell a
PARSER drop (blank row at that date) from a MATCHER value-mismatch (entity
present at that date with a different impact). No SERFF.
"""
import csv
import glob
import os
from datetime import datetime

import analyze_reverse_crosscheck as A


def amb_rows_for_state(state):
    sl = state.lower()
    if sl == "or":
        import ast
        import re
        txt = open("compare_or_ambest.py", encoding="utf-8").read()
        m = re.search(r"AMBEST\s*=\s*(\[.*?\n\])", txt, re.S)
        out = []
        for t in (ast.literal_eval(m.group(1)) if m else []):
            out.append({"subsidiary": t[0], "effective_date": t[1], "impact_pct": t[3],
                        "policyholders_affected": t[4], "data_n_a": "False", "major_line": "PPA"})
        return out
    path = f"tools/ambest_{sl}_data.csv"
    return list(csv.DictReader(open(path, encoding="utf-8"))) if os.path.exists(path) else []


def to_yy(our_eff):
    d = A.to_dt_any(our_eff)
    return d.strftime("%m/%d/%y") if d else None


# Re-derive the genuine-absence anomalies
files = sorted(f for f in glob.glob("output/corroboration/*_corroboration.csv") if ".pre_" not in f)
amb_cache = {}
parser_drop = matcher_mismatch = other = 0
print("Per genuine-absence anomaly: AM Best CSV rows at the SAME effective date\n")
for f in files:
    base = os.path.basename(f).replace("_corroboration.csv", "")
    state, line = base.split("_")
    state, line = state.upper(), line.upper()
    amb = amb_cache.setdefault(state, A.load_ambest(state))
    rawrows = amb_cache.setdefault(state + "_raw", amb_rows_for_state(state))
    for r in csv.DictReader(open(f, encoding="utf-8")):
        if r["match_strength"] != "none":
            continue
        if A.classify(r, line, amb) != "anomaly_review":
            continue
        imp = A.parse_pct(r.get("our_impact"))
        if A.ambest_has_impact(amb, line, r.get("our_subsidiary"), imp):
            continue  # date near-miss, not a genuine absence
        eff_yy = to_yy(r.get("our_effective_date"))
        same_eff = [x for x in rawrows
                    if (x.get("major_line") or "PPA") == line and x.get("effective_date") == eff_yy]
        blanks = [x for x in same_eff if not x.get("subsidiary")]
        named = [x for x in same_eff if x.get("subsidiary")]
        # does a named row at this date carry our entity?
        ent_here = [x for x in named if A.norm(x["subsidiary"]) == A.norm(r.get("our_subsidiary"))]
        if ent_here:
            verdict = "MATCHER? entity present at this date w/ impact=" + ",".join(x.get("impact_pct", "") for x in ent_here)
            matcher_mismatch += 1
        elif blanks:
            verdict = f"PARSER-DROP? {len(blanks)} blank row(s) at this date (na={[x.get('data_n_a') for x in blanks]})"
            parser_drop += 1
        else:
            verdict = f"no row at this date in CSV ({len(named)} other named here)"
            other += 1
        print(f"{state}/{line} {r['our_serff_tracking_number']:20s} {(r['our_subsidiary'] or '')[:38]:38s} "
              f"eff={eff_yy} imp={r['our_impact']:>8s}")
        print(f"      -> {verdict}")

print(f"\n=== blast-radius tally (genuine-absence anomalies) ===")
print(f"  PARSER-DROP candidates (blank row at our eff date):  {parser_drop}")
print(f"  MATCHER candidates (entity present at date, diff val): {matcher_mismatch}")
print(f"  neither (no CSV row at that date at all):             {other}")
