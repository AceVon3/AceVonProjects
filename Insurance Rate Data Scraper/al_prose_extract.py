"""AL prose-extraction — recover overall rate-effect %s from filing-memo prose.

AL DOI does not mandate the SERFF rate-data dialog, so AL filing summaries
carry no Company Rate Information table (the 2026-07-27 thin-yield audit).
This tool extracts the overall % ONLY where the memo states it unambiguously,
via a high-precision pattern ladder derived from the full 91-PDF corpus
(output/al_prose_corpus.json). 58 of the 91 carry no % at all in the summary
(values live in non-public attachments) — those stay excluded, loudly.

Fidelity: %-only (no policyholders / premium / max / min — prose lacks them).
Rows are tagged external_validation='prose_extracted'. A future AM Best AL
pull is the intended corroborator.

REVIEW MODE (default): prints the extraction table, mutates nothing.
--apply: surgical-append to output/al_final_rates.xlsx (b19_apply doctrine:
  presence-checked per (serff, company), untouched rows byte-stable).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

import openpyxl  # noqa: E402

from run_final_rates import _read_pdf_text  # noqa: E402
from src.utils import parse_filing_summary_pdf  # noqa: E402

# Ordered pattern ladder — first match wins. Each entry: (name, regex).
# All require an explicit "overall/filing-level" framing; bare percentages
# never match (core-product rule: never guess).
LADDER = [
    # Allstate header: "RATE CHANGE (+8.6%)" / "Rate Change (-5.1%)" in
    # Company Tracking # or Project Name — filing-level by construction.
    ("allstate_header", re.compile(
        r"(?:Company Tracking #|Co Tr Num|Project Name/Number)[^\n]*?RATE CHANGE\s*\(([+-]?\d+\.?\d*)\s*%\)", re.I)),
    # "proposing an overall rate change of X%" / "overall rate impact of X%" /
    # "overall rate level change of X%" / "overall rate effect of/for ... X%"
    ("overall_prose", re.compile(
        r"overall(?:\s+(?:proposed|combined))?\s+rate\s+(?:change|impact|effect|level\s+change)\s*"
        r"(?:of|is|for this change is|will be)?\s*(?:targeted to be\s*)?([+-]?\d+\.?\d*)\s*%", re.I)),
    # Liberty/Safeco: "changes associated with this revision/rate decrease
    # have a +X% (average) rate impact"
    ("lbpm_revision", re.compile(
        r"associated with this (?:revision|rate (?:decrease|increase)|filing|change)\s+"
        r"(?:have|has)\s+an?\s*([+-]?\d+\.?\d*)\s*%\s*(?:average\s+)?rate impact", re.I)),
    # "There is a 0% rate impact associated with this filing."
    ("zero_impact", re.compile(
        r"There is a\s*([+-]?\d+\.?\d*)\s*%\s*rate impact associated with this filing", re.I)),
    # "producing a combined impact of X%" (multi-line-of-business memos)
    ("combined_impact", re.compile(
        r"producing a combined impact of\s*([+-]?\d+\.?\d*)\s*%", re.I)),
    # "The overall rate change is X%."
    ("overall_is", re.compile(
        r"The overall rate change is\s*([+-]?\d+\.?\d*)\s*%", re.I)),
    # USAA/Garrison: "revision to X premium rates with an overall effect of Y%"
    ("usaa_effect", re.compile(
        r"premium rates with an overall effect of\s*([+-]?\d+\.?\d*)\s*%", re.I)),
]

# Per-company mappings (emit one row per named company, exact values):
# State Farm: "rate level change of 7.9% ... in the State Farm Mutual
# Automobile Insurance Company and 2.9% ... State Farm Fire and Casualty"
PER_COMPANY = [
    ("sfma_two_company", re.compile(
        r"rate level change\s*of\s*([+-]?\d+\.?\d*)\s*%.{0,160}?in the\s+(State Farm [A-Za-z ]+? Company)"
        r"(?:.{0,120}?\band\s+([+-]?\d+\.?\d*)\s*%.{0,160}?\b(State\s+Farm\s+[A-Za-z ]+? Company))?", re.I | re.S)),
    # USAA list: "will be 0.0% for USAA, 0.0% for USAA-CIC, 0.0% for USAA-GIC,
    # and 0.0% for Garrison"
    ("usaa_list", re.compile(
        r"([+-]?\d+\.?\d*)\s*%\s*for\s+(USAA(?:-CIC|-GIC)?|Garrison)", re.I)),
]

USAA_ALIAS = {
    "USAA": "United Services Automobile Association",
    "USAA-CIC": "USAA Casualty Insurance Company",
    "USAA-GIC": "USAA General Indemnity Company",
    "Garrison": "Garrison Property and Casualty Insurance Company",
}


def extract(txt: str) -> tuple[str, list[tuple[str | None, float]]] | None:
    """Return (pattern_name, [(company_or_None, pct), ...]) or None."""
    for name, rx in PER_COMPANY:
        ms = rx.findall(txt)
        if name == "usaa_list" and len(ms) >= 2:
            seen = {}
            for pct, alias in ms:
                key = alias.strip()
                canon = USAA_ALIAS.get(key) or USAA_ALIAS.get(key.upper()) or USAA_ALIAS.get(key.title()) or key
                seen.setdefault(canon, float(pct))
            return name, [(c, p) for c, p in seen.items()]
        if name == "sfma_two_company" and ms:
            m = ms[0]
            rows = [(re.sub(r"\s+", " ", m[1]).strip(), float(m[0]))]
            if m[2] and m[3]:
                rows.append((re.sub(r"\s+", " ", m[3]).strip(), float(m[2])))
            return name, rows
    for name, rx in LADDER:
        vals = {v for v in rx.findall(txt)}
        if len(vals) == 1:                       # unambiguous: exactly one distinct value
            return name, [(None, float(next(iter(vals))))]
        if len(vals) > 1:
            return f"{name}_AMBIGUOUS({sorted(vals)})", []
    return None


def main() -> int:
    apply = "--apply" in sys.argv
    corpus = json.loads(Path("output/al_prose_corpus.json").read_text(encoding="utf-8"))
    wb = openpyxl.load_workbook("output/al_all_companies_search.xlsx", read_only=True)
    ws = wb["Filings"]
    it = ws.iter_rows(values_only=True)
    hdr = list(next(it))
    ti, fi, ci = hdr.index("serff_tracking_number"), hdr.index("filing_id"), hdr.index("company_name")
    sti = hdr.index("sub_type_of_insurance")
    meta = {str(r[ti]): r for r in it}

    extracted, ambiguous, none = [], [], []
    for o in corpus:
        tr = o["tracking"]
        p = Path(f"output/pdfs/AL/{o['fid']}/filing_summary.pdf")
        if not p.exists():
            continue
        txt = _read_pdf_text(p)
        fs = parse_filing_summary_pdf(p, tr, text=txt)
        eff = fs.effective_date_renewal or fs.effective_date_new
        res = extract(txt)
        m = meta.get(tr)
        sub = str(m[sti]) if m is not None else "?"
        filer = str(m[ci]) if m is not None else "?"
        if res is None:
            none.append(tr); continue
        pat, rows = res
        if not rows:
            ambiguous.append((tr, pat)); continue
        for co, pct in rows:
            extracted.append({"tracking": tr, "company": co or filer, "pct": pct,
                              "eff": str(eff or ""), "sub_type": sub, "pattern": pat})

    print(f"corpus: {len(corpus)} | extracted rows: {len(extracted)} "
          f"(from {len(set(e['tracking'] for e in extracted))} filings) | "
          f"ambiguous (skipped loudly): {len(ambiguous)} | no % present: {len(none)}")
    print(f"\n{'tracking':22} {'pct':>7} {'eff':10} {'pattern':18} company / sub_type")
    for e in sorted(extracted, key=lambda x: x["tracking"]):
        print(f"{e['tracking']:22} {e['pct']:>6.1f}% {e['eff'][:10]:10} {e['pattern'][:18]:18} "
              f"{e['company'][:38]} | {e['sub_type'][:34]}")
    for tr, pat in ambiguous:
        print(f"AMBIGUOUS: {tr} -> {pat}")
    if not apply:
        print("\n(review mode — nothing written; run with --apply to append)")
        Path("output/al_prose_extracted.json").write_text(
            json.dumps(extracted, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
