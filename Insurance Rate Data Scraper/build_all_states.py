"""Concatenate per-state final-rates workbooks into all_states_final_rates.xlsx."""
from pathlib import Path
import openpyxl

STATES = ["ID", "WA", "CO"]
OUT = Path("output/all_states_final_rates.xlsx")


def main() -> None:
    src_paths = [Path(f"output/{s.lower()}_final_rates.xlsx") for s in STATES]
    for p in src_paths:
        if not p.exists():
            raise SystemExit(f"missing input: {p}")

    out_wb = openpyxl.Workbook()
    out_ws = out_wb.active
    out_ws.title = "rate_filings"

    header = None
    per_state_counts: dict[str, int] = {}
    total = 0
    for state, path in zip(STATES, src_paths):
        wb = openpyxl.load_workbook(path, read_only=True)
        ws = wb.active
        rows = ws.iter_rows(values_only=True)
        hdr = next(rows)
        if header is None:
            header = list(hdr)
            out_ws.append(header)
        elif list(hdr) != header:
            raise SystemExit(f"header mismatch in {path}: {hdr}")
        n = 0
        for r in rows:
            out_ws.append(list(r))
            n += 1
        per_state_counts[state] = n
        total += n
        wb.close()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out_wb.save(str(OUT))

    print(f"wrote {OUT} with {total} rows")
    for s, n in per_state_counts.items():
        print(f"  {s}: {n}")


if __name__ == "__main__":
    main()
