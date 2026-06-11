"""Build {state}_final_rates.xlsx from cached/downloaded SERFF system PDFs.

Usage:
    python run_final_rates.py ID
    python run_final_rates.py WA
    python run_final_rates.py CO

B1 pipeline (standard since 2026-06-10, validated 0-cell-diff on NM/UT/ID —
see followup_B_enrichment_redundancy.md): reads the state's SEARCH-workbook
universe (union of output/{state}_all_companies_search.xlsx + side workbooks,
deduped by filing_id — see _search_universe_paths), filters to target-TOI
target-carrier filings, downloads each filing's system Filing Summary PDF
(cached), parses it via `utils.parse_filing_summary_pdf`, and emits one row
per per-company rate row in AM Best Disposition Page Data format. The
enrichment phase (run_{state}_full.py) is NO LONGER required: its only unique
contribution to the deliverable was submission_date for search-phase fetch
failures, now supplied by backfill_submission_dates.py (sidecar CSV) or, for
legacy states, the existing enriched workbook.

Non-rate filings (Form, Rule, new-product Rate/Rule) are excluded.
"""
from __future__ import annotations

import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

import openpyxl
import pdfplumber
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

from src.config import (
    AMBEST_VALIDATED_FROM,
    EFFECTIVE_DATE_FROM,
    EFFECTIVE_DATE_TO,
    HEADLESS,
    USER_AGENT,
)

_EFF_WINDOW_FROM = datetime.strptime(EFFECTIVE_DATE_FROM, "%m/%d/%Y").date()
_EFF_WINDOW_TO = datetime.strptime(EFFECTIVE_DATE_TO, "%m/%d/%Y").date()
_AMBEST_VALIDATED_FROM = datetime.strptime(AMBEST_VALIDATED_FROM, "%m/%d/%Y").date()


