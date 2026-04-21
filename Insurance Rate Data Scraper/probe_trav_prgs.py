"""Spot-check Travelers + Progressive for Form A presence."""
from __future__ import annotations
import re, sys
from pathlib import Path
import pdfplumber

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")
from src.config import OUTPUT_DIR

PDF_ROOT = OUTPUT_DIR / "pdfs"
TARGETS = [
    ("Travelers", "TRVD-G134416862", "WA", "134420360"),
    ("Progressive", "PRGS-134458809", "WA", "134458809"),
]
MARKERS = ["Form A", "FORM A", "PV Form", "Section 10", "Section 12",
           "POLICYHOLDERS", "RATE IMPACT", "RATE LEVEL", "RATE CHANGE",
           "policyholders affected", "policies affected", "policies in force",
           "Indicated", "indicated rate", "Overall rate", "statewide average"]

def normalize(t: str) -> str:
    t = re.sub(r"([a-z])([A-Z])", r"\1 \2", t)
    t = re.sub(r"([a-zA-Z])(\d)", r"\1 \2", t)
    t = re.sub(r"(\d)([a-zA-Z])", r"\1 \2", t)
    return re.sub(r"[ \t]+", " ", t)

def text_of(p: Path) -> str:
    try:
        with pdfplumber.open(str(p)) as pdf:
            return "\n".join(pg.extract_text() or "" for pg in pdf.pages)
    except Exception as e:
        return f"[error {e}]"

for label, serff, state, fid in TARGETS:
    print("=" * 78)
    print(f"{label}: {serff}  ({state}/{fid})")
    print("=" * 78)
    pdfs = sorted((PDF_ROOT / state / fid).glob("*.pdf"))
    print(f"PDFs ({len(pdfs)}):")
    for p in pdfs:
        mb = p.stat().st_size / 1024 / 1024
        print(f"  - {p.name}  ({mb:.2f} MB)")

    for p in pdfs:
        mb = p.stat().st_size / 1024 / 1024
        if mb > 3.5:
            print(f"\n--- SKIP {p.name} ({mb:.1f} MB > 3.5) ---")
            continue
        print(f"\n--- {p.name}  ({mb:.2f} MB) ---")
        full = normalize(text_of(p))
        if full.startswith("[error"):
            print(f"  {full}")
            continue
        # First page snippet
        try:
            with pdfplumber.open(str(p)) as pdf:
                fp = (pdf.pages[0].extract_text() or "")[:400] if pdf.pages else ""
            print(f"  FIRST PAGE: {fp[:400]}")
        except Exception:
            pass
        present = [m for m in MARKERS if re.search(re.escape(m), full, re.IGNORECASE)]
        print(f"  Markers present: {present}")
        # Look for any % values
        pcts = list(re.finditer(r"(?:^|\s)([+-]?\d+(?:\.\d+)?)\s*%", full))
        if pcts and present:
            print(f"  % values: {len(pcts)}  (showing 5)")
            for m in pcts[:5]:
                s = max(0, m.start() - 80); e = min(len(full), m.end() + 30)
                print(f"    {m.group(1):>7}%  «{full[s:e].replace(chr(10),' ')[:140]}»")
