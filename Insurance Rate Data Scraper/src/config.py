"""Configuration for the Insurance Rate Data Scraper (Phase 1: one-time collection)."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output"
PDF_DIR = OUTPUT_DIR / "pdfs"
LOG_FILE = OUTPUT_DIR / "scraper.log"

TARGET_COMPANIES = [
    "State Farm",
    "GEICO",
    # GEICO's parent legal name lacks "geico" (root-pattern audit 2026-06-29):
    # a SOLO Government Employees Insurance Company filing would be missed.
    "Government Employees",
    "Progressive",
    # Progressive non-standard underwriter (root-pattern audit): no "progressive" string.
    "Artisan and Truckers",
    "Allstate",
    "Travelers",
    "Liberty Mutual",
    # Major distinct-channel brands (independent-agent siblings of the
    # Liberty Mutual / Allstate captive channels). Each requires its own
    # SERFF search keyword because filings are submitted under the brand
    # name and do not surface under the parent-group search.
    "Safeco",     # Liberty Mutual independent-agent brand
    # Safeco/Liberty affiliate (General Insurance Company of America) that files
    # under its own name and is NOT returned by "safeco"/"liberty mutual" (no
    # brand string in the legal name) — the SAME search-term-gap family as
    # Liberty Insurance Corporation. Missed in WV (2,039ph, dropped) AND NH
    # (3,711ph) before this fix; GROUP_KW already classifies it -> Liberty Mutual.
    "General Insurance",
    # Liberty/Safeco affiliates whose legal names lack the brand string (root-
    # pattern audit 2026-06-29): American States* (Liberty) + First National
    # Insurance Company of America (Safeco). Captured via co-filing in scraped
    # states; these terms catch a SOLO filing in a future state.
    "American States",
    "First National Insurance",
    # Liberty Mutual "Legacy" rating company that files under its own name and
    # is NOT returned by a "liberty mutual" search (no "mutual" in the name) —
    # the same search-term-gap family as Safeco/Encompass. WV 2026-06-26
    # surfaced a material Liberty Insurance Corporation HO filing the sweep
    # missed; this puts the fix in the universe-sweep path so every state
    # surfaces it from the start (GROUP_SEARCH/GROUP_KW already classify it).
    "Liberty Insurance",
    "Encompass",  # Allstate independent-agent brand
    # Travelers Quantum-Home co-file leads whose legal names lack "travelers"
    # (TravCo Insurance Company; The Phoenix Insurance rides its co-files).
    # RI 2026-07-07: AM Best shows a TravCo-led HO rate block (+1.3%/10,207ph
    # eff 07/11/25) that a bare "travelers" search did NOT return — the same
    # search-term-gap family as Liberty Insurance / General Insurance. MA had
    # only shown them co-filing on TRVD filings that DID surface; RI proves a
    # TravCo-led filing can be invisible to the brand term.
    "TravCo",
    # State Farm subsidiary that files under its own name on SERFF and is
    # NOT returned by a "state farm" keyword search. Added as a separate
    # search keyword (Item #3a). Classification via GROUP_KW folds it back
    # into State Farm in the final dataset — the 8-brand scope is unchanged.
    "MGA Insurance",
    # 13-brand expansion (2026-06-10, SCOPE.md). Multiple keywords per brand
    # where SERFF entity names don't contain the brand string (GA portal
    # check: usaa/united services/garrison are three disjoint NAIC buckets).
    "USAA",
    "United Services",           # USAA parent: United Services Automobile Association
    "Garrison",                  # USAA: Garrison Property and Casualty
    "Farmers",
    "Mid-Century",               # Farmers underwriter, no "farmers" in name
    "Fire Insurance Exchange",   # Farmers HO exchange
    "Truck Insurance Exchange",  # Farmers exchange (mostly commercial; cheap)
    "Nationwide",
    "American Family",
    # AmFam auto subs whose legal names lack the brand string (B9 audit) —
    # same search-term-gap family as Liberty Insurance / General Insurance:
    # a SOLO American Standard filing would not surface under "american family".
    "American Standard Insurance",
    "Country",                   # COUNTRY Mutual / Preferred / Casualty
]
# Excluded as out-of-scope (specialty / wound-down):
#   Drive Insurance (Progressive subsidiary, retired)
#   Esurance (Allstate subsidiary, wound down 2020)
#   United Financial / other niche specialty subsidiaries

# Lines of business we care about for the final product: personal lines only.
# Matched case-insensitive partial against `type_of_insurance` and
# `sub_type_of_insurance`. Out-of-scope lines (Commercial Auto, Personal
# Umbrella, CMP, Professional Liability, Renters, VIP, etc.) stay in the raw
# dataset but are flagged via `Filing.in_target_lines = False`.
TARGET_LINES = [
    "personal auto",
    "private passenger auto",
    "homeowners",
]

STATES = ["WA", "ID", "CO", "OR", "UT", "AZ", "MT", "WY", "NV", "NM", "GA", "VA"]

# Submission-window bounds for SERFF search (SERFF only filters by submission
# date). A 6-month lookback before the effective-date floor so filings
# submitted before the floor whose effective date falls inside the window are
# not missed (e.g., the 6 Progressive UT subsidiaries on a filing eff 02/19/25
# and WA Progressive Casualty submitted 2024-12-12 eff 03/07/25).
#
# 2026-06-02: pushed back from 2024-07-01 to 2023-07-01 alongside the
# EFFECTIVE_DATE_FROM extension to 2024-01-01 (6-month lookback preserved).
# Filings submitted 2024-07-01 onward are already cached from the prior run, so
# the incremental search only needs the new 2023-07-01 -> 2024-06-30 slice.
DATE_FROM = "07/01/2023"
DATE_TO = "04/17/2026"

# Effective-date emit filter applied at row emission (run_final_rates.py).
# This is the axis that aligns with AM Best's effective-date matching. Rows
# whose parsed effective_date falls outside this window are dropped at emit
# time. Rows with BLANK effective_date are KEPT (filer omitted the field; we
# do not silently drop them).
#
# 2026-06-02: floor extended from 2025-01-01 to 2024-01-01 (back-extension to
# capture calendar-year 2024 effective dates). See AMBEST_VALIDATED_FROM below
# for the validation-tier boundary.
EFFECTIVE_DATE_FROM = "01/01/2024"
EFFECTIVE_DATE_TO = "04/17/2026"

# AM Best validation boundary. The per-state AM Best cross-checks (see
# dataset_summary.md "Validation") were run against AM Best exports scoped to
# 2025-01-01 -> 2026-04-17. Rows with effective_date >= this date are inside
# that validated window; rows below it (the 2024-01-01 back-extension added
# 2026-06-02) are extracted by the identical pipeline but were NOT AM Best
# cross-checked. This boundary is surfaced per-row in the `validation_tier`
# column. Blank effective_date can never have been AM Best-matched
# (cross-checks key on effective date), so blank-date rows are "pipeline_only".
AMBEST_VALIDATED_FROM = "01/01/2025"

# Original (pre-back-extension) submission-window start. Filings submitted on or
# after this date were inside the SERFF search that the per-state AM Best
# cross-checks were run against; filings submitted BEFORE it surface only via
# the 2026-06-02 back-extension slice. A row that is in the AM Best effective
# window (>= AMBEST_VALIDATED_FROM) but was submitted before this date was
# recovered by the back-extension and therefore postdates the cross-checks —
# it is tiered "ambest_window_unmatched" rather than "ambest_validated".
# Three tiers total (see run_final_rates._validation_tier / dataset_summary.md):
#   ambest_validated        eff >= 2025-01-01 AND in the original cross-check set
#   ambest_window_unmatched eff >= 2025-01-01 BUT recovered by back-extension
#   pipeline_only           eff <  2025-01-01 (or blank effective_date)
AMBEST_CROSSCHECK_SUBMISSION_FROM = "07/01/2024"

REQUEST_DELAY = 2.5

DOWNLOAD_PDFS = True
PARSE_PDFS = True

SERFF_BASE = "https://filingaccess.serff.com/sfa"
SERFF_HOME_URL = SERFF_BASE + "/home/{state}"
SERFF_DETAIL_URL = SERFF_BASE + "/filingSummary.xhtml?filingId={filing_id}"

HEADLESS = True
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
