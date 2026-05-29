# Session checkpoint — 2026-05-29

Snapshot at end of session so the next session can pick up cleanly.
Most-recent commit: `72312ec verify(mobile): confirm multi-entity info-dot renders at 375px`.

## Where we are in the build

Spec `## Build order` step 12 is essentially complete. Polish bundle
(12.b) items 1–6 all shipped. **Step 13 (deploy to Vercel) is next** —
holding for user review before deploying.

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
       6. Badge color audit                       done (audit clean, no code change)
13. Deploy to Vercel                              NEXT (awaiting review)
```

## Item 6 — badge color audit (2026-05-29): CLEAN, no code change

Swept every `*-fill` / `*-text` usage across `src/` against the five
design-system color families in `tailwind.config.ts` (blue, green,
amber, red, gray). Findings:

- **All badge (fill, text) pairs are family-consistent.** Every pairing
  is stored as an inseparable class-pair string in a lookup map
  (`FilingsTable.BADGE_CLASS`, `RecentChanges.PILL_CLASS`,
  `ComplianceCard.TOPIC_TAG_CLASS`), so a cross-family mismatch is
  structurally impossible, not just absent.
- **Window/status badge logic matches the spec's per-page tables.**
  Verified `computeWindowBadge` (prospect/defend/my-carriers) and
  `computeStatusBadge` in `lib/format.ts` against the spec.
- **`amber` is the correct single token for the spec's "Yellow" AND
  "Orange" window-badge slots.** The design system (both
  `tailwind.config.ts` and the reference HTML) defines exactly 5 badge
  families — there is no separate orange/yellow token — so both
  semantic slots correctly resolve to `amber`. Confirmed: no
  orange/yellow tokens exist anywhere.
- **Status "Approved" = blue is intentional.** Spec prose says
  "green-ish," but the authoritative reference mockup
  (`ui-reference.html`) renders Approved as `b-blue`. Per the conflict
  rule (reference wins on appearance), blue is correct.
- Non-badge fills reviewed too: error/coverage banners use red
  fill+text (family-consistent; red is right for errors), and
  `CARD_URGENT` reuses `red-text` as a 2px danger border (intentional
  per spec; no `red-border` token exists).

### Decision: coverage-warning banner NOT implemented in v1 (2026-05-29)

Surfaced during the item-6 sweep: the spec's amber coverage-warning
banner ("{State} isn't covered yet. Showing your other states.",
spec → UI / design system → Coverage warning) has no implementation in
`src/`. **This is intentional, not a bug.** Two existing layers already
make the condition unreachable:
- the setup UI disables uncovered (`data_coverage: false`) states, and
- save-validation rejects any non-covered licensed state (the tamper
  guard from build step 4).

So an uncovered state in a saved profile can't occur in normal
operation — the banner would only fire on hand-edited `localStorage`.
Building display-time UI for a validation-unreachable condition isn't
worth it for v1. Revisit only if profile state ever becomes
server-sourced or shareable (a profile arriving without passing through
this app's save-validation). Recorded in spec.md "Resolved decisions".

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

## Outstanding verification — RESOLVED 2026-05-29

**Info-dot circular `i` glyph visibility on mobile — VERIFIED.**
Confirmed at 375×800 on `/prospect` (independent AZ+NV profile).

How: added a `[multi-entity info-dot]` block to `scripts/e2e_mobile.ts`
that sets the profile, loads `/prospect`, `scrollIntoViewIfNeeded()`s the
first `entity-spread-dot`, asserts its computed style, and saves a tight
clipped screenshot (`polish/mobile-info-dot.png`).

Results (all OK):
- 2 info-dots present in the table; first rolled up 3 entities
  (tooltip "Premium-weighted across 3 entities. Range: 1.0% to 10.6%.").
- Box 14×14, `border-radius: 9999px` (circular), background
  `rgb(241,239,232)` (`bg-soft`, filled — not transparent),
  `font-style: italic`, text content `"i"`, scrolled into the viewport
  horizontally, premium-weighted `title` present.
- **Visual confirmation:** the clipped PNG shows the circular gray dot
  with an italic serif "i" — the shape renders, not just the text.

As predicted, font-load state is irrelevant: the dot is a styled
`<span>` with a Georgia-serif inline style, not the Tabler iconfont.

## Remaining work

1. ~~Info-dot mobile check~~ — DONE (verified 2026-05-29, see above).
2. ~~Item 6: badge color audit~~ — DONE (2026-05-29, clean; see the
   "Item 6 — badge color audit" section above. No code change.)
3. **Step 13: deploy to Vercel** — the only remaining step. Awaiting
   user review before deploying.

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
