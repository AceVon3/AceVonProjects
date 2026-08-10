"""Offline unit tests for the B6 wrapped-name / silent-drop parser fix.

    python test_b6_parser_shapes.py     # 0 SERFF traffic; uses cached PDFs

Covers:
  1  comma-percent (the material bug): thousands-comma % values
     ("1,830.500%") now match, emitted comma-free; wrapped names fold.
  2  additive shapes H (blank-ph), I (blank-min), J (pct-only) extract the
     0%-impact rows the 18-state sweep surfaced.
  3  guard: every pre-B6 shape (A-G examples) parses byte-identically;
     amendment-format and all-blank-cell sections still emit 0 rows.
  4  real-PDF assertions: IL CFPC x2 (the material recoveries), AK CFPC x2
     (native parse == recover_ak_cfpc.py's adjudicated values), VT PRGS.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent))
from src.utils import parse_filing_summary_pdf

_failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    if cond:
        print(f"  PASS {label}")
    else:
        print(f"  FAIL {label}  {detail}")
        _failures.append(label)


def parse_text(body: str):
    """Run the parser over a synthetic filing-summary text."""
    text = (
        "Filing at a Glance\n"
        "Rate data applies\n"
        "Company Rate Information\n"
        "Overall % Overall % Written Premium Number of Policy Written Maximum % Minimum %\n"
        "Company Indicated Rate Change for Holders Affected Premium for Change Change\n"
        "Name: Change: Impact: this Program: for this Program: this Program: (where req'd): (where req'd):\n"
        + body + "\n"
        "Rate/Rule Schedule\n"
    )
    return parse_filing_summary_pdf(Path("nonexistent.pdf"), text=text)


def test_comma_percent_full_row():
    fs = parse_text(
        "COUNTRY Mutual 29.076% 13.421% $9,329,142 27,923 $69,510,807 1,830.500% -16.200%\n"
        "Insurance Company"
    )
    check("comma-pct: 1 row", len(fs.company_rates) == 1, f"got {len(fs.company_rates)}")
    if fs.company_rates:
        r = fs.company_rates[0]
        check("comma-pct: name folded", r.company_name == "COUNTRY Mutual Insurance Company", r.company_name)
        check("comma-pct: impact", r.overall_rate_impact == "13.421%", str(r.overall_rate_impact))
        check("comma-pct: max comma-free", r.maximum_pct_change == "1830.500%", str(r.maximum_pct_change))
        check("comma-pct: min", r.minimum_pct_change == "-16.200%", str(r.minimum_pct_change))
        check("comma-pct: ph", r.policyholders_affected == 27923, str(r.policyholders_affected))


def test_shape_h_blank_ph():
    fs = parse_text(
        "Progressive Direct 0.000% 0.000% $0 $0 0.000% 0.000%\n"
        "Insurance Company\n"
        "Progressive Northern 0.000% 0.000% $0 $0 0.000% 0.000%\n"
        "Insurance Company"
    )
    check("H: 2 rows", len(fs.company_rates) == 2, f"got {len(fs.company_rates)}")
    if len(fs.company_rates) == 2:
        r = fs.company_rates[0]
        check("H: name folded", r.company_name == "Progressive Direct Insurance Company", r.company_name)
        check("H: impact 0", r.overall_rate_impact == "0.000%", str(r.overall_rate_impact))
        check("H: ph is None", r.policyholders_affected is None, str(r.policyholders_affected))


def test_shape_i_blank_min():
    fs = parse_text(
        "Nationwide Mutual 0.000% 0.000% $0 4,868 $2,440,405 0.000% %\n"
        "Insurance Company"
    )
    check("I: 1 row", len(fs.company_rates) == 1, f"got {len(fs.company_rates)}")
    if fs.company_rates:
        r = fs.company_rates[0]
        check("I: name folded", r.company_name == "Nationwide Mutual Insurance Company", r.company_name)
        check("I: max", r.maximum_pct_change == "0.000%", str(r.maximum_pct_change))
        check("I: min is None", r.minimum_pct_change is None, str(r.minimum_pct_change))
        check("I: ph", r.policyholders_affected == 4868, str(r.policyholders_affected))


def test_shape_j_pct_only():
    fs = parse_text(
        "COUNTRY Mutual 0.000% 0.000% 0.000% 0.000%\n"
        "Insurance Company\n"
        "COUNTRY Casualty 0.000% 0.000% 0.000% 0.000%\n"
        "Insurance Company"
    )
    check("J: 2 rows", len(fs.company_rates) == 2, f"got {len(fs.company_rates)}")
    if len(fs.company_rates) == 2:
        r = fs.company_rates[0]
        check("J: name folded", r.company_name == "COUNTRY Mutual Insurance Company", r.company_name)
        check("J: no money cols", r.written_premium_for_program is None and r.policyholders_affected is None,
              f"{r.written_premium_for_program} {r.policyholders_affected}")


def test_shape_k_omitted_prem_chg():
    # Judgment-day sweep 2026-08-08: GA CFPC-134983942 — written-premium-CHANGE
    # column alone omitted (G's mirror).
    fs = parse_text(
        "COUNTRY Preferred 0.000% 0.000% 58,678 $107,129,061 0.000% 0.000%\n"
        "Insurance Company"
    )
    check("K: 1 row", len(fs.company_rates) == 1, f"got {len(fs.company_rates)}")
    if fs.company_rates:
        r = fs.company_rates[0]
        check("K: name folded", r.company_name == "COUNTRY Preferred Insurance Company", r.company_name)
        check("K: ph + prem_for captured, prem_chg None",
              r.policyholders_affected == 58678 and r.written_premium_for_program == "107129061"
              and r.written_premium_change is None,
              f"ph={r.policyholders_affected!r} prem_for={r.written_premium_for_program!r} prem_chg={r.written_premium_change!r}")


def test_existing_shapes_unchanged():
    # one canonical example per pre-B6 pattern (from the pattern comments) —
    # each must parse exactly as before the B6 edit.
    cases = {
        "A": ("GEICO Casualty Company 50.880% 50.880% $1,000 500 $2,000 60.000% -5.000%",
              dict(imp="50.880%", ind="50.880%", maxp="60.000%", minp="-5.000%", ph=500)),
        "B": ("Allstate Insurance Company % 3.000% $100 10 $200 4.000% -1.000%",
              dict(imp="3.000%", ind=None, maxp="4.000%", minp="-1.000%", ph=10)),
        "C": ("State Farm Mutual 5.000% 4.000% % %",
              dict(imp="4.000%", ind="5.000%", maxp=None, minp=None, ph=None)),
        "D": ("State Farm Fire % 2.000% $50 5 $100 % %",
              dict(imp="2.000%", ind=None, maxp=None, minp=None, ph=5)),
        "E": ("State Farm Mutual % 0.000% 7 $100 % %",
              dict(imp="0.000%", ind=None, maxp=None, minp=None, ph=7)),
        "F": ("State Farm Fire and 10.700% -6.900% $-1,719,175 14,939 $24,801,598 % %",
              dict(imp="-6.900%", ind="10.700%", maxp=None, minp=None, ph=14939)),
        "G": ("Encompass Indemnity 0.000% 0.000% $0 0 0.000% 0.000%",
              dict(imp="0.000%", ind="0.000%", maxp="0.000%", minp="0.000%", ph=0)),
    }
    for pat, (line, exp) in cases.items():
        fs = parse_text(line)
        ok = len(fs.company_rates) == 1
        check(f"pre-B6 {pat}: 1 row", ok, f"got {len(fs.company_rates)}")
        if ok:
            r = fs.company_rates[0]
            got = dict(imp=r.overall_rate_impact, ind=r.overall_indicated_change,
                       maxp=r.maximum_pct_change, minp=r.minimum_pct_change,
                       ph=r.policyholders_affected)
            exp_full = {k: (v if k == "ph" else v) for k, v in exp.items()}
            check(f"pre-B6 {pat}: fields", got == exp_full, f"{got} != {exp_full}")


def test_nonrows_still_zero():
    # amendment-format section (AK USAA-134752384 / MT GEICO shape): no row regex
    # may fire on Field-Name lines.
    fs = parse_text(
        "Company Name:GEICO Indemnity Company\n"
        "Field Name Requested Change Prior Value\n"
        "Overall % Rate Impact -0.020%\n"
        "Number of Policy Holders Affected for this41\n"
        "Program\n"
        "Maximum %Change (where required) 13.100%\n"
        "Minimum %Change (where required) -12.700%"
    )
    check("amendment shape: 0 rows", len(fs.company_rates) == 0, f"got {len(fs.company_rates)}")
    # all-blank-cells row (the 102-hit class): nothing extractable.
    fs = parse_text("Allstate Fire and Casualty % % $ % %")
    check("all-blank cells: 0 rows", len(fs.company_rates) == 0, f"got {len(fs.company_rates)}")
    # blank-impact with money cols (GA TRVD-G134360540): impact absent in source
    # -> stays unparsed (nothing to emit for the core product).
    fs = parse_text("Travelers Personal % % $0 155,331 $315,728,071 0.000% -4.800%\nInsurance Company")
    check("blank-impact row: 0 rows", len(fs.company_rates) == 0, f"got {len(fs.company_rates)}")


PDF_ROOT = Path("output/pdfs")

IL_EXPECT = {
    "133968582": {"COUNTRY Mutual Insurance Company": ("13.421%", "1830.500%", 27923),
                  "COUNTRY Preferred Insurance Company": ("12.686%", "1635.700%", 67595),
                  "COUNTRY Casualty Insurance Company": ("13.210%", "1392.100%", 2814)},
    "134419708": {"COUNTRY Mutual Insurance Company": ("-7.527%", "2281.100%", 91400),
                  "COUNTRY Preferred Insurance Company": ("-3.115%", "2083.300%", 239502),
                  "COUNTRY Casualty Insurance Company": ("-3.925%", "1285.400%", 3261)},
}
# adjudicated per-entity impacts from recover_ak_cfpc.py (the recovery this
# native parse must reproduce EXACTLY)
AK_EXPECT = {
    "134283900": {"COUNTRY Mutual Insurance Company": "9.618%",
                  "COUNTRY Preferred Insurance Company": "9.494%",
                  "COUNTRY Casualty Insurance Company": "10.177%"},
    "133947234": {"COUNTRY Mutual Insurance Company": "11.014%",
                  "COUNTRY Preferred Insurance Company": "9.105%",
                  "COUNTRY Casualty Insurance Company": "23.733%"},
}


def test_real_pdfs():
    for fid, exp in IL_EXPECT.items():
        pdf = PDF_ROOT / "IL" / fid / "filing_summary.pdf"
        fs = parse_filing_summary_pdf(pdf, tracking_number=f"CFPC-{fid}")
        got = {r.company_name: (r.overall_rate_impact, r.maximum_pct_change,
                                r.policyholders_affected) for r in fs.company_rates}
        check(f"IL CFPC-{fid}: 3 entities", len(got) == 3, f"got {sorted(got)}")
        check(f"IL CFPC-{fid}: values", got == exp, f"{got} != {exp}")
    for fid, exp in AK_EXPECT.items():
        pdf = PDF_ROOT / "AK" / fid / "filing_summary.pdf"
        fs = parse_filing_summary_pdf(pdf, tracking_number=f"CFPC-{fid}")
        got = {r.company_name: r.overall_rate_impact for r in fs.company_rates}
        check(f"AK CFPC-{fid}: native == recovery", got == exp, f"{got} != {exp}")
    pdf = PDF_ROOT / "VT" / "134029613" / "filing_summary.pdf"
    fs = parse_filing_summary_pdf(pdf, tracking_number="PRGS-134029613")
    got = {r.company_name: r.overall_rate_impact for r in fs.company_rates}
    check("VT PRGS-134029613: 2 rows 0%", got == {
        "Progressive Direct Insurance Company": "0.000%",
        "Progressive Northern Insurance Company": "0.000%"}, str(got))


if __name__ == "__main__":
    print("=== 1: comma-percent (material bug) ===")
    test_comma_percent_full_row()
    print("=== 2: additive shapes H/I/J/K ===")
    test_shape_h_blank_ph()
    test_shape_i_blank_min()
    test_shape_j_pct_only()
    test_shape_k_omitted_prem_chg()
    print("=== 3: pre-B6 shapes byte-identical + non-rows stay 0 ===")
    test_existing_shapes_unchanged()
    test_nonrows_still_zero()
    print("=== 4: real cached PDFs (IL/AK/VT) ===")
    test_real_pdfs()
    print(f"\n{'ALL PASS' if not _failures else 'FAILURES: ' + ', '.join(_failures)}")
    sys.exit(1 if _failures else 0)
