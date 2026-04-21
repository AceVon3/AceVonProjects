"""Probe text + table extraction for 3 new fields across 3 test filings.

Fields to extract:
  1. overall_indicated_change (%) — "Overall Indicated" / "indicated rate change" / ...
  2. overall_rate_impact (%)      — "Overall Rate Impact" / "overall rate change" / ...
  3. policyholders_affected (int) — "Policyholders Affected" / "policies affected" / ...

Try both approaches:
  A. Regex over normalized text (handles smushed-word PDFs)
  B. pdfplumber table extraction — look for column headers matching our targets

Output: prints per-PDF findings grouped by company label.
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

TEST_CASES = [
    ("CO", "134702926", "SFMA-134702926", "per-subsidiary candidate (SFM + SFFC)"),
    ("CO", "134650382", "GECC-134650382", "filing-level only candidate"),
    ("WA", "134538132", "ALSE-134538132", "tabular/exhibit candidate"),
]

# Skip if bigger than this many MB — we don't need massive rate manuals.
MAX_PDF_MB = 15


# ---------- text normalization + regex patterns ----------

def normalize(text: str) -> str:
    """Insert spaces at word boundaries that PDF extraction often smushes."""
    t = re.sub(r"([a-z])([A-Z])", r"\1 \2", text)
    t = re.sub(r"([a-zA-Z])(\d)", r"\1 \2", t)
    t = re.sub(r"(\d)([a-zA-Z])", r"\1 \2", t)
    t = re.sub(r"[ \t]+", " ", t)
    return t


# Percentages: signed or unsigned, with or without %
PCT = r"([+-]?\d+(?:\.\d+)?)\s*%"

INDICATED_PATTERNS = [
    re.compile(rf"overall\s*(?:%\s*)?indicated\s*(?:rate\s*)?(?:change|impact|level\s*change)[^.\n]{{0,80}}?{PCT}", re.IGNORECASE),
    re.compile(rf"indicated\s*rate\s*(?:level\s*)?change[^.\n]{{0,80}}?{PCT}", re.IGNORECASE),
    re.compile(rf"overall\s*rate\s*indication[^.\n]{{0,80}}?{PCT}", re.IGNORECASE),
    re.compile(rf"overall\s*indication[^.\n]{{0,80}}?{PCT}", re.IGNORECASE),
]

IMPACT_PATTERNS = [
    re.compile(rf"overall\s*(?:%\s*)?rate\s*impact[^.\n]{{0,80}}?{PCT}", re.IGNORECASE),
    re.compile(rf"overall\s*(?:proposed\s*)?rate\s*(?:level\s*)?(?:change|increase|decrease)[^.\n]{{0,80}}?{PCT}", re.IGNORECASE),
    re.compile(rf"statewide\s*(?:average|avg)[^.\n]{{0,80}}?{PCT}\s*(?:change|impact|increase|decrease)", re.IGNORECASE),
    re.compile(rf"proposed\s*(?:overall\s*)?rate\s*(?:level\s*)?change[^.\n]{{0,80}}?{PCT}", re.IGNORECASE),
]

POLICYHOLDERS_PATTERNS = [
    re.compile(r"policyholders?\s*affected[^.\n]{0,40}?([\d,]+)", re.IGNORECASE),
    re.compile(r"policies\s*affected[^.\n]{0,40}?([\d,]+)", re.IGNORECASE),
    re.compile(r"number\s*of\s*policyholders?[^.\n]{0,40}?([\d,]+)", re.IGNORECASE),
    re.compile(r"number\s*of\s*policies[^.\n]{0,40}?([\d,]+)", re.IGNORECASE),
    re.compile(r"([\d,]+)\s*policyholders?\s*(?:affected|impacted)", re.IGNORECASE),
    re.compile(r"([\d,]+)\s*policies\s*(?:affected|impacted|in\s*force)", re.IGNORECASE),
]

# Company-name anchor patterns — for per-subsidiary filings
COMPANY_HINTS = [
    "State Farm Mutual",
    "State Farm Fire",
    "State Farm Fire and Casualty",
    "Allstate Fire",
    "Allstate Indemnity",
    "Allstate Insurance",
    "Allstate Property",
    "Allstate Northbrook",
    "GEICO General",
    "GEICO Indemnity",
    "GEICO Casualty",
    "Government Employees",
    "Progressive Direct",
    "Progressive Northern",
    "Progressive Specialty",
    "Progressive Preferred",
    "Liberty Mutual",
    "Liberty Insurance",
    "LM General",
    "Travelers Home",
    "Travelers Indemnity",
    "Travelers Casualty",
    "Standard Fire",
]


def find_pct_matches(text: str, patterns: list[re.Pattern]) -> list[tuple[str, float, str]]:
    """Return list of (kind_tag, value, snippet) for each pattern match."""
    out = []
    for p in patterns:
        for m in p.finditer(text):
            try:
                val = float(m.group(1))
            except (ValueError, IndexError):
                continue
            start = max(0, m.start() - 60)
            end = min(len(text), m.end() + 60)
            snippet = text[start:end].replace("\n", " ")
            out.append((p.pattern[:40], val, snippet))
    return out


def find_int_matches(text: str, patterns: list[re.Pattern]) -> list[tuple[str, int, str]]:
    out = []
    for p in patterns:
        for m in p.finditer(text):
            raw = m.group(1).replace(",", "")
            try:
                val = int(raw)
            except ValueError:
                continue
            if val < 1 or val > 100_000_000:
                continue
            start = max(0, m.start() - 60)
            end = min(len(text), m.end() + 60)
            snippet = text[start:end].replace("\n", " ")
            out.append((p.pattern[:40], val, snippet))
    return out


# ---------- company-aware slicing ----------

def slice_by_company(text: str) -> list[tuple[str, str]]:
    """Split text around company-name mentions so we can associate values.

    Returns list of (company_or_header, text_block) where text_block is everything
    from that company mention until the next company mention.
    """
    hits: list[tuple[int, str]] = []
    for name in COMPANY_HINTS:
        for m in re.finditer(re.escape(name), text, re.IGNORECASE):
            hits.append((m.start(), name))
    hits.sort()
    if not hits:
        return [("(no company anchor)", text)]
    out = []
    for i, (pos, name) in enumerate(hits):
        nxt = hits[i + 1][0] if i + 1 < len(hits) else len(text)
        block = text[pos:nxt]
        out.append((name, block))
    return out


# ---------- table extraction ----------

TABLE_HEADER_KEYWORDS = [
    ("indicated", "overall_indicated_change"),
    ("rate impact", "overall_rate_impact"),
    ("rate change", "overall_rate_impact"),  # often the column is labeled this
    ("policyholders", "policyholders_affected"),
    ("policies", "policyholders_affected"),
    ("company", "company"),
    ("naic", "naic"),
]


def classify_header(h: str) -> str | None:
    if not h:
        return None
    low = h.lower().strip()
    # order matters — "indicated" before "rate change" to catch "overall indicated rate change"
    for kw, tag in TABLE_HEADER_KEYWORDS:
        if kw in low:
            return tag
    return None


def extract_tables_from_pdf(path: Path) -> list[dict]:
    """Return list of parsed-table dicts with company-aware rows."""
    out = []
    try:
        with pdfplumber.open(str(path)) as pdf:
            for page_idx, page in enumerate(pdf.pages):
                tables = page.extract_tables() or []
                for tbl_idx, table in enumerate(tables):
                    if not table or len(table) < 2:
                        continue
                    # Scan up to first 3 rows for headers
                    header_row = None
                    header_idx = -1
                    for hi in range(min(3, len(table))):
                        row = table[hi]
                        tags = [classify_header(c) for c in row]
                        if any(t in ("overall_indicated_change", "overall_rate_impact",
                                     "policyholders_affected") for t in tags):
                            header_row = row
                            header_idx = hi
                            break
                    if header_row is None:
                        continue
                    tags = [classify_header(c) for c in header_row]
                    for data_row in table[header_idx + 1:]:
                        if not any(c and str(c).strip() for c in data_row):
                            continue
                        row_data = {}
                        for col_idx, (cell, tag) in enumerate(zip(data_row, tags)):
                            if tag:
                                row_data[tag] = (cell.strip() if isinstance(cell, str) else cell)
                        # If company cell isn't tagged, capture first non-numeric as company name
                        if "company" not in row_data:
                            for cell in data_row:
                                if cell and isinstance(cell, str):
                                    s = cell.strip()
                                    if s and not re.match(r"^[\d.,+%\-\s]+$", s):
                                        row_data["company"] = s
                                        break
                        out.append({
                            "page": page_idx + 1,
                            "table_idx": tbl_idx,
                            "headers": header_row,
                            "row": row_data,
                        })
    except Exception as e:  # pragma: no cover
        print(f"    [table error] {path.name}: {e}")
    return out


# ---------- driver ----------

def process_pdf(pdf_path: Path) -> tuple[str, list, list, list, list]:
    """Returns (raw_text_preview, ind_matches, imp_matches, pol_matches, table_rows)."""
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            raw = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        print(f"    [text error] {pdf_path.name}: {e}")
        return "", [], [], [], []
    text = normalize(raw)
    ind = find_pct_matches(text, INDICATED_PATTERNS)
    imp = find_pct_matches(text, IMPACT_PATTERNS)
    pol = find_int_matches(text, POLICYHOLDERS_PATTERNS)
    tables = extract_tables_from_pdf(pdf_path)
    return text, ind, imp, pol, tables


def process_filing(state: str, fid: str, serff: str, description: str) -> None:
    pdf_dir = PDF_ROOT / state / fid
    print(f"\n{'=' * 78}")
    print(f"FILING: {serff}  ({state}/{fid})  — {description}")
    print(f"PDF dir: {pdf_dir}")
    print("=" * 78)

    pdfs = sorted(pdf_dir.glob("*.pdf"))
    for pdf_path in pdfs:
        mb = pdf_path.stat().st_size / 1024 / 1024
        if mb > MAX_PDF_MB:
            print(f"\n  [skip] {pdf_path.name}  ({mb:.1f} MB > {MAX_PDF_MB} MB)")
            continue
        print(f"\n--- {pdf_path.name}  ({mb:.1f} MB) ---")

        text, ind, imp, pol, tables = process_pdf(pdf_path)

        if not text:
            continue

        # Per-company slicing for text-level matches
        blocks = slice_by_company(text)
        company_names = sorted({name for name, _ in blocks if name != "(no company anchor)"})
        if company_names:
            print(f"  Company mentions: {company_names}")

        if ind:
            print(f"  INDICATED ({len(ind)}):")
            for tag, val, snip in ind[:4]:
                print(f"    {val:+7.2f}%  «...{snip[:150]}...»")
        if imp:
            print(f"  IMPACT ({len(imp)}):")
            for tag, val, snip in imp[:4]:
                print(f"    {val:+7.2f}%  «...{snip[:150]}...»")
        if pol:
            print(f"  POLICYHOLDERS ({len(pol)}):")
            for tag, val, snip in pol[:4]:
                print(f"    {val:>8,d}   «...{snip[:150]}...»")

        if tables:
            print(f"  TABLE ROWS ({len(tables)}):")
            for t in tables[:10]:
                row = t["row"]
                print(f"    p.{t['page']} t{t['table_idx']}: {row}")


def main() -> int:
    for state, fid, serff, desc in TEST_CASES:
        process_filing(state, fid, serff, desc)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
