"""SERFF Filing Access search-only scraper.

Runs a PrimeFaces/JSF search for one (state, target_company) pair, iterates
paginated results, and returns `Filing` objects populated with the columns
visible on the results table. No detail-page navigation, no PDF download.

Detail-page scraping and PDF download are added in Step 5.
"""
from __future__ import annotations

import json
import re
import time
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Optional

from playwright.sync_api import Page, Browser, sync_playwright

from .config import (
    DATE_FROM,
    DATE_TO,
    HEADLESS,
    REQUEST_DELAY,
    SERFF_BASE,
    SERFF_DETAIL_URL,
    SERFF_HOME_URL,
    TARGET_COMPANIES,
    USER_AGENT,
)
from .models import Filing


def _byid(page: Page, jsf_id: str):
    return page.locator(f'[id="{jsf_id}"]')


def _set_primefaces_select(page: Page, panel_id: str, option_label_regex: str) -> bool:
    label = _byid(page, f"{panel_id}_label")
    if not label.count():
        return False
    label.first.click()
    items = _byid(page, f"{panel_id}_items")
    items.wait_for(state="visible", timeout=5000)
    opt = items.locator("li", has_text=re.compile(option_label_regex, re.I))
    if not opt.count():
        return False
    opt.first.click()
    page.wait_for_load_state("networkidle", timeout=15000)
    return True


def _fill_and_blur(page: Page, jsf_id: str, value: str) -> None:
    loc = _byid(page, jsf_id).first
    loc.click()
    loc.fill(value)
    loc.press("Tab")


def _wait_for_results(page: Page) -> None:
    page.wait_for_load_state("domcontentloaded", timeout=30000)
    page.wait_for_function(
        """() => {
            const hasRows = document.querySelector('tr[data-rk]');
            const hasNoRec = Array.from(document.querySelectorAll('span, div, td, h5'))
                .some(e => /no\\s+records|no\\s+filings?\\s+(were|matched|found)|0\\s+filing/i.test(e.textContent || ''));
            return hasRows || hasNoRec;
        }""",
        timeout=30000,
    )


# --- SERFF failure diagnostics (2026-06-10) ---------------------------------
# Every Begin-Search wall ever logged was the bare string "Locator.click:
# Timeout ... exceeded" — page.goto's response was discarded and nothing read
# the page that was actually served, so "rate limiting" has only ever been an
# INFERENCE from timing behavior, never a measurement. When DIAG_DIR is set
# (validate_batch_download.py, download_all_pdfs and the mini-pass set it),
# every _submit_search appends one timestamped row to
# <DIAG_DIR>/search_ledger.csv (outcome, duration, document HTTP statuses,
# any Retry-After) — precise re-arm timing for free — and on failure dumps a
# snapshot dir (exception, classification, all document responses with full
# headers, page URL/title, body text, full HTML). Snapshot HTML dumps are
# capped per process so a retry storm can't fill the disk. All diagnostic
# code is exception-swallowed: it can never break or slow the main path.
DIAG_DIR: Optional[Path] = None
_DIAG_HTML_CAP = 12
_diag_html_dumped = 0


def _classify_exception(e: Exception) -> str:
    msg = str(e)
    if "net::ERR_CONNECTION" in msg or "net::ERR_NAME" in msg:
        return "connection_error"          # never reached the server
    if "net::ERR_TIMED_OUT" in msg or ("page.goto" in msg and "Timeout" in msg):
        return "navigation_timeout"        # connected, document never finished
    if "begin" in msg.lower() and "Locator.click" in msg:
        return "begin_search_link_timeout" # page served, link never clickable
    if "Timeout" in msg:
        return "other_timeout"
    return type(e).__name__


