#!/usr/bin/env python3
"""Import SERFF rate filings from xlsx into SQLite (filings.db).

Reads the `rate_filings` sheet, normalizes types, derives `brand` from
`company_name`, and writes two tables:
  - filings_raw : one row per source xlsx row
  - filings     : one row per (serff_tracking_number, line_of_business),
                  with overall_rate_impact rolled up as a premium-weighted
                  average across entities

Also writes data/last_updated.txt with the run date.

Fails loudly on any unmatched company_name, null required field, or
unparsable date. The verification block at the end re-asserts the
import-level numbers from spec.md.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sqlite3
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent

# --- AM Best interim path (Step 2) -------------------------------------------
# States we have AM Best industry data for but have NOT scraped yet. Loaded as
# source='ambest_sourced' so they render like normal rows but are backend-tagged
# and cleanly replaceable when scraped (delete WHERE state=X AND source='ambest_
# sourced', re-import the scrape). Reports parsed by the scraper's
# tools/parse_ambest_generic.py into ambest_<state>_data.csv.
# AM Best industry-data states. All load as source='ambest_sourced' via the
# same pipeline. PERMANENT ones are NOT SERFF Public Access (the state runs its
# own non-SERFF system, e.g. CA/CDI), so they can never be replaced by a normal
# scrape — they are AM Best-sourced for good, not "interim awaiting scrape". The
# replacement path (DELETE ... source='ambest_sourced') is state-scoped and must
# never be run for a permanent state. See docs/AMBEST_INTERIM.md.
# PERMANENT (non-SERFF, never replaceable): CA (CDI), NY (DFS), TX (TDI) — each
# runs its own filing system, not SERFF Public Access. Conservative-safe tag:
# mis-tagging a scrapeable state permanent just means "revisit manually"; mis-
# tagging a non-scrapeable state interim lets the replacement sweep delete it
# with no replacement (the CA landmine). NY/TX non-SERFF status is from
# regulatory structure, not a SERFF probe (not probed during the quiet period) —
# confirm if scraping NY/TX is ever considered. NOT load-blocking.
AMBEST_PERMANENT_STATES = ["CA", "NY", "TX"]
AMBEST_STATES = [  # VA (06-22), OH (06-24), IL (06-25) all removed: scraped (serff_scraped), no longer interim.
                 # 10-state batch (2026-06-17). 9 interim + CA (permanent).
                 "AK", "AR", "CA", "CT", "DE", "HI", "IA", "IN", "KS", "KY",
                 # 22-state batch (2026-06-17): 20 interim + NY/TX permanent.
                 # NC EXCLUDED: 68.1% Data-N/A → only 26 thin filings, because
                 # NC rates auto/home through the NC Rate Bureau (collective, no
                 # per-carrier data in AM Best). STRUCTURAL, not a fixable pull —
                 # a re-pull won't help; NC needs a different source (NCRB direct
                 # or another vendor), so it is NOT on any re-pull list.
                 "ME", "MD", "MA", "MI", "MN", "MS", "MO", "NE", "NH", "NJ",
                 "NY", "ND", "OK", "PA", "RI", "SC", "SD", "TN", "TX", "VT",
                 "WV", "WI"]
AMBEST_CSV_DIR = PROJECT_DIR.parent / "Insurance Rate Data Scraper" / "tools"
AMBEST_WINDOW = (date(2024, 1, 1), date(2026, 4, 17))  # match the scraped data span
AMBEST_LINE = {"PPA": "Personal Auto", "HO": "Homeowners"}
# Reuse the SAME brand mapping + Munich-Re exclusions the scraper cross-check uses.
_AMBEST_EXCLUDE = ("american family home", "american modern", "homesite", "midvale",
                   "main street america", "permanent general", "general automobile",
                   "national general", "integon", "esurance", "noblr", "foremost",
                   "bristol west", "coast national", "toggle insurance", "economy fire",
                   "economy premier", "economy preferred", "amco insurance",
                   "allied property", "depositors insurance", "titan indemnity",
                   "victoria fire", "lm general", "standard fire", "american economy",
                   "peerless")


def _ambest_dt(s: str):
    try:
        return datetime.strptime(s.strip(), "%m/%d/%y").date()
    except (ValueError, AttributeError):
        return None


def _ambest_num(s):
    s = str(s or "").strip()
    if s in ("", "None"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _surrogate_key(state: str, line: str, block_id: str, brand: str) -> str:
    """Backend-ONLY surrogate key, one per (block, brand). block_id is the
    parser's content hash of the filing block (group + eff + disp + line + sorted
    entity (subsidiary, impact, policyholders) fingerprint). Brand is folded in
    because an AM Best carrier-GROUP block can span two of our brands (e.g.
    Liberty Mutual Group lists Liberty + Safeco entities) — the app is one-brand-
    per-filing, so those split into separate filings. Block-stable, idempotent,
    collision-proof. Never shown to the user."""
    h = hashlib.md5(f"{block_id}|{brand}".encode("utf-8")).hexdigest()[:10]
    return f"AMB-{state}-{'PA' if line == 'PPA' else 'HO'}-{h}"


def build_ambest_df() -> pd.DataFrame:
    """Transform ambest_<state>_data.csv -> filings_raw-shaped rows tagged
    source='ambest_sourced'. Group entities by the parser's block_id (the true
    filing boundary), dedup page-break repetition, window-filter, in-scope
    (brand-mapped subsidiary, Rate), assign a backend-only block surrogate key."""
    out_rows: list[dict] = []
    for state in AMBEST_STATES:
        csv_path = AMBEST_CSV_DIR / f"ambest_{state.lower()}_data.csv"
        if not csv_path.exists():
            sys.exit(f"FATAL: AM Best CSV not found: {csv_path} (run parse_ambest_generic.py {state})")
        seen: set = set()
        blocks: dict[str, list[dict]] = {}
        for r in csv.DictReader(open(csv_path, encoding="utf-8")):
            if not r.get("subsidiary") or r.get("filing_action") != "Rate":
                continue
            line = r.get("major_line")
            if line not in AMBEST_LINE:
                continue
            eff = _ambest_dt(r["effective_date"])
            if eff is None or eff < AMBEST_WINDOW[0] or eff > AMBEST_WINDOW[1]:
                continue
            brand = derive_brand(r["subsidiary"])
            if brand is None or any(p in r["subsidiary"].lower() for p in _AMBEST_EXCLUDE):
                continue
            # Dedup page-break repetition WITHIN a block (same entity repeats).
            k = (r["block_id"], r["subsidiary"], r["impact_pct"], r["policyholders_affected"])
            if k in seen:
                continue
            seen.add(k)
            r["_brand"] = brand
            blocks.setdefault((r["block_id"], brand), []).append(r)

        for (block_id, brand_k), entities in blocks.items():
            line = entities[0]["major_line"]
            key = _surrogate_key(state, line, block_id, brand_k)
            eff_iso = _ambest_dt(entities[0]["effective_date"]).isoformat()
            for e in entities:
                out_rows.append({
                    "state": state, "brand": e["_brand"], "company_name": e["subsidiary"],
                    "line_of_business": AMBEST_LINE[line], "sub_type_of_insurance": None,
                    "overall_rate_impact": _ambest_num(e["impact_pct"]),
                    "overall_indicated_change": _ambest_num(e["indicated_pct"]),
                    "maximum_percent_change": _ambest_num(e["maximum_pct"]),
                    "minimum_percent_change": _ambest_num(e["minimum_pct"]),
                    "written_premium_change": _ambest_num(e["written_premium_change"]),
                    "policyholders_affected": (int(float(e["policyholders_affected"]))
                                               if e["policyholders_affected"] not in (None, "") else None),
                    "written_premium_for_program": _ambest_num(e["written_premium_for_program"]),
                    "rate_activity": "rate_change",        # AM Best lists only disposed/approved
                    "serff_tracking_number": key,          # backend-only surrogate
                    "disposition_status": "Approved",      # AM Best = disposed/approved
                    "effective_date": eff_iso, "filing_date": None,
                    "source_pdf": f"AM Best {state} interim report",
                    "source": "ambest_sourced",
                })
    return pd.DataFrame(out_rows)

DEFAULT_XLSX_CANDIDATES = [
    PROJECT_DIR / "output" / "all_states_final_rates.xlsx",
    PROJECT_DIR.parent / "Insurance Rate Data Scraper" / "output" / "all_states_final_rates.xlsx",
]
DEFAULT_DB = PROJECT_DIR / "data" / "filings.db"
LAST_UPDATED_PATH = PROJECT_DIR / "data" / "last_updated.txt"
SHEET = "rate_filings"

PERCENT_COLS = [
    "overall_indicated_change",
    "overall_rate_impact",
    "maximum_percent_change",
    "minimum_percent_change",
]

LOB_CLEAN = {
    "04.0 Homeowners": "Homeowners",
    "19.0 Personal Auto": "Personal Auto",
}


def derive_brand(name) -> str | None:
    """Map a company_name to one of the 13 covered brands. First match wins."""
    if name is None or not isinstance(name, str):
        return None
    n = name.lower()
    if n.startswith("state farm") or "mga insurance" in n:
        return "State Farm"
    if n.startswith("geico") or "government employees" in n:
        return "GEICO"
    if n.startswith("allstate"):
        return "Allstate"
    if n.startswith("encompass"):
        return "Encompass"
    if "travelers" in n:
        return "Travelers"
    if n.startswith("progressive") or "artisan and truckers" in n:
        return "Progressive"
    # Safeco — incl. consumer-facing Safeco companies whose legal names carry
    # neither "safeco" nor "liberty" (Liberty Mutual owns the parent post-2008,
    # but these are sold under the Safeco brand). Full-phrase match on
    # "...of america" so it can't swallow "Nationwide General Insurance Company".
    if (n.startswith("safeco")
            or "general insurance company of america" in n
            or "first national insurance company of america" in n
            or "american states" in n):
        return "Safeco"
    # Montgomery Mutual Insurance Company — a Liberty Mutual affiliate (acquired via
    # the 2008 Ohio Casualty / Montgomery Insurance deal). It co-files on Liberty
    # Mutual SERFF filings (LBPM-*) alongside Liberty Mutual Insurance Company, so
    # it rolls up into the same Liberty Mutual filing. Surfaced by the VA scrape
    # (2026-06-22); VA-only — the 10 original scraped states have no Montgomery rows.
    if "liberty" in n or "montgomery mutual" in n:
        return "Liberty Mutual"
    # --- 5 new carriers (13-brand expansion) ---
    # USAA checked before any generic match so "USAA General Indemnity" (carries
    # "general") goes to USAA. Includes its non-"usaa"-named entities.
    if "usaa" in n or "united services" in n or "garrison" in n:
        return "USAA"
    # Farmers: the "farmers*" entities PLUS the historical Farmers exchanges that
    # carry no "farmers" in the name (Fire Insurance Exchange + Mid-Century are
    # Farmers underwriting affiliates; Truck Insurance Exchange the commercial one).
    if ("farmers" in n
            or "fire insurance exchange" in n
            or "truck insurance exchange" in n
            or "mid-century" in n):
        return "Farmers"
    if "nationwide" in n:
        return "Nationwide"
    # American Family — guard the Munich Re name collision (American Family Home
    # Insurance, NAIC 23450, is American Modern/Munich Re, NOT AmFam).
    if "american family" in n and "american family home" not in n:
        return "American Family"
    # COUNTRY Financial — the consumer-facing brand label.
    if ("country mutual" in n
            or "country preferred" in n
            or "country casualty" in n):
        return "COUNTRY Financial"
    return None


def parse_percent(val):
    if val is None:
        return None
    if isinstance(val, float) and pd.isna(val):
        return None
    s = str(val).strip()
    if not s or s.lower() in {"nan", "none", "null"}:
        return None
    s = s.rstrip("%").strip()
    if not s:
        return None
    return float(s)


def parse_date(val, fmt: str, col: str, row_idx: int):
    if val is None:
        return None
    if isinstance(val, float) and pd.isna(val):
        return None
    s = str(val).strip()
    if not s or s.lower() in {"nan", "none", "null"}:
        return None
    try:
        return datetime.strptime(s, fmt).date().isoformat()
    except ValueError as e:
        raise ValueError(
            f"Row {row_idx}: could not parse {col}={s!r} with format {fmt!r}"
        ) from e


def find_xlsx(cli_path: str | None) -> Path:
    if cli_path:
        p = Path(cli_path).resolve()
        if not p.exists():
            sys.exit(f"FATAL: --xlsx path does not exist: {p}")
        return p
    env = os.environ.get("RATE_FILINGS_XLSX")
    if env:
        p = Path(env).resolve()
        if not p.exists():
            sys.exit(f"FATAL: RATE_FILINGS_XLSX path does not exist: {p}")
        return p
    for c in DEFAULT_XLSX_CANDIDATES:
        if c.exists():
            return c
    sys.exit(
        "FATAL: could not locate rate_filings xlsx. Set RATE_FILINGS_XLSX, "
        "pass --xlsx, or place the file at one of:\n  "
        + "\n  ".join(str(c) for c in DEFAULT_XLSX_CANDIDATES)
    )


def load_and_normalize(xlsx_path: Path) -> pd.DataFrame:
    df = pd.read_excel(xlsx_path, sheet_name=SHEET)

    expected_cols = {
        "state", "effective_date", "company_name", "line_of_business",
        "sub_type_of_insurance", "overall_indicated_change",
        "overall_rate_impact", "written_premium_change",
        "policyholders_affected", "written_premium_for_program",
        "maximum_percent_change", "minimum_percent_change", "rate_activity",
        "serff_tracking_number", "disposition_status", "filing_date",
        "source_pdf",
    }
    missing = expected_cols - set(df.columns)
    if missing:
        sys.exit(f"FATAL: xlsx missing required columns: {sorted(missing)}")

    for col in PERCENT_COLS:
        df[col] = df[col].map(parse_percent)

    bad_lob = set(df["line_of_business"].dropna().unique()) - set(LOB_CLEAN.keys())
    if bad_lob:
        sys.exit(f"FATAL: unexpected line_of_business values: {sorted(bad_lob)}")
    df["line_of_business"] = df["line_of_business"].map(LOB_CLEAN)

    df["effective_date"] = [
        parse_date(v, "%m/%d/%Y", "effective_date", i)
        for i, v in enumerate(df["effective_date"])
    ]
    df["filing_date"] = [
        parse_date(v, "%Y-%m-%d", "filing_date", i)
        for i, v in enumerate(df["filing_date"])
    ]

    df["brand"] = df["company_name"].map(derive_brand)

    # Step 1 (source tag, 2026-06-16): every row from this SERFF import is
    # scraped data. The AM Best interim path (Step 2) sets 'ambest_sourced'.
    df["source"] = "serff_scraped"

    # Fail loudly on unmatched company_name (the single point where scope
    # drift will appear during a monthly refresh).
    unmatched = df[df["brand"].isna()]
    if len(unmatched) > 0:
        names = sorted(unmatched["company_name"].dropna().unique().tolist())
        sys.exit(
            f"FATAL: {len(unmatched)} rows have no brand match. "
            f"Update derive_brand() to cover these company_name values:\n  "
            + "\n  ".join(repr(n) for n in names)
        )

    # Genuinely-required fields (fail loudly on null). effective_date is
    # NOT in this list — real SERFF data has rows with null effective_date
    # (e.g. approved 0% filings); we allow them and let downstream handle
    # the missing date. state/rate_activity/brand are NOT NULL at the
    # schema level so any null would error at INSERT.
    required = ["serff_tracking_number", "company_name", "line_of_business",
                "overall_rate_impact"]
    for col in required:
        nulls = df[df[col].isna() | (df[col].astype(str).str.strip() == "")]
        if len(nulls) > 0:
            sys.exit(f"FATAL: {len(nulls)} rows have null required field {col!r}")

    return df


def create_schema(con: sqlite3.Connection) -> None:
    con.executescript("""
        DROP TABLE IF EXISTS filings;
        DROP TABLE IF EXISTS filings_raw;

        CREATE TABLE filings_raw (
            id INTEGER PRIMARY KEY,
            state TEXT NOT NULL,
            brand TEXT NOT NULL,
            company_name TEXT NOT NULL,
            line_of_business TEXT NOT NULL,
            sub_type_of_insurance TEXT,
            overall_rate_impact REAL,
            overall_indicated_change REAL,
            maximum_percent_change REAL,
            minimum_percent_change REAL,
            written_premium_change REAL,
            policyholders_affected INTEGER,
            written_premium_for_program REAL,
            rate_activity TEXT NOT NULL,
            serff_tracking_number TEXT NOT NULL,
            disposition_status TEXT,
            -- effective_date is intentionally nullable. Real SERFF data has
            -- legitimate rows with no effective_date (e.g. approved 0% filings).
            -- Downstream: such rows are excluded from the 12-month window filter
            -- and from Prospect/Defend/Most-Urgent (no date to place), but can
            -- still appear in My Carriers with a 'date unknown' treatment.
            effective_date TEXT,
            filing_date TEXT,
            source_pdf TEXT,
            -- Provenance tag (Step 1, 2026-06-16). 'serff_scraped' for rows from
            -- the SERFF scrape (this import); 'ambest_sourced' for the interim AM
            -- Best path (Step 2). CHECK makes an unknown value fail loud at INSERT.
            source TEXT NOT NULL CHECK (source IN ('serff_scraped', 'ambest_sourced'))
        );

        CREATE TABLE filings (
            id INTEGER PRIMARY KEY,
            serff_tracking_number TEXT NOT NULL,
            state TEXT NOT NULL,
            brand TEXT NOT NULL,
            line_of_business TEXT NOT NULL,
            overall_rate_impact REAL NOT NULL,
            rate_activity TEXT NOT NULL,
            -- Nullable: see filings_raw.effective_date comment above.
            effective_date TEXT,
            filing_date TEXT,
            entity_count INTEGER NOT NULL,
            total_policyholders INTEGER,
            total_written_premium REAL,
            min_entity_impact REAL NOT NULL,
            max_entity_impact REAL NOT NULL,
            entity_names TEXT NOT NULL,
            disposition_status TEXT,
            -- Single sub_type_of_insurance for the filing. Recon-confirmed
            -- single-valued per (serff, line) across all entities; the rollup
            -- asserts this and FAILS LOUDLY on a mixed group (a future refresh
            -- could in theory introduce one). Stored as the raw source string;
            -- the app cleans the NAIC code prefix for display. Nullable only
            -- for the (currently non-existent) all-null-sub_type group.
            sub_type TEXT,
            -- Provenance tag (Step 1, 2026-06-16); single-valued per rollup group
            -- (the rollup FAILS LOUD on a mixed-source group — Step 3 guard).
            source TEXT NOT NULL CHECK (source IN ('serff_scraped', 'ambest_sourced')),
            UNIQUE (serff_tracking_number, line_of_business)
        );

        CREATE INDEX idx_filings_state_brand ON filings(state, brand);
        CREATE INDEX idx_filings_effective ON filings(effective_date);
        CREATE INDEX idx_filings_activity ON filings(rate_activity);
    """)


def _opt(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    return val


def insert_raw(con: sqlite3.Connection, df: pd.DataFrame) -> None:
    rows = []
    for _, r in df.iterrows():
        polic = r["policyholders_affected"]
        polic_int = None if (polic is None or pd.isna(polic)) else int(polic)
        rows.append((
            r["state"], r["brand"], r["company_name"], r["line_of_business"],
            _opt(r["sub_type_of_insurance"]),
            r["overall_rate_impact"],
            r["overall_indicated_change"],
            r["maximum_percent_change"],
            r["minimum_percent_change"],
            _opt(r["written_premium_change"]),
            polic_int,
            _opt(r["written_premium_for_program"]),
            r["rate_activity"], r["serff_tracking_number"],
            _opt(r["disposition_status"]),
            r["effective_date"], r["filing_date"],
            _opt(r["source_pdf"]),
            r["source"],
        ))
    con.executemany("""
        INSERT INTO filings_raw (
            state, brand, company_name, line_of_business, sub_type_of_insurance,
            overall_rate_impact, overall_indicated_change,
            maximum_percent_change, minimum_percent_change,
            written_premium_change, policyholders_affected,
            written_premium_for_program, rate_activity, serff_tracking_number,
            disposition_status, effective_date, filing_date, source_pdf, source
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)


