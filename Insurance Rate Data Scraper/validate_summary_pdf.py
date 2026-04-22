"""Validate the system-generated SERFF summary-PDF download + parse path.

Steps:
  1. Download the system PDF for SFMA-134676753 via minimal-zip
     (no checkboxes selected). Extract the {tracking}.pdf, delete the zip.
  2. Parse the Disposition / Company Rate Information table.
  3. Assert every value matches the AM Best ground truth exactly.
"""
from __future__ import annotations
import re, sys, zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import pdfplumber
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")
from src.config import USER_AGENT, HEADLESS
from src.search import _submit_search, _set_rows_per_page_100, _click_row_to_detail

STATE = "ID"; COMPANY = "state farm"; FILING_ID = "134676753"; TRACKING = "SFMA-134676753"
DEST = Path("output/pdfs") / STATE / FILING_ID
DEST.mkdir(parents=True, exist_ok=True)


# ============================================================
# DOWNLOAD: minimal-zip path
# ============================================================
def download_system_summary_pdf(filing_id: str, tracking: str, dest_dir: Path,
                                state: str, search_term: str) -> Optional[Path]:
    """Returns saved Path to {tracking}.pdf, or None on failure."""
    out_pdf = dest_dir / "filing_summary.pdf"
    if out_pdf.exists() and out_pdf.stat().st_size > 5000:
        return out_pdf
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=True)
        page = ctx.new_page()
        try:
            if not _submit_search(page, state, search_term): return None
            _set_rows_per_page_100(page)
            for _ in range(8):
                if page.locator(f'tr[data-rk="{filing_id}"]').count(): break
                nxt = page.locator(".ui-paginator-next").first
                if not nxt.count(): break
                nxt.click(); page.wait_for_load_state("networkidle", timeout=15000)
            if not _click_row_to_detail(page, filing_id): return None
            page.wait_for_load_state("networkidle", timeout=20000)
            page.wait_for_timeout(600)

            tmp_zip = dest_dir / f"{tracking}.zip"
            with page.expect_download(timeout=90000) as dl_info:
                page.evaluate("document.getElementById('summaryForm:downloadLink').click();")
            dl_info.value.save_as(str(tmp_zip))
            inner = f"{tracking}.pdf"
            with zipfile.ZipFile(tmp_zip) as zf:
                names = zf.namelist()
                if inner not in names:
                    print(f"  ! {inner} not in zip; entries: {names}")
                    return None
                with zf.open(inner) as src, open(out_pdf, "wb") as dst:
                    dst.write(src.read())
            tmp_zip.unlink()
            return out_pdf
        finally:
            browser.close()


# ============================================================
# PARSE: Disposition / Company Rate Information table
# ============================================================
@dataclass
class CompanyRateRow:
    company_name: str
    overall_indicated_change: Optional[str] = None     # "15.900%"
    overall_rate_impact: Optional[str] = None          # "-2.100%"
    written_premium_change: Optional[str] = None       # "-554469" (numeric, signed)
    policyholders_affected: Optional[int] = None       # 20679
    written_premium_for_program: Optional[str] = None  # "26357498"
    maximum_pct_change: Optional[str] = None           # "388.400%"
    minimum_pct_change: Optional[str] = None           # "-41.500%"


@dataclass
class FilingSummary:
    tracking_number: str
    disposition_status: Optional[str] = None
    disposition_date: Optional[str] = None
    effective_date_new: Optional[str] = None
    effective_date_renewal: Optional[str] = None
    rate_data_applies: Optional[bool] = None  # SERFF flag: True = real rate change, False = rule/symbol/new product
    company_rates: list[CompanyRateRow] = None
    multi_company_overall_indicated: Optional[str] = None
    multi_company_overall_impact: Optional[str] = None
    multi_company_premium_change: Optional[str] = None
    multi_company_policyholders: Optional[int] = None


