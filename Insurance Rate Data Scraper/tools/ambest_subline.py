"""Wrapped-line-aware subsidiary-row matching for the AM Best report parsers.

THE ARTIFACT (found 2026-06-10, Phase 3): SUB_LINE_RE matches single text
lines, but long subsidiary names ("United Services Automobile Association",
"Farmers Group Property and Casualty Insurance Company", ...) wrap across
lines in the PDF text extraction. A wrapped row never matches, and when a
block's rows ALL fail, the parser emits one blank-subsidiary meta row —
losing the names AND the per-subsidiary values, and silently dropping those
entries from cross-check DENOMINATORS (USAA GA PPA: all 3 in-window entries
were blank-named -> corroboration unmeasured).

THE FIX: when a line doesn't match on its own, try joining it with the next
1-2 lines and re-matching. False joins are guarded by the regex itself — a
joined candidate must still satisfy the full strict row shape (^Name then
ind% imp% [$prem] pol $prem max% min% in order), which header/narrative
fragments cannot. Single-line matches behave exactly as before, so already-
captured rows are unchanged; the fix only RECOVERS rows that previously
fell through. Measurement-only: deliverable rate rows never touch this code.
"""
from __future__ import annotations

import re


def iter_subsidiary_matches(block: str, sub_line_re: re.Pattern,
                            max_join: int = 2) -> list[re.Match]:
    """All SUB_LINE_RE matches in the block, joining up to `max_join` wrapped
    continuation lines when a line doesn't match alone. Consumed continuation
    lines are skipped so a row is never emitted twice."""
    lines = [ln.strip() for ln in block.splitlines()]
    out: list[re.Match] = []
    i = 0
    while i < len(lines):
        m = sub_line_re.match(lines[i])
        if m:
            out.append(m)
            i += 1
            continue
        joined = lines[i]
        advanced = False
        for k in range(1, max_join + 1):
            if i + k >= len(lines):
                break
            joined = f"{joined} {lines[i + k]}"
            m = sub_line_re.match(joined)
            if m:
                out.append(m)
                i += k + 1
                advanced = True
                break
        if not advanced:
            i += 1
    return out
