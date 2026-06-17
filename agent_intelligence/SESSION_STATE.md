# Session checkpoint — 2026-06-16  ·  AM Best interim data for IL/OH/VA

The build is finished and live. We are in **iterate-and-deploy mode, not
building**.

- **Deployed (agent-intel/master): `d21fe1d`.** Monorepo `cc39a32`. All suites
  green (7 verify + 13 e2e), tsc clean, prod build 12/12.

## Latest iteration — AM Best interim data for IL/OH/VA (2026-06-16)

Added **596 AM Best interim filings** (IL 244, OH 158, VA 194) alongside the
**998 scraped** (13-brand, 10 states). IL/OH/VA render **identically to scraped
states — NO UI marker**. The distinction is **backend-only**:
- `source` column (`'serff_scraped'` | `'ambest_sourced'`) on both tables.
- Backend-only surrogate key `AMB-<ST>-<line>-md5(block_id|brand)` (block-stable,
  idempotent, collision-proof) — **stripped from UI AND API payload** via
  `toClientFiling` (relabeled "AM Best"; raw key never leaves the server).
- `build_ambest_df()` in `import_filings.py`: dedup → window-filter → premium-
  weighted rollup → fail-loud mixed-source guard. Source-aware `verify()` keeps
  the scraped baseline **byte-identical** (1,616/998/293, +93.70% anchor).
- Coverage: IL/OH/VA in `COVERED_STATES` + `AMBEST_STATES` + `states.ts
  source:'ambest'`. Methodology validation table stays **10 cross-checked**;
  interim shown separately (37 not covered).
- **Design + replacement path: `docs/AMBEST_INTERIM.md`.** Replace when scraped:
  `DELETE … WHERE source='ambest_sourced'` → import scrape → re-rollup.
- Cross-cutting state (WAF/quiet period/scraper) lives in the scraper repo's
  `output/resume_state.md`. SERFF quiet period active until **2026-06-21**;
  the June-21 cold-capacity read decides whether to upgrade IL/OH/VA interim→real.

## Latest iteration — GA+NM data expansion + 13 brands + rate-neutral suppression (2026-06-16)

