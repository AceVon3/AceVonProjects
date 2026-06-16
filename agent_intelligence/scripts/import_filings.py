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
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent

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
    if "liberty" in n:
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
            source_pdf TEXT
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
        ))
    con.executemany("""
        INSERT INTO filings_raw (
            state, brand, company_name, line_of_business, sub_type_of_insurance,
            overall_rate_impact, overall_indicated_change,
            maximum_percent_change, minimum_percent_change,
            written_premium_change, policyholders_affected,
            written_premium_for_program, rate_activity, serff_tracking_number,
            disposition_status, effective_date, filing_date, source_pdf
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)


def rollup(con: sqlite3.Connection) -> tuple[int, int, list[str]]:
    """Build filings from filings_raw. Returns (rolled_count, multi_entity_count, warnings)."""
    cur = con.execute("""
        SELECT serff_tracking_number, line_of_business, state, brand,
               company_name, overall_rate_impact, written_premium_for_program,
               policyholders_affected, rate_activity, effective_date, filing_date,
               disposition_status, sub_type_of_insurance
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
            "disposition_status": row[11], "sub_type": row[12],
        })

    inserts = []
    multi_count = 0
    warnings: list[str] = []

    for (serff, lob), entries in groups.items():
        states = {e["state"] for e in entries}
        brands = {e["brand"] for e in entries}
        if len(states) > 1:
            sys.exit(f"FATAL: serff={serff} lob={lob} spans states {sorted(states)}")
        if len(brands) > 1:
            sys.exit(f"FATAL: serff={serff} lob={lob} spans brands {sorted(brands)}")

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
            entity_names, rep["disposition_status"], sub_type,
        ))

    con.executemany("""
        INSERT INTO filings (
            serff_tracking_number, state, brand, line_of_business,
            overall_rate_impact, rate_activity, effective_date, filing_date,
            entity_count, total_policyholders, total_written_premium,
            min_entity_impact, max_entity_impact, entity_names, disposition_status,
            sub_type
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, inserts)

    return len(inserts), multi_count, warnings


def verify(con: sqlite3.Connection, rolled_count: int, multi_count: int) -> None:
    print()
    print("=" * 72)
    print("VERIFICATION (against spec.md import-level numbers)")
    print("=" * 72)
    failed = False

    raw = con.execute("SELECT COUNT(*) FROM filings_raw").fetchone()[0]
    ok = raw == 1616
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (1) filings_raw rows: expected 1616, got {raw}")

    null_brand = con.execute("SELECT COUNT(*) FROM filings_raw WHERE brand IS NULL").fetchone()[0]
    ok = null_brand == 0
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (2) unmatched company_name: expected 0, got {null_brand}")

    rolled = con.execute("SELECT COUNT(*) FROM filings").fetchone()[0]
    ok = rolled == 998
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (3) filings (rolled) rows: expected 998, got {rolled}")

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

    null_sub = con.execute("SELECT COUNT(*) FROM filings WHERE sub_type IS NULL").fetchone()[0]
    print(f"  [INFO] (6b) filings with NULL sub_type: {null_sub} (expected 0 today)")

    distinct_sub = con.execute(
        "SELECT COUNT(DISTINCT sub_type) FROM filings WHERE sub_type IS NOT NULL"
    ).fetchone()[0]
    ok = distinct_sub == 11
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (6c) distinct sub_type in filings: expected 11, got {distinct_sub}")

    # (7) brand & (8) state coverage after the 2026-06 expansion.
    n_brands = con.execute("SELECT COUNT(DISTINCT brand) FROM filings").fetchone()[0]
    ok = n_brands == 13
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (7) distinct brands: expected 13, got {n_brands}")

    n_states = con.execute("SELECT COUNT(DISTINCT state) FROM filings").fetchone()[0]
    ok = n_states == 10
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (8) distinct states: expected 10, got {n_states}")

    # (9) active window (12mo from data as-of; rate_change/_pending) + anchor.
    # Anchors to data/last_updated.txt (xlsx mtime), exactly as the web app does.
    as_of = LAST_UPDATED_PATH.read_text(encoding="utf-8").strip()
    active = con.execute(
        """SELECT COUNT(*) FROM filings
           WHERE rate_activity IN ('rate_change', 'rate_change_pending')
             AND effective_date >= date(?, '-12 months')""",
        (as_of,),
    ).fetchone()[0]
    ok = active == 293
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (9) active-window filings (as of {as_of}): "
          f"expected 293, got {active}")

    anchor = con.execute(
        """SELECT serff_tracking_number, brand, state, overall_rate_impact
           FROM filings
           WHERE rate_activity IN ('rate_change', 'rate_change_pending')
             AND effective_date >= date(?, '-12 months')
           ORDER BY overall_rate_impact DESC LIMIT 1""",
        (as_of,),
    ).fetchone()
    serff, brand, state, impact = anchor
    ok = (serff == "SFMA-134315091" and abs(impact - 93.70) < 0.05
          and brand == "State Farm" and state == "WA")
    failed |= not ok
    print(f"  [{'OK' if ok else 'FAIL'}] (10) max active impact: expected "
          f"+93.70% SFMA-134315091 State Farm WA, got +{impact:.2f}% {serff} {brand} {state}")

    print(f"  [INFO]  multi-entity rollups: {multi_count} of {rolled_count} "
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
    print(f"Normalized {len(df)} rows from sheet '{SHEET}'")

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
