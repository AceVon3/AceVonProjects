"""Reusable import-gate verifier for interim->real state imports.

This HARDENS the surgical-import step the way the search-term audit hardened the
harvest: it proves, mechanically, that moving one state from AM Best interim
(source='ambest_sourced') to a real SERFF scrape (source='serff_scraped') changed
NOTHING except that one state. Generalized from the HI import (2026-07-01); every
future interim->real import (the VA/OH/IL/WV/NH/VT/HI pattern) should run it.

WHAT IT PROVES (the gate):
  - every OTHER scraped state is byte-identical (id-excluded content hash on BOTH
    filings_raw and filings, plus row counts AND active counts — the as-of pin);
  - the AM Best PERMANENT states (CA/NY/TX) are untouched;
  - every scraped invariant (raw / rolled / states / active) grew by EXACTLY the
    imported state's contribution — nothing more (no silent double-count / drift);
  - the imported state flipped ambest_sourced -> serff_scraped with 0 interim rows
    left behind.
No writes. Pure inspection of data/filings.db.

USAGE (run capture on BOTH sides of the import, then diff for a named state):
  python scripts/import_gate_verify.py capture > before.json   # BEFORE import
  python scripts/import_gate_verify.py capture > after.json     # AFTER  import
  python scripts/import_gate_verify.py diff before.json after.json HI

DB location: resolved from (1) $AGENT_FILINGS_DB, else (2) the first existing of a
few candidates relative to this file — so it works whether run from the app repo
(scripts/ next to data/) or a tooling-mirror checkout. Override with the env var.
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
from pathlib import Path


def _resolve_db() -> Path:
    env = os.environ.get("AGENT_FILINGS_DB")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    candidates = [
        here.parent.parent / "data" / "filings.db",              # app repo: scripts/ next to data/
        here.parent / "data" / "filings.db",
        here.parent.parent / "agent_intelligence" / "data" / "filings.db",  # monorepo-relative
        Path.cwd() / "data" / "filings.db",
    ]
    for c in candidates:
        if c.exists():
            return c
    sys.exit("FATAL: filings.db not found. Set $AGENT_FILINGS_DB or run from the app repo. "
             f"Tried: {[str(c) for c in candidates]}")


DB = _resolve_db()
AS_OF = (DB.parent / "last_updated.txt").read_text().strip()


def _cols(con, table):
    return [r[1] for r in con.execute(f"PRAGMA table_info({table})")]


def _state_hash(con, table, state, cols):
    """id-excluded content hash of all rows for a state, order-independent."""
    use = [c for c in cols if c != "id"]
    rows = con.execute(
        f"SELECT {', '.join(use)} FROM {table} WHERE state=? ", (state,)
    ).fetchall()
    lines = sorted("|".join("" if v is None else str(v) for v in r) for r in rows)
    h = hashlib.md5("\n".join(lines).encode("utf-8")).hexdigest()
    return h, len(rows)


def capture():
    con = sqlite3.connect(DB)
    raw_cols = _cols(con, "filings_raw")
    rolled_cols = _cols(con, "filings")

    out = {"as_of": AS_OF, "db_md5": hashlib.md5(DB.read_bytes()).hexdigest()[:8]}

    out["raw_by_source"] = dict(con.execute(
        "SELECT source, COUNT(*) FROM filings_raw GROUP BY source").fetchall())
    out["rolled_by_source"] = dict(con.execute(
        "SELECT source, COUNT(*) FROM filings GROUP BY source").fetchall())

    states = sorted(r[0] for r in con.execute("SELECT DISTINCT state FROM filings"))
    out["states"] = {}
    for st in states:
        src = sorted(set(r[0] for r in con.execute(
            "SELECT source FROM filings WHERE state=?", (st,))))
        rh, rn = _state_hash(con, "filings_raw", st, raw_cols)
        fh, fn = _state_hash(con, "filings", st, rolled_cols)
        active = con.execute(
            """SELECT COUNT(*) FROM filings
               WHERE state=? AND source='serff_scraped'
                 AND rate_activity IN ('rate_change','rate_change_pending')
                 AND effective_date >= date(?, '-12 months')""",
            (st, AS_OF)).fetchone()[0]
        out["states"][st] = {
            "sources": src, "raw_hash": rh, "raw_n": rn,
            "rolled_hash": fh, "rolled_n": fn, "active": active,
        }

    q = lambda sql: con.execute(sql).fetchone()[0]
    out["inv"] = {
        "raw_scraped": q("SELECT COUNT(*) FROM filings_raw WHERE source='serff_scraped'"),
        "rolled_scraped": q("SELECT COUNT(*) FROM filings WHERE source='serff_scraped'"),
        "distinct_states_scraped": q("SELECT COUNT(DISTINCT state) FROM filings WHERE source='serff_scraped'"),
        "distinct_brands_scraped": q("SELECT COUNT(DISTINCT brand) FROM filings WHERE source='serff_scraped'"),
        "distinct_subtype_scraped": q("SELECT COUNT(DISTINCT sub_type) FROM filings WHERE sub_type IS NOT NULL AND source='serff_scraped'"),
        "active_scraped": q(f"""SELECT COUNT(*) FROM filings WHERE source='serff_scraped'
               AND rate_activity IN ('rate_change','rate_change_pending')
               AND effective_date >= date('{AS_OF}','-12 months')"""),
        "raw_ambest": q("SELECT COUNT(*) FROM filings_raw WHERE source='ambest_sourced'"),
        "rolled_ambest": q("SELECT COUNT(*) FROM filings WHERE source='ambest_sourced'"),
    }
    con.close()
    print(json.dumps(out, indent=2, sort_keys=True))


PERMANENT = ("CA", "NY", "TX")  # AM Best permanent (non-SERFF) — must never move


def diff(before_path, after_path, state):
    state = state.upper()
    b = json.loads(Path(before_path).read_text())
    a = json.loads(Path(after_path).read_text())
    print(f"IMPORT-GATE VERIFY — state={state}")
    print(f"AS-OF: before={b['as_of']} after={a['as_of']}  "
          f"{'OK (pinned)' if b['as_of']==a['as_of'] else 'FAIL — WINDOW SLID'}")
    print(f"DB md5: {b['db_md5']} -> {a['db_md5']}")

    print(f"\n=== PRIOR SCRAPED STATES (all except {state}) — byte-identical proof ===")
    prior = [s for s in b["states"] if "serff_scraped" in b["states"][s]["sources"] and s != state]
    all_ident = True
    for st in sorted(prior):
        bs, as_ = b["states"][st], a["states"].get(st, {})
        ident = (bs["raw_hash"] == as_.get("raw_hash") and bs["rolled_hash"] == as_.get("rolled_hash")
                 and bs["raw_n"] == as_.get("raw_n") and bs["rolled_n"] == as_.get("rolled_n")
                 and bs["active"] == as_.get("active"))
        all_ident &= ident
        if not ident:
            print(f"  [FAIL] {st}: before {bs} != after {as_}")
    print(f"  {'[OK] all %d prior scraped states BYTE-IDENTICAL (raw+rolled hash, counts, active)' % len(prior) if all_ident else '[FAIL] see above'}")

    print("\n=== CA/NY/TX AM Best permanent — intact? ===")
    for st in PERMANENT:
        bs, as_ = b["states"].get(st, {}), a["states"].get(st, {})
        ident = bs.get("raw_hash") == as_.get("raw_hash") and bs.get("rolled_hash") == as_.get("rolled_hash")
        print(f"  [{'OK' if ident else 'FAIL'}] {st}: raw_n {bs.get('raw_n')}->{as_.get('raw_n')} "
              f"rolled_n {bs.get('rolled_n')}->{as_.get('rolled_n')} sources={as_.get('sources')}")

    print(f"\n=== {state}: ambest -> serff_scraped flip ===")
    bh, ah = b["states"].get(state, {}), a["states"].get(state, {})
    print(f"  before: sources={bh.get('sources')} raw_n={bh.get('raw_n')} rolled_n={bh.get('rolled_n')} active={bh.get('active')}")
    print(f"  after:  sources={ah.get('sources')} raw_n={ah.get('raw_n')} rolled_n={ah.get('rolled_n')} active={ah.get('active')}")

    print(f"\n=== SCRAPED INVARIANTS — delta == EXACTLY {state}? ===")
    st_raw, st_rolled, st_active = ah.get("raw_n", 0), ah.get("rolled_n", 0), ah.get("active", 0)
    for k in ("raw_scraped", "rolled_scraped", "distinct_states_scraped", "distinct_brands_scraped",
              "distinct_subtype_scraped", "active_scraped", "raw_ambest", "rolled_ambest"):
        bv, av = b["inv"][k], a["inv"][k]
        print(f"  {k:26s} {bv:6d} -> {av:6d}   (delta {av-bv:+d})")
    print(f"\n  {state} contributes: raw={st_raw}  rolled={st_rolled}  active={st_active}")
    checks = [
        (f"raw_scraped grew by exactly {state} raw", a["inv"]["raw_scraped"] - b["inv"]["raw_scraped"] == st_raw),
        (f"rolled_scraped grew by exactly {state} rolled", a["inv"]["rolled_scraped"] - b["inv"]["rolled_scraped"] == st_rolled),
        (f"active_scraped grew by exactly {state} active", a["inv"]["active_scraped"] - b["inv"]["active_scraped"] == st_active),
        ("states +1", a["inv"]["distinct_states_scraped"] - b["inv"]["distinct_states_scraped"] == 1),
        ("brands unchanged", a["inv"]["distinct_brands_scraped"] == b["inv"]["distinct_brands_scraped"]),
        (f"{state} ambest rows removed (rolled_ambest dropped)", a["inv"]["rolled_ambest"] < b["inv"]["rolled_ambest"]),
        (f"{state} now serff_scraped only", ah.get("sources") == ["serff_scraped"]),
        (f"0 {state} ambest remaining", "ambest_sourced" not in ah.get("sources", [])),
    ]
    print()
    ok_all = True
    for label, ok in checks:
        ok_all &= ok
        print(f"  [{'OK' if ok else 'FAIL'}] {label}")
    print(f"\n{'>>> ALL GATES PASS' if (ok_all and all_ident) else '>>> GATE FAILURE — STOP'}")
    sys.exit(0 if (ok_all and all_ident) else 1)


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "capture":
        capture()
    elif len(sys.argv) >= 5 and sys.argv[1] == "diff":
        diff(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        sys.exit(__doc__)