# Match a numeric data row inside the Company Rate / Disposition table.
# Captures: name_fragment, indicated, impact, premium_change(signed), policyholders,
#           premium_for_program(positive), max%, min%
# Money signs may be `$-554,469` or `$554,469` or `$(554,469)`.
# Pattern A: all 7 numeric values present
_RATE_ROW_RE = re.compile(
    r"^(?P<name>.+?)\s+"
    r"(?P<ind>-?\d+(?:\.\d+)?)%\s+"
    r"(?P<imp>-?\d+(?:\.\d+)?)%\s+"
    r"\$\(?(?P<prem_chg>-?[\d,]+)\)?\s+"
    r"(?P<ph>[\d,]+)\s+"
    r"\$(?P<prem_for>[\d,]+)\s+"
    r"(?P<maxp>-?\d+(?:\.\d+)?)%\s+"
    r"(?P<minp>-?\d+(?:\.\d+)?)%\s*$"
)
# Pattern B: blank "Overall Indicated Change" rendered as bare `%` (e.g., ANAIC Allstate)
_RATE_ROW_RE_B = re.compile(
    r"^(?P<name>.+?)\s+%\s+"
    r"(?P<imp>-?\d+(?:\.\d+)?)%\s+"
    r"\$\(?(?P<prem_chg>-?[\d,]+)\)?\s+"
    r"(?P<ph>[\d,]+)\s+"
    r"\$(?P<prem_for>[\d,]+)\s+"
    r"(?P<maxp>-?\d+(?:\.\d+)?)%\s+"
    r"(?P<minp>-?\d+(?:\.\d+)?)%\s*$"
)
# Pattern C: only ind% and impact% present; premium/policyholders/max/min all blank.
# Renders as "name ind% impact% % %"  (e.g., new-program first rate filing).
_RATE_ROW_RE_C = re.compile(
    r"^(?P<name>.+?)\s+"
    r"(?P<ind>-?\d+(?:\.\d+)?)%\s+"
    r"(?P<imp>-?\d+(?:\.\d+)?)%\s+"
    r"%\s+%\s*$"
)

# Multi-company summary lines (page 7 bottom)
_MULTI_INDICATED_RE = re.compile(r"Overall Percentage Rate Indicated For This Filing\s+(-?\d+(?:\.\d+)?)%")
_MULTI_IMPACT_RE    = re.compile(r"Overall Percentage Rate Impact For This Filing\s+(-?\d+(?:\.\d+)?)%")
_MULTI_PREMCHG_RE   = re.compile(r"Effect of Rate Filing[-\s]+Written Premium Change For This Program\s+\$\(?(-?[\d,]+)\)?")
_MULTI_PH_RE        = re.compile(r"Effect of Rate Filing\s*[-–]\s*Number of Policyholders Affected\s+([\d,]+)")

# Effective dates from Page 2 'Filing at a Glance'
_EFF_NEW_RE     = re.compile(r"Effective Date\s*\n?\s*(\d{1,2}/\d{1,2}/\d{2,4})\s*\n?\s*Requested\s*\(New\)", re.MULTILINE)
_EFF_RENEWAL_RE = re.compile(r"Effective Date\s*\n?\s*(\d{1,2}/\d{1,2}/\d{2,4})\s*\n?\s*Requested\s*\(Renewal\)", re.MULTILINE)
# The text shows them as: "Effective Date 01/02/2026\nRequested (New):" — line layout
_EFF_NEW_RE2     = re.compile(r"Effective Date\s+(\d{1,2}/\d{1,2}/\d{2,4})\s*\n\s*Requested\s*\(New\)")
_EFF_RENEWAL_RE2 = re.compile(r"Effective Date\s+(\d{1,2}/\d{1,2}/\d{2,4})\s*\n\s*Requested\s*\(Renewal\)")

_DISP_DATE_RE = re.compile(r"Disposition Date:\s*(\d{1,2}/\d{1,2}/\d{2,4})")
# anchor to end-of-line so an empty "Disposition Status:" on a pending filing
# doesn't eat a letter from a later line
_DISP_STATUS_RE = re.compile(r"Disposition Status:\s*([A-Z][A-Z\-]+)\s*$", re.MULTILINE)
_STATE_STATUS_RE = re.compile(r"State Status:\s*([A-Z][A-Z\- ]+?)\s*$", re.MULTILINE)

