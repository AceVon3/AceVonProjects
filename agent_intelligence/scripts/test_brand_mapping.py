"""derive_brand scope tests — the bare-"farmers"-substring fix (2026-07-07).

The ND cross-check found ~86 live interim rows across 13 independent mutuals
("Farmers Mutual of Nebraska", "Farmers Alliance Mutual", Pekin's "The Farmers
Automobile Insurance Association", ...) mislabeled brand=Farmers by a bare
"farmers" substring — the Mutual-of-Wausau class. The fix: derive_brand maps
only the explicit _FIG_FARMERS_PATTERNS allowlist to Farmers; the independents
are also in _AMBEST_EXCLUDE (belt-and-suspenders).

Run:
    python scripts/test_brand_mapping.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_filings import derive_brand, _AMBEST_EXCLUDE

# Every FIG "Farmers*" entity observed in the live 19-state dataset + the
# AM Best CSVs (2026-07-07 sweep), plus the no-"farmers" exchanges.
FIG_ENTITIES = [
    "Farmers Insurance Exchange",
    "Fire Insurance Exchange",
    "Truck Insurance Exchange",
    "Mid-Century Insurance Company",
    "Mid-Century Insurance Company of Texas",
    "Farmers Casualty Insurance Company",
    "Farmers Direct Property and Casualty Insurance Company",
    "Farmers Group Property and Casualty Insurance Company",
    "Farmers Property and Casualty Insurance Company",
    "Farmers Insurance Company, Inc.",
    "Farmers Insurance of Columbus, Inc.",
    "Farmers Insurance Company of Arizona",
    "Farmers Lloyds Insurance Company of Texas",
    "Farmers New Century Insurance Company",
    "Farmers Texas County Mutual Insurance Company",
    "Illinois Farmers Insurance Company",
    "Texas Farmers Insurance Company",
]

# Independent mutuals — NOT Farmers Insurance Group. Must map to None AND be
# excluded from the AM Best interim build.
INDEPENDENT_ENTITIES = [
    "Farmers Mutual of Nebraska",
    "Farmers Alliance Mutual Insurance Company",
    "Alliance Insurance Company",                       # FAMI co-filing sub
    "The Farmers Automobile Insurance Association",     # Pekin
    "National Farmers Union Property And Casualty Company",
    "Farmers Union Mutual Insurance Company",
    "Indiana Farmers Mutual Insurance Company",
    "Ferdinand Farmers Mutual Insurance Company, Inc.",
    "Tennessee Farmers Mutual Insurance Company",
    "American Farmers & Ranchers Mutual Insurance Company",
    "Farmers Mutual Fire Insurance Company",
    "Farmers Mutual Fire Ins. Co. of Marble, PA",
    "Farmers Mutual Fire Insurance Co. of Salem County",
    "Farmers Mutual Fire Insurance Company of McCandless Township",
    "The Farmers Fire Insurance Company",
    "Farmers Insurance Company of Flemington",          # the wildcard tripwire
]

# B9 root-pattern audit (2026-07-07 follow-up): unaffiliated names a brand
# keyword would otherwise sweep. Must map to None AND be in _AMBEST_EXCLUDE.
AUDIT_UNAFFILIATED = [
    # The LIVE fix — ex-Ameriprise, a distinct excluded brand (61 interim rows
    # across 23 states had served as brand=American Family):
    "American Family Connect Property and Casualty Insurance Company",
    "American Family Connect Insurance Company",
    "American Family Life Assurance Company of Columbus",   # AFLAC
    # Latent (found in CSVs / search universes, nothing shipped):
    "Countryway Insurance Company",
    "Farm Bureau Town & Country Insurance Company of Missouri",
    "North Country Insurance Co.",
    "Farmers Mutual Hail Insurance Company of Iowa",
    "Farmers and Mechanics Mutual Ins. Co. of WV",
    "FARMERS & MECHANICS BENEVOLENT FIRE INS ASSOC OF COUNTIES OF ROANOKE & BOTETOURT",
    "Farmers' Mutual Insurance Company/WV",
    "Nationwide Warranty Corporation",
    "Nationwide Protection Plan Inc.",
    "Nationwide Vehicle Services, Inc.",
]

# Liberty allowlist (replaces the bare "liberty" substring): every genuine LM
# entity observed live must keep mapping; unaffiliated liberty-named must not.
LIBERTY_AFFILIATES = [
    "Liberty Mutual Insurance Company",
    "Liberty Mutual Fire Insurance Company",
    "Liberty Mutual Personal Insurance Company",
    "Liberty Mutual Mid-Atlantic Insurance Company",
    "Liberty Insurance Corporation",
    "The First Liberty Insurance Corporation",
    "Liberty County Mutual Insurance Company",
    "Liberty Lloyds of Texas Insurance Company",
    "Liberty Personal Insurance Company",
    "Liberty Insurance Underwriters Inc.",
]
LIBERTY_UNAFFILIATED = [
    "Liberty Bankers Life Insurance Company",
    "Liberty National Life Insurance Company",
    "Liberty University Insurance Trust",
]

# Regression spot-checks: rules that must not shift.
OTHER_BRAND_CASES = [
    ("State Farm Mutual Automobile Insurance Company", "State Farm"),
    ("MGA Insurance Company, Inc.", "State Farm"),
    ("COUNTRY Mutual Insurance Company", "COUNTRY Financial"),
    ("Liberty Insurance Corporation", "Liberty Mutual"),
    ("Montgomery Mutual Insurance Company", "Liberty Mutual"),
    ("TravCo Insurance Company", "Travelers"),
    ("The Phoenix Insurance Company", "Travelers"),
    ("General Insurance Company of America", "Safeco"),
    ("USAA General Indemnity Company", "USAA"),
    ("Nationwide General Insurance Company", "Nationwide"),
    ("Nationwide Mutual Insurance Company", "Nationwide"),
    ("Nationwide Agribusiness Insurance Company", "Nationwide"),
    ("American Family Mutual Insurance Company, S.I.", "American Family"),
    ("American Family Insurance Company", "American Family"),
    # Genuine AmFam auto subs without the brand string (B9 audit re-map):
    ("American Standard Insurance Company of Wisconsin", "American Family"),
    ("American Standard Insurance Company of Ohio", "American Family"),
    # ...but never a bare "american standard" wildcard:
    ("American Standard Lloyds of Texas", None),
    ("American Family Home Insurance Company", None),   # Munich Re collision
    ("Mutual of Wausau Insurance Corporation", None),   # independent WI mutual
    ("Wausau Underwriters Insurance Company", None),    # excluded LM vehicle (Decision 2)
    ("American States Insurance Company", "Safeco"),
    ("The Travelers Home and Marine Insurance Company", "Travelers"),
    ("Allstate North American Insurance Company", "Allstate"),
]


def main() -> int:
    failures = []

    for name in FIG_ENTITIES:
        got = derive_brand(name)
        if got != "Farmers":
            failures.append(f"FIG lost: {name!r} -> {got!r} (want Farmers)")
        if any(p in name.lower() for p in _AMBEST_EXCLUDE):
            failures.append(f"FIG wrongly in _AMBEST_EXCLUDE: {name!r}")

    for name in INDEPENDENT_ENTITIES:
        got = derive_brand(name)
        if got is not None:
            failures.append(f"independent retained: {name!r} -> {got!r} (want None)")
        if not any(p in name.lower() for p in _AMBEST_EXCLUDE):
            failures.append(f"independent missing from _AMBEST_EXCLUDE: {name!r}")

    for name, want in OTHER_BRAND_CASES:
        got = derive_brand(name)
        # Wausau Underwriters maps via "liberty"? No — it has no "liberty" in
        # the name; derive_brand returns None and _AMBEST_EXCLUDE drops it.
        if got != want:
            failures.append(f"regression: {name!r} -> {got!r} (want {want!r})")

    for name in AUDIT_UNAFFILIATED:
        got = derive_brand(name)
        if got is not None:
            failures.append(f"audit-unaffiliated retained: {name!r} -> {got!r} (want None)")
        if not any(p in name.lower() for p in _AMBEST_EXCLUDE):
            failures.append(f"audit-unaffiliated missing from _AMBEST_EXCLUDE: {name!r}")

    for name in LIBERTY_AFFILIATES:
        got = derive_brand(name)
        if got != "Liberty Mutual":
            failures.append(f"LM affiliate lost by allowlist: {name!r} -> {got!r}")
    for name in LIBERTY_UNAFFILIATED:
        got = derive_brand(name)
        if got is not None:
            failures.append(f"liberty over-match: {name!r} -> {got!r} (want None)")

    print(f"FIG entities:          {len(FIG_ENTITIES)} checked")
    print(f"Independent mutuals:   {len(INDEPENDENT_ENTITIES)} checked")
    print(f"Other-brand cases:     {len(OTHER_BRAND_CASES)} checked")
    print(f"Audit unaffiliated:    {len(AUDIT_UNAFFILIATED)} checked")
    print(f"Liberty allowlist:     {len(LIBERTY_AFFILIATES)} affiliates + {len(LIBERTY_UNAFFILIATED)} unaffiliated checked")
    if failures:
        print(f"\nFAIL — {len(failures)} problem(s):")
        for f in failures:
            print("  ", f)
        return 1
    print("\nALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
