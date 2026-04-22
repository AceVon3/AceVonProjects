"""Validate the summary-PDF flow on multiple carrier types.

Tests:
  - GEICO minimum filer (no Form A in any attached PDF)
  - Travelers (Form A filer)
  - Progressive (different filer template)

For each: download system PDF, parse, dump per-company rate rows.
Goal: confirm Disposition / Company Rate Information is populated for
all carrier types, including minimum filers.
"""
from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

from validate_summary_pdf import download_system_summary_pdf, parse_filing_summary_pdf

TARGETS = [
    # (state, filing_id, tracking_number, company_search_term, label)
    ("ID", "134794993", "GECC-134794993",  "geico",      "GEICO Motorcycle (minimum filer, new product)"),
    ("ID", "134679097", "TRVD-G134677302", "travelers",  "Travelers Commercial PPA"),
    ("ID", "134568989", "PERR-134561619",  "progressive","Progressive Direct Inland Marine"),
    ("ID", "134651294", "ALSE-134651294",  "allstate",   "Allstate NAIC Auto (Form A filer)"),
    ("ID", "134872376", "SFMA-134872376",  "state farm", "State Farm HO (pending)"),
]


def main():
    for state, filing_id, tracking, search, label in TARGETS:
        print("=" * 78)
        print(f"{label}  ({tracking}, filing_id={filing_id})")
        print("=" * 78)
        dest = Path("output/pdfs") / state / filing_id
        dest.mkdir(parents=True, exist_ok=True)
        # delete any previous filing_summary.pdf so we re-download fresh
        old = dest / "filing_summary.pdf"
        if old.exists(): old.unlink()
        pdf_path = download_system_summary_pdf(filing_id, tracking, dest, state, search)
        if not pdf_path:
            print("  ! download failed\n"); continue
        print(f"  pdf: {pdf_path.name}  ({pdf_path.stat().st_size / 1024:.1f} KB)")
        fs = parse_filing_summary_pdf(pdf_path, tracking)
        print(f"  disposition: {fs.disposition_status}  date={fs.disposition_date}  rate_data_applies={fs.rate_data_applies}")
        print(f"  effective:   new={fs.effective_date_new}  renewal={fs.effective_date_renewal}")
        print(f"  multi-co:    ind={fs.multi_company_overall_indicated}  imp={fs.multi_company_overall_impact}  "
              f"prem_chg={fs.multi_company_premium_change}  ph={fs.multi_company_policyholders}")
        print(f"  company_rates: {len(fs.company_rates)}")
        for r in fs.company_rates:
            print(f"    [{r.company_name}]")
            print(f"      indicated={r.overall_indicated_change}  impact={r.overall_rate_impact}")
            print(f"      prem_chg=${r.written_premium_change}  policyholders={r.policyholders_affected}")
            print(f"      prem_for=${r.written_premium_for_program}  max={r.maximum_pct_change}  min={r.minimum_pct_change}")
        if not fs.company_rates:
            print("  !! NO company-rate rows extracted — check PDF format")
        print()


if __name__ == "__main__":
    main()