def _diag_record(state: str, company: str, outcome: str, dur_s: float,
                 doc_responses: list[dict], err: Optional[Exception], page: Page) -> None:
    """Append a ledger row; on failure, dump a snapshot. Never raises."""
    global _diag_html_dumped
    try:
        DIAG_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now()
        last = doc_responses[-1] if doc_responses else {}
        retry_after = next((d.get("retry_after") for d in reversed(doc_responses)
                            if d.get("retry_after")), "")
        ledger = DIAG_DIR / "search_ledger.csv"
        new = not ledger.exists()
        with open(ledger, "a", newline="", encoding="utf-8") as f:
            if new:
                f.write("timestamp,state,term,outcome,duration_s,n_doc_responses,"
                        "last_doc_status,retry_after\n")
            f.write(f"{ts.isoformat(timespec='milliseconds')},{state},{company},{outcome},"
                    f"{dur_s:.1f},{len(doc_responses)},{last.get('status','')},{retry_after}\n")
        if outcome == "ok":
            return
        snap = DIAG_DIR / f"fail_{ts.strftime('%Y%m%d_%H%M%S_%f')}"
        snap.mkdir(parents=True, exist_ok=True)
        info: dict = {
            "timestamp": ts.isoformat(timespec="milliseconds"),
            "state": state, "term": company, "outcome": outcome,
            "duration_s": round(dur_s, 1),
            "exception": repr(err) if err else None,
            "document_responses": doc_responses,  # full headers incl. retry-after
        }
        for key, fn in (("page_url", lambda: page.url),
                        ("page_title", lambda: page.title()),
                        ("body_text_head", lambda: page.evaluate(
                            "() => document.body ? document.body.innerText.slice(0, 3000) : null"))):
            try:
                info[key] = fn()
            except Exception as ie:
                info[key] = f"<capture failed: {type(ie).__name__}>"
        with open(snap / "snapshot.json", "w", encoding="utf-8") as f:
            json.dump(info, f, indent=2, default=str)
        if _diag_html_dumped < _DIAG_HTML_CAP:
            try:
                (snap / "page.html").write_text(page.content(), encoding="utf-8")
                _diag_html_dumped += 1
            except Exception:
                pass
    except Exception:
        pass


def _submit_search(
    page: Page,
    state: str,
    company: str,
    *,
    date_from: str = DATE_FROM,
    date_to: str = DATE_TO,
) -> bool:
    """Submit one SERFF search. `date_from`/`date_to` default to the config
    submission window; callers (e.g. an incremental back-fill) may pass a
    narrower window to fetch only a new slice without re-fetching cached
    filings. Defaults are bound at import time to config's values, so the
    ~20 existing callers that pass no date args keep the full window.

    Semantics unchanged by the diagnostics wrapper: exceptions from
    navigation/clicks still PROPAGATE to callers; form/results failures
    still return False."""
    if DIAG_DIR is None:
        ok, _reason = _submit_search_attempt(page, state, company, date_from, date_to)
        return ok

    t0 = time.time()
    doc_responses: list[dict] = []

    def _on_response(resp):
        try:
            if resp.request.resource_type == "document":
                h = resp.headers
                doc_responses.append({
                    "ts": datetime.now().isoformat(timespec="milliseconds"),
                    "url": resp.url,
                    "status": resp.status,
                    "retry_after": h.get("retry-after"),
                    "headers": h,
                })
        except Exception:
            pass

    try:
        page.on("response", _on_response)
    except Exception:
        pass
    err: Optional[Exception] = None
    outcome = "ok"
    try:
        ok, reason = _submit_search_attempt(page, state, company, date_from, date_to)
        if not ok:
            outcome = reason
        return ok
    except Exception as e:
        err = e
        outcome = _classify_exception(e)
        raise
    finally:
        try:
            page.remove_listener("response", _on_response)
        except Exception:
            pass
        _diag_record(state, company, outcome, time.time() - t0, doc_responses, err, page)


