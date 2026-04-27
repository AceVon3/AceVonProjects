"""Extract AM Best UT PPA report text → flat file for cross-validation."""
import pdfplumber
from pathlib import Path

src = Path(r"c:/Users/ryanc/Downloads/Report (3).pdf")
out = Path("output/ambest_ut_ppa_text.txt")
out.parent.mkdir(exist_ok=True)

print(f"opening {src}", flush=True)
with pdfplumber.open(str(src)) as pdf:
    print(f"pages: {len(pdf.pages)}", flush=True)
    parts = []
    for i, p in enumerate(pdf.pages):
        if i % 10 == 0:
            print(f"  page {i+1}", flush=True)
        parts.append(p.extract_text() or "")
text = "\n".join(parts)

out.write_text(text, encoding="utf-8")
print(f"wrote {out} ({len(text):,} chars)", flush=True)
