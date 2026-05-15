"""One-shot restore of un-enriched rows that were dropped from {state}_final.xlsx
by an earlier (now-fixed) run of tools/enrich_new_brands.py.

For each state in {ID, OR, UT}: rows present in {state}_all_companies_search.xlsx
but absent from {state}_final.xlsx are appended back to the final xlsx with
their search-time fields populated. The pipeline's TOI-fallback (in
run_final_rates.py) handles these un-enriched rows downstream.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

from openpyxl import load_workbook

from src.config import OUTPUT_DIR
from src.output import write_excel
from tools.enrich_new_brands import _row_to_filing, _hydrate_filing_from_final_row, _load_xlsx_rows


STATES = ("ID", "OR", "UT")


def main() -> int:
    for state in STATES:
        s = state.lower()
        final_path = OUTPUT_DIR / f"{s}_final.xlsx"
        search_path = OUTPUT_DIR / f"{s}_all_companies_search.xlsx"

        existing_rows = _load_xlsx_rows(final_path, "Filings")
        existing = [_hydrate_filing_from_final_row(r) for r in existing_rows]
        existing_ids = {f.filing_id for f in existing}

        search_rows = _load_xlsx_rows(search_path, "Filings")
        restored = []
        for r in search_rows:
            fid = str(r.get("filing_id") or "")
            if not fid or fid in existing_ids:
                continue
            restored.append(_row_to_filing(r))

        combined = existing + restored
        write_excel(combined, final_path)
        print(f"[{state}] final={len(existing)} + restored={len(restored)} = {len(combined)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
