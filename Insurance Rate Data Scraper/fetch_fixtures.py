"""Download real SERFF PDFs (1-2 per target company) into tests/fixtures/pdfs/
so we can validate the rate-effect regex parser against actual carrier formats.

Reuses the same PrimeFaces/JSF navigation pattern from explore.py.

Run:
    ./.venv/Scripts/python.exe fetch_fixtures.py
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

FIXTURES = Path("tests/fixtures/pdfs")
FIXTURES.mkdir(parents=True, exist_ok=True)

WA_HOME = "https://filingaccess.serff.com/sfa/home/WA"
TARGETS = ["State Farm", "GEICO", "Progressive"]
DATE_START = "01/01/2024"
DATE_END = "04/17/2026"

REQUEST_DELAY = 2.5


def byid(page: Page, jsf_id: str):
    return page.locator(f'[id="{jsf_id}"]')


def set_primefaces_select(page: Page, panel_id: str, option_label_regex: str) -> bool:
    label = byid(page, f"{panel_id}_label")
    if not label.count():
        return False
    label.first.click()
    items = byid(page, f"{panel_id}_items")
    items.wait_for(state="visible", timeout=5000)
    opt = items.locator("li", has_text=re.compile(option_label_regex, re.I))
    if not opt.count():
        return False
    opt.first.click()
    page.wait_for_load_state("networkidle", timeout=15000)
    return True


def fill_and_blur(page: Page, jsf_id: str, value: str) -> None:
    loc = byid(page, jsf_id).first
    loc.click()
    loc.fill(value)
    loc.press("Tab")


def wait_for_results(page: Page) -> None:
    # The search button causes a full navigation to filingSearchResults.xhtml.
    # Just wait for the page to load and a data row to appear (or a no-records message).
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


def search_for_company(page: Page, company: str) -> bool:
    """Run a fresh P&C search for `company` between DATE_START and DATE_END.
    Returns True if a result row is present.
    """
    print(f"\n=== Search: {company} ===")
    page.goto(WA_HOME, wait_until="domcontentloaded", timeout=30000)
    page.get_by_role("link", name=re.compile(r"begin\s*search", re.I)).first.click()
    page.wait_for_load_state("domcontentloaded", timeout=30000)
    # Accept agreement (only on first page load per session — this is a fresh ctx each run)
    try:
        page.get_by_role("button", name=re.compile(r"^accept$", re.I)).first.click(timeout=5000)
        page.wait_for_load_state("networkidle", timeout=30000)
    except Exception:
        pass

    ok = set_primefaces_select(page, "simpleSearch:businessType", r"property\s*&\s*casualty")
    if not ok:
        print("  ! failed to set business type")
        return False

    fill_and_blur(page, "simpleSearch:companyName", company)
    fill_and_blur(page, "simpleSearch:submissionStartDate_input", DATE_START)
    fill_and_blur(page, "simpleSearch:submissionEndDate_input", DATE_END)

    byid(page, "simpleSearch:saveBtn").first.click()
    try:
        wait_for_results(page)
    except Exception as e:
        print(f"  ! results wait failed: {e}")
        debug_name = f"debug_search_{re.sub(r'[^a-z0-9]+', '_', company.lower()).strip('_')}.html"
        Path("tests/fixtures").joinpath(debug_name).write_text(page.content(), encoding="utf-8")
        print(f"    dumped DOM to tests/fixtures/{debug_name}")
        return False

    rows = page.locator("tr[data-rk]")
    count = rows.count()
    print(f"  result rows: {count}")
    return count > 0


def find_rate_rule_filing_ids(page: Page, limit: int = 5) -> list[str]:
    """Scan the results table and return up to `limit` data-rk values where Filing Type is 'Rate/Rule'."""
    info = page.evaluate(
        f"""() => {{
            const rows = Array.from(document.querySelectorAll('tr[data-rk]'));
            const headers = Array.from(document.querySelectorAll('thead th')).map(h => h.textContent.trim());
            let typeIdx = headers.findIndex(h => /filing\\s*type/i.test(h));
            if (typeIdx < 0) typeIdx = 4;
            const out = [];
            for (const r of rows) {{
                const tds = r.querySelectorAll('td');
                const cell = tds[typeIdx];
                if (cell && /rate/i.test(cell.textContent || '')) {{
                    out.push(r.getAttribute('data-rk'));
                    if (out.length >= {limit}) break;
                }}
            }}
            return out;
        }}"""
    )
    return info or []


def navigate_to_detail_by_clicking_row(page: Page, filing_id: str) -> bool:
    """From the search results page, click the target row's SERFF Tracking Number cell."""
    target_row = page.locator(f'tr[data-rk="{filing_id}"]').first
    if not target_row.count():
        return False
    cells = target_row.locator("td")
    n = cells.count()
    if n < 2:
        return False
    url_before = page.url
    cells.nth(n - 1).click()
    try:
        page.wait_for_url(lambda u: u != url_before and "filingSummary" in u, timeout=15000)
        page.wait_for_load_state("domcontentloaded", timeout=15000)
        return True
    except Exception as e:
        print(f"    ! row-click nav failed: {e}")
        return False


