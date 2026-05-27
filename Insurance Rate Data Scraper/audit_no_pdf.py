"""Audit no_pdf cases for MT and NV — classify as out-of-scope or genuine loss.

For each filing that load_targets returns but final-rates excludes as
no_pdf (or `rate_data_applies=True but 0 rows extracted`), check:
  - PDF cached + parseable?
  - is_new_product (PDF text)?
  - rate_data_applies?
  - effective_date_new in window?
  - filing-vehicle subsidiary?

Anything that passes all checks AND has no emitted row in {state}_final_rates.xlsx
is a GENUINE LOSS candidate for fresh-context recovery.
"""
from __future__ import annotations
from pathlib import Path
from datetime import datetime
import openpyxl

from src.utils import parse_filing_summary_pdf
from run_final_rates import (
    detect_filing_type_and_new_product,
    load_targets,
    _in_effective_window,
    EXCLUDED_SUBSIDIARY_PATTERNS,
)


def audit_state(state: str):
    targets = load_targets(state)

    # Tracking numbers in final output
    final_path = Path(f"output/{state.lower()}_final_rates.xlsx")
    in_final = set()
    if final_path.exists():
        wb = openpyxl.load_workbook(final_path, read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if rows:
            hdr = list(rows[0])
            ix = {n: i for i, n in enumerate(hdr)}
            for r in rows[1:]:
                in_final.add(r[ix["serff_tracking_number"]])
        wb.close()

    # Find target filings NOT in final output — these are excluded somewhere
    missing = [t for t in targets if t.tracking not in in_final]

    buckets = {"no_pdf_or_small": [], "form_or_rule": [], "new_product": [],
               "rate_data_not_apply": [], "zero_rows_extracted": [],
               "out_of_window": [], "filing_vehicle_only": [], "GENUINE_LOSS": []}

    for t in missing:
        pdf = Path(f"output/pdfs/{state}/{t.filing_id}/filing_summary.pdf")
        if not pdf.exists() or pdf.stat().st_size < 5000:
            buckets["no_pdf_or_small"].append(t)
            continue
        try:
            ft, is_new = detect_filing_type_and_new_product(pdf)
        except Exception as e:
            buckets["no_pdf_or_small"].append(t)
            continue
        ft = ft or t.filing_type_xlsx
        if ft not in ("Rate", "Rate/Rule"):
            buckets["form_or_rule"].append(t)
            continue
        if is_new:
            buckets["new_product"].append(t)
            continue
        try:
            fs = parse_filing_summary_pdf(pdf, t.tracking)
        except Exception as e:
            buckets["no_pdf_or_small"].append(t)
            continue
        if not fs.rate_data_applies:
            buckets["rate_data_not_apply"].append(t)
            continue
        if not fs.company_rates:
            buckets["zero_rows_extracted"].append(t)
            continue
        eff = fs.effective_date_new or fs.effective_date_renewal
        if not _in_effective_window(eff):
            buckets["out_of_window"].append((t, eff))
            continue
        # Did all rows get excluded as filing_vehicle?
        non_excluded = [r for r in fs.company_rates
                        if not any(p in (r.company_name or "").lower() for p in EXCLUDED_SUBSIDIARY_PATTERNS)]
        if not non_excluded:
            buckets["filing_vehicle_only"].append(t)
            continue
        # All checks passed — this is a GENUINE LOSS
        buckets["GENUINE_LOSS"].append((t, eff, len(fs.company_rates), len(non_excluded)))

    print(f"\n=== {state}: {len(missing)} target filings missing from final-rates ===")
    for k, v in buckets.items():
        if v:
            print(f"  {len(v):3d}  {k}")
    if buckets["GENUINE_LOSS"]:
        print(f"\n  GENUINELY LOST in {state}:")
        for t, eff, total_rows, kept_rows in buckets["GENUINE_LOSS"]:
            print(f"    {t.tracking:24s} {t.company[:35]:35s} sub_toi={t.sub_toi[:30]:30s} eff={eff} rows={kept_rows}/{total_rows}")
    if buckets["zero_rows_extracted"]:
        print(f"\n  0-rows-extracted in {state}:")
        for t in buckets["zero_rows_extracted"]:
            print(f"    {t.tracking:24s} {t.company[:35]:35s} sub_toi={t.sub_toi[:30]}")
    return buckets


if __name__ == "__main__":
    for state in ("MT", "NV"):
        audit_state(state)
