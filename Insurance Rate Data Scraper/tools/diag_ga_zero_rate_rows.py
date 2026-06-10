"""Dump the rate-data section of GA PDFs where company-row extraction got 0 rows."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf

AFFECTED = ["ALSE-134337637", "TRVD-G134889922", "GECC-134863850"]
targets, _ = rf.load_targets_search("GA")
by_tracking = {t.tracking: t for t in targets}
for tk in AFFECTED:
    t = by_tracking[tk]
    pdf = Path(f"output/pdfs/GA/{t.filing_id}/filing_summary.pdf")
    text = rf._read_pdf_text(pdf)
    # show from 'Rate Information' / 'Rate Data' heading onward
    low = text.lower()
    for marker in ("rate information", "company rate information", "rate data"):
        i = low.find(marker)
        if i >= 0:
            break
    print(f"=== {tk} (section from {marker!r}) ===")
    print(text[i:i + 1800])
    print()
