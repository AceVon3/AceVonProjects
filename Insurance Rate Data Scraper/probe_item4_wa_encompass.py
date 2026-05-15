"""Item #4 investigation — Phase 1.

Live SERFF search for WA + 'encompass' keyword. Dumps every raw result row
WITHOUT the per-row submission-date detail-page fetch, so we see exactly what
SERFF returns to our keyword search.

Question being answered:
- Does SERFF's "encompass" WA search return the AM Best filing
  (Encompass Indemnity Company, filed 2025-03-12, eff 07/12/25, imp 19.6%)?
- If yes: it's in the raw results but our pipeline dropped it.
- If no: the filing isn't surfacing on SERFF for this keyword search.
"""
from __future__ import annotations

import re
import time
from playwright.sync_api import sync_playwright

from src.config import DATE_FROM, DATE_TO, HEADLESS, SERFF_HOME_URL, USER_AGENT
from src.search import _byid, _fill_and_blur, _set_primefaces_select, _set_rows_per_page_100, _wait_for_results


def search_dump(state: str, company_keyword: str) -> list[dict]:
    """Return all visible result rows; no detail-page submission-date fetch."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=HEADLESS)
        ctx = browser.new_context(user_agent=USER_AGENT)
        page = ctx.new_page()
        try:
            page.goto(SERFF_HOME_URL.format(state=state), wait_until="domcontentloaded", timeout=30000)
            page.get_by_role("link", name=re.compile(r"begin\s*search", re.I)).first.click()
            page.wait_for_load_state("domcontentloaded", timeout=30000)
            try:
                page.get_by_role("button", name=re.compile(r"^accept$", re.I)).first.click(timeout=5000)
                page.wait_for_load_state("networkidle", timeout=30000)
            except Exception:
                pass

            _set_primefaces_select(page, "simpleSearch:businessType", r"property\s*&\s*casualty")
            _fill_and_blur(page, "simpleSearch:companyName", company_keyword)
            _fill_and_blur(page, "simpleSearch:submissionStartDate_input", DATE_FROM)
            _fill_and_blur(page, "simpleSearch:submissionEndDate_input", DATE_TO)
            _byid(page, "simpleSearch:saveBtn").first.click()
            _wait_for_results(page)
            _set_rows_per_page_100(page)

            all_rows = []
            page_num = 0
            while True:
                page_num += 1
                data = page.evaluate(
                    """() => {
                        const headers = Array.from(document.querySelectorAll('thead th .ui-column-title'))
                            .map(h => (h.textContent || '').trim());
                        const rows = Array.from(document.querySelectorAll('tr[data-rk]'));
                        const out = [];
                        for (const r of rows) {
                            const cells = Array.from(r.querySelectorAll('td')).map(td => (td.textContent || '').trim());
                            out.push({ data_rk: r.getAttribute('data-rk'), cells });
                        }
                        return { headers, rows: out };
                    }"""
                )
                headers = [h for h in data.get("headers", []) if h]
                for r in data["rows"]:
                    cells = r["cells"]
                    row = {"data_rk": r["data_rk"]}
                    for i, h in enumerate(headers):
                        if i < len(cells):
                            row[h] = cells[i]
                    all_rows.append(row)
                print(f"  page {page_num}: {len(data['rows'])} rows (cumulative {len(all_rows)})", flush=True)

                # Pagination
                nxt = page.locator(".ui-paginator-top .ui-paginator-next").first
                if not nxt.count() or "ui-state-disabled" in (nxt.get_attribute("class") or ""):
                    break
                nxt.click()
                try:
                    _wait_for_results(page)
                except Exception:
                    break
            return all_rows
        finally:
            ctx.close()
            browser.close()


def main() -> None:
    import sys
    keyword = sys.argv[1] if len(sys.argv) > 1 else "encompass"
    state = sys.argv[2] if len(sys.argv) > 2 else "WA"
    rows = search_dump(state, keyword)
    print(f"\nTotal rows from live SERFF {state} + '{keyword}': {len(rows)}\n")
    for r in rows:
        tracking = r.get("SERFF Tracking #") or r.get("SERFF Tracking Number") or r["data_rk"]
        co = r.get("Company Name") or ""
        ftype = r.get("Filing Type") or ""
        fstatus = r.get("Filing Status") or ""
        sub_toi = r.get("Sub-Type of Insurance") or r.get("Sub Type of Insurance") or ""
        print(f"  {tracking:22s} co={co:40s} ftype={ftype:8s} status={fstatus:20s} sub_toi={sub_toi}")


if __name__ == "__main__":
    main()
