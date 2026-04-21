"""Diagnostic probes:
  1. GEICO format probe — GECC-134628136 (single-company target)
  2. Contamination check — SFMA-134393639 (only policyholders extracted)
  3. ALSE-134572006 sanity check — 0.0% AVPIC source
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

from src.config import OUTPUT_DIR

PDF_ROOT = OUTPUT_DIR / "pdfs"


def normalize(text: str) -> str:
    t = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    t = re.sub(r"([a-zA-Z])(\d)", r"\1 \2", t)
    t = re.sub(r"(\d)([a-zA-Z])", r"\1 \2", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t


def get_text(path: Path) -> str:
    try:
        with pdfplumber.open(str(path)) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    except Exception as e:
        return f"[error: {e}]"


def first_page(path: Path) -> str:
    try:
        with pdfplumber.open(str(path)) as pdf:
            if not pdf.pages:
                return "[empty]"
            return pdf.pages[0].extract_text() or "[no text]"
    except Exception as e:
        return f"[error: {e}]"


def probe_geico() -> None:
    print("=" * 78)
    print("PROBE 1: GEICO  GECC-134628136  (WA/134628136)")
    print("=" * 78)
    pdf_dir = PDF_ROOT / "WA" / "134628136"
    pdfs = sorted(pdf_dir.glob("*.pdf"))
    print(f"PDFs ({len(pdfs)}):")
    for p in pdfs:
        mb = p.stat().st_size / 1024 / 1024
        print(f"  - {p.name}  ({mb:.2f} MB)")

    for p in pdfs:
        mb = p.stat().st_size / 1024 / 1024
        print(f"\n--- {p.name}  ({mb:.2f} MB) ---")
        first = first_page(p)
        print("FIRST PAGE (truncated to 1500 chars):")
        print(first[:1500])

        # Check for Form A markers + section structure across full text
        full = normalize(get_text(p))
        markers = []
        for kw in ["Form A", "FORM A", "PV Form", "Section 10", "Section 12",
                  "POLICYHOLDERS", "RATE IMPACT", "RATE LEVEL", "RATE CHANGE",
                  "policyholders affected", "policies affected", "policies in force",
                  "Indicated", "indicated rate", "Overall rate", "statewide average",
                  "Number of policies", "Number of insured"]:
            if re.search(re.escape(kw), full, re.IGNORECASE):
                markers.append(kw)
        print(f"\nMarkers present: {markers}")

        # Look for any % values with context
        pcts = list(re.finditer(r"(?:^|\s)([+-]?\d+(?:\.\d+)?)\s*%", full))
        if pcts:
            print(f"\n% values found: {len(pcts)}  (showing first 10)")
            for m in pcts[:10]:
                s = max(0, m.start() - 80); e = min(len(full), m.end() + 40)
                snip = full[s:e].replace("\n", " ").strip()
                print(f"  {m.group(1):>7}%   «{snip[:160]}»")

        # Look for any policyholders / policies counts
        pols = list(re.finditer(r"([\d,]{3,})\s*(?:policyholders?|policies|insureds?|risks?)", full, re.IGNORECASE))
        if pols:
            print(f"\nPolicy counts: {len(pols)}  (showing first 5)")
            for m in pols[:5]:
                s = max(0, m.start() - 60); e = min(len(full), m.end() + 60)
                snip = full[s:e].replace("\n", " ").strip()
                print(f"  {m.group(1):>10}   «{snip[:160]}»")


def probe_contamination() -> None:
    print("\n" + "=" * 78)
    print("PROBE 2: CONTAMINATION CHECK  SFMA-134393639  (CO/134393639)")
    print("=" * 78)
    print("(Extracted policyholders=545,361 with no impact — investigating source)")
    pdf_dir = PDF_ROOT / "CO" / "134393639"
    pdfs = sorted(pdf_dir.glob("*.pdf"))
    print(f"PDFs ({len(pdfs)}):")
    for p in pdfs:
        mb = p.stat().st_size / 1024 / 1024
        print(f"  - {p.name}  ({mb:.2f} MB)")

    for p in pdfs:
        full = normalize(get_text(p))
        # Look for 545,361 specifically
        for m in re.finditer(r"545[,.]?361", full):
            s = max(0, m.start() - 200); e = min(len(full), m.end() + 200)
            print(f"\n[{p.name}] 545,361 context:")
            print(f"  «{full[s:e]}»")
        # Find Form A blocks: Section 1 (company) and Section 10 (policyholders)
        comp_matches = list(re.finditer(r"1\.\s*COMPANY\s*NAME[^:]*:\s*(.{3,120}?)(?:\r?\n|$)", full, re.IGNORECASE))
        pol_matches = list(re.finditer(r"10\.\s*NUMBER\s*OF\s*POLICYHOLDERS\s*AFFECTED[^:]*:\s*([\d,]+)", full, re.IGNORECASE))
        imp_matches = list(re.finditer(r"12\.\s*OVERALL\s*%\s*RATE\s*IMPACT\s*/\s*CHANGE[^:]*:\s*([+-]?\d+(?:\.\d+)?)\s*%", full, re.IGNORECASE))
        if comp_matches or pol_matches or imp_matches:
            print(f"\n[{p.name}] Form A blocks:")
            print(f"  Section 1 COMPANY hits: {len(comp_matches)}")
            for cm in comp_matches:
                print(f"    -> {cm.group(1).strip()[:80]}")
            print(f"  Section 10 POLICYHOLDERS hits: {len(pol_matches)}")
            for pm in pol_matches:
                print(f"    -> {pm.group(1)}")
            print(f"  Section 12 IMPACT hits: {len(imp_matches)}")
            for im in imp_matches:
                print(f"    -> {im.group(1)}%")


def probe_alse() -> None:
    print("\n" + "=" * 78)
    print("PROBE 3: ALSE-134572006  (WA/134572006)  AVPIC 0.0% sanity check")
    print("=" * 78)
    pdf_dir = PDF_ROOT / "WA" / "134572006"
    pdfs = sorted(pdf_dir.glob("*.pdf"))

    for p in pdfs:
        mb = p.stat().st_size / 1024 / 1024
        if mb > 3.5:
            print(f"\n--- SKIP {p.name} ({mb:.1f} MB) ---")
            continue
        print(f"\n--- {p.name}  ({mb:.2f} MB) ---")
        full = normalize(get_text(p))
        # Search for any 0.0% or 0% with full context
        for pat in [r"0\.0\s*%", r"\b0\s*%"]:
            for m in re.finditer(pat, full):
                s = max(0, m.start() - 200); e = min(len(full), m.end() + 80)
                snip = full[s:e].replace("\n", " ")
                print(f"  «{snip[:280]}»")
                print()


if __name__ == "__main__":
    probe_geico()
    probe_contamination()
    probe_alse()