def rollup(con: sqlite3.Connection) -> tuple[int, int, list[str]]:
    """Build filings from filings_raw. Returns (rolled_count, multi_entity_count, warnings)."""
    cur = con.execute("""
        SELECT serff_tracking_number, line_of_business, state, brand,
               company_name, overall_rate_impact, written_premium_for_program,
               policyholders_affected, rate_activity, effective_date, filing_date,
               disposition_status, sub_type_of_insurance, source
        FROM filings_raw
    """)
    groups: dict[tuple[str, str], list[dict]] = {}
    for row in cur.fetchall():
        key = (row[0], row[1])
        groups.setdefault(key, []).append({
            "serff": row[0], "lob": row[1], "state": row[2], "brand": row[3],
            "company_name": row[4], "impact": row[5], "premium": row[6],
            "policyholders": row[7], "rate_activity": row[8],
            "effective_date": row[9], "filing_date": row[10],
            "disposition_status": row[11], "sub_type": row[12], "source": row[13],
        })

    inserts = []
    multi_count = 0
    warnings: list[str] = []

    for (serff, lob), entries in groups.items():
        states = {e["state"] for e in entries}
        brands = {e["brand"] for e in entries}
        if len(states) > 1:
            sys.exit(f"FATAL: serff={serff} lob={lob} spans states {sorted(states)}")
        # Liberty Mutual Group co-filing resolution (2026-06-25, IL import): a
        # single SERFF filing under a Liberty tracking number (LBPM-) can co-file
        # Safeco (a Liberty Mutual subsidiary brand) entities alongside Liberty
        # entities — the app is one-brand-per-filing, so attribute the whole
        # Group filing to Liberty Mutual (the filer). Same co-filer precedent as
        # Montgomery Mutual -> Liberty Mutual (VA). SCOPED to the EXACT
        # {Liberty Mutual, Safeco} span so it can only ever touch this case (no
        # other state/filing spans these two brands); every other multi-brand
        # span still FATALs. Today: only IL LBPM-134662340 (Personal Auto, 0.0%).
        if brands == {"Liberty Mutual", "Safeco"}:
            for e in entries:
                e["brand"] = "Liberty Mutual"
            brands = {"Liberty Mutual"}
        if len(brands) > 1:
            sys.exit(f"FATAL: serff={serff} lob={lob} spans brands {sorted(brands)}")

        # Mixed-source guard (Step 3): a rollup group must be all-scraped or
        # all-AM-Best. Naturally safe (scraped/AM-Best states are disjoint), but
        # this fails loud on any accidental blend and protects the eventual
        # state-by-state replacement (delete ambest rows -> import scrape).
        sources = {e["source"] for e in entries}
        if len(sources) > 1:
            sys.exit(f"FATAL: serff={serff} lob={lob} MIXES sources {sorted(sources)}")
        source = next(iter(sources))

        # Sub-type: recon-confirmed single-valued per (serff, line). Assert it
        # and FAIL LOUDLY on a mixed group (same fail-loud pattern as brands).
        # All-null is allowed (store NULL + warn); it doesn't occur today.
        sub_types = {e["sub_type"] for e in entries if e["sub_type"] not in (None, "")}
        if len(sub_types) > 1:
            sys.exit(
                f"FATAL: serff={serff} lob={lob} has MIXED sub_type_of_insurance "
                f"across entities: {sorted(sub_types)}. The Sub-type column assumes "
                f"one sub_type per filing; revisit the rollup before proceeding."
            )
        sub_type = next(iter(sub_types)) if sub_types else None
        if sub_type is None:
            warnings.append(
                f"WARN: serff={serff} lob={lob} has no non-null sub_type_of_insurance; "
                f"storing NULL sub_type"
            )

        n = len(entries)
        if n > 1:
            multi_count += 1

        impacts = [e["impact"] for e in entries if e["impact"] is not None]
        if not impacts:
            sys.exit(f"FATAL: serff={serff} lob={lob} has no non-null overall_rate_impact")
        min_imp = min(impacts)
        max_imp = max(impacts)

        any_null_premium = any(e["premium"] is None for e in entries)
        if any_null_premium:
            warnings.append(
                f"WARN: serff={serff} lob={lob} has null written_premium_for_program; "
                f"falling back to simple mean of overall_rate_impact"
            )
            weighted_impact = sum(impacts) / len(impacts)
        else:
            num = sum(e["impact"] * e["premium"] for e in entries if e["impact"] is not None)
            den = sum(e["premium"] for e in entries if e["impact"] is not None)
            if den == 0:
                warnings.append(
                    f"WARN: serff={serff} lob={lob} sum of premiums is 0; using unweighted mean"
                )
                weighted_impact = sum(impacts) / len(impacts)
            else:
                weighted_impact = num / den

        if any(e["policyholders"] is None for e in entries):
            total_policyholders = None
        else:
            total_policyholders = int(sum(e["policyholders"] for e in entries))
        total_premium = None if any_null_premium else sum(e["premium"] for e in entries)

        # Representative entity for fields that should be constant across the group.
        rep = max(entries, key=lambda e: (e["premium"] if e["premium"] is not None else -1))
        for field in ["rate_activity", "effective_date", "filing_date", "disposition_status"]:
            distinct = {e[field] for e in entries}
            if len(distinct) > 1:
                warnings.append(
                    f"WARN: serff={serff} lob={lob} entities differ on {field}: "
                    f"{sorted(str(d) for d in distinct)}; using {rep[field]!r}"
                )

        entity_names = json.dumps([e["company_name"] for e in entries])

        inserts.append((
            serff, rep["state"], rep["brand"], lob, weighted_impact,
            rep["rate_activity"], rep["effective_date"], rep["filing_date"],
            n, total_policyholders, total_premium, min_imp, max_imp,
            entity_names, rep["disposition_status"], sub_type, source,
        ))

    con.executemany("""
        INSERT INTO filings (
            serff_tracking_number, state, brand, line_of_business,
            overall_rate_impact, rate_activity, effective_date, filing_date,
            entity_count, total_policyholders, total_written_premium,
            min_entity_impact, max_entity_impact, entity_names, disposition_status,
            sub_type, source
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, inserts)

    return len(inserts), multi_count, warnings


def verify(con: sqlite3.Connection, rolled_count: int, multi_count: int) -> None:
    print()
    print("=" * 72)
    print("VERIFICATION (against spec.md import-level numbers)")
    print("=" * 72)
    failed = False

    # Scraped invariants are SCOPED to source='serff_scraped'. Baseline re-keyed
    # 2026-06-25 when IL moved interim->scraped (+303 raw / +206 rolled / 13th
    # state / +69 active): 2,447/1,536/461, +93.70% anchor (WA, unchanged — IL's
    # max active is below it). The 44 non-IL states (incl. VA/OH scraped and
    # CA/NY/TX permanent) proven byte-identical. IL's one Liberty+Safeco co-filing
    # (LBPM-134662340 PPA, 0.0%) resolves to Liberty Mutual (Group filer; scoped
    # rollup resolution — see rollup()). Prior 2026-06-24 baseline was 2,144/1,330/392.
    raw = con.execute("SELECT COUNT(*) FROM filings_raw WHERE source='serff_scraped'").fetchone()[0]
    ok = raw == 2447
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (1) scraped filings_raw rows: expected 2447, got {raw}")

    null_brand = con.execute("SELECT COUNT(*) FROM filings_raw WHERE brand IS NULL").fetchone()[0]
    ok = null_brand == 0
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (2) unmatched company_name: expected 0, got {null_brand}")

    rolled = con.execute("SELECT COUNT(*) FROM filings WHERE source='serff_scraped'").fetchone()[0]
    ok = rolled == 1536
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (3) scraped filings (rolled) rows: expected 1536, got {rolled}")

    # (4) GECC-134661852 Personal Auto spot-check
    raw_n = con.execute(
        "SELECT COUNT(*) FROM filings_raw WHERE serff_tracking_number=? AND line_of_business=?",
        ("GECC-134661852", "Personal Auto"),
    ).fetchone()[0]
    row = con.execute(
        "SELECT overall_rate_impact, entity_count, min_entity_impact, max_entity_impact, "
        "       total_policyholders, total_written_premium, brand, state "
        "FROM filings WHERE serff_tracking_number=? AND line_of_business=?",
        ("GECC-134661852", "Personal Auto"),
    ).fetchone()
    print(f"  [..] (4) GECC-134661852 Personal Auto spot-check:")
    if row is None:
        print("        FAIL: not found in filings table")
        failed = True
    else:
        impact, n_ent, mn, mx, polic, prem, brand, state = row
        checks = [
            ("raw rows == 2",                 raw_n == 2,                    raw_n),
            ("rolled to 1 record",            True,                          1),
            ("overall_rate_impact ~ 50.88",   abs(impact - 50.88) < 0.05,    round(impact, 4)),
            ("entity_count == 2",             n_ent == 2,                    n_ent),
            ("min_entity_impact == 30.49",    abs(mn - 30.49) < 0.005,       mn),
            ("max_entity_impact == 56.47",    abs(mx - 56.47) < 0.005,       mx),
            ("brand == GEICO",                brand == "GEICO",              brand),
            ("state == NV",                   state == "NV",                 state),
        ]
        for label, passed, got in checks:
            mark = "OK" if passed else "FAIL"
            failed |= not passed
            print(f"        [{mark}] {label}  (got {got!r})")
        print(f"        [INFO] total_policyholders={polic}, total_written_premium={prem}")

    # (5) MGA Insurance Company → State Farm
    mga = con.execute(
        "SELECT DISTINCT brand FROM filings_raw WHERE company_name LIKE 'MGA Insurance%'"
    ).fetchall()
    brands = [r[0] for r in mga]
    ok = brands == ["State Farm"]
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (5) MGA Insurance Company -> State Farm: got brands={brands}")

    # (6) Sub-type rollup: no mixed groups, column populated, 11 distinct.
    mixed = con.execute("""
        SELECT COUNT(*) FROM (
            SELECT serff_tracking_number, line_of_business
            FROM filings_raw
            WHERE sub_type_of_insurance IS NOT NULL AND sub_type_of_insurance <> ''
            GROUP BY serff_tracking_number, line_of_business
            HAVING COUNT(DISTINCT sub_type_of_insurance) > 1
        )
    """).fetchone()[0]
    ok = mixed == 0
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (6a) mixed sub_type groups: expected 0, got {mixed}")

    null_sub_scraped = con.execute(
        "SELECT COUNT(*) FROM filings WHERE sub_type IS NULL AND source='serff_scraped'").fetchone()[0]
    ok = null_sub_scraped == 0
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (6b) scraped filings with NULL sub_type: expected 0, got {null_sub_scraped}")

    distinct_sub = con.execute(
        "SELECT COUNT(DISTINCT sub_type) FROM filings WHERE sub_type IS NOT NULL AND source='serff_scraped'"
    ).fetchone()[0]
    ok = distinct_sub == 11
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (6c) scraped distinct sub_type: expected 11, got {distinct_sub}")

    # (7) brand & (8) state coverage — SCOPED to scraped (the locked baseline).
    n_brands = con.execute("SELECT COUNT(DISTINCT brand) FROM filings WHERE source='serff_scraped'").fetchone()[0]
    ok = n_brands == 13
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (7) scraped distinct brands: expected 13, got {n_brands}")

    n_states = con.execute("SELECT COUNT(DISTINCT state) FROM filings WHERE source='serff_scraped'").fetchone()[0]
    ok = n_states == 13
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (8) scraped distinct states: expected 13, got {n_states}")

    # (9) active window + (10) anchor — SCOPED to scraped so AM Best can't move them.
    as_of = LAST_UPDATED_PATH.read_text(encoding="utf-8").strip()
    active = con.execute(
        """SELECT COUNT(*) FROM filings
           WHERE source='serff_scraped'
             AND rate_activity IN ('rate_change', 'rate_change_pending')
             AND effective_date >= date(?, '-12 months')""",
        (as_of,),
    ).fetchone()[0]
    ok = active == 461
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (9) scraped active-window filings (as of {as_of}): "
          f"expected 461, got {active}")

    anchor = con.execute(
        """SELECT serff_tracking_number, brand, state, overall_rate_impact
           FROM filings
           WHERE source='serff_scraped'
             AND rate_activity IN ('rate_change', 'rate_change_pending')
             AND effective_date >= date(?, '-12 months')
           ORDER BY overall_rate_impact DESC LIMIT 1""",
        (as_of,),
    ).fetchone()
    serff, brand, state, impact = anchor
    ok = (serff == "SFMA-134315091" and abs(impact - 93.70) < 0.05
          and brand == "State Farm" and state == "WA")
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (10) scraped max active impact: expected "
          f"+93.70% SFMA-134315091 State Farm WA, got +{impact:.2f}% {serff} {brand} {state}")

    # (11)/(12) source tags — scraped baseline intact + AM Best present.
    raw_scraped = con.execute("SELECT COUNT(*) FROM filings_raw WHERE source='serff_scraped'").fetchone()[0]
    raw_ambest = con.execute("SELECT COUNT(*) FROM filings_raw WHERE source='ambest_sourced'").fetchone()[0]
    ok = raw_scraped == 2447 and raw_ambest > 0
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (11) filings_raw source tags: 2447 serff_scraped "
          f"+ {raw_ambest} ambest_sourced (got {raw_scraped} / {raw_ambest})")

    f_scraped = con.execute("SELECT COUNT(*) FROM filings WHERE source='serff_scraped'").fetchone()[0]
    f_ambest = con.execute("SELECT COUNT(*) FROM filings WHERE source='ambest_sourced'").fetchone()[0]
    ok = f_scraped == 1536 and f_ambest > 0
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (12) filings source tags: 1536 serff_scraped "
          f"+ {f_ambest} ambest_sourced (got {f_scraped} / {f_ambest})")

    # ---- AM Best-specific checks (own invariants) ----
    amb_states = sorted(r[0] for r in con.execute(
        "SELECT DISTINCT state FROM filings WHERE source='ambest_sourced'"))
    ok = amb_states == sorted(AMBEST_STATES)
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (13) AM Best states: expected {sorted(AMBEST_STATES)}, got {amb_states}")

    bad_act = con.execute(
        "SELECT COUNT(*) FROM filings_raw WHERE source='ambest_sourced' AND rate_activity<>'rate_change'").fetchone()[0]
    bad_sub = con.execute(
        "SELECT COUNT(*) FROM filings_raw WHERE source='ambest_sourced' AND sub_type_of_insurance IS NOT NULL").fetchone()[0]
    bad_pdf = con.execute(
        "SELECT COUNT(*) FROM filings_raw WHERE source='ambest_sourced' AND source_pdf NOT LIKE 'AM Best%'").fetchone()[0]
    bad_key = con.execute(
        "SELECT COUNT(*) FROM filings_raw WHERE source='ambest_sourced' AND serff_tracking_number NOT LIKE 'AMB-%'").fetchone()[0]
    ok = bad_act == 0 and bad_sub == 0 and bad_pdf == 0 and bad_key == 0
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (14) AM Best row invariants: rate_activity!='rate_change' {bad_act}, "
          f"non-null sub_type {bad_sub}, bad source_pdf {bad_pdf}, non-AMB key {bad_key} (all expect 0)")

    # (15) AM Best surrogate keys collision-free: distinct (key,line) == rolled AM Best filings.
    amb_keys = con.execute(
        "SELECT COUNT(DISTINCT serff_tracking_number || '|' || line_of_business) FROM filings WHERE source='ambest_sourced'").fetchone()[0]
    ok = amb_keys == f_ambest
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (15) AM Best surrogate keys unique per (key,line): "
          f"{amb_keys} distinct == {f_ambest} rolled")

    # (16) no mixed-source rollup groups in filings_raw (the rollup guard already
    # fails loud; assert here too).
    mixed_src = con.execute("""
        SELECT COUNT(*) FROM (
            SELECT serff_tracking_number, line_of_business FROM filings_raw
            GROUP BY serff_tracking_number, line_of_business
            HAVING COUNT(DISTINCT source) > 1)
    """).fetchone()[0]
    ok = mixed_src == 0
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (16) mixed-source rollup groups: expected 0, got {mixed_src}")

    print(f"  [INFO] AM Best rolled filings per state/line:")
    for st, lob, cnt in con.execute(
        "SELECT state, line_of_business, COUNT(*) FROM filings WHERE source='ambest_sourced' "
        "GROUP BY state, line_of_business ORDER BY state, line_of_business"):
        print(f"           {st} {lob}: {cnt}")
    print(f"  [INFO]  scraped multi-entity rollups: {multi_count} of {rolled_count} "
          f"({100*multi_count/rolled_count:.1f}%)  -- baseline 351 / 998 (~35.2%)")
    print("=" * 72)
    if failed:
        sys.exit("ONE OR MORE VERIFICATION CHECKS FAILED")
    print("ALL CHECKS PASSED")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", help="Path to all_states_final_rates.xlsx")
    ap.add_argument("--db", default=str(DEFAULT_DB), help="Output SQLite db path")
    args = ap.parse_args()

    xlsx_path = find_xlsx(args.xlsx)
    db_path = Path(args.db).resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Reading xlsx: {xlsx_path}")
    print(f"Writing db:   {db_path}")

    df = load_and_normalize(xlsx_path)
    print(f"Normalized {len(df)} scraped rows from sheet '{SHEET}'")
    amb = build_ambest_df()
    print(f"Built {len(amb)} AM Best interim rows for {AMBEST_STATES}")
    # Scraped FIRST so their ids (and the rollup order) are unchanged — keeps the
    # scraped baseline byte-identical; AM Best rows append after.
    df = pd.concat([df, amb], ignore_index=True)

    if db_path.exists():
        db_path.unlink()
    con = sqlite3.connect(db_path)
    try:
        con.execute("PRAGMA foreign_keys = ON")
        create_schema(con)
        with con:
            insert_raw(con, df)
            rolled, multi, warnings = rollup(con)
    finally:
        con.close()

    for w in warnings:
        print(w, file=sys.stderr)

    # last_updated reflects the *data* freshness (xlsx mtime), not today's
    # import-run date. The web app reads this and anchors the 12-month
    # active window to it (date(asOf, '-12 months')), which keeps queries
    # deterministic per data snapshot — they don't drift with the wall clock.
    data_asof = datetime.fromtimestamp(
        xlsx_path.stat().st_mtime, tz=timezone.utc
    ).date().isoformat()
    LAST_UPDATED_PATH.parent.mkdir(parents=True, exist_ok=True)
    LAST_UPDATED_PATH.write_text(data_asof + "\n", encoding="utf-8")
    print(f"Wrote {LAST_UPDATED_PATH.name}: {data_asof} (xlsx mtime, UTC)")

    con = sqlite3.connect(db_path)
    try:
        verify(con, rolled, multi)
    finally:
        con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
