"""Offline unit tests for the download-path efficiency wins (Workstream 1).

    python test_recovery_harvest.py     # 0 SERFF traffic, no Playwright browser

Covers:
  1a  _batched_with_recovery — degradation-misses recovered at batch rate
      (re-pooled into fresh batches) BEFORE per-target; true not-founds fall
      through after a no-progress recovery round; harvest stop banks progress.
  1b  _HarvestEarlyGuard — warm-up, collapse detection, latch, disable.

The SERFF I/O is entirely behind the injected `run_batch_fn`, so these run
with a deterministic mock — no browser, no network.
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run_final_rates import _batched_with_recovery, _HarvestEarlyGuard


class MockSerff:
    """Deterministic stand-in for a batched search session.

    `succeed_on[id]` = the attempt number (1-based) on which that target's
    download succeeds; a target absent from the map NEVER succeeds (true
    not-found). A target with succeed_on=2 models a JSF-degradation miss: it
    fails its first batch attempt (contaminated session) and lands on a later
    fresh-batch retry. Records every (term, chunk) call for assertions."""

    def __init__(self, succeed_on: dict[str, int]):
        self.succeed_on = succeed_on
        self.attempts: dict[str, int] = defaultdict(int)
        self.calls: list[tuple[str, tuple]] = []

    def run_batch(self, term, chunk):
        self.calls.append((term, tuple(chunk)))
        misses = []
        for t in chunk:
            self.attempts[t] += 1
            need = self.succeed_on.get(t)
            if need is None or self.attempts[t] < need:
                misses.append(t)
        return misses


_failures: list[str] = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}{(' — ' + detail) if detail and not cond else ''}")
    if not cond:
        _failures.append(name)


# ---------------------------------------------------------------- 1a recovery
def test_degradation_miss_recovered_at_batch_rate():
    # 9 targets, one term, batch_size 8. D and I are degradation-misses
    # (succeed on attempt 2); the rest land first try.
    ids = list("ABCDEFGHI")
    succeed = {x: 1 for x in ids}
    succeed["D"] = 2
    succeed["I"] = 2
    m = MockSerff(succeed)
    remaining, stopped = _batched_with_recovery(
        ["term"], ids, batch_size=8, run_batch_fn=m.run_batch,
        recovery_rounds=1, log=lambda *_: None)
    check("degradation misses fully recovered (none left for per-target)",
          remaining == [] and stopped is False, f"remaining={remaining}")
    # Round0: chunk[A..H] + chunk[I] = 2 batches; Round1 re-pools [D, I] into ONE batch.
    check("recovery re-pooled D+I into a single fresh batch (8:1, not 1:1)",
          m.calls[-1][1] == ("D", "I"), f"last call={m.calls[-1]}")
    check("recovery used batches only (no per-target path inside)",
          len(m.calls) == 3, f"calls={len(m.calls)}")


def test_true_notfound_falls_through_and_recovery_stops():
    # Z never succeeds; recovery must not loop — one no-progress round then stop.
    m = MockSerff({"A": 1})  # Z absent => true not-found
    remaining, stopped = _batched_with_recovery(
        ["term"], ["A", "Z"], batch_size=8, run_batch_fn=m.run_batch,
        recovery_rounds=3, log=lambda *_: None)
    check("true not-found survives to per-target", remaining == ["Z"], f"remaining={remaining}")
    check("recovery stopped after a no-progress round (bounded, not 1+3 rounds)",
          len(m.calls) == 2, f"calls={len(m.calls)} (round0 + one no-progress recovery)")


def test_all_clean_single_pass():
    ids = list("ABCDE")
    m = MockSerff({x: 1 for x in ids})
    remaining, stopped = _batched_with_recovery(
        ["term"], ids, batch_size=8, run_batch_fn=m.run_batch,
        recovery_rounds=1, log=lambda *_: None)
    check("all-clean -> empty remaining, not stopped, single batch",
          remaining == [] and stopped is False and len(m.calls) == 1,
          f"remaining={remaining} calls={len(m.calls)}")


def test_recovery_disabled_is_legacy():
    # recovery_rounds=0 => misses go straight back (to per-target), no re-batch.
    m = MockSerff({"A": 1, "B": 2})
    remaining, stopped = _batched_with_recovery(
        ["term"], ["A", "B"], batch_size=8, run_batch_fn=m.run_batch,
        recovery_rounds=0, log=lambda *_: None)
    check("recovery_rounds=0 leaves the degradation-miss for per-target (legacy)",
          remaining == ["B"] and len(m.calls) == 1, f"remaining={remaining} calls={len(m.calls)}")


def test_harvest_stop_banks_and_defers():
    # 30 never-succeed targets; harvest trips after 2 all-miss batches.
    ids = [f"T{i}" for i in range(30)]
    m = MockSerff({})  # nothing ever lands
    guard = _HarvestEarlyGuard(min_batches=2, window=2, collapse_ratio=0.34)
    remaining, stopped = _batched_with_recovery(
        ["term"], ids, batch_size=8, run_batch_fn=m.run_batch,
        recovery_rounds=1, on_batch=guard.record,
        should_stop=guard.should_stop, log=lambda *_: None)
    check("harvest stop returns stopped_early=True", stopped is True)
    check("harvest stop defers the rest (all 30 still pending, none lost)",
          len(remaining) == 30, f"remaining={len(remaining)}")
    check("harvest stop happened early (<= 3 batches attempted, not all of them)",
          len(m.calls) <= 3, f"calls={len(m.calls)}")


# ---------------------------------------------------------------- 1b guard
def test_guard_warmup_no_stop():
    g = _HarvestEarlyGuard(min_batches=3, window=3, collapse_ratio=0.34)
    g.record(0, 8); g.record(0, 8)  # 2 collapsed batches, but still in warm-up
    check("no stop during warm-up (<min_batches)", g.should_stop() is False)


def test_guard_trips_on_collapse():
    g = _HarvestEarlyGuard(min_batches=3, window=3, collapse_ratio=0.34)
    g.record(8, 8); g.record(1, 8); g.record(0, 8)  # last window = 9/24 = 0.375...
    # tighten: make recent window clearly collapsed
    g2 = _HarvestEarlyGuard(min_batches=3, window=3, collapse_ratio=0.34)
    g2.record(8, 8); g2.record(0, 8); g2.record(0, 8)  # window=8/24=0.33 < 0.34
    check("trips when recent window collapses below ratio", g2.should_stop() is True)


def test_guard_healthy_never_stops():
    g = _HarvestEarlyGuard(min_batches=3, window=3, collapse_ratio=0.34)
    for _ in range(10):
        g.record(8, 8)  # full yield throughout
    check("healthy full-yield run never stops", g.should_stop() is False)


def test_guard_latches():
    g = _HarvestEarlyGuard(min_batches=2, window=2, collapse_ratio=0.34)
    g.record(0, 8); g.record(0, 8)
    first = g.should_stop()
    g.record(8, 8); g.record(8, 8)  # recovery after trip
    check("stop latches even if yield recovers", first is True and g.should_stop() is True)


def test_guard_disabled():
    g = _HarvestEarlyGuard(enabled=False, min_batches=1, window=1, collapse_ratio=0.99)
    g.record(0, 8); g.record(0, 8)
    check("disabled guard never stops", g.should_stop() is False)


if __name__ == "__main__":
    print("=== 1a: re-batched recovery ===")
    test_degradation_miss_recovered_at_batch_rate()
    test_true_notfound_falls_through_and_recovery_stops()
    test_all_clean_single_pass()
    test_recovery_disabled_is_legacy()
    test_harvest_stop_banks_and_defers()
    print("=== 1b: harvest-early guard ===")
    test_guard_warmup_no_stop()
    test_guard_trips_on_collapse()
    test_guard_healthy_never_stops()
    test_guard_latches()
    test_guard_disabled()
    print(f"\n{'ALL PASS' if not _failures else 'FAILURES: ' + ', '.join(_failures)}")
    sys.exit(1 if _failures else 0)
