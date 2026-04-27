"""Sweep all cached system PDFs across states for silent parser failures.

A silent failure is a filing where:
  - parse_filing_summary_pdf returns rate_data_applies = True (filing
    is supposed to have rate-effect rows), AND
  - company_rates is empty (parser produced no rows).

For each gap, report tracking number, state, raw "Company Rate Information"
section text, and the most-recent disposition-status value extracted.
"""
from __future__ import annotations

from pathlib import Path
import sys

import pdfplumber

sys.stdout.reconfigure(encoding="utf-8")

from src.utils import parse_filing_summary_pdf

PDF_ROOT = Path("output/pdfs")
STATES = ("ID", "WA", "CO", "OR", "UT")


def extract_table_section(pdf_path: Path) -> str:
    with pdfplumber.open(str(pdf_path)) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)
    idx = text.find("Company Rate Information")
    if idx < 0:
        return ""
    end = text.find("Further information may be available", idx)
    return text[idx:end if end > 0 else idx + 1500]


def main() -> int:
    silent_failures: list[dict] = []
    total = 0
    for st in STATES:
        st_dir = PDF_ROOT / st
        if not st_dir.exists():
            continue
        pdfs = sorted(st_dir.glob("*/filing_summary.pdf"))
        print(f"[{st}] scanning {len(pdfs)} cached PDFs...", flush=True)
        for pdf in pdfs:
            total += 1
            try:
                fs = parse_filing_summary_pdf(pdf)
            except Exception as e:
                print(f"  [{pdf.parent.name}] parse error: {e}", flush=True)
                continue
            if fs.rate_data_applies and not fs.company_rates:
                section = extract_table_section(pdf)
                silent_failures.append({
                    "state": st,
                    "filing_id": pdf.parent.name,
                    "pdf": str(pdf),
                    "disposition_status": fs.disposition_status,
                    "effective_date_new": fs.effective_date_new,
                    "section": section,
                })

    print()
    print(f"Total cached PDFs scanned: {total}")
    print(f"Silent failures (rate_data_applies=True but 0 rows extracted): {len(silent_failures)}")
    print()
    by_state: dict[str, int] = {}
    for f in silent_failures:
        by_state[f["state"]] = by_state.get(f["state"], 0) + 1
    for st in STATES:
        print(f"  {st}: {by_state.get(st, 0)}")

    print()
    print("=" * 70)
    for f in silent_failures:
        print(f"\n--- {f['state']} / {f['filing_id']} ---")
        print(f"   disposition_status: {f['disposition_status']}")
        print(f"   effective_date_new: {f['effective_date_new']}")
        print(f"   PDF: {f['pdf']}")
        print(f"   --- Company Rate Information section ---")
        for line in f["section"].splitlines()[:20]:
            print(f"   | {line.rstrip()[:120]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
