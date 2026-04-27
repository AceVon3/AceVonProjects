"""One-shot probe:
  1. WA × 8 brands live SERFF search, no end-date cap, capture rows whose
     filing/state/disposition status indicates 'pending' or 'review'.
     Filter to TOI 19.0 / 04.0 (personal-lines) only.
  2. Re-fetch ALSE-134886800 (OR) detail page; report current disposition
     status, dates, and any updates.

Writes JSON output to output/probe_pending_refresh.json so the caller
can act on results without re-running the browser.
"""
from __future__ import annotations

import json
import re
import time
from datetime import date, datetime
from pathlib import Path

from playwright.sync_api import Browser, Page, sync_playwright

from src.config import (
    DATE_FROM,
    HEADLESS,
    REQUEST_DELAY,
    SERFF_BASE,
    SERFF_HOME_URL,
    TARGET_COMPANIES,
    USER_AGENT,
)
from src.search import (
    _byid,
    _click_row_to_detail,
    _fill_and_blur,
    _set_primefaces_select,
    _set_rows_per_page_100,
    _wait_for_results,
)
from src.detail import scrape_detail_fields
from src.models import Filing


OUTPUT_PATH = Path("output/probe_pending_refresh.json")
TODAY_MMDDYYYY = datetime.now().strftime("%m/%d/%Y")
TARGET_TOI_RE = re.compile(r"^(19\.0|04\.0)", re.I)
PENDING_RE = re.compile(r"pending|review|active\s*suspense|referred|re-?open", re.I)


def submit_search_open_window(page: Page, state: str, company: str) -> bool:
    """Same as search._submit_search but uses today as DATE_TO so we get
    everything filed up to now."""
    page.goto(SERFF_HOME_URL.format(state=state), wait_until="domcontentloaded", timeout=30000)
    page.get_by_role("link", name=re.compile(r"begin\s*search", re.I)).first.click()
    page.wait_for_load_state("domcontentloaded", timeout=30000)
    try:
        page.get_by_role("button", name=re.compile(r"^accept$", re.I)).first.click(timeout=5000)
        page.wait_for_load_state("networkidle", timeout=30000)
    except Exception:
        pass

    if not _set_primefaces_select(page, "simpleSearch:businessType", r"property\s*&\s*casualty"):
        return False

    _fill_and_blur(page, "simpleSearch:companyName", company)
    _fill_and_blur(page, "simpleSearch:submissionStartDate_input", DATE_FROM)
    _fill_and_blur(page, "simpleSearch:submissionEndDate_input", TODAY_MMDDYYYY)

    _byid(page, "simpleSearch:saveBtn").first.click()
    try:
        _wait_for_results(page)
    except Exception:
        return False
    return True


def extract_results_with_status(page: Page) -> list[dict]:
    """Pull every visible row's cells indexed by column header."""
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

    def col_idx(rx: str) -> int | None:
        for i, h in enumerate(headers):
            if re.search(rx, h, re.I):
                return i
        return None

    idx = {
        "company": col_idx(r"company\s*name"),
        "subtoi":  col_idx(r"sub\s*type"),
        "ftype":   col_idx(r"filing\s*type"),
        "fstatus": col_idx(r"filing\s*status"),
        "serff":   col_idx(r"serff\s*tracking"),
    }
    out = []
    for r in data.get("rows", []):
        cells = r["cells"]
        def cell(k):
            i = idx[k]
            return cells[i].strip() if (i is not None and i < len(cells)) else ""
        out.append({
            "filing_id": r["data_rk"],
            "company_name": cell("company"),
            "sub_type_of_insurance": cell("subtoi"),
            "filing_type": cell("ftype"),
            "filing_status": cell("fstatus"),
            "serff_tracking_number": cell("serff"),
        })
    return out


def has_next_page(page: Page) -> bool:
    nxt = page.locator(".ui-paginator-top .ui-paginator-next").first
    if not nxt.count():
        return False
    cls = nxt.get_attribute("class") or ""
    return "ui-state-disabled" not in cls


def click_next_page(page: Page) -> bool:
    nxt = page.locator(".ui-paginator-top .ui-paginator-next").first
    if not nxt.count():
        return False
    nxt.click()
    try:
        _wait_for_results(page)
        return True
    except Exception:
        return False


