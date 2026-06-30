"""HI Travelers 100-cap de-cap — date-windowed (searches only).

Travelers returned EXACTLY 100 raw / 0 in-target in the cold sweep (page-1 cap).
AM Best HI shows 0 Travelers in-target (Travelers is one of the 6 brands that do
not file in-scope personal lines in HI), so page-1 being all commercial is the
EXPECTED outcome — but a 100-cap is a cap, not a confirm. Date slices each return
<100 so pagination reaches any in-target personal lines hidden past the cap (the
OH/IL/VT Travelers precedent: de-cap before accepting Travelers as 0 in-target).
"""
from __future__ import annotations
from pathlib import Path
from src.config import OUTPUT_DIR
from src.output import write_excel
import src.search as search_mod
from src.search import search_all
from src.quiet_period import guard
guard("run_search")
search_mod.DIAG_DIR = Path("output/serff_diagnostics")
WINDOWS = [("07/01/2023","06/30/2024"),("07/01/2024","06/30/2025"),("07/01/2025","04/17/2026")]
out = Path(OUTPUT_DIR)/"hi_travelers_decap.xlsx"
allf={}
for dfrom,dto in WINDOWS:
    print(f"[hi-decap] Travelers {dfrom}->{dto}", flush=True)
    fs=search_all([("HI","Travelers")],date_from=dfrom,date_to=dto,fetch_submission_dates=False)
    for f in fs: allf[f.filing_id]=f
    print(f"  slice {dfrom}..{dto}: {len(fs)} rows; cumulative {len(allf)}", flush=True)
write_excel(list(allf.values()), out)
intt=sum(1 for f in allf.values() if getattr(f,'in_target_lines',False))
print(f"  Travelers de-capped: {len(allf)} distinct, {intt} in-target -> {out}", flush=True)
