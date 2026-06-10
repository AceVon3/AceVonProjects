"""Classify GA's 49 rate_data_applies=True / 0-rows filings:
(a) per-company table, all rate cells blank  -> correctly no rate rows
(b) multi-company filing-level layout, all zero/blank -> correctly none
(c) multi-company layout with NONZERO values -> PARSER GAP, real data loss
(d) anything else -> inspect
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf
from src.utils import parse_filing_summary_pdf

MULTI = "Rate Information for Multiple Company Filings"
NUM = re.compile(
    r"(Overall Percentage Rate Indicated For This Filing|"
    r"Overall Percentage Rate Impact For This Filing|"
    r"Effect of Rate Filing-?\s*Written Premium Change For This Program|"
    r"Effect of Rate Filing -? ?Number of Policyholders Affected)"
    r"\s*\$?(-?[\d,]+\.?\d*)%?")

targets, _ = rf.load_targets_search("GA")
cls = {"a_per_company_blank": [], "b_multi_zero": [], "c_multi_NONZERO": [], "d_other": []}
for t in targets:
    if not rf._is_rate_filing_type(t.filing_type_xlsx):
        continue
    pdf = Path(f"output/pdfs/GA/{t.filing_id}/filing_summary.pdf")
    if not pdf.exists() or pdf.stat().st_size < 5000:
        continue
    text = rf._read_pdf_text(pdf)
    ft_pdf, is_new = rf.detect_filing_type_and_new_product(pdf, text=text)
    if is_new:
        continue
    fs = parse_filing_summary_pdf(pdf, t.tracking, text=text)
    if not fs.rate_data_applies or fs.company_rates:
        continue
    if MULTI in text:
        vals = [(m.group(1)[:40], m.group(2)) for m in NUM.finditer(text)]
        nonzero = [v for _k, v in vals
                   if v.replace(",", "").replace(".", "").replace("-", "").strip("0") != ""]
        if nonzero:
            cls["c_multi_NONZERO"].append((t.tracking, vals))
        else:
            cls["b_multi_zero"].append(t.tracking)
    elif "Rate Information" in text:
        cls["a_per_company_blank"].append(t.tracking)
    else:
        cls["d_other"].append(t.tracking)

for k, v in cls.items():
    print(f"{k}: {len(v)}")
print()
for tk, vals in cls["c_multi_NONZERO"]:
    print(f"  NONZERO {tk}: {vals}")
for tk in cls["d_other"]:
    print(f"  OTHER {tk}")