Big data + scope expansion of the rate-filing product (NOT the compliance
briefing — that's the prior iteration, still intact). The source xlsx was
re-collected with Georgia + New Mexico added and the effective-date floor pushed
back a year. Everything below was reconciled against an independent read-only
recon of the source before any build change, then re-keyed.

### 🔒 New verification baseline (REPLACES 468/314)

- **1,616 raw → 998 rolled → 293 active-window** (12mo from data as-of
  **2026-06-11**; `rate_change`/`rate_change_pending`; eff ≥ 2025-06-11).
- **13 brands, 10 states** (was 8/8). Date range **2024–2026**.
- Anchor **+93.70% `SFMA-134315091`** (State Farm WA Homeowners) UNCHANGED.
- multi-entity rollups 351/998 (35.2%). 0 unmatched company_names.
- Prospect/Defend re-key (active window): Independent AZ+NV **13/9**, all-8
  **48/38**, all-10 **81/51**; Captive SF AZ+NV **12/7**, all-8 **40/28**;
  Captive Allstate AZ+NV **9/6**. GA-only Independent 27/7; NM-only 6/6.
- My Carriers (POST rate-neutral suppression, see below): SF+TRV AZ+NV **10**,
  SF+TRV+PRG AZ+CO+NV **26**, Allstate+Liberty+Safeco all-8 **78**, captive SF
  AZ+NV **6**.
- `import_filings.py` `verify()` is re-keyed to all of the above (raw/rolled/
  active/13-brand/10-state/anchor; GECC-134661852 rollup spot-check + 11 distinct
  sub_types still hold unchanged).

### ⚠️ Intentional-but-odd states — DO NOT "fix" these as bugs

1. **The 5 new carriers are GA-ONLY on data, on purpose.** Farmers, COUNTRY
   Financial, American Family, Nationwide, USAA were adopted with full brand
   plumbing (in `BRANDS`, so pickers/positioning/validation all flow from it),
   but the source only has their filings in Georgia so far. **Backfilling the
   existing 8 states with these 5 carriers is the next data task.** A WA agent
   authorizing Farmers seeing no WA Farmers data is EXPECTED, not a gap to fix.

2. **GA + NM render compliance as COMING-SOON even though they have rate data.**
   `data_coverage:true` governs rate-data selectability ONLY; the compliance
   briefing gate is `sectionsForState()` (WA/ID/UT only). Rate-data coverage ≠
   compliance coverage — this is the designed separation, not a missing wire.

3. **Rate-neutral (0.0%) filings are hidden from My Carriers + Overview only.**
   Many GA State Farm PPA filings are declared rate-NEUTRAL refiles (SERFF "Rate
   Change Type: Neutral" — verified against PDF `SFMA-134315020`: indicated
   15.3%/3.0% but implemented 0.0%). They're suppressed on the unfiltered
   own-carrier surfaces (`getMyCarriersFilings` adds `overall_rate_impact != 0`).
   Prospect/Defend exclude 0% via thresholds already; **Positioning and the
   coverage map are deliberately NOT filtered.** A "N rate-neutral filings (0.0%)
   hidden" note explains the count gap; the Overview footnote says "No recent
   **rate-moving** filings…". A carrier whose filings are ALL neutral shows the
   normal no-data empty state (NOT coverage-gap — it IS covered).

4. **Positioning is COVERAGE-AWARE.** A brand counts as a competitor in a cell
   only where we actually collect its data (`getBrandStateCoverage`). Without
   this the 5 GA-only brands registered as phantom "insufficient" competitors in
   every non-GA cell (insufficient jumped 29→79). Fixed → captive SF all-8 totals
   10/6/41/**23**/**18**/**25**; independent SF/TRV/PRG comparable **64**, higher
   **30** (independently reconciled, not rubber-stamped).

5. **Coverage-gap empty state is data-driven + self-healing.** A selectable brand
   with zero rows in the agent's state(s) shows "covers {states}, {state} coming"
   instead of silent emptiness; the note clears automatically once backfill lands
   a row (it reads `SELECT DISTINCT brand,state FROM filings`, which counts ALL
   rows incl. 0.0% — that's why neutral-only ≠ coverage-gap).

### Brand derivation (`derive_brand`) additions

- **Safeco affiliates** folded into Safeco by full legal name (consumer-facing
  Safeco companies Liberty owns post-2008): `general insurance company of
  america`, `first national insurance company of america`, `american states`.
  This was also REQUIRED to get WA importing again (2 WA 2024 rows broke it).
- **5 new carrier families:** USAA (`usaa`/`united services`/`garrison`),
  Farmers (`farmers`/`fire insurance exchange`/`mid-century`/`truck insurance
  exchange`), Nationwide, American Family (guards the Munich Re `american family
  home` NAIC-23450 collision), COUNTRY Financial.
- **Two collision guards (load-bearing — a wrong attribution silently corrupts
  Prospect/Defend):** Safeco rule matches the FULL "general insurance company of
  america" so "Nationwide General Insurance Company" → Nationwide; USAA is
  checked before any generic match so "USAA General Indemnity" → USAA.

### states.ts / coverage

- **GA + NM `data_coverage:true`.** Their `validated` flags' VALUES come from the
  AM Best cross-check logs — GA `{auto:true,home:true}` (PPA 92.8% / HO 94.3%),
  NM `{auto:true,home:true}` (PPA 97.3% / HO 88.2%) — but the ROWS themselves are
  fully scraped SERFF data (480 GA / 131 NM raw rows, all with scraped
  `source_pdf`, sub-types + withdrawn dispositions present). `validated` is a
  state/line CROSS-CHECK flag, NOT a "this data is AM Best-sourced" marker — no
  app row is AM Best data; the four-tier `external_validation` gradient isn't even
  imported. `constants.ts` `COVERED_STATES` → 10. Methodology text updated
  (2024–2026; 13 brands; "{50-n} states not covered"; newer/thinner-coverage note).

New lib: `src/lib/coverage.ts` (pure coverage-gap note), `getBrandStateCoverage`
+ `getMyCarriersNeutralHiddenCount` in `filings.ts`. `/api/filings` returns
`coverage` + `neutralHidden`. Monorepo `cd86a5c` → deploy `d3470cb`.

## Earlier iteration — Compliance briefing goes MULTI-STATE: +ID +UT (2026-06-16)

The compliance office briefing expanded beyond WA to **Idaho and Utah** via a
**per-state section model** — and in doing so PROVED the multi-state template
the remaining 5 covered states (AZ, CO, MT, NV, OR) will reuse.

- **Per-state section model** (`briefing.ts`): each built state declares its own
  ordered section list. `WA_SECTIONS` is the original 6 (incl. PFML + WA Cares),
  **unchanged** so WA renders exactly as before. `FEDERAL_DEFAULT_SECTIONS` (ID,
  UT) is 5 — wage, salary, leave, at-will, business tax — **no WA Cares**.
  `SECTIONS_BY_STATE` maps state→list; `sectionsForState()` /
  `salaryWarningForState()` / `isBriefingReady()` all key off it. A new state
  with its own structure (CO's salary threshold + FAMLI, OR regional wages) gets
  its own list — that's the whole extension point.
- **Honesty bar preserved on the new states.** ID/UT salary sections defer to the
  **federal FLSA** (no invented threshold figure); **UT at-will is intentionally
  left COMING-SOON** (no clean official Utah .gov source — grounding it weakly was
  rejected, per the WA bar); business tax framed as **income-on-net-profit**, not
  a B&O-style "your rate." UT business-tax guidance scopes the **$100 minimum to
  C-corps only** so it can't read as a universal obligation. Per-state salary
  warning names **L&I** (WA) vs the **U.S. DOL** (federal-default states).
- **Verified content.** The generated ID/UT summaries in `complianceData.ts` were
  produced under per-state generator guidance (`GUIDANCE_BY_STATE` in
  `generate_compliance.ts`) and checked; the UT business_tax entry in the tree is
  the corrected **entity-distinct** version (C-corp franchise + $100 min vs the
  4.5% individual flat rate on pass-through/sole-prop owners), not an early draft.
- **Coming-soon sections no longer assert size applicability.** The generic
  "Applies regardless of company size." note now renders **only on grounded
  sections** — a coming-soon section hadn't grounded that claim. (UT at-will, AZ
  blocks no longer show it.)
- **Not-yet-built states** (AZ/CO/MT/NV/OR + any non-covered employee state) still
  render the whole-state coming-soon block, surfaced not dropped — multi-state mix
  WA+ID+AZ confirmed: WA first (primary), ID its own block, AZ coming-soon.

Tests: new `verify_briefing_language.ts` runs the determination-language
blocklist over **WA+ID+UT** grounded content (guards that ID/UT meet WA's honesty
bar, not just WA); `verify_office_summary.ts` expectations updated for ID now
being briefing-ready (was the stale "only WA" world — no logic regression); new
`e2e_compliance` cases (ID-only, UT-only coming-soon at-will + no size note,
WA+ID+AZ mix). All green: tsc · 7 verify · e2e_compliance + e2e_nav · build 12/12.
Monorepo `a5c11a2` → deploy `50ef430`.

## Earlier checkpoint — 2026-06-02 (office summary + accordion)

- Monorepo `b3a94ac feat(compliance): office summary + accordion briefing`.
- **Deployed (agent-intel/master): `71d448c`** — in sync with the monorepo
  subtree at that checkpoint. All suites green (6 verify + 13 e2e).

## Latest iteration — Compliance office summary + accordion (2026-06-02, deployed)

Two new profile inputs feed a personalized office summary at the top of
`/compliance`, and the briefing is now a collapsed accordion.

- **Profile inputs:** `pay_type` (Hourly/Salary/Both) and `remote_count` (whole
  number, validated at entry to not exceed `employee_count`). Both required. Old
  saved profiles predate them: `loadProfile` stays tolerant; **`needsProfileUpgrade()`**
  drives a prompt (banner on `/setup`, upgrade card on `/compliance`) — never
  errors or wipes. New lib `src/lib/officeSummary.ts`; new verify
  `scripts/verify_office_summary.ts`.
- **Office summary** (`src/components/OfficeSummary.tsx`, above the disclaimer
  band): factual recap of the agent's inputs; **"Worth reviewing for your office"**
  relevance pointers (fact + their number, point at sections, NEVER a
  determination — blocklist-tested); and the **load-bearing out-of-state remote
  flag** (prominent amber callout, always visible, fires when remote workers are
  in states the WA briefing doesn't cover).
- **Accordion briefing:** each topic is an accessible accordion item (button +
  aria-expanded/aria-controls, chevron, keyboard-operable), collapsed by default,
  content in a `role=region` toggled via `hidden`. The **Salary** header carries a
  visible **"affects exempt status"** caution pill while collapsed; the full
  misclassification warning stays inside. The "not legal/tax advice" band stays
  sticky + always-visible.
- **Relevance links = primary nav into the briefing.** Expansion state lifted to
  `compliance/page.tsx`; clicking a pointer EXPANDS its target section then scrolls
  (rAF → `scrollIntoView`, honoring `scroll-mt-[88px]` so it lands below the sticky
  band) — never a collapsed empty row. No-dead-link rule intact:
  `briefingSectionAnchorId` only resolves when the target renders (no-WA profile →
  zero links; remote pointer has no section → plain text).

Structure/presentation only; no change to grounded summary content or
determination-language honesty. Monorepo `b3a94ac` → deploy `71d448c`.

## Earlier iteration — Overview: carrier-activity recent-filings card (2026-06-02, deployed)

Replaced the aggregated per-(brand,line,state) averages in the "Your carrier's
activity" card with a curated recent slice of the carrier's own INDIVIDUAL
filings. Selection order: (1) **coverage floor** — most-recent filing from each
licensed state the carrier filed in (every filed state guaranteed ≥1 row);
(2) **fill** — next-most-recent by recency only, capped at `CARRIER_ACTIVITY_EXTRA
= 3` on top of the floor (busy state earns a 2nd row only after coverage);
(3) licensed states with no filings noted at the card foot ("No recent filings
from your carrier in: {states}", suppressed when the list is entirely empty —
the empty message covers that). Each row: carrier/line/sub-type, signed change,
state, effective date (with year), abbreviated policyholders — reusing
`formatEffectiveDate`/`formatPolicyholders`/`formatRateImpact`/`rateImpactColor`
+ `resolveSubtype` label cleanup. Added a "See all →" link to `/my-carriers`.
**No new query path** — same own-carrier set `/my-carriers` renders, a different
slice; reconciles by construction. `computeCarrierActivity(filings, licensedStates)`
now returns `{ rows: Filing[], noFilingStates: string[] }`.

Tests: `verify_overview` rewritten (reconciliation, coverage floor, floor/
no-filings partition, +3 cap, newest-first order); `e2e_overview` updated for
the row-based card + "See all" link + a captive-Progressive-all-8 case (floor +
ID/UT/WA no-filings note). Full suite green (5 verify + 13 e2e). Monorepo
`cde0c95` → deploy `cc7bf2a`.

## Earlier iteration — Methodology: Positioning section (2026-06-02, deployed)

Added a "How Rate Positioning compares carriers" section to `/methodology`
(between the thresholds and excluded-brands sections). Static documentation,
no logic change; facts sourced from the Feature 7 spec. Leads with the
load-bearing "rate changes, not prices" frame in the feature's own amber band
(`bg-amber-fill text-amber-text`), then documents the premium-weighted
computation (same active 12-month set as Prospect/Defend), the
higher-confidence vs thin tiering + anchored-cell / insufficient-data honesty
mechanics, and the sparsity limit. Deliberately omits the internal
verification counts (10/41/24) and phrases the null-premium fallback durably
rather than hardcoding "1 of 180." New section carries `data-testid=
"section-positioning"`. Monorepo `48cb173` → deploy `6e261ea`.

## Status: done

All 13 build-order steps + all polish complete; Features 7, 8, 9 shipped & live.

```
1–13  v1 build order + polish                       done (deployed)
+  Post-v1 iterations (all shipped & deployed):
    - effective-date year fix
    - left sidebar nav + Defend table polish
    - click-to-sort headers + three-state sort affordance
    - Recent Changes restyle + enriched feed; window-badge wrap fix
    - My Carriers opened to captives (singular "My Carrier")
    - "Your carrier's activity" Overview summary
    - Feature 7: Rate Positioning (/positioning)
    - Feature 8: Sub-type column + click-based info bubble (filings tables)
    - Feature 9: Compliance office briefing (/compliance)   ← newest
```

## Feature 9 — Compliance office briefing (complete, deployed)

Personalized grounded briefing at the top of `/compliance`, scoped to the
agent's employee states, ordered by primary state; the existing 8-topic card
grid stays below.

- **Grounded figures shown** (decision B, reversed from the earlier qualitative
  decision A): min wage $17.13 (2026, up from $16.66); overtime 1.5×; WA Cares
  0.58%; **insurance-commissions B&O rate 0.484%** (grounded via the DOR
  classifications page, framed for agencies + classification/confirm-with-DOR
  caveat). PFML & B&O *general* rates honestly deferred (not on the fetched
  pages — no number invented).
- **Salary/exempt threshold**: shows the formula for transparency
  (`2.25 × $17.13 × 40 = $1,541.70/week`, keeps "tiers currently match in 2026"),
  a **derived annual ≈$80,168/yr** computed in the UI as weekly × 52 (ties by
  construction), and its **own strong inline misclassification warning** (not
  the generic band). Its generic size-gate was dropped (tiers match this year);
  **PFML keeps its 50+ size-gate**.
- **Two-tier disclaimer**: top band covers staleness; the salary box carries the
  stronger figure-specific warning. **Per-section "as of {date}"** on each figure.
- **Source links** show a distinguishing path segment (e.g.
  `dor.wa.gov/…/business-occupation-tax-classifications`), not bare domain.
- **WA-complete.** All other employee states (covered-but-unmapped AND
  non-covered) render the honest **coming-soon** block — surfaced, not dropped.
  State expansion is a separate effort.

## ⏰ Standing maintenance obligation — regenerate compliance figures yearly

The Compliance **office briefing (Feature 9)** prints **live grounded figures**
(minimum wage, the overtime-exempt salary threshold, the WA Cares premium rate
0.58%, and the insurance-commissions B&O rate 0.484%). **These MUST be
regenerated at least once a year** — most WA figures reset on **January 1**
(the B&O rate changes by legislation, re-verify it each refresh). A stale
printed figure is the feature's main risk (the salary threshold can cause a
real misclassification).

Each January (and after any known mid-year change):
1. `ANTHROPIC_API_KEY=… npx tsx scripts/generate_compliance.ts --only WA/wage_hour,WA/salary_threshold,WA/leave,WA/wa_cares,WA/business_tax`
2. Verify the new numbers against the official source pages.
3. Commit + subtree-push → redeploy.

The UI shows a per-section "as of {last_checked}" date so staleness is visible,
but that does not remove the obligation to refresh. (Spec: Feature 9 →
"Standing maintenance obligation".)

## Live deployment

- **Live URL:** https://agent-intelligence-sigma.vercel.app/
- **Deploy source of truth:** GitHub `AceVon3/agent_intelligence` (private),
  branch `master`, at `7bc5bf8`.
- **Host:** Vercel project connected to that repo (project Root Directory =
  repo root `/`; auto-builds on push to master).
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

## Test suites — all green at acd848c (5 verify + 13 e2e)

verify_queries · verify_profile · verify_overview · verify_positioning · verify_subtype
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
