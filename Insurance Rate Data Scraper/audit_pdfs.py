"""Audit a directory of SERFF PDFs to categorize each filing as:
  RATE_CHANGE            — explicit rate-change % found
  PREMIUM_NEUTRAL        — "no rate impact"/"premium neutral" sentinel found
  RULE_ONLY              — rule/symbol/factor revision only; no % expected
  AMBIGUOUS              — none of the above; worth manual review

Accepts either:
  (a) a flat fixture dir where filenames are `{company}_{tracking_id}_{filename}.pdf`
      (default: tests/fixtures/pdfs/) — for parser fixture validation
  (b) a production dir laid out as `{state}/{tracking_id}/{filename}.pdf`
      — for auditing real scrapes

Usage:
  python audit_pdfs.py                               # fixtures
  python audit_pdfs.py --pdf-dir output/pdfs          # production
"""
import sys, re, argparse
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parent))
from src.utils import ZERO_RATE_CHANGE_SENTINELS, PDF_FIELD_PATTERNS
import pdfplumber


def extract_pdf_text_capped(path, max_pages=30):
    """Extract text from first N pages. Large manuals are skipped past page 30
    because memo summaries always appear upfront."""
    try:
        with pdfplumber.open(path) as pdf:
            total = len(pdf.pages)
            chunks = [p.extract_text() or "" for p in pdf.pages[:max_pages]]
        return "\n".join(chunks), total
    except Exception:
        return "", 0


def group_pdfs(pdf_dir: Path):
    """Return dict of (label, tracking_id) -> list[Path]."""
    groups = defaultdict(list)
    # Detect layout: any subdirs?
    subdirs = [p for p in pdf_dir.iterdir() if p.is_dir()]
    if subdirs:
        # Production layout: {state}/{tracking_id}/*.pdf
        for state_dir in subdirs:
            for tid_dir in state_dir.iterdir():
                if not tid_dir.is_dir():
                    continue
                for pdf in tid_dir.glob("*.pdf"):
                    groups[(state_dir.name, tid_dir.name)].append(pdf)
    else:
        # Flat fixture layout: {company}_{tracking_id}_{name}.pdf
        for p in sorted(pdf_dir.glob("*.pdf")):
            if p.stem.startswith("state_farm_"):
                rest = p.stem[len("state_farm_"):]
                tid = rest.split("_", 1)[0]
                key = ("state_farm", tid)
            else:
                parts = p.stem.split("_", 2)
                if len(parts) < 3:
                    continue
                key = (parts[0], parts[1])
            groups[key].append(p)
    return groups


RATE_PATTERNS = [
    (r"overall\s+rate\s+(?:level\s+)?(?:change|impact|effect|increase|decrease)\s+of\s+[\+\-]?\s*\d+\.?\d*\s*%", "explicit overall rate %"),
    (r"revision\s+of\s+[\+\-]?\s*\d+\.?\d*\s*%\s+to\s+(?:our|the)\s+premium", "premium revision %"),
    (r"rate\s+(?:change|increase|decrease|impact)\s+of\s+[\+\-]?\s*\d+\.?\d*\s*%", "rate change %"),
    (r"indicated\s+rate\s+(?:level\s+)?(?:change|increase)\s+of\s+[\+\-]?\s*\d+\.?\d*\s*%", "indicated rate %"),
    (r"requesting\s+(?:a\s+)?[\+\-]?\s*\d+\.?\d*\s*%\s+(?:overall\s+)?rate", "requesting rate %"),
    (r"average\s+rate\s+(?:change|increase|decrease)\s+of\s+[\+\-]?\s*\d+\.?\d*\s*%", "average rate %"),
    (r"proposed\s+rate\s+change\s+of\s+[\+\-]?\s*\d+\.?\d*\s*%", "proposed rate %"),
    (r"(?:premium|rate)\s+impact\s+of\s+[\+\-]?\s*\d+\.?\d*\s*%", "premium impact %"),
    (r"[\+\-]?\s*\d+\.?\d*\s*%\s+(?:overall\s+)?(?:rate|premium)\s+(?:change|increase|decrease|level|impact)", "%-first"),
]

RULE_ONLY_HINTS = [
    r"symbol\s+(?:set|table|listing)",
    r"factor\s+pages?",
    r"rule\s+(?:revision|update|filing)",
    r"CBIS\s+Rules?",
    r"manual\s+(?:revision|update|page)",
    r"form\s+(?:revision|update)",
]


