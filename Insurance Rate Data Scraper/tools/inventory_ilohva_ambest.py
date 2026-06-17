"""Inventory + extract IL/OH/VA AM Best reports (read-only source -> output/text).

Extracts each PDF with pypdf (same pipeline as GA/western), writes
output/ambest_<state>_text_<n>.txt, and reports the ACTUAL state / lines /
effective-date range found INSIDE each file (don't trust filenames).
"""
from __future__ import annotations
import re
from pathlib import Path
from datetime import date
import pypdf

SRC = Path("Ambest Reports")
OUT = Path("output")
APPROVED = re.compile(r"Approved\s+([A-Z]{2})\s+(\d{2}/\d{2}/\d{2})")
PPA = re.compile(r"Private\s+Passenger\s+Auto", re.I)
HO = re.compile(r"Homeowners\s+Multi[\-­‐‑‒–—]Peril", re.I)
# GA/western rate line: "{pages} Rate {EFF} {DISP} {impact}% ..."
RATE = re.compile(r"\d{1,5}\s+Rate\s+(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})")
END = "Further information may be available for this filing"

# date-order file index per state, from the start date in the filename
FILES = {
    "IL": ["IL AM Best 1-1-24, 10-31-24.pdf", "IL AM Best 10-31-24, 10-31-25.pdf", "IL AM Best 10-31-25, 6-8-26.pdf"],
    "OH": ["OH AM Best 1-1-24, 12-31-24.pdf", "OH AM Best 1-1-25, 6-8-26.pdf"],
    "VA": ["VA AM Best 1-1-24, 12-31-24.pdf", "VA AM Best 12-31-24, 1-1-26.pdf", "VA AM Best 1-1-26, 6-8-26.pdf"],
}


def to_dt(s):
    mm, dd, yy = s.split("/")
    return date(2000 + int(yy), int(mm), int(dd))


for state, files in FILES.items():
    print("=" * 76)
    print(f"STATE {state}")
    print("=" * 76)
    for idx, fname in enumerate(files, 1):
        p = SRC / fname
        if not p.exists():
            print(f"  [file {idx}] MISSING: {fname}"); continue
        r = pypdf.PdfReader(str(p))
        text = "\n".join((pg.extract_text() or "") for pg in r.pages).replace("\xa0", " ")
        outp = OUT / f"ambest_{state.lower()}_text_{idx}.txt"
        outp.write_text(text, encoding="utf-8")
        # actual state(s) in Approved headers
        st_counts = {}
        for m in APPROVED.finditer(text):
            st_counts[m.group(1)] = st_counts.get(m.group(1), 0) + 1
        eff_dates = [to_dt(m.group(1)) for m in RATE.finditer(text)]
        eff_rng = (min(eff_dates), max(eff_dates)) if eff_dates else (None, None)
        print(f"  [file {idx}] {fname}")
        print(f"      pages={len(r.pages)} chars={len(text):,} -> {outp.name}")
        print(f"      Approved-header states: {st_counts}")
        print(f"      blocks(END marker): {text.count(END)} | PPA markers: {len(PPA.findall(text))} | HO markers: {len(HO.findall(text))}")
        print(f"      eff-date range (from Rate lines): {eff_rng[0]} -> {eff_rng[1]}  ({len(eff_dates)} rate lines)")
