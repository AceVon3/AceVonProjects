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
from run_final_rates import (
    _batched_with_recovery, _HarvestEarlyGuard, _BeginSearchBudget, _SustainedWallStop,
    _NotFoundStop, _should_abort_batch)


class TermAwareSerff:
    """Like MockSerff but a target only lands under its assigned search TERM —
    models the wrong-term case (Encompass filings miss under `allstate`, land
    under `encompass`). `lands_under[id] = term`; absent ids never land."""

    def __init__(self, lands_under: dict[str, str]):
        self.lands_under = lands_under
        self.calls: list[tuple[str, tuple]] = []

    def run_batch(self, term, chunk):
        self.calls.append((term, tuple(chunk)))
        return [t for t in chunk if self.lands_under.get(t) != term]


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


# ------------------------------------------------------------ 1c burst cap
def test_burst_cap_stops_under_wall_and_defers():
    # 30 landable targets, batch_size 8 -> 4 batches needed. Budget caps at 3
    # Begin-Searches (one per batch here): stop after 3 batches, defer the rest.
    # Models a burst that stops UNDER the wall before any 405 (all mock targets
    # land — there is no wall in the mock; the CAP is what stops the run).
    ids = [f"T{i}" for i in range(30)]
    m = MockSerff({x: 1 for x in ids})
    budget = _BeginSearchBudget(3)

    def run_batch(term, chunk):
        budget.spend()              # each fresh-context batch = one Begin-Search
        return m.run_batch(term, chunk)

    remaining, stopped = _batched_with_recovery(
        ["term"], ids, batch_size=8, run_batch_fn=run_batch,
        recovery_rounds=1, should_stop=budget.exhausted, log=lambda *_: None)
    check("burst cap stops the run (stopped_early=True)", stopped is True)
    check("burst cap spent exactly the budget (3 Begin-Searches, not the full 4)",
          budget.count == 3, f"count={budget.count}")
    check("burst cap banked 24 landed, deferred the remaining 6 (partial, none lost)",
          len(remaining) == 6, f"remaining={len(remaining)}")
    # idempotent re-run (the NEXT burst): the deferred 6 complete under a fresh
    # budget — a capped run is partial, not corrupt; re-running converges.
    budget2 = _BeginSearchBudget(3)

    def run_batch2(term, chunk):
        budget2.spend()
        return m.run_batch(term, chunk)

    remaining2, stopped2 = _batched_with_recovery(
        ["term"], remaining, batch_size=8, run_batch_fn=run_batch2,
        recovery_rounds=1, should_stop=budget2.exhausted, log=lambda *_: None)
    check("next burst finishes the deferred set (idempotent, no corruption)",
          remaining2 == [] and stopped2 is False, f"remaining2={remaining2}")


def test_burst_cap_none_is_unlimited():
    ids = [f"T{i}" for i in range(20)]
    m = MockSerff({x: 1 for x in ids})
    budget = _BeginSearchBudget(None)

    def run_batch(term, chunk):
        budget.spend()
        return m.run_batch(term, chunk)

    remaining, stopped = _batched_with_recovery(
        ["term"], ids, batch_size=8, run_batch_fn=run_batch,
        recovery_rounds=1, should_stop=budget.exhausted, log=lambda *_: None)
    check("budget=None never stops (unlimited == prior behavior)",
          stopped is False and remaining == [], f"stopped={stopped} remaining={remaining}")
    check("budget=None.exhausted() is always False", budget.exhausted() is False)


def test_burst_cap_counts_recovery_searches():
    # The cap must count re-batched-recovery Begin-Searches too (total WAF spend),
    # not just round-0 batches. 9 targets, D+I are degradation-misses (succeed on
    # attempt 2). Round0 = 2 batches (spend->2); the recovery round re-pools [D,I]
    # = 1 more batch (spend->3). A cap of 2 must stop BEFORE the recovery search.
    ids = list("ABCDEFGHI")
    succeed = {x: 1 for x in ids}
    succeed["D"] = 2
    succeed["I"] = 2
    m = MockSerff(succeed)
    budget = _BeginSearchBudget(2)

    def run_batch(term, chunk):
        budget.spend()
        return m.run_batch(term, chunk)

    remaining, stopped = _batched_with_recovery(
        ["term"], ids, batch_size=8, run_batch_fn=run_batch,
        recovery_rounds=1, should_stop=budget.exhausted, log=lambda *_: None)
    check("cap counts recovery searches: stopped at 2, recovery search not fired",
          budget.count == 2 and stopped is True, f"count={budget.count} stopped={stopped}")
    check("the two degradation-misses are deferred (not lost) when cap pre-empts recovery",
          set(remaining) == {"D", "I"}, f"remaining={remaining}")