def _submit_search_attempt(
    page: Page, state: str, company: str, date_from: str, date_to: str
) -> tuple[bool, str]:
    """The original _submit_search body, returning (ok, failure_reason)."""
    page.goto(SERFF_HOME_URL.format(state=state), wait_until="domcontentloaded", timeout=30000)
    page.get_by_role("link", name=re.compile(r"begin\s*search", re.I)).first.click()
    page.wait_for_load_state("domcontentloaded", timeout=30000)
    # ToU accept is required once per session.
    try:
        page.get_by_role("button", name=re.compile(r"^accept$", re.I)).first.click(timeout=5000)
        page.wait_for_load_state("networkidle", timeout=30000)
    except Exception:
        pass

    if not _set_primefaces_select(page, "simpleSearch:businessType", r"property\s*&\s*casualty"):
        return False, "business_type_select_failed"

    _fill_and_blur(page, "simpleSearch:companyName", company)
    _fill_and_blur(page, "simpleSearch:submissionStartDate_input", date_from)
    _fill_and_blur(page, "simpleSearch:submissionEndDate_input", date_to)

    _byid(page, "simpleSearch:saveBtn").first.click()
    try:
        _wait_for_results(page)
    except Exception:
        return False, "results_timeout"
    return True, "ok"


def _paginator_total(page: Page) -> int | None:
    """Read the results total from the PrimeFaces paginator ("1 - 100 of N" /
    "Showing x to y of N"). Returns None when no paginator/total is rendered.
    B8 (2026-07-08): this is the reconciliation source — rows SAVED must equal
    the total the page itself reports, else the search is NOT ok."""
    try:
        txt = page.locator(".ui-paginator-current").first.text_content(timeout=3000) or ""
        m = re.search(r"of\s+([\d,]+)", txt)
        return int(m.group(1).replace(",", "")) if m else None
    except Exception:
        return None


def _set_rows_per_page_100(page: Page) -> None:
    """Reduce pagination by selecting the 100 rows-per-page option if present.

    B8 (2026-07-08): the old body waited networkidle 15s and SWALLOWED the
    timeout — on a BIG result set the PrimeFaces AJAX re-render outlives the
    wait, extraction then reads the mid-render (emptied) tbody, and the search
    exits "ok" with 0 rows (the AK/MA Travelers + MA Nationwide false-clean-0).
    Now: wait for the re-render to COMPLETE (rows present again), retry once,
    and WARN LOUDLY if it never settles (the extract-retry + reconciliation
    guard downstream then catch any residue — nothing is silent).
    """
    try:
        sel = page.locator("select.ui-paginator-rpp-options").first
        if not sel.count():
            return
    except Exception:
        return
    for attempt in (1, 2):
        try:
            sel.select_option("100")
            page.wait_for_function(
                "() => !!document.querySelector('tr[data-rk]')", timeout=45000)
            page.wait_for_load_state("networkidle", timeout=45000)
            time.sleep(1.0)
            return
        except Exception as e:
            print(f"    [paginator] RPP-100 re-render not settled "
                  f"(attempt {attempt}/2): {type(e).__name__}", flush=True)
            time.sleep(2.0)
    print("    [paginator] WARNING: RPP-100 re-render never settled — "
          "extraction proceeds under the reconciliation guard", flush=True)


