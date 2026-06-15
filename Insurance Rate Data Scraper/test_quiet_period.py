"""Offline tests for the quiet-period guard (Workstream 2a). 0 SERFF traffic.

Creates and removes its own quiet_period.json; restores any pre-existing one.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import src.quiet_period as qp

_failures: list[str] = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' — ' + detail) if detail and not cond else ''}")
    if not cond:
        _failures.append(name)


def run():
    # back up any real quiet file so the test never clobbers a live rest window
    backup = None
    if qp.QUIET_FILE.exists():
        backup = qp.QUIET_FILE.read_text(encoding="utf-8")
    try:
        qp.clear()
        # no window -> active() False, guard() no-op
        check("no window -> not active", qp.active()[0] is False)
        qp.guard("test")  # must not raise

        # active window
        rec = qp.start(14, "unit test rest")
        is_active, r = qp.active()
        check("start() -> active", is_active is True and r["reason"] == "unit test rest")
        check("end is ~14d after start",
              abs((datetime.fromisoformat(rec["end"]) - datetime.fromisoformat(rec["start"])) - timedelta(days=14)).total_seconds() < 2)

        # active() with injected past/future now
        check("active() False when now is past end",
              qp.active(now=datetime.fromisoformat(rec["end"]) + timedelta(seconds=1))[0] is False)

        # guard refuses (sys.exit 3) while active, no override
        os.environ.pop(qp.OVERRIDE_ENV, None)
        raised = None
        try:
            qp.guard("run_final_rates")
        except SystemExit as e:
            raised = e.code
        check("guard refuses with exit 3 while active", raised == 3, f"code={raised}")

        # override env bypasses
        os.environ[qp.OVERRIDE_ENV] = "1"
        bypassed = True
        try:
            qp.guard("run_final_rates")
        except SystemExit:
            bypassed = False
        os.environ.pop(qp.OVERRIDE_ENV, None)
        check("SERFF_QUIET_OVERRIDE=1 bypasses the guard", bypassed)

        # clear -> guard no-op again
        qp.clear()
        cleared_ok = True
        try:
            qp.guard("run_final_rates")
        except SystemExit:
            cleared_ok = False
        check("clear() -> guard no-op", cleared_ok and not qp.QUIET_FILE.exists())
    finally:
        if backup is not None:
            qp.QUIET_FILE.write_text(backup, encoding="utf-8")
        else:
            qp.clear()


if __name__ == "__main__":
    print("=== 2a: quiet-period guard ===")
    run()
    print(f"\n{'ALL PASS' if not _failures else 'FAILURES: ' + ', '.join(_failures)}")
    sys.exit(1 if _failures else 0)
