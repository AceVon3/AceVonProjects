"""One-off recovery for CO GECC-134650382 — Thread 4.

The filing is in-scope (GEICO PPA, eff 09/12/2025) but was skipped during
the CO enrichment run due to JSF ViewState staleness in the long-running
browser context. Same recovery pattern as Thread 3 (LBPM-134879025):
fresh browser context bypasses the staleness.
"""
from __future__ import annotations

import time

from playwright.sync_api import sync_playwright

from src.config import HEADLESS, PDF_DIR, USER_AGENT
from src.detail import download_system_summary_pdf
from src.search import (
    _click_next_page,
    _has_next_page,
    _set_rows_per_page_100,
    _submit_search,
)

STATE = "CO"
SEARCH_KW = "geico"
TARGET_FILING_ID = "134650382"
TARGET_TRACKING = "GECC-134650382"


def main() -> int:
    print(f"[recover] target={TARGET_TRACKING} via {STATE}/'{SEARCH_KW}'", flush=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=HEADLESS)
        try:
            ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=True)
            page = ctx.new_page()
            try:
                if not _submit_search(page, STATE, SEARCH_KW):
                    print("[recover] search submit failed", flush=True)
                    return 1
                _set_rows_per_page_100(page)

                page_num = 1
                while True:
                    has_row = page.locator(f'tr[data-rk="{TARGET_FILING_ID}"]').count()
                    print(f"  [page {page_num}] row visible: {bool(has_row)}", flush=True)
                    if has_row:
                        break
                    if not _has_next_page(page):
                        print("[recover] paginated through all pages, row not found", flush=True)
                        return 2
                    if not _click_next_page(page):
                        print("[recover] click_next_page failed", flush=True)
                        return 3
                    page_num += 1
                    time.sleep(1.0)

                dest_dir = PDF_DIR / STATE / TARGET_FILING_ID
                result = download_system_summary_pdf(
                    page, TARGET_FILING_ID, TARGET_TRACKING, dest_dir,
                )
                if result is None:
                    print("[recover] download_system_summary_pdf returned None", flush=True)
                    return 4

                size_kb = result.stat().st_size / 1024
                print(f"[recover] PDF saved: {result} ({size_kb:.1f} KB)", flush=True)
                return 0
            finally:
                ctx.close()
        finally:
            browser.close()


if __name__ == "__main__":
    raise SystemExit(main())
