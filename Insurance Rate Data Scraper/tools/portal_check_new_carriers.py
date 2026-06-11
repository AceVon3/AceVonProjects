"""Phase 1C — SERFF Public Access presence check for the 5 candidate carriers.

COUNT-ONLY: one fresh search per keyword (8 total, within the WAF burst
budget), read the first results page (RPP=100) for row count + sample company
names, no row clicks, no date fetches. Diagnostics armed; aborts the sweep on
the first captcha signature rather than grinding.

    python tools/portal_check_new_carriers.py GA
"""
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import src.search as search
from src.config import HEADLESS, REQUEST_DELAY, USER_AGENT
from src.search import _set_rows_per_page_100, _submit_search

search.DIAG_DIR = Path("output/serff_diagnostics")

KEYWORDS = [
    ("USAA", "usaa"),
    ("USAA", "united services"),
    ("USAA", "garrison"),
    ("Farmers", "farmers"),
    ("Nationwide", "nationwide"),
    ("American Family", "american family"),
    ("Country", "country"),
    ("Farmers", "mid-century"),
]


def main() -> int:
    state = (sys.argv[1] if len(sys.argv) > 1 else "GA").upper()
    print(f"=== {state} SERFF presence check — {len(KEYWORDS)} count-only searches ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        for carrier, kw in KEYWORDS:
            ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=False)
            page = ctx.new_page()
            try:
                try:
                    ok = _submit_search(page, state, kw)
                except Exception as e:
                    print(f"  [{carrier}] {kw!r}: search RAISED {type(e).__name__} — "
                          f"possible WAF challenge, ABORTING sweep (see serff_diagnostics)", flush=True)
                    return 1
                if not ok:
                    print(f"  [{carrier}] {kw!r}: search failed (no results state) — see diagnostics", flush=True)
                    continue
                _set_rows_per_page_100(page)
                n = page.locator("tr[data-rk]").count()
                names = page.evaluate(
                    """() => Array.from(document.querySelectorAll('tr[data-rk]'))
                        .slice(0, 100).map(tr => {
                            const tds = tr.querySelectorAll('td');
                            return tds.length > 1 ? tds[1].textContent.trim() : '';
                        })"""
                )
                uniq = sorted({x for x in names if x})[:8]
                more = "+" if n == 100 else ""
                print(f"  [{carrier}] {kw!r}: {n}{more} filings | companies: {uniq}", flush=True)
            finally:
                ctx.close()
                time.sleep(REQUEST_DELAY)
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