def _parse_pdf_eff_date(s):
    """Parse the PDF-extracted effective date string (MM/DD/YY or MM/DD/YYYY).
    Returns None on blank or unparseable input."""
    if not s:
        return None
    s = str(s).strip()
    if not s:
        return None
    for fmt in ("%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _in_effective_window(eff_str) -> bool:
    """Effective-date emit filter. Blank effective_date is KEPT (filer omission).
    Parseable dates outside [EFFECTIVE_DATE_FROM, EFFECTIVE_DATE_TO] are dropped."""
    d = _parse_pdf_eff_date(eff_str)
    if d is None:
        return True
    return _EFF_WINDOW_FROM <= d <= _EFF_WINDOW_TO


def _load_backfill_ids(state: str) -> set[str]:
    """filing_ids in the state's 2026-06-02 back-extension slice
    (output/{state}_all_companies_search_backfill2024.xlsx). Membership in this
    set is the robust provenance signal for "recovered by the back-extension"
    (equivalent to submitted before AMBEST_CROSSCHECK_SUBMISSION_FROM, but
    reliable even when the per-row submission date failed to scrape). Empty set
    if the slice workbook is absent (e.g. a state collected entirely fresh)."""
    src = Path(f"output/{state.lower()}_all_companies_search_backfill2024.xlsx")
    if not src.exists():
        return set()
    import openpyxl as _ox
    wb = _ox.load_workbook(src, read_only=True)
    ws = wb["Filings"]
    hdr = [c.value for c in next(ws.iter_rows(max_row=1))]
    fi = hdr.index("filing_id")
    ids = {str(r[fi]) for r in ws.iter_rows(min_row=2, values_only=True) if r[fi] is not None}
    wb.close()
    return ids


def _validation_tier(eff_str, is_backfill: bool) -> str:
    """Per-row validation provenance — three tiers (2026-06-02 refinement):

    "ambest_validated"        in the original cross-check dataset (NOT a
                              back-extension recovery) and effective_date in the
                              AM Best window (>= AMBEST_VALIDATED_FROM) or blank
                              (blank-effective rows were kept in the original
                              deliverable). The documented match rates apply.
    "ambest_window_unmatched" recovered by the back-extension (in the
                              2023-07-01 -> 2024-06-30 submission slice) with an
                              in-window effective_date — postdates the
                              cross-checks, never individually verified.
    "pipeline_only"           effective_date below the AM Best window (the 2024
                              back-extension), or a back-extension recovery with
                              a blank effective_date.

    Provenance is decided by SLICE MEMBERSHIP (`is_backfill`), not the per-row
    submission date, because the original finals include rows whose submission
    date failed to scrape (e.g. 5 in OR) and some back-extension TRVD rows have
    blank submission dates. Slice membership is exact either way. Consequence:
    filtering `validation_tier == "ambest_validated"` reproduces exactly the
    original cross-checked set (including its blank-effective rows)."""
    d = _parse_pdf_eff_date(eff_str)
    # eff below the window is decisively the 2024 back-extension.
    if d is not None and d < _AMBEST_VALIDATED_FROM:
        return "pipeline_only"
    # eff is in-window (>= 2025) or blank.
    if is_backfill:
        return "ambest_window_unmatched" if d is not None else "pipeline_only"
    return "ambest_validated"


# The ONLY filing with a documented, all-field AM Best Disposition Page Data
# match (SFMA-134676753, 14/14 — see verify_anchor + dataset_summary
# "Validation"). The per-state cross-checks elsewhere were AGGREGATE COVERAGE
# analyses (directional AM-Best->ours, largely date-relaxed, ID presence-only,
# CO none) and do NOT substantiate per-row validation. So this is the only row
# set that can honestly carry an external "validated" claim. (2026-06-04
# tier-honesty pass.)
_VALIDATED_ANCHORS = {"SFMA-134676753"}


def _relabel(provenance_tier: str, tracking: str) -> tuple[str, str, str, str]:
    """Emit-time BASE labels (provenance != validation). Returns
    (source, external_validation, match_strength, validation_tier).

    The four-tier external_validation is EARNED at ingestion: the emitter sets a
    base, then a cross-check + apply_validation_tiers.py step UPGRADES matched
    rows to "ambest_cross_checked" (+ match_strength) and DOWNGRADES eff>=2025
    rows in a non-cross-checked state (CO, ID non-anchor) to "pipeline_extracted".
    See CROSS_CHECK_STANDARD.md.

      source: "original" (pre-extension 468) | "extension" (2024 back-extension).
      external_validation base:
        "field_validated"  documented all-field per-row AM Best match (anchor).
        "pipeline_extracted_in_validated_window"  eff>=2025 (provisional).
        "pipeline_extracted"  eff<2025 / blank-effective back-extension.
      match_strength: "field" for the anchor, "" otherwise.
      validation_tier: coarse app-compat alias (ambest_validated for
        field_validated/ambest_cross_checked, else pipeline_only)."""
    if tracking in _VALIDATED_ANCHORS:
        source = "original" if provenance_tier == "ambest_validated" else "extension"
        return source, "field_validated", "field", "ambest_validated"
    if provenance_tier == "ambest_validated":           # eff>=2025, original set
        return "original", "pipeline_extracted_in_validated_window", "", "pipeline_only"
    if provenance_tier == "ambest_window_unmatched":    # eff>=2025, back-extension
        return "extension", "pipeline_extracted_in_validated_window", "", "pipeline_only"
    return "extension", "pipeline_extracted", "", "pipeline_only"  # eff<2025 / blank
import src.search as _serff_search
from src.detail import download_system_summary_pdf
from src.search import (
    _back_to_results,
    _click_row_to_detail,
    _set_rows_per_page_100,
    _submit_search,
)
from src.utils import parse_filing_summary_pdf

TARGET_TOI = ("19.0", "04.0")  # Personal Auto + Homeowners (Farmowners explicitly out of scope)
GROUP_SEARCH = {  # group -> list of SERFF search terms (each term = a separate SERFF query)
    # MGA Insurance Company is a State Farm subsidiary that files under its
    # own name on SERFF and is NOT returned by a "state farm" keyword search
    # (Item #3a, 2026-05-15).
    "State Farm":     ["state farm", "mga insurance"],
    "GEICO":          ["geico"],
    # Encompass files under its own brand on SERFF and is NOT returned by an
    # "allstate" keyword search; we search both names under the Allstate group.
    "Allstate":       ["allstate", "encompass"],
    "Travelers":      ["travelers"],
    # Safeco is Liberty Mutual's independent-agent brand and files under its
    # own name; it does NOT surface under a "liberty mutual" search.
    "Liberty Mutual": ["liberty mutual", "safeco"],
    "Progressive":    ["progressive"],
    # 13-brand expansion (2026-06-10, SCOPE.md). USAA needs three keywords —
    # the parent files as "United Services Automobile Association" and
    # Garrison carries neither string (GA portal check: three disjoint NAIC
    # buckets). Farmers' exchanges/Mid-Century likewise lack "farmers".
    "USAA":             ["usaa", "united services", "garrison"],
    "Farmers":          ["farmers", "mid-century", "fire insurance exchange", "truck insurance exchange"],
    "Nationwide":       ["nationwide"],
    "American Family":  ["american family"],
    "Country Financial": ["country"],
}
GROUP_KW = {  # subsidiary-name keywords used to assign a filing to its parent group
    "State Farm":     ["state farm", "mga insurance"],
    "GEICO":          ["geico"],
    "Allstate":       ["allstate", "encompass", "integon", "north american insurance"],
    "Travelers":      ["travelers", "standard fire"],
    "Liberty Mutual": ["liberty mutual", "safeco", "first national insurance company of america", "general insurance company of america", "american states"],
    "Progressive":    ["progressive"],
    # 13-brand expansion (2026-06-10, SCOPE.md). Anchors are tighter than the
    # search keywords where bare keywords risk stray matches (Farm-Bureau-
    # style names, Country-Wide); the bare forms remain at the END of each
    # list because the target_company label fallback for "Multiple"-company
    # filings carries the short label ("Farmers", "Country"). Known stray /
    # collision entities are suppressed per-row via
    # EXCLUDED_SUBSIDIARY_PATTERNS (esp. the Munich Re "American Family Home"
    # collision, NAIC 23450).
    "USAA":             ["usaa", "united services", "garrison"],
    "Farmers":          ["farmers insurance exchange", "fire insurance exchange",
                         "truck insurance exchange", "mid-century",
                         "farmers insurance company", "farmers casualty",
                         "farmers property and casualty", "farmers direct",
                         "farmers group property", "farmers"],
    "Nationwide":       ["nationwide"],
    "American Family":  ["american family"],
    "Country Financial": ["country mutual", "country preferred", "country casualty", "country"],
}
# Out-of-scope subsidiaries (do NOT classify as one of our groups):
#   - Esurance (Allstate, wound down 2020)
#   - Drive Insurance (Progressive, retired)
#   - United Financial (Progressive specialty)
# Identifies filings that launch a new product (vs. modifying an existing one).
# A bare "Introduction of" / "Initial Submission" / "Initial Filing" keyword can
# false-positive on body text describing rating-factor additions, deductible
# tweaks, or references to prior filings. This regex anchors those keywords to
# header fields (Project Name/Number, Company Tracking #) and requires body-text
# "introduction of" to be followed by a product-launch noun (Program, line of
# business). Standalone "New Program" / "new product" remain catch-alls because
# audit found no false-positives for those phrasings in our corpus.
NEW_PRODUCT_RE = re.compile(
    r"("
    r"Project Name/Number:[^\n]*\b(?:Initial Filing|Initial Submission|Introduction of)\b"
    r"|Company Tracking #:[^\n]*\bINTRODUCTION OF\b"
    # `\bNew Program\b` excludes the "Rate Transition Modification - New Program
    # Table" SERFF supporting-document boilerplate via negative lookahead
    # (Issue #3, 2026-05-26). Without the lookahead, 5 Travelers HO rate filings
    # in AZ were false-positively excluded as new-product launches.
    # GA (2026-06-10): GA filing summaries embed a DOI questionnaire with the
    # literal field "New Program (Type Yes or No): No" — the bare keyword
    # matched the QUESTION on 225/237 GA rate filings whose answer is "No"
    # (0-row deliverable). The "...: No" lookahead skips the answered-No
    # questionnaire; the explicit "...: Yes" alternative below trusts the
    # answered-Yes declaration outright.
    r"|New Program\s*\(Type Yes or No\)\s*:\s*Yes"
    r"|\bNew Program\b(?!\s+Table)(?!\s*\(Type Yes or No\)\s*:\s*No)"
    # `\bnew product\b` now requires introduction/rollout context within 40
    # chars (Issue #5, 2026-05-27 MT/WY/NV expansion). Without anchoring, the
    # bare \bnew product\b matched narrative/regulator-commentary references
    # like "discussing this new product with the Division" (NV ALSE-134362303,
    # a 47%-rate-change filing) and false-positively excluded 7 legitimate
    # rate filings across CO/AZ/MT/NV.
    r"|\b(?:introduc\w+|launch\w+)\b[\s\S]{0,40}\bnew product\b"
    r"|\bnew product\b[\s\S]{0,40}\b(?:will\s+be\s+(?:offered|available|launched|introduced)|to\s+new\s+business\s+only)\b"
    # The gap must not contain discount/rating-plan/factor terms: GA showed
    # "introduction of an IBHS Fortified Home Discount for its Homeowners line
    # of business" and "introduction of the Easy Pay Factor rating plan ...
    # Program" (2026-06-10) — those introduce a RATING ELEMENT to an existing
    # product (legitimate rate filings), not a product launch.
    r"|\bintroduction of\b(?:(?!\b(?:discount|rating\s+plan|factor)\b)[\s\S]){0,120}\b(?:Program|line of business|lines of business)\b"
    r")",
    re.IGNORECASE,
)
RATE_FILING_TYPES = {"Rate", "Rate/Rule"}


def _is_rate_filing_type(ft) -> bool:
    """State filing-type vocabularies differ: WA..NM use bare "Rate"/"Rate/Rule",
    but GA labels its rate filings "Rate/Rule PPA-Prior Approval", "Rate/Rule
    PPA- File and Use" and "Rate/Rule other than PPA" (found 2026-06-10 when the
    exact-membership check excluded ALL 247 GA rate filings as form_or_rule ->
    0-row deliverable). Exact "Rate" or a "Rate/Rule" prefix counts; nothing
    else ("Form", "Reporting", ...) does."""
    ft = (ft or "").strip()
    return ft == "Rate" or ft.startswith("Rate/Rule")
PDF_FILING_TYPE_RE = re.compile(r"Filing Type:\s*([A-Za-z/ \-]+)\s*$", re.MULTILINE)

# Per-company rate-table rows for these subsidiary names are dropped at emission
# time. They appear in customer-facing-brand filings (kept at filing level via
# parent classification) but are themselves filing vehicles or out-of-scope
# specialty acquisitions, not customer-facing brands. Match is case-insensitive
# substring against the per-company name.
EXCLUDED_SUBSIDIARY_PATTERNS = (
    "lm general insurance company",
    "lm insurance corporation",
    "standard fire insurance",
    "integon ",                  # Integon Indemnity / Integon National (Allstate-acquired specialty)
    "national general",
    "esurance",
    "drive insurance",
    "united financial",
    # Liberty Mutual-owned filing entity (Item #3b, 2026-05-15). No consumer
    # website, no own agent channel, AM Best rating consolidated under LM,
    # sold under Safeco's umbrella. Matches LM General / Standard Fire pattern.
    "american economy",
    # Peerless Insurance Company / Peerless Indemnity Insurance Company.
    # Liberty Mutual phased out the consumer-facing Peerless brand in 2013;
    # both entities now exist only as legal/filing vehicles within Liberty
    # Mutual Holding Company. No consumer website, no own agent channel, AM
    # Best rating consolidated under LM. Same filing-vehicle pattern as LM
    # General / American Economy (Thread 1, 2026-05-26).
    "peerless",
    # --- 13-brand expansion exclusions (2026-06-10, SCOPE.md) -------------
    # USAA: Noblr is a distinct telematics brand.
    "noblr",
    # Farmers: distinct sub-brands + legacy-MetLife vehicles.
    "foremost",
    "bristol west",
    "coast national",
    "toggle insurance",
    "economy fire",
    "economy premier",
    "economy preferred",
    # Nationwide: Allied brand retired ~2020 (Peerless precedent) + non-standard.
    "amco insurance",
    "allied property and casualty",
    "depositors insurance",
    "titan indemnity",
    "victoria fire",
    # American Family: distinct brands/vehicles, and the NAME COLLISION —
    # "American Family Home Insurance Company" (NAIC 23450) is Munich Re /
    # American Modern, NOT AmFam (verified 2026-06-10). The sibling "American
    # Modern *" entities ride the same filings' rate tables (caught by the
    # Phase 3 guardrail differ as 3 unclassified rows, 2026-06-10).
    "american family home",
    "american modern",
    "american family connect",
    "homesite",
    "midvale",
    "main street america",
    "permanent general",
    "general automobile",
)


def _is_excluded_subsidiary(name: str | None) -> bool:
    n = (name or "").lower()
    return any(p in n for p in EXCLUDED_SUBSIDIARY_PATTERNS)


def carrier_group(*names: Optional[str]) -> Optional[str]:
    """Match the first non-empty name against carrier-group keywords.
    Multi-company filings list company_name as 'Multiple' — pass target_company
    as a fallback so they're not dropped."""
    for name in names:
        n = (name or "").lower()
        if not n:
            continue
        for g, kws in GROUP_KW.items():
            if any(k in n for k in kws):
                return g
    return None


@dataclass
class Target:
    tracking: str
    filing_id: str
    company: str
    toi: str
    sub_toi: str
    filing_type_xlsx: str
    submission_date: object
    disposition_date: object
    disposition_status_xlsx: str
    group: str


def load_targets_enriched(state: str) -> list[Target]:
    """LEGACY loader (pre-B1): targets from the enriched {state}_final.xlsx.
    Kept as the reference path for validate_b1.py's A-vs-B diff; production
    now uses load_targets (search-universe)."""
    src = Path(f"output/{state.lower()}_final.xlsx")
    wb = openpyxl.load_workbook(src, read_only=True)
    ws = wb.active
    hdr = [c.value for c in next(ws.iter_rows(max_row=1))]
    ix = {h: i for i, h in enumerate(hdr)}
    out = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        toi = r[ix["type_of_insurance"]] or ""
        sub_toi = r[ix["sub_type_of_insurance"]] or ""
        # Fallback: parent TOI is populated by detail-page enrichment, but
        # when enrichment is skipped (row-not-found during a large search),
        # type_of_insurance can be blank while sub_type_of_insurance (captured
        # at search time) is still reliable. Derive parent TOI from the
        # sub-type prefix so target filings aren't silently dropped.
        if not toi and sub_toi:
            if sub_toi.startswith("19."):
                toi = "19.0 Personal Auto"
            elif sub_toi.startswith("04."):
                toi = "04.0 Homeowners"
        if not any(toi.startswith(p) for p in TARGET_TOI):
            grp = carrier_group(r[ix["company_name"]], r[ix["target_company"]])
            if grp and toi:
                tk = r[ix["serff_tracking_number"]] or ""
                print(f"  excluded — out of scope TOI: {tk} ({grp}, {toi})", flush=True)
            continue
        grp = carrier_group(r[ix["company_name"]], r[ix["target_company"]])
        if not grp:
            continue
        out.append(Target(
            tracking=r[ix["serff_tracking_number"]] or "",
            filing_id=str(r[ix["filing_id"]] or ""),
            company=r[ix["company_name"]] or "",
            toi=toi,
            sub_toi=r[ix["sub_type_of_insurance"]] or "",
            filing_type_xlsx=r[ix["filing_type"]] or "",
            submission_date=r[ix["submission_date"]],
            disposition_date=r[ix["disposition_date"]],
            disposition_status_xlsx=r[ix["disposition_status"]] or "",
            group=grp,
        ))
    return out


# ============================================================
# B1 loaders — search-workbook universe (standard since 2026-06-10)
# ============================================================

# Workbook-name patterns that are archives/inputs already folded into the
# universe, never universe members themselves.
_ARCHIVE_WORKBOOK_RE = re.compile(r"(prebackfill|pre_lookback|backfill2024|\.bak)")


def _search_universe_paths(state: str) -> list[Path]:
    """The search workbooks that together form the state's filing universe.

    States collected after MGA Insurance became a search keyword (Item #3a,
    2026-05-15 — e.g. NM, GA) carry all 9 keywords in the single all_companies
    sweep. Legacy states (UT, ID, ...) keep the MGA scrape in a side workbook
    that was merged into the enriched final but never folded back into
    all_companies — the 2026-06-09 B1 validation caught path B missing
    7 UT + 2 ID GNSC targets because of exactly this."""
    paths = [Path(f"output/{state.lower()}_all_companies_search.xlsx")]
    mga = Path(f"output/{state.lower()}_mga_insurance_search.xlsx")
    if mga.exists():
        paths.append(mga)
    return paths


def _workbook_filing_ids(path: Path) -> set[str]:
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb["Filings"] if "Filings" in wb.sheetnames else wb.active
    hdr = [c.value for c in next(ws.iter_rows(max_row=1))]
    fi = hdr.index("filing_id")
    out = {str(r[fi]) for r in ws.iter_rows(min_row=2, values_only=True) if r[fi] is not None}
    wb.close()
    return out


def verify_search_universe(state: str, universe_ids: set[str]) -> None:
    """HARD GATE: every non-archive {state}_*_search*.xlsx side workbook must be
    a subset of the universe. A side workbook with filing_ids the universe
    lacks means a legacy-style unmerged scrape exists and B1 would silently
    drop its rows — refuse to run until it is merged into all_companies (or
    added to _search_universe_paths) or renamed with an archive suffix.
    Audited clean across all 11 states on 2026-06-10
    (tools/audit_search_universe.py)."""
    universe_names = {p.name for p in _search_universe_paths(state)}
    problems = []
    for p in sorted(Path("output").glob(f"{state.lower()}_*_search*.xlsx")):
        if p.name in universe_names or _ARCHIVE_WORKBOOK_RE.search(p.name):
            continue
        extra = _workbook_filing_ids(p) - universe_ids
        if extra:
            problems.append(f"  {p.name}: {len(extra)} filing_id(s) not in universe, e.g. {sorted(extra)[:5]}")
    if problems:
        raise SystemExit(
            f"SEARCH-UNIVERSE VIOLATION for {state} — side workbook(s) contain filings "
            f"missing from the universe (would be silently dropped):\n" + "\n".join(problems)
        )


def _load_sidecar_dates(state: str) -> dict[str, object]:
    """submission_date backfill sidecar written by backfill_submission_dates.py
    ({filing_id: datetime.date}). Rows whose fetch failed (blank date) are
    skipped — the deliverable keeps a blank filing_date for those (precedented:
    OR ships 5 such rows; tiering uses slice membership, not dates)."""
    import csv
    p = Path(f"output/{state.lower()}_submission_date_backfill.csv")
    if not p.exists():
        return {}
    out: dict[str, object] = {}
    with open(p, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            d = (row.get("submission_date") or "").strip()
            if d:
                out[str(row["filing_id"])] = datetime.strptime(d, "%Y-%m-%d").date()
    return out


def _load_enriched_dates(state: str) -> dict[str, object]:
    """submission_date by filing_id from the legacy enriched workbook, if one
    exists (states collected before B1). New B1 states have none."""
    src = Path(f"output/{state.lower()}_final.xlsx")
    if not src.exists():
        return {}
    wb = openpyxl.load_workbook(src, read_only=True)
    ws = wb.active
    hdr = [c.value for c in next(ws.iter_rows(max_row=1))]
    ix = {h: i for i, h in enumerate(hdr)}
    out: dict[str, object] = {}
    for r in ws.iter_rows(min_row=2, values_only=True):
        fid = str(r[ix["filing_id"]] or "")
        if fid and r[ix["submission_date"]] not in (None, ""):
            out[fid] = r[ix["submission_date"]]
    wb.close()
    return out


def load_targets_search(state: str) -> tuple[list[Target], dict]:
    """B1 target loader: search-workbook universe + layered submission_date
    resolution (search value -> legacy enriched workbook -> mini-pass sidecar
    -> blank). Returns (targets, report)."""
    enriched_dates = _load_enriched_dates(state)
    sidecar_dates = _load_sidecar_dates(state)

    universe_rows: list[tuple] = []
    seen_fids: set[str] = set()
    hdr: list | None = None
    universe_files: list[tuple[str, int]] = []
    for src in _search_universe_paths(state):
        wb = openpyxl.load_workbook(src, read_only=True)
        ws = wb["Filings"] if "Filings" in wb.sheetnames else wb.active
        h = [c.value for c in next(ws.iter_rows(max_row=1))]
        if hdr is None:
            hdr = h
        elif h != hdr:
            raise SystemExit(f"header mismatch in {src}")
        n_new = 0
        fi = h.index("filing_id")
        for r in ws.iter_rows(min_row=2, values_only=True):
            fid = str(r[fi] or "")
            if fid and fid in seen_fids:
                continue
            seen_fids.add(fid)
            universe_rows.append(r)
            n_new += 1
        wb.close()
        universe_files.append((src.name, n_new))
    verify_search_universe(state, seen_fids)

    ix = {h: i for i, h in enumerate(hdr)}
    out: list[Target] = []
    search_blank: list[tuple[str, str, str]] = []  # (tracking, filing_id, group)
    filled_enriched: list[tuple[str, object]] = []
    filled_sidecar: list[tuple[str, object]] = []
    still_blank: list[str] = []
    for r in universe_rows:
        toi = r[ix["type_of_insurance"]] or ""
        sub_toi = r[ix["sub_type_of_insurance"]] or ""
        # Parent TOI is blank in search workbooks; derive from the sub-TOI
        # prefix (same rule the enriched path used as fallback).
        if not toi and sub_toi:
            if sub_toi.startswith("19."):
                toi = "19.0 Personal Auto"
            elif sub_toi.startswith("04."):
                toi = "04.0 Homeowners"
        if not any(toi.startswith(p) for p in TARGET_TOI):
            continue
        grp = carrier_group(r[ix["company_name"]], r[ix["target_company"]])
        if not grp:
            continue
        fid = str(r[ix["filing_id"]] or "")
        tracking = r[ix["serff_tracking_number"]] or ""
        sub_date = r[ix["submission_date"]]
        if sub_date in (None, ""):
            search_blank.append((tracking, fid, grp))
            if fid in enriched_dates:
                sub_date = enriched_dates[fid]
                filled_enriched.append((tracking, sub_date))
            elif fid in sidecar_dates:
                sub_date = sidecar_dates[fid]
                filled_sidecar.append((tracking, sub_date))
            else:
                still_blank.append(tracking)
        out.append(Target(
            tracking=tracking,
            filing_id=fid,
            company=r[ix["company_name"]] or "",
            toi=toi,
            sub_toi=sub_toi,
            filing_type_xlsx=r[ix["filing_type"]] or "",
            submission_date=sub_date,
            disposition_date=r[ix["disposition_date"]],
            disposition_status_xlsx=r[ix["disposition_status"]] or "",
            group=grp,
        ))
    report = {
        "universe_files": universe_files,
        "universe_size": len(universe_rows),
        "search_blank": search_blank,
        "filled_enriched": filled_enriched,
        "filled_sidecar": filled_sidecar,
        "still_blank": still_blank,
    }
    return out, report


def load_targets(state: str) -> list[Target]:
    """Standard (B1) entry point used by main()."""
    targets, rep = load_targets_search(state)
    for name, n in rep["universe_files"]:
        print(f"  search universe: {name} -> +{n} filings", flush=True)
    print(
        f"  submission_date: {len(rep['filled_enriched'])} from legacy enriched workbook, "
        f"{len(rep['filled_sidecar'])} from backfill sidecar, "
        f"{len(rep['still_blank'])} blank",
        flush=True,
    )
    if rep["still_blank"]:
        print(
            f"  blank submission_date targets (run backfill_submission_dates.py {state}): "
            f"{rep['still_blank']}",
            flush=True,
        )
    return targets


# Batched download mode (2026-06-10, Step 2 of the rest/batch/resume plan):
# one fresh "Begin Search" session per batch of DOWNLOAD_BATCH_SIZE uncached
# targets instead of one per target. Fresh-per-target was the deliberate fix
# for JSF results-page degradation (OR Travelers: 9/9 misses over a long
# reused session, all recovered under fresh contexts) — but the SERFF throttle
# rations fresh Begin-Search submissions (observed burst capacity 85 -> 14 ->
# ~12 across consecutive heavy days), so one-search-per-target makes
# final-rates cost ~1 burst-unit per filing and dominates every state's
# throttle bill. Batching cuts that ~batch_size-fold.
#
# Why this is miss-safe (not corruption-risky): download_system_summary_pdf
# clicks rows by stable filing_id (data-rk, pagination-aware) and the PDF is
# server-generated per filing — a degraded session can only FAIL TO FIND rows,
# never fetch the wrong filing's data. Misses fall through to the proven
# fresh-per-target FALLBACK pass below, and convergence re-runs retry whatever
# remains. Validate in vivo with validate_batch_download.py (Step 3) before a
# full batched state run.
DOWNLOAD_BATCH_SIZE = 8  # tune against JSF degradation; 1 = legacy fresh-per-target only
# End a batch session early after this many consecutive misses — the OR
# degradation signature is misses starting partway through a session. The
# batch's unattempted targets go back to the remaining pool (fallback /
# convergence), so aborting early costs nothing but a fresh search.
BATCH_ABORT_CONSECUTIVE_MISSES = 2


def download_all_pdfs(state: str, targets: list[Target], *,
                      batch_size: int = DOWNLOAD_BATCH_SIZE) -> dict[str, str]:
    """Download system PDF for every target. Returns {filing_id: download_status}.
    Primary path: batched (batch_size downloads per fresh search session).
    Stragglers then get the legacy fresh-search-per-target fallback."""
    # Failure-signature capture for every fresh search this run makes
    # (ledger row per search + snapshot on failure — see src/search.DIAG_DIR).
    _serff_search.DIAG_DIR = Path("output/serff_diagnostics")
    by_group: dict[str, list[Target]] = {}
    for t in targets:
        by_group.setdefault(t.group, []).append(t)
    statuses: dict[str, str] = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=True)
        page = ctx.new_page()

        def _refresh_context():
            nonlocal ctx, page
            try:
                ctx.close()
            except Exception:
                pass
            ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=True)
            page = ctx.new_page()

        def _submit_with_retry(st: str, term: str) -> bool:
            for attempt in range(3):
                try:
                    if _submit_search(page, st, term):
                        return True
                except Exception as e:
                    print(f"    [retry {attempt+1}/3] submit_search {term!r}: {e}", flush=True)
                _refresh_context()
            return False

        def _run_batch(term: str, batch: list[Target]) -> list[Target]:
            """One fresh search session, then sequential downloads for the
            whole batch. Returns the targets still missing (misses + any
            unattempted after an early abort)."""
            _refresh_context()
            if not _submit_with_retry(state, term):
                return list(batch)
            _set_rows_per_page_100(page)
            misses: list[Target] = []
            consecutive = 0
            for j, t in enumerate(batch, 1):
                dest_dir = Path(f"output/pdfs/{state}/{t.filing_id}")
                try:
                    pdf = download_system_summary_pdf(page, t.filing_id, t.tracking, dest_dir)
                except Exception as e:
                    print(f"    [batch {j}/{len(batch)}] {t.tracking}: error {type(e).__name__} -> miss", flush=True)
                    pdf = None
                if pdf:
                    statuses[t.filing_id] = "ok"
                    consecutive = 0
                    print(f"    [batch {j}/{len(batch)}] {t.tracking}: ok", flush=True)
                else:
                    misses.append(t)
                    consecutive += 1
                    print(f"    [batch {j}/{len(batch)}] {t.tracking}: miss", flush=True)
                    if consecutive >= BATCH_ABORT_CONSECUTIVE_MISSES and j < len(batch):
                        rest = batch[j:]
                        print(f"    [batch] {consecutive} consecutive misses — ending session early "
                              f"({len(rest)} unattempted -> retried later)", flush=True)
                        misses.extend(rest)
                        break
            return misses

        for grp, items in by_group.items():
            uncached = []
            for t in items:
                pdf = Path(f"output/pdfs/{state}/{t.filing_id}/filing_summary.pdf")
                if pdf.exists() and pdf.stat().st_size > 5000:
                    statuses[t.filing_id] = "cached"
                else:
                    uncached.append(t)
            if not uncached:
                print(f"[{grp}] all {len(items)} cached", flush=True); continue
            search_terms = GROUP_SEARCH[grp]
            print(f"[{grp}] searches={search_terms!r}, downloading {len(uncached)}/{len(items)}", flush=True)
            remaining = list(uncached)

            # --- primary path: batched sessions per search term ---
            if batch_size > 1:
                for search_term in search_terms:
                    if not remaining:
                        break
                    print(f"  [{grp}] BATCH search={search_term!r}, "
                          f"{len(remaining)} filing(s) in chunks of {batch_size}", flush=True)
                    still_remaining: list[Target] = []
                    for i in range(0, len(remaining), batch_size):
                        still_remaining.extend(_run_batch(search_term, remaining[i:i + batch_size]))
                    remaining = still_remaining

            # --- fallback: proven fresh context + fresh search PER target ---
            # Reusing one context across many navigate->download->go_back
            # cycles degrades the JSF results page so later-page rows become
            # unfindable — batch-loop state contamination, observed as 9/9 OR
            # Travelers misses that ALL recovered under fresh contexts.
            # download_system_summary_pdf paginates to the row by its stable
            # data-rk via _click_row_to_detail. Only batch misses reach here.
            for search_term in search_terms:
                if not remaining:
                    break
                print(f"  [{grp}] FALLBACK search={search_term!r}, attempting {len(remaining)} filing(s)", flush=True)
                still_remaining = []
                for idx, t in enumerate(remaining, 1):
                    _refresh_context()
                    if not _submit_with_retry(state, search_term):
                        still_remaining.append(t)
                        continue
                    _set_rows_per_page_100(page)
                    dest_dir = Path(f"output/pdfs/{state}/{t.filing_id}")
                    try:
                        pdf = download_system_summary_pdf(page, t.filing_id, t.tracking, dest_dir)
                    except Exception as e:
                        print(f"    [{idx}/{len(remaining)}] {t.tracking}: error {type(e).__name__} -> miss", flush=True)
                        pdf = None
                    if pdf:
                        statuses[t.filing_id] = "ok"
                        print(f"    [{idx}/{len(remaining)}] {t.tracking}: ok", flush=True)
                    else:
                        still_remaining.append(t)
                remaining = still_remaining
            for t in remaining:
                statuses[t.filing_id] = "fail:row_not_found"
                print(f"  {t.tracking}: not found in any of {search_terms!r}", flush=True)
        browser.close()
    return statuses


