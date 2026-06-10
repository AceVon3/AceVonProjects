"""Offline test of the _submit_search diagnostics wrapper (no SERFF, no browser).

Drives _submit_search with a fake Page that reproduces the exact historical
failure (Begin-Search link Locator.click timeout) and asserts:
  1. the exception still PROPAGATES (caller semantics unchanged),
  2. a ledger row is written with outcome=begin_search_link_timeout,
  3. a failure snapshot (snapshot.json + page.html) is dumped,
  4. with DIAG_DIR=None nothing is written and the exception still propagates.
"""
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import src.search as search

CLICK_TIMEOUT_MSG = (
    'Locator.click: Timeout 30000ms exceeded.\n'
    'Call log:\n  - waiting for get_by_role("link", name=re.compile(r"begin\\s*search", re.IGNORECASE)).first\n'
)


class FakeLoc:
    def __init__(self):
        self.first = self

    def click(self, **kw):
        raise Exception(CLICK_TIMEOUT_MSG)


class FakePage:
    url = "https://filingaccess.serff.com/sfa/home/GA"

    def on(self, *a, **kw): pass
    def remove_listener(self, *a, **kw): pass
    def goto(self, *a, **kw): return None
    def get_by_role(self, *a, **kw): return FakeLoc()
    def title(self): return "SERFF Filing Access - fake"
    def evaluate(self, *a, **kw): return "fake body text"
    def content(self): return "<html>fake wall page</html>"


TMP = Path("output/serff_diagnostics_test")
shutil.rmtree(TMP, ignore_errors=True)

# --- case 1: DIAG enabled, exception propagates, artifacts written ---
search.DIAG_DIR = TMP
raised = False
try:
    search._submit_search(FakePage(), "GA", "allstate")
except Exception as e:
    raised = "Locator.click" in str(e)
assert raised, "exception must still propagate to callers"

ledger = TMP / "search_ledger.csv"
assert ledger.exists(), "ledger row must be written"
lines = ledger.read_text(encoding="utf-8").strip().splitlines()
assert lines[0].startswith("timestamp,state,term,outcome"), lines[0]
assert ",GA,allstate,begin_search_link_timeout," in lines[1], lines[1]

snaps = sorted(TMP.glob("fail_*"))
assert snaps, "failure snapshot dir must exist"
snap_json = (snaps[0] / "snapshot.json").read_text(encoding="utf-8")
assert '"begin_search_link_timeout"' in snap_json
assert "fake body text" in snap_json
assert (snaps[0] / "page.html").read_text(encoding="utf-8") == "<html>fake wall page</html>"
print("case 1 OK: exception propagated; ledger + snapshot.json + page.html written")
print(f"  ledger row: {lines[1]}")

# --- case 2: DIAG disabled — pure passthrough, nothing written ---
shutil.rmtree(TMP, ignore_errors=True)
search.DIAG_DIR = None
raised = False
try:
    search._submit_search(FakePage(), "GA", "allstate")
except Exception:
    raised = True
assert raised and not TMP.exists(), "DIAG off: propagate, write nothing"
print("case 2 OK: DIAG_DIR=None is a pure passthrough")

# --- case 3: classification table sanity ---
cases = {
    "net::ERR_CONNECTION_TIMED_OUT at https://...": "connection_error",
    "page.goto: Timeout 30000ms exceeded.": "navigation_timeout",
    CLICK_TIMEOUT_MSG: "begin_search_link_timeout",
    "Locator.click: Timeout 30000ms exceeded. waiting for #simpleSearch": "other_timeout",
}
for msg, expect in cases.items():
    got = search._classify_exception(Exception(msg))
    assert got == expect, f"{msg[:40]!r}: got {got}, expected {expect}"
print("case 3 OK: exception classification table")

print("\nALL DIAGNOSTICS TESTS PASS (offline, no SERFF)")
