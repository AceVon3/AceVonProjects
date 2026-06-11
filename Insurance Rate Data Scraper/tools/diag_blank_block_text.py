"""Dump raw text of GA blocks that yield blank-subsidiary rows (USAA focus)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

import parse_ambest_ga as P

shown = 0
for idx, path in P.INPUT_TXTS:
    text = path.read_text(encoding="utf-8").replace("\xa0", " ")
    for b in P.split_filings(text):
        if P.classify_major(b) != "PPA":
            continue
        if "USAA" not in b and "United Services" not in b:
            continue
        meta = P.extract_rate_meta(b)
        if not meta:
            continue
        subs = P.extract_subsidiary_rates(b)
        if subs or "Disposition Page Data N/A" in b:
            continue
        shown += 1
        print(f"===== file {idx} blank-yield USAA PPA block (eff {meta['effective_date']}) =====")
        print(b[-2200:])
        print()
        if shown >= 2:
            sys.exit(0)