def _read_pdf_text(pdf_path: Path) -> str:
    """Extract full text from a PDF once (pdfplumber, all pages)."""
    with pdfplumber.open(str(pdf_path)) as pdf:
        return "\n".join((pg.extract_text() or "") for pg in pdf.pages)


def detect_filing_type_and_new_product(pdf_path: Path, text: str | None = None) -> tuple[Optional[str], bool]:
    """Return (filing_type, is_new_product) from the PDF text. `text`: optional
    pre-extracted full text so the caller can read the PDF once and share it with
    parse_filing_summary_pdf (audit decision C, 2026-06-08); when None the PDF is
    opened here (back-compat for other callers, e.g. audit_no_pdf.py)."""
    if text is None:
        text = _read_pdf_text(pdf_path)
    ft = None
    if m := PDF_FILING_TYPE_RE.search(text):
        ft = m.group(1).strip()
    return ft, bool(NEW_PRODUCT_RE.search(text))


# AM Best Disposition Page Data column order (per user spec)
COLUMNS = [
    "state",
    "effective_date",
    "company_name",
    "line_of_business",
    "sub_type_of_insurance",
    "overall_indicated_change",
    "overall_rate_impact",
    "written_premium_change",
    "policyholders_affected",
    "written_premium_for_program",
    "maximum_percent_change",
    "minimum_percent_change",
    "rate_activity",
    "serff_tracking_number",
    "disposition_status",
    "filing_date",
    "source_pdf",
    # Appended after the 17 AM Best Disposition Page Data columns so their
    # column order is preserved. validation_tier is now RE-DERIVED from
    # external_validation (2026-06-04 tier-honesty pass); source +
    # external_validation separate provenance from external validation.
    "validation_tier",
    "source",
    "external_validation",
    "match_strength",
]


