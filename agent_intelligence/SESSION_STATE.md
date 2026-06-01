# Session checkpoint — 2026-06-01  ·  v1 COMPLETE & DEPLOYED

The build is finished and live. We are now in **iterate-and-deploy mode,
not building**.

- Monorepo HEAD: `43e07ea feat(positioning): Rate Positioning page`.
- **Deployed (agent-intel/master): `7bc5bf8`** — the subtree-split equivalent
  of monorepo `43e07ea`. All suites green at this commit.

## Status: done

All 13 build-order steps complete; all polish complete; Feature 7 (Rate
Positioning) shipped and live.

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
12. Polish (empty states, skeleton, token consolidation,
    icon self-host, mobile, badge audit)           done
13. Deploy to Vercel                                DONE (live)
+  Post-v1 iterations (all shipped & deployed):
    - effective-date year fix
    - left sidebar nav + Defend table polish
    - click-to-sort headers + three-state sort affordance
    - Recent Changes restyle + enriched feed
    - window-badge wrap fix
    - My Carriers opened to captives (singular "My Carrier")
    - Feature 7: Rate Positioning (/positioning)    ← newest
```

## Live deployment

- **Deploy source of truth:** GitHub `AceVon3/agent_intelligence` (private),
  branch `master`, at `7bc5bf8`.
- **Host:** Vercel project connected to that repo (project Root Directory =
  repo root `/`; auto-builds on push to master). The exact live URL is the
  subdomain Vercel assigned the project — confirm in the Vercel dashboard
  (intentionally not guessed here).
- **No env vars** required in prod (`ANTHROPIC_API_KEY` is offline-regen only).
- **Runtime DB tracing:** `/api/filings`, `/api/positioning`, and
  `/methodology` read `data/filings.db` / `last_updated.txt` at request time.
  They are force-included via `experimental.outputFileTracingIncludes` in
  `next.config.mjs` (next@14.2.x). **Any NEW dynamic route that reads the db
  MUST be added there or it 500s in prod (invisible at build time).**

## Deploy workflow (two-repo topology — read before shipping)

This working copy is the **monorepo** `AceVon3/browser-games`, project under
`agent_intelligence/`. The deploy repo has the project at its root.

To ship a change:
1. Commit in the monorepo (paths `agent_intelligence/...`).
2. `git subtree push --prefix=agent_intelligence agent-intel master`
   (from the monorepo root; remote `agent-intel` → the standalone repo).
3. Vercel auto-builds `master`.

Do NOT plain-`git push` to `agent-intel` (path layouts differ). After each
deploy, update this file and subtree-push it so the deploy repo's record
matches.

## Test suites — all green at 7bc5bf8 (4 verify + 13 e2e)

verify_queries · verify_profile · verify_overview · verify_positioning
e2e: setup · prospect · defend · my-carriers · overview · compliance · nav ·
methodology · filters · empty_states · skeleton · mobile · positioning

- e2e_*.ts run against a running dev server:
  `npm run dev` then `E2E_BASE=http://localhost:3000 npx tsx scripts/e2e_<name>.ts`.
- verify_*.ts are node-only (no browser). **verify_positioning is the Feature 7
  answer-key gate** — captive State Farm all-8 must produce 10 anchored /
  6 unanchored / 41 comparable / 24 higher-confidence / 17 thin / 29
  insufficient; independent {SF,Travelers,Progressive} → 69 / 34. If these
  drift, the positioning query diverged from recon.

---

_History below is the original build log, retained for reference._

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
3. **Step 13: deploy to Vercel** — IN PROGRESS. Deploy-prep done; the
   Vercel project setup is the next live action (do together).

### Deploy-prep (2026-05-29)

Readiness verified before any Vercel action:
- **SQLite**: `db.ts` opens readonly; `data/filings.db` +
  `data/last_updated.txt` committed (240K / 12B).
- **No runtime env vars needed.** `@anthropic-ai/sdk` is imported only
  in `scripts/generate_compliance.ts` (offline regen), never in `src/`.
  Compliance page reads the committed `complianceData.ts`. So Vercel
  needs NO env vars; `ANTHROPIC_API_KEY` is only for local regen.
- **`npm run build` clean** (next@14.2.35; 11/11 pages).
- **File-tracing fix applied** (commit below): empty `next.config.mjs`
  had no `outputFileTracingIncludes`, so the runtime `process.cwd()`
  reads of `data/` would NOT be bundled into the Vercel lambdas →
  guaranteed 500s, invisible at build. Added
  `experimental.outputFileTracingIncludes` (experimental-scoped for
  14.2.x; top-level is Next 15) mapping `/api/filings` →
  filings.db + last_updated.txt, `/methodology` → last_updated.txt.
  **Verified from `.nft.json` trace manifests** that both files are
  traced and the relative entries resolve to the real files — proven,
  not inferred from a green build.

### GitHub repo created (2026-05-29)

Pushed to a NEW dedicated repo: **`AceVon3/agent_intelligence`**
(private, default branch `master`). The project lives at the REPO ROOT
there (package.json at `/`), extracted from this monorepo subdir via
`git subtree split --prefix=agent_intelligence` — full 26-commit history
preserved. `data/filings.db` (240K) + `last_updated.txt` confirmed
present on the remote.

**Two-repo topology now in play.** This working copy is still the
monorepo (`AceVon3/browser-games`) with the project under
`agent_intelligence/`. The standalone deploy repo has it at root.
- Remote `agent-intel` → the standalone repo.
- Push future changes with:
  `git subtree push --prefix=agent_intelligence agent-intel master`
  (run from the monorepo root). Do NOT plain-`git push` to agent-intel.

Still TODO (live, do together):
- Vercel project: connect **`AceVon3/agent_intelligence`**. Because the
  project is now at the repo root, **Root Directory = `/`** (NOT
  `agent_intelligence` — that note applied to the old monorepo plan).
- Connect repo + deploy. No env vars needed.

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