# SERFF filer-set flag: "Rate data applies to filing." or "Rate data does NOT apply to filing."
_RATE_DATA_APPLIES_RE = re.compile(r"Rate data\s+(does NOT apply|applies)\s+to filing\.", re.IGNORECASE)


def _normalize_money(s: str) -> str:
    """'-554,469' -> '-554469'.  '(554,469)' -> '-554469'."""
    s = s.replace(",", "").strip()
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    return s


def parse_filing_summary_pdf(pdf_path: Path, tracking_number: str = "") -> FilingSummary:
    fs = FilingSummary(tracking_number=tracking_number, company_rates=[])
    with pdfplumber.open(str(pdf_path)) as pdf:
        full_text_pages = [(pg.extract_text() or "") for pg in pdf.pages]
    full = "\n".join(full_text_pages)

    # disposition date / status. Fall back to State Status for pending filings.
    if m := _DISP_DATE_RE.search(full): fs.disposition_date = m.group(1)
    if m := _DISP_STATUS_RE.search(full):
        fs.disposition_status = m.group(1)
    elif m := _STATE_STATUS_RE.search(full):
        fs.disposition_status = m.group(1).strip()

    # rate-data-applies sentinel
    if m := _RATE_DATA_APPLIES_RE.search(full):
        fs.rate_data_applies = (m.group(1).lower() == "applies")

    # effective dates
    for r in (_EFF_NEW_RE, _EFF_NEW_RE2):
        if m := r.search(full): fs.effective_date_new = m.group(1); break
    for r in (_EFF_RENEWAL_RE, _EFF_RENEWAL_RE2):
        if m := r.search(full): fs.effective_date_renewal = m.group(1); break

    # multi-company overall
    if m := _MULTI_INDICATED_RE.search(full): fs.multi_company_overall_indicated = m.group(1) + "%"
    if m := _MULTI_IMPACT_RE.search(full):    fs.multi_company_overall_impact    = m.group(1) + "%"
    if m := _MULTI_PREMCHG_RE.search(full):   fs.multi_company_premium_change    = _normalize_money(m.group(1))
    if m := _MULTI_PH_RE.search(full):        fs.multi_company_policyholders     = int(m.group(1).replace(",", ""))

    # company-rate rows: scan only inside the Disposition + Rate Information sections
    # to avoid false matches in other parts of the doc.
    section_text = []
    capture = False
    for ln in full.splitlines():
        if re.search(r"\b(D\s*isposition|Company Rate Information)\b", ln):
            capture = True
        if re.search(r"^Schedule\s+Schedule Item", ln):  # end markers
            capture = False
        if re.search(r"^R\s*ate/Rule Schedule", ln):
            capture = False
        if capture:
            section_text.append(ln)
    target_block = "\n".join(section_text)

    # Iterate lines; when we find a numeric row, prepend any preceding non-numeric
    # name continuation, and append following non-numeric continuation lines.
    lines = target_block.splitlines()
    i = 0
    # Dedupe by data signature (page 7 Disposition + page 9 Company Rate Info repeat).
    seen_sigs: set[tuple] = set()
    _CONT_STOP = re.compile(r"(Overall|Schedule|Rate|Effective|Disposition|Status|Comment|"
                            r"PDF Pipeline|SERFF Tracking|Generated|Filing Method|Project Name|"
                            r"State:|TOI/Sub-TOI|Product Name|Company Rate Information)")
    while i < len(lines):
        ln = lines[i].strip()
        # Try patterns in priority order: A (full), B (blank-ind), C (sparse)
        m = _RATE_ROW_RE.match(ln)
        pattern = "A"
        if not m:
            m = _RATE_ROW_RE_B.match(ln); pattern = "B"
        if not m:
            m = _RATE_ROW_RE_C.match(ln); pattern = "C"
        if not m:
            i += 1; continue
        gd = m.groupdict()
        name_parts = [gd["name"].strip()]
        # collect continuation lines that follow (no % and no $ and not a known header)
        j = i + 1
        while j < len(lines):
            nxt = lines[j].strip()
            if not nxt or "%" in nxt or "$" in nxt or _CONT_STOP.search(nxt):
                break
            name_parts.append(nxt); j += 1
        full_name = " ".join(name_parts).strip()
        ind = gd.get("ind")  # None for pattern B
        imp = gd.get("imp")
        sig = (ind, imp, gd.get("prem_chg"), gd.get("ph"),
               gd.get("prem_for"), gd.get("maxp"), gd.get("minp"))
        if sig in seen_sigs:
            i = j; continue
        seen_sigs.add(sig)
        row = CompanyRateRow(
            company_name=full_name,
            overall_indicated_change=(ind + "%") if ind is not None else None,
            overall_rate_impact=(imp + "%") if imp is not None else None,
            written_premium_change=_normalize_money(gd["prem_chg"]) if gd.get("prem_chg") else None,
            policyholders_affected=int(gd["ph"].replace(",", "")) if gd.get("ph") else None,
            written_premium_for_program=_normalize_money(gd["prem_for"]) if gd.get("prem_for") else None,
            maximum_pct_change=(gd["maxp"] + "%") if gd.get("maxp") else None,
            minimum_pct_change=(gd["minp"] + "%") if gd.get("minp") else None,
        )
        fs.company_rates.append(row)
        i = j
    return fs