def build_rows(state: str, targets: list[Target], backfill_ids: set[str] | None = None) -> tuple[list[dict], dict]:
    """Parse each cached PDF and emit one row per per-company rate row.
    `backfill_ids` = filing_ids recovered by the 2026-06-02 back-extension
    (drives validation_tier). Returns (rows, stats)."""
    backfill_ids = backfill_ids or set()
    rows: list[dict] = []
    stats = {
        "filings_total": len(targets),
        "filings_excluded_form_or_rule": 0,
        "filings_excluded_new_product": 0,
        "filings_excluded_no_pdf": 0,
        "filings_excluded_rate_data_does_not_apply": 0,
        "filings_excluded_out_of_effective_window": 0,
        "filings_emitted": 0,
        "rows_emitted": 0,
        "anchor_match_count": 0,
    }
    for t in targets:
        pdf = Path(f"output/pdfs/{state}/{t.filing_id}/filing_summary.pdf")
        if not pdf.exists() or pdf.stat().st_size < 5000:
            stats["filings_excluded_no_pdf"] += 1; continue
        # Read the PDF text ONCE and share it with both consumers (audit decision
        # C, 2026-06-08) — previously detect_* and parse_* each opened + extracted
        # the full PDF independently (two reads per filing per pass).
        pdf_text = _read_pdf_text(pdf)
        ft_pdf, is_new = detect_filing_type_and_new_product(pdf, text=pdf_text)
        ft = ft_pdf or t.filing_type_xlsx
        if not _is_rate_filing_type(ft):
            stats["filings_excluded_form_or_rule"] += 1; continue
        if is_new:
            stats["filings_excluded_new_product"] += 1; continue
        fs = parse_filing_summary_pdf(pdf, t.tracking, text=pdf_text)
        if not fs.rate_data_applies:
            stats["filings_excluded_rate_data_does_not_apply"] += 1; continue
        if not fs.company_rates:
            # rate_data_applies=True but no rows extracted — record as zero-row anomaly
            print(f"  ! {t.tracking}: rate_data_applies=True but 0 rows extracted")
            stats["filings_excluded_no_pdf"] += 1
            continue

        # Determine rate_activity from disposition status. UT uses REJECTED for
        # disapproved filings; other states use Disapproved/DISAPPROVED. NV uses
        # "Open" for undisposed/in-review filings (added 2026-05-27 in MT/WY/NV
        # expansion — equivalent to PENDING). GA (2026-06-10) adds "Received"
        # (with the state, no disposition yet) and "Exam" (under examination) —
        # both in-review, classified pending like NV's Open; GA's terminal
        # accepted vocabulary ("Acknowledged", "Filed", "Approved") falls
        # through to rate_change.
        ds = (fs.disposition_status or "").upper()
        if "WITHDRAWN" in ds:
            activity = "rate_change_withdrawn"
        elif "DISAPPROV" in ds or "REJECT" in ds:
            activity = "rate_change_disapproved"
        elif "PENDING" in ds or ds in ("OPEN", "RECEIVED", "EXAM"):
            activity = "rate_change_pending"
        else:
            activity = "rate_change"

        eff = fs.effective_date_new or fs.effective_date_renewal
        if not _in_effective_window(eff):
            stats["filings_excluded_out_of_effective_window"] += 1
            continue
        rel_pdf = pdf.relative_to(Path(".")).as_posix() if pdf.is_absolute() is False else pdf.as_posix()
        _src, _ext, _ms, _vt = _relabel(_validation_tier(eff, t.filing_id in backfill_ids), t.tracking)
        for r in fs.company_rates:
            if _is_excluded_subsidiary(r.company_name):
                stats["rows_excluded_filing_vehicle"] = stats.get("rows_excluded_filing_vehicle", 0) + 1
                continue
            rows.append({
                "state": state,
                "effective_date": eff,
                "company_name": r.company_name,
                "line_of_business": t.toi,
                "sub_type_of_insurance": t.sub_toi,
                "overall_indicated_change": r.overall_indicated_change,
                "overall_rate_impact": r.overall_rate_impact,
                "written_premium_change": r.written_premium_change,
                "policyholders_affected": r.policyholders_affected,
                "written_premium_for_program": r.written_premium_for_program,
                "maximum_percent_change": r.maximum_pct_change,
                "minimum_percent_change": r.minimum_pct_change,
                "rate_activity": activity,
                "serff_tracking_number": t.tracking,
                "disposition_status": fs.disposition_status,
                "filing_date": (t.submission_date.isoformat() if hasattr(t.submission_date, "isoformat") else t.submission_date),
                "source_pdf": rel_pdf,
                "validation_tier": _vt,
                "source": _src,
                "external_validation": _ext,
                "match_strength": _ms,
            })
        stats["filings_emitted"] += 1
        stats["rows_emitted"] += len(fs.company_rates)
    return rows, stats


