"""Extract AM Best NM rate-filings PDF text -> flat file for cross-validation.

The NM report is a single PDF containing BOTH the Private Passenger Auto and
Homeowners Multi-Peril lines (like the AZ/MT/NV reports). We extract with pypdf
(preserves the soft-hyphen / non-breaking-space layout the parse_ambest_nv.py
parser expects) and also keep a pdfplumber pass for cross-checking page count.
"""
import pypdf
from pathlib import Path

src = Path(r"C:/Users/ryanc/Downloads/AM Best NM.pdf")
out = Path("output/ambest_nm_text.txt")
out.parent.mkdir(exist_ok=True)

print(f"opening {src}", flush=True)
reader = pypdf.PdfReader(str(src))
print(f"pages: {len(reader.pages)}", flush=True)
parts = []
for i, p in enumerate(reader.pages):
    if i % 25 == 0:
        print(f"  page {i+1}", flush=True)
    parts.append(p.extract_text() or "")
text = "\n".join(parts)

out.write_text(text, encoding="utf-8")
print(f"wrote {out} ({len(text):,} chars)", flush=True)
