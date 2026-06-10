"""What does NEW_PRODUCT_RE actually match in GA rate-filing PDFs?"""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf

targets, _ = rf.load_targets_search("GA")
match_spans = Counter()
shown = 0
checked = 0
for t in targets:
    if not rf._is_rate_filing_type(t.filing_type_xlsx):
        continue
    pdf = Path(f"output/pdfs/GA/{t.filing_id}/filing_summary.pdf")
    if not pdf.exists() or pdf.stat().st_size < 5000:
        continue
    text = rf._read_pdf_text(pdf)
    m = rf.NEW_PRODUCT_RE.search(text)
    checked += 1
    if m:
        # context: 60 chars either side, newlines flattened
        s, e = m.span()
        ctx = text[max(0, s - 60):e + 60].replace("\n", " | ")
        match_spans[m.group(0)[:80].replace("\n", " | ")] += 1
        if shown < 6:
            shown += 1
            print(f"{t.tracking}: ...{ctx}...")
print(f"\nchecked {checked} rate-filing PDFs")
print("\nmatched spans (top 10):")
for span, n in match_spans.most_common(10):
    print(f"  {n:4d}x  {span!r}")