def write_xlsx(rows: list[dict], state: str) -> Path:
    out = Path(f"output/{state.lower()}_final_rates.xlsx")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "rates"
    ws.append(COLUMNS)
    for r in rows:
        ws.append([r.get(c) for c in COLUMNS])
    wb.save(out)
    return out


# ============================================================
# Idaho-specific anchor verification (SFMA-134676753 vs AM Best)
# ============================================================
ANCHOR_EXPECTED = {
    ("SFMA-134676753", "State Farm Fire and Casualty Company"): dict(
        ind="15.900%", imp="-2.100%", prem_chg="-554469", ph=20679,
        prem_for="26357498", maxp="388.400%", minp="-41.500%",
    ),
    ("SFMA-134676753", "State Farm Mutual Automobile Insurance Company"): dict(
        ind="-2.600%", imp="-9.700%", prem_chg="-25716996", ph=360274,
        prem_for="263832752", maxp="847.900%", minp="-52.200%",
    ),
}


def verify_anchor(rows: list[dict]) -> tuple[int, list[str]]:
    """Return (matches_count, mismatch_messages) for anchor SFMA-134676753."""
    mismatches: list[str] = []
    matched = 0
    by_key = {(r["serff_tracking_number"], r["company_name"]): r for r in rows}
    for key, exp in ANCHOR_EXPECTED.items():
        r = by_key.get(key)
        if not r:
            mismatches.append(f"  MISSING: {key}"); continue
        actual = dict(
            ind=r["overall_indicated_change"], imp=r["overall_rate_impact"],
            prem_chg=r["written_premium_change"], ph=r["policyholders_affected"],
            prem_for=r["written_premium_for_program"],
            maxp=r["maximum_percent_change"], minp=r["minimum_percent_change"],
        )
        ok = True
        for k, ev in exp.items():
            if actual[k] != ev:
                mismatches.append(f"  {key} {k}: got={actual[k]!r} expected={ev!r}"); ok = False
        if ok: matched += 7  # 7 fields per row
    return matched, mismatches


