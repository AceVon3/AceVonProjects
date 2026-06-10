"""B1 submission-date mini-pass — targeted fetch for search-phase failures.

Usage:
    python backfill_submission_dates.py NM
    python backfill_submission_dates.py NM --validate   # compare vs enriched workbook
    python backfill_submission_dates.py NM --force      # re-fetch even if sidecar has a date

The search phase fetches submission_date per filing; for a small minority the
detail page fails to open ("could not open detail") and the date stays blank.
Under B1 there is no enrichment pass to backfill them, so this mini-pass
re-fetches submission_date for exactly the blank-date TARGET filings (in-scope
TOI + carrier only — the only ones the deliverable needs). Load is minimal:
one search + one detail-open per filing, throttled by REQUEST_DELAY.

Robustness: these are precisely the filings that were flaky at search time, so
each fetch uses a FRESH browser context (the download_all_pdfs lesson: reused
JSF sessions degrade and rows become unfindable) and tries every group search
term with 2 attempts each.

FALLBACK POLICY (decided 2026-06-10, with B1 deployment): if a filing's detail
page still cannot be opened after all attempts, its submission_date stays
BLANK in the sidecar and therefore blank in the deliverable's filing_date.
Precedented and safe: the committed OR deliverable ships 5 blank-submission
rows; validation tiering keys on backfill-slice membership, not dates
(run_final_rates._validation_tier), so a blank date cannot mistier a row. The
failure is recorded in the sidecar (status column) for later retries — re-runs
skip filings that already have a date and re-attempt failures.

Output sidecar: output/{state}_submission_date_backfill.csv
    filing_id, serff_tracking_number, group, submission_date (ISO or blank),
    status (ok | row_not_found | search_failed | no_date_on_page), attempts,
    fetched_at
run_final_rates.load_targets_search reads it (after the legacy enriched
workbook, if one exists).

--validate (legacy states only): after fetching, compare every fetched date
against the enriched workbook's value for the same filing_id and report
exact-match / mismatch / oracle-missing counts. This is the live half of the
B1 validation: the offline harness (validate_b1.py) used the enriched values
as the backfill oracle; this proves the production fetch reproduces them.
"""
from __future__ import annotations

import csv
import sys
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf
from src.config import HEADLESS, REQUEST_DELAY, USER_AGENT
from src.search import (
    _click_row_to_detail,
    _extract_submission_date_from_detail,
    _set_rows_per_page_100,
    _submit_search,
)

ATTEMPTS_PER_TERM = 2


def sidecar_path(state: str) -> Path:
    return Path(f"output/{state.lower()}_submission_date_backfill.csv")


def load_sidecar(state: str) -> dict[str, dict]:
    p = sidecar_path(state)
    if not p.exists():
        return {}
    with open(p, newline="", encoding="utf-8") as f:
        return {str(row["filing_id"]): dict(row) for row in csv.DictReader(f)}


def write_sidecar(state: str, rows: dict[str, dict]) -> Path:
    p = sidecar_path(state)
    cols = ["filing_id", "serff_tracking_number", "group", "submission_date",
            "status", "attempts", "fetched_at"]
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for fid in sorted(rows):
            w.writerow({c: rows[fid].get(c, "") for c in cols})
    return p


def fetch_one(browser, state: str, filing_id: str, group: str) -> tuple[str, str, int]:
    """Returns (iso_date_or_blank, status, attempts_used)."""
    attempts = 0
    saw_search_ok = False
    for term in rf.GROUP_SEARCH[group]:
        for _ in range(ATTEMPTS_PER_TERM):
            attempts += 1
            ctx = browser.new_context(user_agent=USER_AGENT, accept_downloads=False)
            page = ctx.new_page()
            try:
                if not _submit_search(page, state, term):
                    print(f"    [attempt {attempts}] search {term!r} failed", flush=True)
                    continue
                saw_search_ok = True
                _set_rows_per_page_100(page)
                if not _click_row_to_detail(page, filing_id):
                    print(f"    [attempt {attempts}] row not found under {term!r}", flush=True)
                    break  # row genuinely absent under this term — try next term
                d = _extract_submission_date_from_detail(page)
                if d:
                    return d.isoformat(), "ok", attempts
                return "", "no_date_on_page", attempts
            except Exception as e:
                print(f"    [attempt {attempts}] {type(e).__name__}: {e}", flush=True)
            finally:
                ctx.close()
                time.sleep(REQUEST_DELAY)
    return "", ("row_not_found" if saw_search_ok else "search_failed"), attempts


