"""Offline smoke for the batched download_all_pdfs refactor: NM is fully
cached, so every group short-circuits before any search — zero SERFF traffic,
but the new function signature, batch wiring and status vocabulary all run."""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

import run_final_rates as rf

targets, _ = rf.load_targets_search("NM")
statuses = rf.download_all_pdfs("NM", targets, batch_size=rf.DOWNLOAD_BATCH_SIZE)
cnt = Counter(statuses.values())
print(f"targets={len(targets)} statuses={dict(cnt)}")
assert len(statuses) == len(targets), "every target must get a status"
assert set(cnt) == {"cached"}, "NM fully cached -> no searches, no downloads"
print("SMOKE OK — batched download_all_pdfs wired correctly, 0 SERFF requests")
