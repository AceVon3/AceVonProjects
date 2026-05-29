# Session checkpoint — 2026-05-28

Snapshot at end of session so the next session can pick up cleanly.
Most-recent commit: `44a486b polish(mobile): responsive layout at 375x800`.

## Where we are in the build

Spec `## Build order` step 12 is in progress. Item 5 of the polish bundle
(12.b) just shipped; **item 6 is next**.

```
1. Scaffold                            done
2. import_filings.py                   done
3. db.ts + filings.ts + queries        done
4. /setup (ProfileForm + localStorage) done
5. FilingsTable + /prospect            done
6. /defend                             done
7. /my-carriers                        done
8. Overview                            done
9. /compliance                         done
10. NavBar + ScopeStrip                done
11. /methodology                       done
12. Polish:
    a. PINNED: live compliance generation gate    CLEARED (commit daa484b)
    b. Cosmetic polish bundle:
       1. Empty states (filtered vs no-data)      done (commit af07177)
       2. Loading skeleton                        done (commit 78c2573)
       3. Tailwind token consolidation            done (commit 1de3061)
       4. Tabler icon resilience (self-host)      done (commit db1dc00)
       5. Mobile layout (375×800)                 done (commit 44a486b)
       6. Badge color audit                       NEXT
13. Deploy to Vercel                              after 12.b.6
```

## Decisions logged from end of item 5

User answered three open items from the mobile-layout report:

1. **Tap targets at 28–30px: accepted.** The filter chips (30px) and
   the state checkbox option rows (28px) clear WCAG AA per the user's
   reading; not changing them to a touch-only size. Desktop info
   density preserved.

2. **SERFF row tooltip + entity-spread `i` info dot: accepted as
   desktop-only.** Both surface via the `title` attribute, which
   doesn't fire on touch. v1 audience is desk-bound; agents on mobile
   look up the SERFF number via carrier+state+impact if needed.
   Revisit if mobile usage data later warrants surfacing.

3. **Tailwind cache gotcha → CLAUDE.md.** Added (this commit) under a
   new "## Gotchas" section so the next bulk-className edit doesn't
   hit a stale `.next` cache for the third time.

## Outstanding verification (pending, low-priority)

**Info-dot circular `i` glyph visibility on mobile.** Surfaced as a
question during item 5 reporting. Not yet visually verified.

What's known without re-checking:
- The dot is a styled `<span>` with text "i", NOT the Tabler iconfont
  — so font-load failure does NOT affect rendering.
- The dot lives in the Impact column (column 4 of the 7-column table).
  At 375px the table scrolls horizontally with `min-w-[900px]`, so the
  Impact column (and therefore the dot) is OFF-SCREEN by default and
  requires a horizontal scroll to see.

What still needs verification:
- A mobile screenshot scrolled to the Impact column to confirm the
  circular background + italic "i" actually render as intended (the
  shape, not just the text). Easy: in `scripts/e2e_mobile.ts`, scroll
  the table to the right and screenshot the Impact column region.

Take a few minutes at the top of the next session to run this check.
Likely fine; flagging so it isn't forgotten.

## Remaining work

1. **Info-dot mobile check** (above) — quick visual confirmation.
2. **Item 6: badge color audit** — sweep all badges across all pages,
   confirm every (fill, text) pair uses the design-system color family
   (e.g. `bg-green-fill` always pairs with `text-green-text`, no
   mismatched cross-family usage). Now that tokens are consolidated in
   `tailwind.config.ts`, this should be a fast grep-driven sweep.
3. **Step 13: deploy to Vercel.**

## Launch-blocker status

12.a (compliance generation gate) was the only pinned launch blocker.
**Cleared at commit `daa484b`**:
- `scripts/generate_compliance.ts` ran against the live Anthropic API
  with a real key.
- WA `wage_hour` and WA `leave` generated summaries were independently
  verified against the fetched source pages — every factual claim
  traced to source content, no fabrications.
- Fetch-fail fallback test passed (typed URL → entry absent from
  `complianceData.ts`, no invented content).
- DOR business-licensing URL fixed (the old one 404'd).
- Refusal-detection added to the generator so models that decline to
  ground a topic store `title/summary: null` and render the
  coming-soon card variant.

No other launch blockers tracked.

## Regression state

All 12 E2E suites pass at the most-recent commit:
  setup · prospect · defend · my-carriers · overview · compliance ·
  nav · methodology · filters · empty_states · skeleton · mobile

Verification harnesses kept in `scripts/`:
- `verify_queries.ts`, `verify_profile.ts`, `verify_overview.ts` (Node
  unit-style, no browser).
- `e2e_*.ts` (Playwright, headless chromium, against a running dev
  server).
- `screenshot_pages.ts` (full-page before/after PNG snapshots into
  `polish/`, gitignored).

## Dev environment quirks

- Two non-default ports may still be held by background processes; use
  `Get-NetTCPConnection -LocalPort @(3000..3010) -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
  to clear them if 3000 is busy at start.
- Tailwind cache: see `## Gotchas` in `agent_intelligence/CLAUDE.md`.

## Working-tree state at checkpoint

- `agent_intelligence/`: clean.
- The rest of the repo (`baseball_model_v1/`, root `Test`): pre-existing
  dirty state from before this session, not touched here.