def main() -> int:
    args = [a for a in sys.argv[1:]]
    flags = {a for a in args if a.startswith("--")}
    pos = [a for a in args if not a.startswith("--")]
    state = (pos[0] if pos else "NM").upper()
    validate = "--validate" in flags
    force = "--force" in flags

    print(f"=== {state} submission-date mini-pass ===", flush=True)
    _targets, rep = rf.load_targets_search(state)
    blank = rep["search_blank"]  # (tracking, filing_id, group) — search-phase failures
    print(f"search-blank target filings: {len(blank)}", flush=True)

    sidecar = load_sidecar(state)
    todo = []
    for tracking, fid, group in blank:
        prev = sidecar.get(fid)
        if prev and prev.get("submission_date") and not force:
            continue  # already fetched on a previous run
        todo.append((tracking, fid, group))
    print(f"to fetch ({'force' if force else 'skipping already-fetched'}): {len(todo)}", flush=True)

    if todo:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=HEADLESS)
            for i, (tracking, fid, group) in enumerate(todo, 1):
                print(f"  [{i}/{len(todo)}] {tracking} ({group})", flush=True)
                iso, status, attempts = fetch_one(browser, state, fid, group)
                print(f"    -> {status}{': ' + iso if iso else ''} ({attempts} attempt(s))", flush=True)
                sidecar[fid] = {
                    "filing_id": fid,
                    "serff_tracking_number": tracking,
                    "group": group,
                    "submission_date": iso,
                    "status": status,
                    "attempts": attempts,
                    "fetched_at": datetime.now().isoformat(timespec="seconds"),
                }
            browser.close()
        out = write_sidecar(state, sidecar)
        print(f"sidecar written: {out}", flush=True)

    n_ok = sum(1 for r in sidecar.values() if r.get("submission_date"))
    n_fail = sum(1 for r in sidecar.values() if not r.get("submission_date"))
    print(f"\nsidecar totals: {n_ok} dated, {n_fail} blank (fallback: stays blank in deliverable)", flush=True)

    if validate:
        oracle = rf._load_enriched_dates(state)
        if not oracle:
            print("\n--validate: no enriched workbook for this state — nothing to compare", flush=True)
            return 0
        match = mismatch = oracle_missing = unfetched = 0
        print(f"\n=== VALIDATION vs enriched oracle ({state.lower()}_final.xlsx) ===", flush=True)
        for tracking, fid, _group in blank:
            fetched = (sidecar.get(fid) or {}).get("submission_date") or ""
            ov = oracle.get(fid)
            oracle_iso = ov.isoformat() if hasattr(ov, "isoformat") else (str(ov) if ov else "")
            # openpyxl returns datetimes for date cells — compare date part only
            oracle_iso = oracle_iso[:10]
            if not fetched and not oracle_iso:
                unfetched += 1
                print(f"  BOTH BLANK {tracking}: search, enrichment and mini-pass all failed — stays blank", flush=True)
            elif not fetched:
                mismatch += 1
                print(f"  FETCH FAILED {tracking}: oracle has {oracle_iso}, mini-pass got nothing", flush=True)
            elif not oracle_iso:
                oracle_missing += 1
                print(f"  ORACLE BLANK {tracking}: mini-pass got {fetched}, enrichment had failed", flush=True)
            elif fetched == oracle_iso:
                match += 1
            else:
                mismatch += 1
                print(f"  MISMATCH {tracking}: mini-pass={fetched} oracle={oracle_iso}", flush=True)
        print(f"\n  exact matches: {match}/{len(blank)}", flush=True)
        print(f"  mismatches/failures: {mismatch}", flush=True)
        print(f"  mini-pass recovered where enrichment failed: {oracle_missing}", flush=True)
        print(f"  blank everywhere (documented fallback): {unfetched}", flush=True)
        print(f"\n  VERDICT: {'CLEAN — mini-pass reproduces the oracle' if mismatch == 0 else 'MISMATCHES — investigate before deploying B'}", flush=True)
        return 0 if mismatch == 0 else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