def search_wa_pending(browser: Browser) -> dict:
    """For each of the 8 brands, run WA search and collect any row whose
    filing_status looks pending/review/suspense AND TOI is personal-lines."""
    findings = []
    per_brand_counts = {}
    for company in TARGET_COMPANIES:
        ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=False)
        page = ctx.new_page()
        try:
            ok = submit_search_open_window(page, "WA", company)
            if not ok:
                per_brand_counts[company] = {"error": "submit_failed"}
                ctx.close()
                continue
            _set_rows_per_page_100(page)
            all_rows = []
            while True:
                all_rows.extend(extract_results_with_status(page))
                if not has_next_page(page):
                    break
                if not click_next_page(page):
                    break
                time.sleep(REQUEST_DELAY)
            # filter to personal lines + pending-ish status
            in_target = [r for r in all_rows if TARGET_TOI_RE.match(r.get("sub_type_of_insurance") or "")]
            pending = [r for r in in_target if PENDING_RE.search(r.get("filing_status") or "")]
            per_brand_counts[company] = {
                "total_rows": len(all_rows),
                "in_target_personal_lines": len(in_target),
                "pending_in_target": len(pending),
            }
            for r in pending:
                r["target_company"] = company
                findings.append(r)
            print(f"[WA/{company}] total={len(all_rows)} in_target={len(in_target)} pending={len(pending)}")
        finally:
            ctx.close()
        time.sleep(REQUEST_DELAY)
    return {"findings": findings, "per_brand": per_brand_counts}


def refresh_alse(browser: Browser) -> dict:
    """Re-run OR Allstate search, locate ALSE-134886800, click into detail,
    return current status fields."""
    target_serff = "ALSE-134886800"
    ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=False)
    page = ctx.new_page()
    try:
        ok = submit_search_open_window(page, "OR", "Allstate")
        if not ok:
            return {"error": "submit_failed"}
        _set_rows_per_page_100(page)
        # Find row with matching SERFF tracking
        filing_id = None
        while True:
            rows = extract_results_with_status(page)
            for r in rows:
                if r.get("serff_tracking_number") == target_serff:
                    filing_id = r["filing_id"]
                    cur_filing_status = r.get("filing_status")
                    cur_subtoi = r.get("sub_type_of_insurance")
                    cur_company = r.get("company_name")
                    break
            if filing_id or not has_next_page(page):
                break
            if not click_next_page(page):
                break
            time.sleep(REQUEST_DELAY)
        if not filing_id:
            return {"error": "filing_not_found_in_search_results", "target": target_serff}

        # Click into detail page
        ok = _click_row_to_detail(page, filing_id)
        if not ok:
            return {"error": "click_to_detail_failed", "filing_id": filing_id}

        f = Filing(
            state="OR",
            serff_tracking_number=target_serff,
            filing_id=filing_id,
            company_name=cur_company or "",
            target_company="Allstate",
        )
        scrape_detail_fields(page, f)

        return {
            "serff_tracking_number": target_serff,
            "filing_id": filing_id,
            "company_name": f.company_name,
            "filing_status_results_table": cur_filing_status,
            "filing_status_detail": f.filing_status,
            "disposition_status": f.disposition_status,
            "state_status": f.state_status,
            "submission_date": f.submission_date.isoformat() if f.submission_date else None,
            "disposition_date": f.disposition_date.isoformat() if f.disposition_date else None,
            "sub_type_of_insurance": f.sub_type_of_insurance or cur_subtoi,
            "type_of_insurance": f.type_of_insurance,
        }
    finally:
        ctx.close()


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result = {"as_of": datetime.now().isoformat(timespec="seconds")}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        try:
            print(f"\n=== 1. WA pending search across {len(TARGET_COMPANIES)} brands ===\n")
            result["wa_pending"] = search_wa_pending(browser)
            print(f"\n=== 2. Refresh ALSE-134886800 (OR) ===\n")
            result["alse_refresh"] = refresh_alse(browser)
        finally:
            browser.close()
    OUTPUT_PATH.write_text(json.dumps(result, indent=2, default=str))
    print(f"\n[saved] {OUTPUT_PATH}")
    print(json.dumps(result, indent=2, default=str)[:2000])


if __name__ == "__main__":
    main()
