"""Shared AM Best cross-check artifact writer (CROSS_CHECK_STANDARD.md).

Every compare_{state}_ambest.py calls write_corroboration() to emit a per-row
corroboration CSV (one row per OUR in-scope row) plus a missing-AM-Best CSV,
and prints the direct/date_relaxed/reclassified/none strength split with a
mostly-date-relaxed flag. This is what was missing originally (UT 19/19 could
not be re-derived because no per-row record existed).
"""
from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

OUT_DIR = Path("output/corroboration")
STRENGTHS = ("direct", "date_relaxed", "reclassified", "none")
CORR_COLUMNS = [
    "state", "line", "our_serff_tracking_number", "our_subsidiary",
    "our_effective_date", "our_impact", "our_policyholders",
    "matched_ambest_subsidiary", "ambest_effective_date", "ambest_impact",
    "ambest_policyholders",
    "agreed_subsidiary", "agreed_impact", "agreed_eff_date", "agreed_policyholders",
    "match_strength",
]


def write_corroboration(state: str, line: str, our_rows: list[dict],
                        matched: dict, missing_ambest: list[dict] | None = None,
                        key_fn=None) -> dict:
    """Write the per-row corroboration artifact for one (state, line).

    our_rows      : list of our in-scope row dicts (PPA or HO bucket).
    matched       : { our_row_key : {"ambest": {...}|None, "strength": str,
                                      "agreed": {"subsidiary","impact",
                                                 "eff_date","policyholders"}} }
    missing_ambest: AM Best in-scope entries with no match (coverage gaps).
    key_fn        : our_row -> hashable key (default: (tracking, subsidiary)).

    Returns a summary dict (per-strength counts + mostly_date_relaxed flag).
    Raises if `line` not in {PPA, HO} or a match_strength is unknown — the
    standard requires both lines and the four-value taxonomy.
    """
    if line not in ("PPA", "HO"):
        raise ValueError(f"line must be PPA or HO, got {line!r}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    key_fn = key_fn or (lambda d: (d.get("serff_tracking_number"), d.get("company_name")))

    recs = []
    for d in our_rows:
        m = matched.get(key_fn(d), {"ambest": None, "strength": "none", "agreed": {}})
        strength = m.get("strength", "none")
        if strength not in STRENGTHS:
            raise ValueError(f"unknown match_strength {strength!r} (allowed: {STRENGTHS})")
        amb = m.get("ambest") or {}
        ag = m.get("agreed") or {}
        recs.append({
            "state": state, "line": line,
            "our_serff_tracking_number": d.get("serff_tracking_number"),
            "our_subsidiary": d.get("company_name"),
            "our_effective_date": d.get("effective_date"),
            "our_impact": d.get("overall_rate_impact"),
            "our_policyholders": d.get("policyholders_affected"),
            "matched_ambest_subsidiary": amb.get("subsidiary", ""),
            "ambest_effective_date": amb.get("effective_date", ""),
            "ambest_impact": amb.get("impact", ""),
            "ambest_policyholders": amb.get("policyholders", ""),
            "agreed_subsidiary": ag.get("subsidiary", ""),
            "agreed_impact": ag.get("impact", ""),
            "agreed_eff_date": ag.get("eff_date", ""),
            "agreed_policyholders": ag.get("policyholders", ""),
            "match_strength": strength,
        })

    corr_path = OUT_DIR / f"{state.lower()}_{line.lower()}_corroboration.csv"
    with open(corr_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CORR_COLUMNS); w.writeheader(); w.writerows(recs)

    if missing_ambest:
        miss_path = OUT_DIR / f"{state.lower()}_{line.lower()}_missing.csv"
        with open(miss_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["state", "line", "subsidiary", "effective_date", "impact", "policyholders"])
            for a in missing_ambest:
                w.writerow([state, line, a.get("subsidiary"), a.get("effective_date"), a.get("impact"), a.get("policyholders")])

    cnt = Counter(r["match_strength"] for r in recs)
    matched_n = sum(cnt[s] for s in ("direct", "date_relaxed", "reclassified"))
    summary = {"state": state, "line": line, "our_rows": len(recs),
               "direct": cnt["direct"], "date_relaxed": cnt["date_relaxed"],
               "reclassified": cnt["reclassified"], "none": cnt["none"],
               "matched": matched_n,
               "mostly_date_relaxed": bool(matched_n and cnt["date_relaxed"] > cnt["direct"]),
               "artifact": str(corr_path)}
    return summary


def emit_from_tiers(state: str, line: str, our_rows: list[dict],
                    matched_tier1: list, matched_tier2: list, reclass: list,
                    missing_ambest: list, *,
                    norm_name, our_eff, our_impact, our_ph, norm_eff) -> dict:
    """Convenience wrapper for the standard tier-based comparators: assemble the
    per-row `matched` map from (ambest, our_row) pairs in each tier and write the
    artifact. matched_tier1 -> direct, matched_tier2 -> date_relaxed,
    reclass -> reclassified. The supplied fns parse/normalize a comparator's own
    field formats (so this stays state-agnostic)."""
    def amb_view(a):
        return {"subsidiary": a["subsidiary"], "effective_date": norm_eff(a["effective_date"]),
                "impact": a["impact_pct"], "policyholders": a["policyholders"]}

    def agree(a, d):
        return {"subsidiary": norm_name(a["subsidiary"]) == norm_name(d["company_name"]),
                "impact": a["impact_pct"] == our_impact(d),
                "eff_date": norm_eff(a["effective_date"]) == our_eff(d),
                "policyholders": a["policyholders"] == our_ph(d)}

    def key(d):
        return (d.get("serff_tracking_number"), d.get("company_name"))

    mm: dict = {}
    for a, d in matched_tier1:
        mm[key(d)] = {"ambest": amb_view(a), "strength": "direct", "agreed": agree(a, d)}
    for a, d in matched_tier2:
        mm.setdefault(key(d), {"ambest": amb_view(a), "strength": "date_relaxed", "agreed": agree(a, d)})
    for a, d in reclass:
        mm.setdefault(key(d), {"ambest": amb_view(a), "strength": "reclassified", "agreed": agree(a, d)})

    rows = list(our_rows)
    ks = {key(d) for d in our_rows}
    for a, d in reclass:
        if key(d) not in ks:
            rows.append(d); ks.add(key(d))
    miss = [{"subsidiary": r["subsidiary"], "effective_date": norm_eff(r["effective_date"]),
             "impact": r["impact_pct"], "policyholders": r["policyholders"]} for r in missing_ambest]
    s = write_corroboration(state, line, rows, mm, miss)
    print_summary(s)
    return s


def print_summary(summary: dict) -> None:
    s = summary
    flag = "  [!] MOSTLY DATE-RELAXED (soft corroboration)" if s["mostly_date_relaxed"] else ""
    print(f"[{s['state']} {s['line']}] our_rows={s['our_rows']} matched={s['matched']} "
          f"(direct={s['direct']} date_relaxed={s['date_relaxed']} "
          f"reclassified={s['reclassified']} none={s['none']}){flag}")
    print(f"  -> {s['artifact']}")