def _extract_rows(page: Page, state: str, company: str) -> list[Filing]:
    """Read the visible results table rows and map each to a Filing."""
    data = page.evaluate(
        """() => {
            const headers = Array.from(document.querySelectorAll('thead th .ui-column-title'))
                .map(h => (h.textContent || '').trim());
            const rows = Array.from(document.querySelectorAll('tbody#j_idt25\\\\:filingTable_data > tr[data-rk], tr[data-rk]'));
            const out = [];
            for (const r of rows) {
                const cells = Array.from(r.querySelectorAll('td')).map(td => (td.textContent || '').trim());
                out.push({ data_rk: r.getAttribute('data-rk'), cells });
            }
            return { headers, rows: out };
        }"""
    )
    headers: list[str] = [h for h in data.get("headers", []) if h]
    rows = data.get("rows", [])

    def col_index(name_regex: str) -> int | None:
        for i, h in enumerate(headers):
            if re.search(name_regex, h, re.I):
                return i
        return None

    idx_company = col_index(r"company\s*name")
    idx_naic = col_index(r"naic")
    idx_product = col_index(r"product")
    idx_subtoi = col_index(r"sub\s*type")
    idx_ftype = col_index(r"filing\s*type")
    idx_fstatus = col_index(r"filing\s*status")
    idx_serff = col_index(r"serff\s*tracking")

    filings: list[Filing] = []
    for r in rows:
        cells: list[str] = r["cells"]
        filing_id = r["data_rk"]
        if not filing_id or not cells:
            continue
        # The first cell contains a toggler glyph prefix; cells already stripped.
        def cell(i: int | None) -> str | None:
            if i is None or i >= len(cells):
                return None
            v = cells[i].strip()
            return v or None

        serff_tid = cell(idx_serff) or f"{state}-{filing_id}"
        naic_raw = cell(idx_naic) or ""
        naic_codes = [c.strip() for c in re.split(r"[,\s/;]+", naic_raw) if c.strip()]

        filings.append(
            Filing(
                state=state,
                serff_tracking_number=serff_tid,
                filing_id=filing_id,
                company_name=cell(idx_company) or "",
                target_company=company,
                naic_codes=naic_codes,
                product_name=cell(idx_product),
                sub_type_of_insurance=cell(idx_subtoi),
                filing_type=cell(idx_ftype),
                filing_status=cell(idx_fstatus),
                detail_url=SERFF_DETAIL_URL.format(filing_id=filing_id),
            )
        )
    return filings


def _has_next_page(page: Page) -> bool:
    nxt = page.locator(".ui-paginator-top .ui-paginator-next").first
    if not nxt.count():
        return False
    cls = (nxt.get_attribute("class") or "")
    return "ui-state-disabled" not in cls


def _click_next_page(page: Page) -> bool:
    """B8 (2026-07-08): a bare .click() dies when a floating navbar overlay
    intercepts the pointer (the AK-noted mode) — scroll into view first, fall
    back to a JS click on interception, then VERIFY PROGRESS (the first row's
    data-rk changed) instead of trusting the click."""
    nxt = page.locator(".ui-paginator-top .ui-paginator-next").first
    if not nxt.count():
        return False
    try:
        before = page.locator("tr[data-rk]").first.get_attribute("data-rk")
    except Exception:
        before = None
    try:
        nxt.scroll_into_view_if_needed(timeout=5000)
        nxt.click(timeout=10000)
    except Exception:
        try:
            nxt.evaluate("el => el.click()")  # JS click bypasses pointer interception
        except Exception:
            return False
    try:
        if before is not None:
            page.wait_for_function(
                """(prev) => {
                    const r = document.querySelector('tr[data-rk]');
                    return r && r.getAttribute('data-rk') !== prev;
                }""",
                arg=before, timeout=20000)
        else:
            _wait_for_results(page)
        return True
    except Exception:
        return False


def _parse_date(s: str) -> Optional[date]:
    """Accept SERFF's m/d/yy or m/d/yyyy formats."""
    s = (s or "").strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _goto_row_page(page: Page, filing_id: str, max_pages: int = 50) -> bool:
    """Paginate the results table until the row with the given stable
    `data-rk` (the SERFF filing_id captured at search time) is on the visible
    page. Returns True once found.

    Keys off `data-rk`, NOT result-set position or page index, so it is robust
    to paginated and reordered results — the row may land on any page and at
    any index across re-runs (this is the bug behind the AZ enrichment skips:
    the old code only inspected page 1 / the current page). Jumps to the first
    page first so the forward scan covers the whole result set regardless of
    where pagination currently sits. Note for TRVD-G filings the data-rk is NOT
    the tracking-number suffix, so callers must pass the filing_id from the
    search workbook, never derive it from the tracking string.
    """
    _set_rows_per_page_100(page)
    first = page.locator(".ui-paginator-first").first
    if first.count() and "ui-state-disabled" not in (first.get_attribute("class") or ""):
        try:
            first.click()
            _wait_for_results(page)
        except Exception:
            pass
    for _ in range(max_pages):
        if page.locator(f'tr[data-rk="{filing_id}"]').count():
            return True
        nxt = page.locator(".ui-paginator-next").first
        if not nxt.count() or "ui-state-disabled" in (nxt.get_attribute("class") or ""):
            return False
        try:
            nxt.click()
            _wait_for_results(page)
        except Exception:
            return False
    return False