# ----------------------------------------------------- 1d sustained-wall stop
def test_wall_stop_trips_on_consecutive_walls():
    w = _SustainedWallStop(threshold=2)
    w.record(True); w.record(True)         # clean searches
    check("no stop while searches are clean", w.should_stop() is False)
    w.record(False)                         # one walled search
    check("no stop on a single wall (could be transient)", w.should_stop() is False)
    w.record(False)                         # second consecutive wall
    check("stop on 2 consecutive walled Begin-Searches", w.should_stop() is True)


def test_wall_stop_resets_on_clean_search():
    w = _SustainedWallStop(threshold=2)
    w.record(False)                         # one wall
    w.record(True)                          # a clean search resets the streak
    w.record(False)                         # one wall again (streak restarted)
    check("a clean search between walls resets the streak (no premature stop)",
          w.should_stop() is False)


def test_wall_stop_ignores_wrong_term_misses():
    # THE ordering-bug fix: a wrong-search-term still returns 200 (search OK) — only
    # its row-downloads miss. The wall stop keys on SEARCH success, so a long run of
    # clean (wrong-term) searches with zero landed downloads must NOT trip it.
    w = _SustainedWallStop(threshold=2)
    for _ in range(20):
        w.record(True)                      # every search succeeds (downloads may miss)
    check("wrong-term clean searches never trip the wall stop (no false bail)",
          w.should_stop() is False)


def test_wall_stop_disabled():
    w = _SustainedWallStop(threshold=None)
    for _ in range(10):
        w.record(False)
    check("threshold=None disables the wall stop", w.should_stop() is False)


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


# ------------------------------------------------- 2a harvest-early ORDERING fix
def test_wrong_term_first_recovers_under_later_term():
    # THE ordering bug: 8 targets land ONLY under term 'encompass'; term order is
    # ['allstate','encompass']. Round-0 'allstate' = all-miss (wrong term). With
    # harvest NOT in the mid-chunk should_stop (it's a post_pass_stop now), the run
    # MUST proceed to 'encompass' and recover all 8 — not bail on the wrong-term
    # collapse. (Pre-fix: harvest-as-should_stop bailed before 'encompass'.)
    ids = list("ABCDEFGH")
    m = TermAwareSerff({x: "encompass" for x in ids})
    guard = _HarvestEarlyGuard(min_batches=1, window=2, collapse_ratio=0.34)
    remaining, stopped = _batched_with_recovery(
        ["allstate", "encompass"], ids, batch_size=8, run_batch_fn=m.run_batch,
        recovery_rounds=1, on_batch=guard.record,
        should_stop=None,                     # wall/budget only would go here (none in this mock)
        post_pass_stop=guard.should_stop,     # harvest judged only AFTER all terms
        log=lambda *_: None)
    check("wrong-term-first group fully recovers under the later term (no false bail)",
          remaining == [] and stopped is False, f"remaining={remaining} stopped={stopped}")
    check("both terms ran ('allstate' miss then 'encompass' land)",
          [c[0] for c in m.calls][:2] == ["allstate", "encompass"], f"calls={[c[0] for c in m.calls]}")


def test_post_pass_stop_banks_only_after_full_pass():
    # 30 never-land targets. With harvest as post_pass_stop (not mid-chunk), the
    # full batched+recovery pass runs, THEN harvest trips post-pass -> stopped_early
    # banks and defers the rest. Confirms the stop still happens (just correctly
    # ordered) and nothing is lost.
    ids = [f"T{i}" for i in range(30)]
    m = MockSerff({})  # nothing ever lands
    guard = _HarvestEarlyGuard(min_batches=2, window=2, collapse_ratio=0.34)
    remaining, stopped = _batched_with_recovery(
        ["term"], ids, batch_size=8, run_batch_fn=m.run_batch,
        recovery_rounds=1, on_batch=guard.record,
        should_stop=None, post_pass_stop=guard.should_stop, log=lambda *_: None)
    check("post-pass harvest trips after the full pass (stopped_early=True)", stopped is True)
    check("post-pass stop defers all 30 (none lost)", len(remaining) == 30, f"remaining={len(remaining)}")


def test_post_pass_stop_none_is_legacy():
    # post_pass_stop=None -> never post-pass-stops (prior behavior preserved).
    ids = [f"T{i}" for i in range(20)]
    m = MockSerff({})  # all miss, but no stop hooks at all
    remaining, stopped = _batched_with_recovery(
        ["term"], ids, batch_size=8, run_batch_fn=m.run_batch,
        recovery_rounds=1, should_stop=None, post_pass_stop=None, log=lambda *_: None)
    check("post_pass_stop=None never stops (legacy): all deferred, stopped=False",
          stopped is False and len(remaining) == 20, f"stopped={stopped} remaining={len(remaining)}")


# --------------------------------------------------------- 2b not-found stop
def test_notfound_stop_trips_on_consecutive_notfounds():
    nf = _NotFoundStop(threshold=8)
    for _ in range(7):
        nf.record(search_ok=True, found=False)
    check("no stop below threshold (7 < 8)", nf.should_stop() is False)
    nf.record(search_ok=True, found=False)
    check("stop on 8 consecutive genuine not-founds", nf.should_stop() is True)


