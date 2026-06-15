"""Quiet-period guard (Workstream 2a).

A durable record of a declared SERFF rest window plus a guard that every
SERFF-touching entry point calls at startup, so an accidental "let me just try"
run cannot reset the IP-keyed WAF penalty clock and waste a multi-day rest.

0 SERFF traffic — this is a pure local file + wall-clock check.

CLI:
    python src/quiet_period.py start --days 14 --reason "decisive cold-read rest"
    python src/quiet_period.py status
    python src/quiet_period.py clear

Programmatic (entry points):
    from src.quiet_period import guard
    guard("run_final_rates")   # refuses (sys.exit 3) if a quiet window is active

Override (intentionally end the rest early): set env SERFF_QUIET_OVERRIDE=1,
or `python src/quiet_period.py clear`.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Repo-root file so the rest window is durable and visible (committed/synced).
QUIET_FILE = Path(__file__).resolve().parent.parent / "quiet_period.json"
OVERRIDE_ENV = "SERFF_QUIET_OVERRIDE"


def read() -> dict | None:
    if not QUIET_FILE.exists():
        return None
    try:
        return json.loads(QUIET_FILE.read_text(encoding="utf-8"))
    except Exception:
        return None


def start(days: int, reason: str, start_dt: datetime | None = None) -> dict:
    start_dt = start_dt or datetime.now()
    end_dt = start_dt + timedelta(days=days)
    rec = {
        "start": start_dt.isoformat(timespec="seconds"),
        "end": end_dt.isoformat(timespec="seconds"),
        "days": days,
        "reason": reason,
    }
    QUIET_FILE.write_text(json.dumps(rec, indent=2), encoding="utf-8")
    return rec


def clear() -> None:
    if QUIET_FILE.exists():
        QUIET_FILE.unlink()


def active(now: datetime | None = None) -> tuple[bool, dict | None]:
    """Return (is_active, record). is_active is True iff a window exists and now
    is before its end. `now` is injectable for testing."""
    rec = read()
    if not rec:
        return False, None
    now = now or datetime.now()
    try:
        end = datetime.fromisoformat(rec["end"])
    except Exception:
        return False, rec
    return now < end, rec


def guard(entry: str) -> None:
    """Call at the top of any SERFF-touching entry point. If a quiet period is
    active, print a loud banner and refuse to run (sys.exit 3) unless
    SERFF_QUIET_OVERRIDE=1 is set."""
    is_active, rec = active()
    if not is_active:
        if rec:
            print(f"[quiet] declared rest window ended {rec['end']} — '{entry}' clear to run.", flush=True)
        return
    override = os.environ.get(OVERRIDE_ENV) == "1"
    banner = (
        "\n" + "=" * 72 +
        f"\n  SERFF QUIET PERIOD ACTIVE - '{entry}' must NOT touch SERFF.\n"
        f"    started: {rec.get('start')}\n"
        f"    ends:    {rec.get('end')}\n"
        f"    reason:  {rec.get('reason')}\n"
        "  Running now resets the WAF penalty clock and wastes the rest.\n"
    )
    if override:
        print(banner + f"  {OVERRIDE_ENV}=1 set - OVERRIDING, proceeding anyway.\n" + "=" * 72, flush=True)
        return
    print(
        banner +
        f"  To intentionally end the rest: set {OVERRIDE_ENV}=1, or run\n"
        f"      python src/quiet_period.py clear\n" + "=" * 72,
        flush=True,
    )
    sys.exit(3)


def _main(argv) -> int:
    import argparse
    ap = argparse.ArgumentParser(description="Quiet-period (SERFF rest) control")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("start", help="declare a rest window")
    s.add_argument("--days", type=int, required=True)
    s.add_argument("--reason", required=True)
    sub.add_parser("status", help="show the current window")
    sub.add_parser("clear", help="end/remove the window")
    a = ap.parse_args(argv)
    if a.cmd == "start":
        rec = start(a.days, a.reason)
        print(f"quiet period set: {rec['start']} -> {rec['end']} ({a.days}d)\n  reason: {a.reason}")
        print("  SERFF entry points will now refuse to run until then "
              f"(override: {OVERRIDE_ENV}=1).")
    elif a.cmd == "status":
        is_active, rec = active()
        if not rec:
            print("no quiet period declared.")
        else:
            print(f"{'ACTIVE' if is_active else 'ended'}: {rec['start']} -> {rec['end']}\n  reason: {rec['reason']}")
    elif a.cmd == "clear":
        clear()
        print("quiet period cleared.")
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