# ============================================================
# VALIDATION
# ============================================================
EXPECTED = {
    "State Farm Fire and Casualty Company": dict(
        ind="15.900%", imp="-2.100%", prem_chg="-554469", ph=20679,
        prem_for="26357498", maxp="388.400%", minp="-41.500%",
    ),
    "State Farm Mutual Automobile Insurance Company": dict(
        ind="-2.600%", imp="-9.700%", prem_chg="-25716996", ph=360274,
        prem_for="263832752", maxp="847.900%", minp="-52.200%",
    ),
}


def main():
    print("[1/3] Download system summary PDF for", TRACKING)
    pdf_path = download_system_summary_pdf(FILING_ID, TRACKING, DEST, STATE, COMPANY)
    if not pdf_path or not pdf_path.exists():
        print("  ! download failed"); sys.exit(1)
    print(f"  saved -> {pdf_path}  ({pdf_path.stat().st_size / 1024:.1f} KB)")

    print("\n[2/3] Parse filing summary PDF")
    fs = parse_filing_summary_pdf(pdf_path, TRACKING)
    print(f"  disposition: {fs.disposition_status} on {fs.disposition_date}")
    print(f"  rate_data_applies: {fs.rate_data_applies}")
    print(f"  effective:   new={fs.effective_date_new}  renewal={fs.effective_date_renewal}")
    print(f"  multi-co:    ind={fs.multi_company_overall_indicated}  "
          f"imp={fs.multi_company_overall_impact}  "
          f"prem_chg={fs.multi_company_premium_change}  ph={fs.multi_company_policyholders}")
    print(f"  company_rates: {len(fs.company_rates)}")
    for r in fs.company_rates:
        print(f"    {r.company_name}")
        print(f"      indicated={r.overall_indicated_change}  impact={r.overall_rate_impact}")
        print(f"      prem_chg={r.written_premium_change}  ph={r.policyholders_affected}")
        print(f"      prem_for={r.written_premium_for_program}  max={r.maximum_pct_change}  min={r.minimum_pct_change}")

    print("\n[3/3] Assert against AM Best ground truth")
    fail = []
    found_names = {r.company_name: r for r in fs.company_rates}
    for expected_name, exp in EXPECTED.items():
        if expected_name not in found_names:
            fail.append(f"  MISSING: {expected_name}"); continue
        r = found_names[expected_name]
        actual = dict(ind=r.overall_indicated_change, imp=r.overall_rate_impact,
                      prem_chg=r.written_premium_change, ph=r.policyholders_affected,
                      prem_for=r.written_premium_for_program,
                      maxp=r.maximum_pct_change, minp=r.minimum_pct_change)
        for k, ev in exp.items():
            if actual[k] != ev:
                fail.append(f"  MISMATCH {expected_name} | {k}: got={actual[k]!r} expected={ev!r}")
    if fail:
        print("  FAIL:")
        for f in fail: print(f)
        sys.exit(2)
    print("  ALL VALUES MATCH AM BEST GROUND TRUTH ✓")


if __name__ == "__main__":
    main()