def test_notfound_stop_resets_on_found():
    nf = _NotFoundStop(threshold=3)
    nf.record(search_ok=True, found=False)
    nf.record(search_ok=True, found=False)
    nf.record(search_ok=True, found=True)   # a found row resets the streak
    nf.record(search_ok=True, found=False)
    check("a found row resets the not-found streak (no premature stop)",
          nf.should_stop() is False)


def test_notfound_stop_ignores_walls():
    # A 405 wall is NOT a not-found — wall-stop owns it; not-found-stop must ignore.
    nf = _NotFoundStop(threshold=3)
    for _ in range(10):
        nf.record(search_ok=False, found=False)
    check("walls never trip the not-found stop (wall-stop owns 405s)", nf.should_stop() is False)


def test_notfound_stop_transient_then_found():
    # A couple of transient misses then a found (recovered under a later term) must
    # NOT trip — only a sustained genuine-not-found tail does.
    nf = _NotFoundStop(threshold=8)
    nf.record(search_ok=True, found=False)
    nf.record(search_ok=True, found=False)
    nf.record(search_ok=True, found=True)
    check("transient misses that recover don't trip the not-found stop",
          nf.should_stop() is False)


def test_notfound_stop_disabled():
    nf = _NotFoundStop(threshold=None)
    for _ in range(20):
        nf.record(search_ok=True, found=False)
    check("threshold=None disables the not-found stop", nf.should_stop() is False)


# --------------------------------------------------- 2c front-of-batch grace
def test_batch_front_grace_tolerates_front_misses():
    # 2 misses at the FRONT (no success yet) must NOT abort (the OH State Farm B6
    # fix); a dead session (front_grace consecutive, still no success) DOES abort.
    check("2 front misses, no success yet -> no abort (grace)",
          _should_abort_batch(2, seen_success=False) is False)
    check("front_grace (4) consecutive misses, no success -> cold abort (dead session)",
          _should_abort_batch(4, seen_success=False) is True)


def test_batch_degradation_abort_default_preserved():
    # After a success, the original 2-consecutive degradation abort is unchanged.
    check("success then 2 consecutive misses -> degradation abort (default)",
          _should_abort_batch(2, seen_success=True) is True)
    check("success then 1 miss -> no abort (below threshold, default)",
          _should_abort_batch(1, seen_success=True) is False)


def test_batch_front_then_success_then_degrade():
    # Models the full OH State Farm shape: front misses tolerated, then a success
    # arms the degradation abort at the normal threshold again.
    check("3 front misses (no success) still under grace -> no abort",
          _should_abort_batch(3, seen_success=False) is False)
    check("after a success, 2 misses -> abort (degradation signature restored)",
          _should_abort_batch(2, seen_success=True) is True)


if __name__ == "__main__":
    print("=== 1a: re-batched recovery ===")
    test_degradation_miss_recovered_at_batch_rate()
    test_true_notfound_falls_through_and_recovery_stops()
    test_all_clean_single_pass()
    test_recovery_disabled_is_legacy()
    test_harvest_stop_banks_and_defers()
    print("=== 1c: burst Begin-Search cap ===")
    test_burst_cap_stops_under_wall_and_defers()
    test_burst_cap_none_is_unlimited()
    test_burst_cap_counts_recovery_searches()
    print("=== 1d: sustained-wall stop (ordering-bug fix) ===")
    test_wall_stop_trips_on_consecutive_walls()
    test_wall_stop_resets_on_clean_search()
    test_wall_stop_ignores_wrong_term_misses()
    test_wall_stop_disabled()
    print("=== 1b: harvest-early guard ===")
    test_guard_warmup_no_stop()
    test_guard_trips_on_collapse()
    test_guard_healthy_never_stops()
    test_guard_latches()
    test_guard_disabled()
    print("=== 2a: harvest-early ORDERING fix (post_pass_stop) ===")
    test_wrong_term_first_recovers_under_later_term()
    test_post_pass_stop_banks_only_after_full_pass()
    test_post_pass_stop_none_is_legacy()
    print("=== 2b: not-found stop (coverage-gap tail) ===")
    test_notfound_stop_trips_on_consecutive_notfounds()
    test_notfound_stop_resets_on_found()
    test_notfound_stop_ignores_walls()
    test_notfound_stop_transient_then_found()
    test_notfound_stop_disabled()
    print("=== 2c: front-of-batch grace ===")
    test_batch_front_grace_tolerates_front_misses()
    test_batch_degradation_abort_default_preserved()
    test_batch_front_then_success_then_degrade()
    print(f"\n{'ALL PASS' if not _failures else 'FAILURES: ' + ', '.join(_failures)}")
    sys.exit(1 if _failures else 0)