def download_pdfs_from_detail(page: Page, company: str, filing_id: str) -> list[Path]:
    """On the detail page, click PDF attachment links and capture downloads. Prefer filings with Memo/Exhibits in the name."""
    saved: list[Path] = []
    print(f"  navigating to detail for filing {filing_id}")
    if not navigate_to_detail_by_clicking_row(page, filing_id):
        print("  ! could not reach detail page")
        return saved
    print(f"  detail url: {page.url}")

    # Collect all attachment link descriptors (id + text), then decide what to click.
    links = page.evaluate(
        """() => {
            const out = [];
            document.querySelectorAll('a[id$="downloadAttachment_"]').forEach(a => {
                out.push({ id: a.id, text: (a.textContent || '').trim() });
            });
            return out;
        }"""
    )
    print(f"  attachments on page: {len(links)}")
    if len(links) == 0:
        debug_detail = Path("tests/fixtures") / f"debug_detail_{re.sub(r'[^a-z0-9]+', '_', company.lower()).strip('_')}_{filing_id}.html"
        debug_detail.write_text(page.content(), encoding="utf-8")
        print(f"    dumped detail DOM to {debug_detail.name}  (url={page.url})")
    # Pick up to 2 per company — prefer Memo/Exhibits-style PDFs, fallback to any .pdf
    scored = []
    for lk in links:
        text = lk["text"].lower()
        if not text.endswith(".pdf"):
            continue
        score = 0
        for keyword, pts in (
            ("memo", 5),
            ("exhibit", 4),
            ("actuarial", 4),
            ("filing", 2),
            ("manual", 1),
        ):
            if keyword in text:
                score += pts
        scored.append((score, lk))
    scored.sort(key=lambda x: -x[0])
    chosen = [lk for _, lk in scored[:3]] or [lk for lk in links if lk["text"].lower().endswith(".pdf")][:2]
    if not chosen:
        print("  ! no PDF attachments found")
        return saved

    company_slug = re.sub(r"\W+", "_", company.lower()).strip("_")
    for lk in chosen:
        filename = re.sub(r'[\\/:*?"<>|]+', "_", lk["text"])
        dest = FIXTURES / f"{company_slug}_{filing_id}_{filename}"
        if dest.exists():
            print(f"    [skip] already have {dest.name}")
            saved.append(dest)
            continue
        try:
            with page.expect_download(timeout=30000) as dl_info:
                # The link has target=_blank; click via JS to avoid popup blockers
                page.evaluate(f"document.getElementById('{lk['id']}').click();")
            download = dl_info.value
            download.save_as(str(dest))
            print(f"    [ok] saved {dest.name}")
            saved.append(dest)
            time.sleep(REQUEST_DELAY)
        except Exception as e:
            print(f"    [err] download failed for {lk['text']!r}: {e}")
    return saved


def main() -> int:
    results: dict[str, list[str]] = {}
    max_filings_per_company = 3
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        for company in TARGETS:
            results.setdefault(company, [])
            filing_ids: list[str] = []
            # First pass: do one search, collect up to N rate/rule filing IDs.
            ctx = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                accept_downloads=True,
            )
            page = ctx.new_page()
            try:
                if not search_for_company(page, company):
                    print(f"  ! no results for {company}, skipping")
                    continue
                filing_ids = find_rate_rule_filing_ids(page, limit=max_filings_per_company)
                print(f"  rate/rule filing ids: {filing_ids}")
            finally:
                ctx.close()
                time.sleep(REQUEST_DELAY)

            # Subsequent passes: fresh context per filing so session state is clean.
            for fid in filing_ids:
                ctx = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    accept_downloads=True,
                )
                page = ctx.new_page()
                try:
                    if not search_for_company(page, company):
                        continue
                    saved = download_pdfs_from_detail(page, company, fid)
                    results[company].extend(p.name for p in saved)
                finally:
                    ctx.close()
                    time.sleep(REQUEST_DELAY)
        browser.close()

    print("\n=== Fixture download summary ===")
    for company, files in results.items():
        print(f"  {company}: {len(files)} pdf(s)")
        for f in files:
            print(f"    - {f}")
    total = sum(len(v) for v in results.values())
    print(f"Total PDFs saved: {total}")
    return 0 if total else 1


if __name__ == "__main__":
    sys.exit(main())