def _click_row_to_detail(page: Page, filing_id: str) -> bool:
    """Click the SERFF Tracking cell on a results row to load its detail page.

    Direct URL navigation (filingSummary.xhtml?filingId=...) redirects to
    /sfa/500.xhtml because the detail page requires the JSF ViewState session
    produced by a row click on the results page.

    Paginates to find the row by its stable `data-rk` before clicking, so rows
    beyond page 1 (or reordered onto a different page) are reached rather than
    silently skipped.
    """
    if not _goto_row_page(page, filing_id):
        return False
    row = page.locator(f'tr[data-rk="{filing_id}"]').first
    if not row.count():
        return False
    cells = row.locator("td")
    n = cells.count()
    if n < 2:
        return False
    url_before = page.url
    try:
        # The click itself must be inside the try: when the PrimeFaces table
        # is mid-re-render (e.g. right after a download's go_back in a batched
        # session) the cell can detach mid-click and Locator.click RAISES —
        # observed crashing the 2026-06-10 GA validation burst at position 3.
        # A raise here is a per-row miss, not a run-fatal error.
        cells.nth(n - 1).click()
        page.wait_for_url(lambda u: u != url_before and "filingSummary" in u, timeout=15000)
        page.wait_for_load_state("domcontentloaded", timeout=15000)
        return True
    except Exception:
        return False


def _extract_submission_date_from_detail(page: Page) -> Optional[date]:
    """Pull the 'Submission Date: <date>' value from the filing summary page."""
    txt = page.evaluate(
        """() => {
            const labels = Array.from(document.querySelectorAll('label'));
            for (const l of labels) {
                if (/^\\s*submission\\s+date\\s*:\\s*$/i.test(l.textContent || '')) {
                    const row = l.closest('.row');
                    if (!row) continue;
                    const val = row.querySelector('div');
                    return val ? (val.textContent || '').trim() : null;
                }
            }
            return null;
        }"""
    )
    return _parse_date(txt) if txt else None


def _back_to_results(page: Page) -> bool:
    try:
        page.go_back(wait_until="domcontentloaded", timeout=15000)
        page.wait_for_selector('tr[data-rk]', timeout=10000)
        return True
    except Exception:
        return False


