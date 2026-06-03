"""Enrich ONLY a state's back-fill search slice, reusing the tested
src.detail.enrich_filings orchestrator (same detail-page scraping + PDF
download path as run_{state}_full.py, grouped by (state, target_company)).

Reads  output/{state}_all_companies_search_backfill2024.xlsx  (the new
2023-07-01 -> 2024-06-30 slice produced by run_search.py --out-suffix)
Writes output/{state}_final_backfill2024.xlsx

Merge the result into output/{state}_final.xlsx with merge_backfill_final.py,
then re-emit with run_final_rates.py {state}.

Enriching only the slice (vs re-running run_{state}_full on the merged
workbook) avoids re-enriching the already-cached 2024-07+ filings. PDFs are
downloaded here for Rate/Rule filings; "Rate"-type and any-missing target PDFs
are backfilled by run_final_rates.download_all_pdfs at emit time (unchanged).

    python enrich_backfill.py MT
"""
from __future__ import annotations

import sys
import time
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook

sys.stdout.reconfigure(encoding="utf-8")

from src.config import OUTPUT_DIR
from src.detail import enrich_filings
from src.models import Filing
from src.output import write_excel
from src.search import _parse_date

SLICE_SUFFIX = "_backfill2024"


def _parse_any_date(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    s = str(v).strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s).date()
    except ValueError:
        return _parse_date(s)


def _load_filings(path: Path, default_state: str) -> list[Filing]:
    """Mirror of run_{state}_full.py::_load_filings (state-agnostic)."""
    wb = load_workbook(path, read_only=True)
    ws = wb["Filings"]
    rows = list(ws.iter_rows(values_only=True))
    header = list(rows[0])
    idx = {name: i for i, name in enumerate(header)}

    def g(r, col):
        i = idx.get(col)
        return r[i] if i is not None else None

    filings: list[Filing] = []
    for r in rows[1:]:
        naic_raw = g(r, "naic_codes") or ""
        naic = [c.strip() for c in str(naic_raw).split(";") if c.strip()]
        filings.append(
            Filing(
                state=g(r, "state") or default_state,
                serff_tracking_number=g(r, "serff_tracking_number") or "",
                filing_id=str(g(r, "filing_id") or ""),
                company_name=g(r, "company_name") or "",
                target_company=g(r, "target_company") or "",
                naic_codes=naic,
                product_name=g(r, "product_name"),
                type_of_insurance=g(r, "type_of_insurance"),
                sub_type_of_insurance=g(r, "sub_type_of_insurance"),
                filing_type=g(r, "filing_type"),
                filing_status=g(r, "filing_status"),
                submission_date=_parse_any_date(g(r, "submission_date")),
                detail_url=g(r, "detail_url"),
            )
        )
    wb.close()
    return filings


def main() -> int:
    if len(sys.argv) < 2:
        raise SystemExit("usage: python enrich_backfill.py <STATE>")
    state = sys.argv[1].upper()
    slug = state.lower()
    src = Path(OUTPUT_DIR) / f"{slug}_all_companies_search{SLICE_SUFFIX}.xlsx"
    out = Path(OUTPUT_DIR) / f"{slug}_final{SLICE_SUFFIX}.xlsx"
    if not src.exists():
        raise SystemExit(f"missing slice workbook: {src}")

    filings = _load_filings(src, state)
    rr = sum(1 for f in filings if f.filing_type == "Rate/Rule")
    print(f"[{state}] loaded {len(filings)} slice filings ({rr} Rate/Rule -> PDF download)", flush=True)

    t0 = time.time()
    enrich_filings(filings, download_pdfs=True)
    write_excel(filings, out)
    print(f"[{state}] wrote {out} ({len(filings)} filings) in {(time.time()-t0)/60:.1f} min", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