def categorize_filing(pdfs, text_cache):
    evidence, rate_hits, zero_hits, rule_hits = [], [], [], []
    for pdf in pdfs:
        text = text_cache.get(pdf.name, "")
        if not text.strip():
            evidence.append(f"  {pdf.name}: [empty]")
            continue
        low = text.lower()
        for pat, label in RATE_PATTERNS:
            for m in re.finditer(pat, low, re.I):
                snip = text[max(0, m.start() - 40):m.end() + 40].replace("\n", " ").strip()
                rate_hits.append((pdf.name, label, snip))
        for pat in ZERO_RATE_CHANGE_SENTINELS:
            for m in re.finditer(pat, low, re.I):
                snip = text[max(0, m.start() - 30):m.end() + 30].replace("\n", " ").strip()
                zero_hits.append((pdf.name, snip))
        for pat in RULE_ONLY_HINTS:
            for m in re.finditer(pat, low, re.I):
                snip = text[max(0, m.start() - 20):m.end() + 20].replace("\n", " ").strip()
                rule_hits.append((pdf.name, snip))

    if rate_hits and not zero_hits:
        cat = "RATE_CHANGE"
    elif rate_hits and zero_hits:
        cat = "RATE_CHANGE_WITH_ZERO_LANG"
    elif zero_hits:
        cat = "PREMIUM_NEUTRAL"
    elif rule_hits:
        cat = "RULE_ONLY"
    else:
        cat = "AMBIGUOUS"

    seen = set()
    for name, label, snip in rate_hits[:12]:
        k = (name, label, snip[:60])
        if k in seen: continue
        seen.add(k)
        evidence.append(f"  [RATE:{label}] {name}: ...{snip[:180]}...")
    for name, snip in zero_hits[:6]:
        evidence.append(f"  [ZERO] {name}: ...{snip[:160]}...")
    if not rate_hits and not zero_hits and rule_hits:
        for name, snip in rule_hits[:3]:
            evidence.append(f"  [RULE] {name}: ...{snip[:120]}...")
    return cat, evidence


def run_parser_on_cached_text(text):
    """Apply PDF_FIELD_PATTERNS to already-extracted text (avoids re-opening PDFs)."""
    result = {}
    if not text.strip():
        return result
    for field, pat, parser in PDF_FIELD_PATTERNS:
        if field in result: continue
        m = re.search(pat, text, re.I)
        if m:
            try:
                result[field] = parser(m.group(1))
            except Exception:
                continue
    for pat in ZERO_RATE_CHANGE_SENTINELS:
        if re.search(pat, text, re.I):
            result.setdefault("overall_rate_effect", 0.0)
            break
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    default_fix = Path(__file__).resolve().parent / "tests" / "fixtures" / "pdfs"
    ap.add_argument("--pdf-dir", type=Path, default=default_fix,
                    help=f"Directory of PDFs (default: {default_fix})")
    ap.add_argument("--max-pages", type=int, default=30,
                    help="Cap text extraction to first N pages (default: 30)")
    args = ap.parse_args()

    if not args.pdf_dir.exists():
        print(f"ERROR: {args.pdf_dir} does not exist", file=sys.stderr)
        sys.exit(1)

    groups = group_pdfs(args.pdf_dir)
    total_pdfs = sum(len(v) for v in groups.values())
    print(f"Auditing {total_pdfs} PDFs across {len(groups)} filing(s) in {args.pdf_dir}")

    text_cache = {}
    for key, pdfs in sorted(groups.items()):
        for pdf in pdfs:
            t, total = extract_pdf_text_capped(pdf, max_pages=args.max_pages)
            text_cache[pdf.name] = t
            print(f"  {pdf.name}: {len(t)} chars ({total} pages; capped at {args.max_pages})", flush=True)

    parser_results = {name: run_parser_on_cached_text(t) for name, t in text_cache.items()}

    print("\n" + "=" * 100)
    summary = defaultdict(list)
    for key, pdfs in sorted(groups.items()):
        label, tid = key
        cat, evidence = categorize_filing(pdfs, text_cache)
        filing_fields = {}
        filing_overall = None
        for pdf in pdfs:
            pr = parser_results.get(pdf.name, {}) or {}
            for fk, fv in pr.items():
                filing_fields.setdefault(fk, fv)
            if filing_overall is None and pr.get("overall_rate_effect") is not None:
                filing_overall = pr["overall_rate_effect"]
        summary[cat].append((label, tid, len(pdfs), filing_overall, filing_fields))
        print(f"\n[{cat}] {label}/{tid}  ({len(pdfs)} PDFs)  parser_overall={filing_overall}  fields={filing_fields}")
        for line in evidence:
            try:
                print(line)
            except UnicodeEncodeError:
                print(line.encode("ascii", "replace").decode("ascii"))

    print("\n" + "=" * 100)
    print("FILING-LEVEL BREAKDOWN")
    print("=" * 100)
    for cat, items in sorted(summary.items()):
        print(f"\n{cat}: {len(items)} filing(s)")
        for label, tid, n, overall, _ in items:
            print(f"   - {label}/{tid}  ({n} PDFs)  parser_overall={overall}")

    print("\n" + "=" * 100)
    print("PDF-LEVEL BREAKDOWN (by parent filing category)")
    print("=" * 100)
    pdf_cat_count = defaultdict(int)
    for cat, items in summary.items():
        for _, _, n, _, _ in items:
            pdf_cat_count[cat] += n
    for cat, n in sorted(pdf_cat_count.items()):
        print(f"  {cat}: {n} PDFs")


if __name__ == "__main__":
    main()
