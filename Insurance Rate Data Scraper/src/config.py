"""Configuration for the Insurance Rate Data Scraper (Phase 1: one-time collection)."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output"
PDF_DIR = OUTPUT_DIR / "pdfs"
LOG_FILE = OUTPUT_DIR / "scraper.log"

TARGET_COMPANIES = [
    "State Farm",
    "GEICO",
    "Progressive",
    "Allstate",
    "Travelers",
    "Liberty Mutual",
    # Major distinct-channel brands (independent-agent siblings of the
    # Liberty Mutual / Allstate captive channels). Each requires its own
    # SERFF search keyword because filings are submitted under the brand
    # name and do not surface under the parent-group search.
    "Safeco",     # Liberty Mutual independent-agent brand
    "Encompass",  # Allstate independent-agent brand
    # State Farm subsidiary that files under its own name on SERFF and is
    # NOT returned by a "state farm" keyword search. Added as a separate
    # search keyword (Item #3a). Classification via GROUP_KW folds it back
    # into State Farm in the final dataset — the 8-brand scope is unchanged.
    "MGA Insurance",
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

STATES = ["WA", "ID", "CO", "OR", "UT", "AZ"]

# Submission-window bounds for SERFF search (SERFF only filters by submission
# date). Widened to a 6-month lookback so filings submitted before 2025-01-01
# whose effective date falls inside the AM Best validation window are not
# missed (e.g., the 6 Progressive UT subsidiaries on a filing eff 02/19/25 and
# WA Progressive Casualty submitted 2024-12-12 eff 03/07/25).
DATE_FROM = "07/01/2024"
DATE_TO = "04/17/2026"

# Effective-date emit filter applied at row emission (run_final_rates.py).
# This is the axis that aligns with AM Best's effective-date matching. Rows
# whose parsed effective_date falls outside this window are dropped at emit
# time. Rows with BLANK effective_date are KEPT (filer omitted the field; we
# do not silently drop them).
EFFECTIVE_DATE_FROM = "01/01/2025"
EFFECTIVE_DATE_TO = "04/17/2026"

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
