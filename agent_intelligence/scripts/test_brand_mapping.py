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
    ("American Family Mutual Insurance Company, S.I.", "American Family"),
    ("American Family Home Insurance Company", None),   # Munich Re collision
    ("Mutual of Wausau Insurance Corporation", None),   # independent WI mutual
    ("Wausau Underwriters Insurance Company", None),    # excluded LM vehicle (Decision 2)
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

    print(f"FIG entities:          {len(FIG_ENTITIES)} checked")
    print(f"Independent mutuals:   {len(INDEPENDENT_ENTITIES)} checked")
    print(f"Other-brand cases:     {len(OTHER_BRAND_CASES)} checked")
    if failures:
        print(f"\nFAIL — {len(failures)} problem(s):")
        for f in failures:
            print("  ", f)
        return 1
    print("\nALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
