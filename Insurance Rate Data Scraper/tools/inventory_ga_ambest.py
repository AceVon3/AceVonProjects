"""Inventory the 3 GA AM Best PDFs BEFORE any scraping.

Extracts each PDF to output/ambest_ga_text_{1,2,3}.txt (pypdf, reused later by
the GA parse step) and reports, per file and from the DATA (not the filename):
  - actual effective-date range + disposition-date range (chronological)
  - which line(s) present: PPA / HO
  - filing-block count + per-line block counts (raw, pre-dedup)
Then a coverage check across the 3 files: gap/overlap tiling of our window
[2024-01-01, 2026-04-17].
"""
from __future__ import annotations
import re, datetime
from pathlib import Path
import pypdf

FILES = [
    (1, Path(r"C:/Users/ryanc/Downloads/GA AM Best 1-1-24, 10-31-24.pdf")),
    (2, Path(r"C:/Users/ryanc/Downloads/GA AM Best 10-31-24, 6-30-35.pdf")),
    (3, Path(r"C:/Users/ryanc/Downloads/GA AM Best 6-30-35, Now.pdf")),
]
OUT = Path("output")

END = "Further information may be available for this filing"
PPA = re.compile(r"Private\s+Passenger\s+Auto", re.IGNORECASE)
HO  = re.compile(r"Homeowners\s+Multi[\-­‐‑‒–—]Peril", re.IGNORECASE)
RATE = re.compile(r"\d{1,5}\s+Rate\s+(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})")
APPROVED = re.compile(r"Approved ([A-Z]{2}) \d{2}/\d{2}/\d{2}")


def d(s):
    mm, dd, yy = s.split("/")
    return datetime.date(2000 + int(yy), int(mm), int(dd))


def extract(path: Path) -> str:
    r = pypdf.PdfReader(str(path))
    parts = []
    for p in r.pages:
        parts.append(p.extract_text() or "")
    return "\n".join(parts)


def analyze(idx: int, path: Path):
    txt_path = OUT / f"ambest_ga_text_{idx}.txt"
    print(f"\n[file {idx}] {path.name}", flush=True)
    print(f"  extracting -> {txt_path} ...", flush=True)
    text = extract(path).replace("\xa0", " ")
    txt_path.write_text(text, encoding="utf-8")
    print(f"  chars: {len(text):,}", flush=True)

    states = {}
    for m in APPROVED.finditer(text):
        states[m.group(1)] = states.get(m.group(1), 0) + 1
    print(f"  Approved-header states: {states}")

    rate = RATE.findall(text)
    effs = sorted(d(e) for e, _ in rate)
    disps = sorted(d(x) for _, x in rate)
    eff_lo, eff_hi = (effs[0], effs[-1]) if effs else (None, None)
    disp_lo, disp_hi = (disps[0], disps[-1]) if disps else (None, None)
    print(f"  rate lines: {len(rate)}")
    print(f"  EFFECTIVE range: {eff_lo} -> {eff_hi}")
    print(f"  DISPOSITION range: {disp_lo} -> {disp_hi}")

    blocks = [b for b in text.split(END) if "Approved" in b]
    ppa_blocks = sum(1 for b in blocks if PPA.search(b))
    ho_blocks = sum(1 for b in blocks if HO.search(b))
    other = len(blocks) - ppa_blocks - ho_blocks
    print(f"  filing blocks: {len(blocks)} (PPA={ppa_blocks}  HO={ho_blocks}  other/both={other})")
    print(f"  PPA present: {PPA.search(text) is not None}  |  HO present: {HO.search(text) is not None}")
    return {
        "idx": idx, "name": path.name, "eff_lo": eff_lo, "eff_hi": eff_hi,
        "disp_lo": disp_lo, "disp_hi": disp_hi, "blocks": len(blocks),
        "ppa": ppa_blocks, "ho": ho_blocks, "states": states,
    }


def main():
    OUT.mkdir(exist_ok=True)
    results = [analyze(i, p) for i, p in FILES]

    print("\n" + "=" * 70)
    print("COVERAGE CHECK — window [2024-01-01, 2026-04-17]")
    print("=" * 70)
    WIN_LO = datetime.date(2024, 1, 1)
    WIN_HI = datetime.date(2026, 4, 17)
    rs = sorted([r for r in results if r["eff_lo"]], key=lambda r: r["eff_lo"])
    for r in rs:
        print(f"  file {r['idx']}: EFF {r['eff_lo']} -> {r['eff_hi']}  (filename: {r['name']})")
    # gap/overlap between consecutive files by effective date
    print("\n  boundary analysis (effective date):")
    for a, b in zip(rs, rs[1:]):
        gap_days = (b["eff_lo"] - a["eff_hi"]).days
        if gap_days > 1:
            print(f"    !! GAP between file {a['idx']} (ends {a['eff_hi']}) and file {b['idx']} (starts {b['eff_lo']}): {gap_days-1} day(s) uncovered")
        elif gap_days <= 0:
            print(f"    overlap: file {a['idx']} ends {a['eff_hi']}, file {b['idx']} starts {b['eff_lo']} (overlap {1-gap_days} day(s) inclusive)")
        else:
            print(f"    contiguous: file {a['idx']} ends {a['eff_hi']}, file {b['idx']} starts {b['eff_lo']} (adjacent)")
    full_lo = min(r["eff_lo"] for r in rs)
    full_hi = max(r["eff_hi"] for r in rs)
    print(f"\n  combined EFF coverage: {full_lo} -> {full_hi}")
    print(f"  window need:           {WIN_LO} -> {WIN_HI}")
    print(f"  covers window low?  {full_lo <= WIN_LO}")
    print(f"  covers window high? {full_hi >= WIN_HI}")
    print(f"  any line missing anywhere? PPA total blocks={sum(r['ppa'] for r in results)}  HO total blocks={sum(r['ho'] for r in results)}")


if __name__ == "__main__":
    raise SystemExit(main())
