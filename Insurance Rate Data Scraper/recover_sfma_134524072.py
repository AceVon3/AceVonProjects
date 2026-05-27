"""One-off recovery for MT SFMA-134524072 — Issue 2 / no_pdf audit.

Target Rate/Rule HO filing whose system PDF wasn't downloaded during
run_final_rates (presumably JSF ViewState skip from long-running context).
Recover via fresh browser context, then re-emit MT.
"""
from __future__ import annotations
import time
from playwright.sync_api import sync_playwright
from src.config import HEADLESS, PDF_DIR, USER_AGENT
from src.detail import download_system_summary_pdf
from src.search import (
    _click_next_page, _has_next_page, _set_rows_per_page_100, _submit_search,
)

STATE = "MT"
SEARCH_KW = "state farm"
TARGET_FILING_ID = "134524072"
TARGET_TRACKING = "SFMA-134524072"


def main() -> int:
    print(f"[recover] target={TARGET_TRACKING} via {STATE}/'{SEARCH_KW}'", flush=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=HEADLESS)
        try:
            ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=True)
            page = ctx.new_page()
            try:
                if not _submit_search(page, STATE, SEARCH_KW):
                    print("[recover] search submit failed", flush=True); return 1
                _set_rows_per_page_100(page)
                page_num = 1
                while True:
                    if page.locator(f'tr[data-rk="{TARGET_FILING_ID}"]').count():
                        print(f"  [page {page_num}] row visible", flush=True)
                        break
                    if not _has_next_page(page):
                        print("[recover] paginated through all pages, row not found", flush=True); return 2
                    if not _click_next_page(page):
                        print("[recover] click_next_page failed", flush=True); return 3
                    page_num += 1
                    time.sleep(1.0)
                dest_dir = PDF_DIR / STATE / TARGET_FILING_ID
                result = download_system_summary_pdf(page, TARGET_FILING_ID, TARGET_TRACKING, dest_dir)
                if result is None:
                    print("[recover] download returned None", flush=True); return 4
                print(f"[recover] PDF saved: {result} ({result.stat().st_size/1024:.1f} KB)", flush=True)
                return 0
            finally:
                ctx.close()
        finally:
            browser.close()


if __name__ == "__main__":
    raise SystemExit(main())
