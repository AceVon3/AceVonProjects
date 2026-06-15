"""Definitive blast radius: for each in-window nonzero 'none' row that the
reverse cross-check flagged (anomaly_review OR entity_not_enumerated), check
whether its exact policyholder count appears in the AM Best RAW TEXT. If yes,
the filing IS in the AM Best source and the CSV lacks it => parser-drop false
negative => recoverable by fixing the parser. Offline (raw text + artifacts)."""
import csv
import glob
import os

import analyze_reverse_crosscheck as A

RAWTEXT = {
    "AZ": ["output/ambest_az_text.txt"],
    "GA": ["output/ambest_ga_text_1.txt", "output/ambest_ga_text_2.txt", "output/ambest_ga_text_3.txt"],
    "MT": ["output/ambest_mt_text.txt"],
    "NM": ["output/ambest_nm_text.txt"],
    "NV": ["output/ambest_nv_text.txt"],
    "UT": ["output/ambest_ut_ppa_text.txt"],
}
_cache = {}


def raw(state):
    if state not in _cache:
        t = ""
        for p in RAWTEXT.get(state, []):
            if os.path.exists(p):
                t += open(p, encoding="utf-8", errors="ignore").read()
        _cache[state] = t
    return _cache[state]


def ph_in_text(state, ph):
    if not ph:
        return False
    try:
        n = int(float(ph))
    except (ValueError, TypeError):
        return False
    if n < 50:           # tiny counts are not specific enough to be evidence
        return None
    return f"{n:,}" in raw(state) or str(n) in raw(state)


files = sorted(f for f in glob.glob("output/corroboration/*_corroboration.csv") if ".pre_" not in f)
amb_cache = {}
confirmed = notfound = tiny = recent = 0
rows_out = []
for f in files:
    base = os.path.basename(f).replace("_corroboration.csv", "")
    state, line = base.split("_"); state, line = state.upper(), line.upper()
    if state == "OR":
        continue  # OR inline data, no raw-text artifact
    amb = amb_cache.setdefault(state, A.load_ambest(state))
    for r in csv.DictReader(open(f, encoding="utf-8")):
        if r["match_strength"] != "none":
            continue
        bkt = A.classify(r, line, amb)
        if bkt not in ("anomaly_review", "entity_not_enumerated"):
            continue
        d = A.to_dt_any(r.get("our_effective_date"))
        if d and d.year == 2026 and d.month >= 3:
            recent += 1; verdict = "recent (AM Best lag, skip)"
        else:
            hit = ph_in_text(state, r.get("our_policyholders"))
            if hit is True:
                confirmed += 1; verdict = "CONFIRMED in raw text -> PARSER DROP (recoverable)"
            elif hit is None:
                tiny += 1; verdict = "tiny ph (inconclusive)"
            else:
                notfound += 1; verdict = "not in raw text (genuine absence / value differs)"
        rows_out.append((state, line, bkt, r, verdict))

for state, line, bkt, r, verdict in rows_out:
    print(f"{state}/{line} {bkt[:12]:12s} {r['our_serff_tracking_number']:20s} "
          f"{(r['our_subsidiary'] or '')[:36]:36s} imp={r['our_impact']:>8s} ph={r['our_policyholders']:>9s} -> {verdict}")

print(f"\n=== BLAST RADIUS (definitive, raw-text confirmed) ===")
print(f"  CONFIRMED parser-drop false negatives (recoverable): {confirmed}")
print(f"  not in raw text (genuine absence / value diff):      {notfound}")
print(f"  tiny ph (inconclusive):                              {tiny}")
print(f"  recent 2026 (AM Best lag, excluded):                 {recent}")