def main():
    state = (sys.argv[1] if len(sys.argv) > 1 else "ID").upper()
    t0 = time.time()
    print(f"=== {state} final-rates pipeline ===")
    targets = load_targets(state)
    print(f"loaded {len(targets)} target-TOI target-carrier filings")
    download_all_pdfs(state, targets)
    backfill_ids = _load_backfill_ids(state)
    if backfill_ids:
        print(f"loaded {len(backfill_ids)} back-extension filing_ids for tiering", flush=True)
    rows, stats = build_rows(state, targets, backfill_ids)
    out = write_xlsx(rows, state)
    elapsed = time.time() - t0

    # storage delta — sum size of cached system PDFs
    pdf_dir = Path(f"output/pdfs/{state}")
    total_kb = sum(p.stat().st_size for p in pdf_dir.rglob("filing_summary.pdf")) / 1024

    # field-completion rates
    completion = {c: 0 for c in COLUMNS}
    for r in rows:
        for c in COLUMNS:
            if r.get(c) not in (None, ""):
                completion[c] += 1

    print("\n=== STATS ===")
    for k, v in stats.items(): print(f"  {k}: {v}")
    print(f"\n=== FIELD COMPLETION ({len(rows)} rows) ===")
    for c in COLUMNS:
        pct = (100 * completion[c] / len(rows)) if rows else 0
        print(f"  {completion[c]:4d}/{len(rows)}  ({pct:5.1f}%)  {c}")
    print(f"\n=== STORAGE ===")
    print(f"  system PDFs cached: {total_kb:.1f} KB across {len(targets)} filings")
    print(f"  avg per filing:     {total_kb / max(1, len(targets)):.1f} KB")
    print(f"\n=== RUNTIME ===")
    print(f"  elapsed: {elapsed:.1f} s ({elapsed/60:.1f} min)")
    print(f"\n=== OUTPUT ===")
    print(f"  -> {out} ({len(rows)} data rows)")

    if state == "ID":
        matched, mismatches = verify_anchor(rows)
        print(f"\n=== ANCHOR (SFMA-134676753 vs AM Best) ===")
        print(f"  matched: {matched}/14 fields")
        if mismatches:
            print("  mismatches:")
            for m in mismatches: print(m)


if __name__ == "__main__":
    main()
