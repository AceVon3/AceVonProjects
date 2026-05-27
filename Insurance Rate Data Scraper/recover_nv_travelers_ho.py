"""Recover 3 NV Travelers HO PDFs lost to JSF ViewState skip — Issue 5.

Same fresh-context pattern as recover_lbpm_134879025.py / recover_sfma_134524072.py.
"""
from __future__ import annotations
import time
from playwright.sync_api import sync_playwright
from src.config import HEADLESS, PDF_DIR, USER_AGENT
from src.detail import download_system_summary_pdf
from src.search import (
    _click_next_page, _has_next_page, _set_rows_per_page_100, _submit_search,
)

STATE = "NV"
SEARCH_KW = "travelers"
# Note: TRVD-G tracking numbers don't map directly to filing_id (unlike most
# other carrier prefixes). The "-G" indicates a group filing; actual filing_id
# differs from the tracking-number suffix. Filing_ids verified by lookup in
# nv_travelers_search.xlsx.
TARGETS = [
    ("134594460", "TRVD-G134570380"),
    ("134515103", "TRVD-G134503411"),
    ("134812407", "TRVD-G134806398"),
]


def recover_one(page, filing_id: str, tracking: str) -> int:
    page_num = 1
    while True:
        if page.locator(f'tr[data-rk="{filing_id}"]').count():
            print(f"  [{tracking}] visible on page {page_num}", flush=True); break
        if not _has_next_page(page):
            print(f"  [{tracking}] not found in any page", flush=True); return 2
        if not _click_next_page(page):
            print(f"  [{tracking}] click_next_page failed", flush=True); return 3
        page_num += 1
        time.sleep(0.5)
    dest_dir = PDF_DIR / STATE / filing_id
    result = download_system_summary_pdf(page, filing_id, tracking, dest_dir)
    if result is None:
        print(f"  [{tracking}] download returned None", flush=True); return 4
    print(f"  [{tracking}] PDF saved: {result.stat().st_size/1024:.1f} KB", flush=True)
    return 0


def main() -> int:
    print(f"[recover] {len(TARGETS)} NV Travelers HO filings via {STATE}/'{SEARCH_KW}'", flush=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=HEADLESS)
        try:
            for filing_id, tracking in TARGETS:
                # Fresh context per target — avoids ViewState staleness
                ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=True)
                page = ctx.new_page()
                try:
                    if not _submit_search(page, STATE, SEARCH_KW):
                        print(f"  [{tracking}] search submit failed", flush=True); continue
                    _set_rows_per_page_100(page)
                    recover_one(page, filing_id, tracking)
                finally:
                    ctx.close()
            return 0
        finally:
            browser.close()


if __name__ == "__main__":
    raise SystemExit(main())