def search_company(
    browser: Browser,
    state: str,
    company: str,
    *,
    fetch_submission_dates: bool = True,
    delay_s: float = REQUEST_DELAY,
    date_from: str = DATE_FROM,
    date_to: str = DATE_TO,
) -> list[Filing]:
    """Run one search; return a Filing per results-table row across all pages.

    When `fetch_submission_dates` is True, we make a lightweight detail-page
    fetch per filing to populate `submission_date` (no PDF parsing here —
    that's Step 5). Reuses the search's browser context for session state.

    `date_from`/`date_to` are passed through to `_submit_search` (default to
    the config submission window).
    """
    ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=False)
    page = ctx.new_page()
    filings: list[Filing] = []
    try:
        if not _submit_search(page, state, company, date_from=date_from, date_to=date_to):
            return filings
        _set_rows_per_page_100(page)
        reported_total = _paginator_total(page)

        seen: set[str] = set()
        while True:
            batch = _extract_rows(page, state, company)
            if not batch and not filings:
                # B8: the results-wait saw rows (or no-records) before we got
                # here; an empty FIRST read on a page that reported a total is
                # a mid-render race, not an answer. Re-wait and retry once.
                if reported_total:
                    print(f"    [paginator] first extract empty but paginator "
                          f"reports {reported_total} — re-waiting", flush=True)
                    try:
                        _wait_for_results(page)
                    except Exception:
                        pass
                    time.sleep(2.0)
                    batch = _extract_rows(page, state, company)
            new = [f for f in batch if f.filing_id not in seen]
            for f in new:
                seen.add(f.filing_id)
            filings.extend(new)
            if not _has_next_page(page):
                break
            if not _click_next_page(page):
                break

        # B8 reconciliation guard: rows SAVED must match the total the page
        # itself reported. Any shortfall is a LOUD non-ok ledger outcome —
        # the false-clean-0 class (and any future variant) cannot masquerade
        # as a genuine empty result again.
        if reported_total is not None and len(filings) < reported_total:
            print(f"    [paginator] EXTRACT MISMATCH: saved {len(filings)} of "
                  f"{reported_total} reported — flagging in ledger", flush=True)
            _diag_record(state, company,
                         f"extract_mismatch_{len(filings)}_of_{reported_total}",
                         0.0, [], None, page)

        if fetch_submission_dates and filings:
            print(f"    fetching submission dates for {len(filings)} filings ...", flush=True)
            for i, f in enumerate(filings, 1):
                try:
                    # If the row isn't in the current view (pagination reverted
                    # after a go_back), re-set RPP=100 to bring all rows back.
                    if not page.locator(f'tr[data-rk="{f.filing_id}"]').count():
                        _set_rows_per_page_100(page)
                    if not _click_row_to_detail(page, f.filing_id):
                        print(f"      [warn] {f.serff_tracking_number}: could not open detail", flush=True)
                        continue
                    f.submission_date = _extract_submission_date_from_detail(page)
                    _back_to_results(page)
                except Exception as e:
                    print(f"      [warn] {f.serff_tracking_number}: {e}", flush=True)
                time.sleep(delay_s)
                if i % 10 == 0:
                    print(f"      {i}/{len(filings)} ...", flush=True)
    finally:
        ctx.close()
    return filings


def search_all(
    state_company_pairs: Iterable[tuple[str, str]],
    *,
    headless: bool = HEADLESS,
    delay_s: float = REQUEST_DELAY,
    checkpoint_cb=None,
    date_from: str = DATE_FROM,
    date_to: str = DATE_TO,
    fetch_submission_dates: bool = True,
) -> list[Filing]:
    """Run search_company for each (state, company) pair with polite delays.

    `checkpoint_cb(all_filings_so_far)` is invoked after each (state, company)
    pair completes — lets the caller persist partial results so a later crash
    doesn't wipe an hour of search work.

    `date_from`/`date_to` are passed through to each `search_company` call
    (default to the config submission window). An incremental back-fill can
    pass a narrower window to fetch only a new submission slice.
    """
    all_filings: list[Filing] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        try:
            for state, company in state_company_pairs:
                print(f"[search] {state} / {company}  [{date_from} -> {date_to}] ...", flush=True)
                try:
                    results = search_company(browser, state, company, date_from=date_from, date_to=date_to,
                                             fetch_submission_dates=fetch_submission_dates)
                except Exception as e:
                    print(f"  ! {state}/{company} failed: {e}", flush=True)
                    results = []
                print(f"  -> {len(results)} rows", flush=True)
                all_filings.extend(results)
                if checkpoint_cb is not None:
                    try:
                        checkpoint_cb(all_filings)
                    except Exception as e:
                        print(f"  ! checkpoint save failed: {e}", flush=True)
                time.sleep(delay_s)
        finally:
            browser.close()
    return all_filings


__all__ = ["search_company", "search_all", "TARGET_COMPANIES", "SERFF_BASE"]
