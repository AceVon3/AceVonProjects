"""SERFF exploration — Step 1 of build plan.

Traverses the WA SERFF Filing Access site with the real selectors observed
in the live HTML, runs a sample search, captures a results table and a
detail page. Saves every HTML snapshot into tests/fixtures/ for offline
parser testing later.

Run:
    ./.venv/Scripts/python.exe explore.py
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

FIXTURES = Path("tests/fixtures")
FIXTURES.mkdir(parents=True, exist_ok=True)

WA_HOME = "https://filingaccess.serff.com/sfa/home/WA"
PROBE_COMPANY = "State Farm"
PROBE_DATE_START = "01/01/2025"
PROBE_DATE_END = "04/17/2026"


@dataclass
class Findings:
    notes: list[str] = field(default_factory=list)
    results_columns: list[str] = field(default_factory=list)
    results_row_count: int | None = None
    results_sample_rows: list[list[str]] = field(default_factory=list)
    detail_labels: list[str] = field(default_factory=list)
    detail_sections: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def log(self, msg: str) -> None:
        safe = msg.encode("ascii", "replace").decode("ascii")
        print(safe)
        self.notes.append(msg)


def save_html(page: Page, name: str) -> None:
    (FIXTURES / f"{name}.html").write_text(page.content(), encoding="utf-8")


# Playwright locator by literal id attribute (JSF uses ':' which breaks `#id`).
def byid(page: Page, jsf_id: str):
    return page.locator(f'[id="{jsf_id}"]')


def set_primefaces_select(page: Page, panel_id: str, option_label_regex: str) -> bool:
    """Click a PrimeFaces SelectOne menu label, wait for the option panel, click the option."""
    label = byid(page, f"{panel_id}_label")
    if not label.count():
        return False
    label.first.click()
    # Option list uses id={panel_id}_items
    items = byid(page, f"{panel_id}_items")
    items.wait_for(state="visible", timeout=5000)
    opt = items.locator("li", has_text=re.compile(option_label_regex, re.I))
    if not opt.count():
        return False
    opt.first.click()
    # Let the AJAX postback settle (P&C triggers the Type-of-Insurance dropdown to populate)
    page.wait_for_load_state("networkidle", timeout=15000)
    return True


def describe_results_table(page: Page, findings: Findings) -> None:
    info = page.evaluate(
        """
        () => {
            // search results table on SERFF is in the panel section, usually a <table> with class containing 'ui-datatable'
            const candidates = Array.from(document.querySelectorAll('table'));
            let best = null;
            let bestScore = 0;
            for (const t of candidates) {
                const rows = t.querySelectorAll('tbody tr').length;
                const headers = t.querySelectorAll('thead th').length;
                const score = headers * 100 + rows;
                // skip obvious non-result tables (radio toggles only have 1 row)
                if ((t.className || '').includes('ui-datatable') || headers >= 3) {
                    if (score > bestScore) { best = t; bestScore = score; }
                }
            }
            if (!best) return null;
            const headers = Array.from(best.querySelectorAll('thead th')).map(h => h.textContent.trim());
            const rows = Array.from(best.querySelectorAll('tbody tr'));
            const sample = rows.slice(0, 3).map(r =>
                Array.from(r.querySelectorAll('td')).map(c => c.textContent.trim().slice(0, 80))
            );
            const firstLinkHref = best.querySelector('tbody a') ? best.querySelector('tbody a').getAttribute('href') : '';
            return {
                id: best.id || '',
                cls: best.className || '',
                headers,
                rowCount: rows.length,
                sample,
                firstLinkHref,
            };
        }
        """
    )
    if not info:
        findings.errors.append("No results table found on results page")
        return
    findings.results_columns = info["headers"]
    findings.results_row_count = info["rowCount"]
    findings.results_sample_rows = info["sample"]
    findings.log(f"Results table id={info['id']!r} class={info['cls']!r}")
    findings.log(f"  rowCount={info['rowCount']}, headers={info['headers']}")
    for i, row in enumerate(info["sample"]):
        findings.log(f"  sample[{i}] = {row}")
    findings.log(f"  first result link href={info['firstLinkHref']!r}")


def describe_detail_page(page: Page, findings: Findings) -> None:
    # SERFF detail page typically has multiple panels with headings; extract label: value pairs.
    data = page.evaluate(
        """
        () => {
            const pairs = [];
            const seen = new Set();
            // Strategy 1: definition tables — rows with <th>Label</th><td>Value</td>
            document.querySelectorAll('table tr').forEach(tr => {
                const th = tr.querySelector('th');
                const td = tr.querySelector('td');
                if (th && td) {
                    const k = th.textContent.trim();
                    const v = td.textContent.trim().slice(0, 120);
                    if (k && !seen.has(k)) {
                        seen.add(k);
                        pairs.push({k, v});
                    }
                }
            });
            // Strategy 2: Bootstrap form-group rows (label + value div)
            document.querySelectorAll('.form-group').forEach(fg => {
                const label = fg.querySelector('label');
                const val = fg.querySelector('.col-md-9, .col-md-7, .col-md-3');
                if (label && val) {
                    const k = label.textContent.trim();
                    const v = val.textContent.trim().slice(0, 120);
                    if (k && !seen.has(k)) {
                        seen.add(k);
                        pairs.push({k, v});
                    }
                }
            });
            // Strategy 3: panel headings — give context for where data lives
            const sections = Array.from(document.querySelectorAll('h2, h3, .panel-title, .panel-heading'))
                .map(h => h.textContent.trim()).filter(Boolean);
            return { pairs, sections };
        }
        """
    )
    findings.detail_labels = [f"{p['k']}: {p['v']}" for p in data["pairs"]]
    findings.detail_sections = data["sections"]
    findings.log("Detail page sections:")
    for s in data["sections"]:
        findings.log(f"  # {s}")
    findings.log("Detail page label/value pairs:")
    for p in data["pairs"]:
        findings.log(f"  {p['k']}: {p['v']}")


def explore_wa(pw) -> Findings:
    findings = Findings()
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
    )
    page = ctx.new_page()

    try:
        findings.log(f"GET {WA_HOME}")
        page.goto(WA_HOME, wait_until="domcontentloaded", timeout=30000)
        save_html(page, "01_wa_home")

        findings.log("Click 'Begin Search' link")
        page.get_by_role("link", name=re.compile(r"begin\s*search", re.I)).first.click()
        page.wait_for_load_state("domcontentloaded", timeout=30000)
        save_html(page, "02_wa_agreement")

        findings.log("Click 'Accept'")
        page.get_by_role("button", name=re.compile(r"^accept$", re.I)).first.click()
        page.wait_for_load_state("networkidle", timeout=30000)
        save_html(page, "03_wa_search_form")
        findings.log(f"  URL: {page.url}")

        # 1. Set Business Type to Property & Casualty (PrimeFaces SelectOne)
        findings.log("Set Business Type = Property & Casualty")
        ok = set_primefaces_select(page, "simpleSearch:businessType", r"property\s*&\s*casualty")
        findings.log(f"  selected: {ok}")
        save_html(page, "04_wa_after_business_type")

        # Helper: fill + blur (Tab) so JSF/PrimeFaces registers the value in its model.
        def fill_and_blur(jsf_id: str, value: str) -> None:
            loc = byid(page, jsf_id).first
            loc.click()
            loc.fill(value)
            loc.press("Tab")

        # 2. Company name
        findings.log(f"Fill Company Name = {PROBE_COMPANY!r}")
        fill_and_blur("simpleSearch:companyName", PROBE_COMPANY)
        # Leave the radio at the default "Begins With" for now.

        # 3. Date range (submission start/end). Format: MM/DD/YYYY.
        findings.log(f"Fill Start Submission Date = {PROBE_DATE_START}")
        fill_and_blur("simpleSearch:submissionStartDate_input", PROBE_DATE_START)
        findings.log(f"Fill End Submission Date = {PROBE_DATE_END}")
        fill_and_blur("simpleSearch:submissionEndDate_input", PROBE_DATE_END)

        save_html(page, "05_wa_search_filled")

        # 4. Click Search (PrimeFaces AJAX postback rewrites simpleSearch:panel).
        findings.log("Click Search button")
        byid(page, "simpleSearch:saveBtn").first.click()

        # Wait for results to land: either a datatable, a no-records message, or an error.
        # The "Now Searching..." blocker is visible during the AJAX call; when it hides, we're done.
        outcome = None
        try:
            page.wait_for_function(
                """() => {
                    const blocker = document.querySelector('#simpleSearch\\\\:j_idt22');
                    const blockerHidden = !blocker || blocker.classList.contains('ui-helper-hidden') || blocker.style.display === 'none';
                    const hasTable = document.querySelector('table.ui-datatable, table[id*="resultsTable" i]');
                    const hasMessage = document.querySelector('#simpleSearch\\\\:messages .ui-messages-info, #simpleSearch\\\\:messages .ui-messages-warn, #simpleSearch\\\\:messages .ui-messages-error');
                    const hasNoRec = Array.from(document.querySelectorAll('span, div, td')).some(e => /no\\s+records|no\\s+filings?\\s+(were|matched|found)/i.test(e.textContent || ''));
                    return blockerHidden && (hasTable || hasMessage || hasNoRec);
                }""",
                timeout=60000,
            )
            outcome = "signal"
        except Exception:
            # Fall through — save what we have and let describe_results_table diagnose.
            outcome = "timeout"
        findings.log(f"  post-search wait outcome: {outcome}")
        save_html(page, "06_wa_results")
        findings.log(f"  URL: {page.url}")

        describe_results_table(page, findings)

        # 5. Click into the first result row. PrimeFaces SelectableDataTable:
        #    Option A: row click navigates -> detail page.
        #    Option B: row-toggler expands inline -> details render in the same page.
        #    Try a body cell click (not the toggler in cell 0).
        first_row = page.locator("tr[data-rk]").first
        if first_row.count():
            rk = first_row.get_attribute("data-rk")
            findings.log(f"Attempt 1: click SERFF Tracking Number cell, data-rk={rk!r}")
            try:
                # Click the last cell (SERFF tracking number) to avoid the ui-row-toggler in cell 0.
                cells = first_row.locator("td")
                n = cells.count()
                url_before = page.url
                cells.nth(n - 1).click()
                # Wait either for a URL change (navigation) or new content (inline expansion)
                try:
                    page.wait_for_url(lambda u: u != url_before, timeout=10000)
                    findings.log("  -> navigation occurred")
                except Exception:
                    findings.log("  -> no navigation; assuming inline expansion")
                    page.wait_for_timeout(2000)
                save_html(page, "07a_wa_after_row_click")
                findings.log(f"  URL after row cell click: {page.url}")
            except Exception as e:
                findings.log(f"  row cell click failed: {e}")

            # Attempt 2: click the row-toggler icon (should expand row in-place).
            findings.log("Attempt 2: click row-toggler to expand row")
            try:
                toggler = first_row.locator(".ui-row-toggler").first
                if toggler.count():
                    toggler.click()
                    page.wait_for_timeout(2000)
                    save_html(page, "07b_wa_after_row_toggler")
                    findings.log(f"  URL after row-toggler click: {page.url}")
                    describe_detail_page(page, findings)
                else:
                    findings.log("  no row-toggler element found")
            except Exception as e:
                findings.errors.append(f"Row-toggler click failed: {e}")
        else:
            findings.errors.append("No result row [data-rk] found in results table")

    finally:
        ctx.close()
        browser.close()

    return findings


def main() -> int:
    with sync_playwright() as pw:
        findings = explore_wa(pw)

    out = {
        "notes": findings.notes,
        "results_columns": findings.results_columns,
        "results_row_count": findings.results_row_count,
        "results_sample_rows": findings.results_sample_rows,
        "detail_sections": findings.detail_sections,
        "detail_labels": findings.detail_labels,
        "errors": findings.errors,
    }
    (FIXTURES / "exploration_report.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"\nFixtures + report saved to {FIXTURES.resolve()}")
    if findings.errors:
        print("\n!! Errors:")
        for e in findings.errors:
            print(f"  - {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
