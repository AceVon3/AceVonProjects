"""Diagnose GA 0-rows: where did 308 'form_or_rule' exclusions come from?"""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf

t_search, _ = rf.load_targets_search("GA")
t_enriched = rf.load_targets_enriched("GA")

print("filing_type_xlsx — SEARCH loader:", dict(Counter(t.filing_type_xlsx for t in t_search)))
print("filing_type_xlsx — ENRICHED loader:", dict(Counter(t.filing_type_xlsx for t in t_enriched)))

# For ten filings whose xlsx type is a rate type, what does the PDF say?
shown = 0
ft_pdf_counter = Counter()
for t in t_search:
    pdf = Path(f"output/pdfs/GA/{t.filing_id}/filing_summary.pdf")
    if not pdf.exists() or pdf.stat().st_size < 5000:
        continue
    text = rf._read_pdf_text(pdf)
    ft_pdf, is_new = rf.detect_filing_type_and_new_product(pdf, text=text)
    ft_pdf_counter[ft_pdf] += 1
    if t.filing_type_xlsx in rf.RATE_FILING_TYPES and shown < 10:
        shown += 1
        head = " | ".join(text.splitlines()[:3])
        print(f"  {t.tracking}: xlsx={t.filing_type_xlsx!r} pdf_ft={ft_pdf!r} "
              f"resolved={(ft_pdf or t.filing_type_xlsx)!r}")
        if shown <= 3:
            print(f"    pdf text head: {head[:200]}")
print("\nft_pdf across all cached:", dict(ft_pdf_counter))
