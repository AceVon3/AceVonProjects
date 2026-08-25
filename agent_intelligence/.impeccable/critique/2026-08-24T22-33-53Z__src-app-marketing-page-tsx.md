---
target: the landing page
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-24T22-33-53Z
slug: src-app-marketing-page-tsx
---
# Critique — AgencyMan.ai marketing landing (`src/app/(marketing)/page.tsx`)

Method: dual-agent (A: design review · B: detector/browser evidence). Detector clean (verified non-vacuous); browser evidence limited to SSR HTML (no JS execution, no overlay injection).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Nav auth CTAs render nothing server-side; they mount only after Clerk's external script loads |
| 2 | Match System / Real World | 4 | Fluent agent language; jargon explained in place |
| 3 | User Control and Freedom | 3 | Anchors both ways; no back-to-top on the long lower page |
| 4 | Consistency and Standards | 3 | Pricing eyebrow uses nonexistent `.kicker` class (unstyled); "Browse the Compliance Hub" links to /setup |
| 5 | Error Prevention | 3 | Hardcoded "49 states" literal in price-feats vs MARKETED_STATE_COUNT elsewhere |
| 6 | Recognition Rather Than Recall | 3 | Mid-page "Get started →" lands on /checkout before price is shown |
| 7 | Flexibility and Efficiency | 2 | ≤560px hides `.link-quiet` — returning mobile users have no sign-in path from the nav |
| 8 | Aesthetic and Minimalist Design | 3 | Signal Red used decoratively (stat numbers, timeline discs, checkmarks) against the One Alarm Rule |
| 9 | Error Recovery | 3 | If Clerk's script is blocked, the nav CTA never appears; no fallback |
| 10 | Help and Documentation | 3 | Methodology linked twice; no support/contact link anywhere |
| **Total** | | **30/40** | **Good (75%)** |

## Design Specificity Verdict

**Authored, not interchangeable (9/10).** The hero "imagery" is a bespoke signal panel populated with real verification-set values (State Farm AZ+NV, Prospect 13 / Defend 8, GEICO +50.9% NV with 13.3k policyholders) — product truth as the hero visual, honoring the no-fabrication constraint. Copy is fluently in-audience ("your book gets quietly shopped", "be the call they get first") with thresholds injected from constants. Deterministic scan: **zero findings** on both landing and checkout (engine verified non-vacuous with a planted-defect file). Static HTML is structurally sound: single h1, clean h1→h2→h3 order, labeled promo input, no empty hrefs, zero inline styles. Detector-only catches: /checkout reuses the landing's `<title>` verbatim; checkout page has no header/nav/footer landmarks (possibly intentional funnel focus). Suspected false positive: empty alt on the header logo mark (decorative, adjacent to wordmark text — correct practice). No overlay is visible in the browser; injection was not attempted (no browser automation in the assessment context).

## Overall Impression

A genuinely authored, disciplined landing page — one of the rare ones where the proof is real data. The conversion path is weaker than the presentation: the page's most persistent CTA depends entirely on an external script, and the "free with an agency code" conditional is never resolved for the codeless first-timer, which is every first-timer.

## What's Working

1. **Product-truth as hero imagery** — the `.signal-panel` mock uses real dataset numbers instead of a fake screenshot; specific, credible, honest.
2. **Audience-native copywriting** wired to constants so marketing numbers can't drift from product truth.
3. **Engineering-grade theming** — full light/dark parity, no-JS `prefers-color-scheme` fallback, `prefers-reduced-motion` handling, `:focus-visible` styling, reveal gated behind `html.lp-js`.

## Priority Issues

1. **[P1] Nav CTA depends entirely on Clerk's external script.** SSR HTML for `nav.nav-actions` contains only the theme button; Sign in / Get started mount client-side (from a `pk_test` dev-instance CDN). Blocked/slow script = no persistent CTA, plus layout shift. **Fix:** render static links as SSR default in `LandingAuthActions`, let Clerk swap after hydration; confirm prod key in prod build.
2. **[P1] The agency-code conditional is never resolved.** All three pricing mentions say "free with an agency code" but never how to get one. Codeless readers conclude it costs $14.99 or isn't for them — at the highest-stakes moment. **Fix (locked copy untouched):** one microcopy line near the price card: "Don't have one yet? You can request a code at checkout — no card required."
3. **[P2] Unstyled Pricing eyebrow** — `className="kicker"` (page.tsx:481) has no matching CSS rule; the page's most scrutinized section is the only one missing the signature red-rule eyebrow. **Fix:** one-word class change to `eyebrow`.
4. **[P2] "Browse the Compliance Hub" → `/setup`.** Label promises browsing, delivers a profile form (hero's hub link correctly goes to /compliance). **Fix:** point both at /compliance or relabel.
5. **[P2] Signal Red used decoratively** — 4 stat numbers, 3 timeline discs, 5 checkmarks, all eyebrows. The hero's +50.9% should be the loudest red on the page; it competes with 12+ ornamental reds. **Fix:** stats/checkmarks → ink/navy; keep eyebrows (identity) and panel signals.
6. **[P3] Hardcoded "49 states"** in the pricing bullet (elsewhere uses `MARKETED_STATE_COUNT`); one refresh cycle from a catchable lie.

## Persona Red Flags

**Jordan (first-timer):** stalls at "free with an agency code" with no path to a code; hesitates at the pre-price "Get started →"; "Premium-weighted, rolled up per filing" leads the hero panel unexplained; no support/contact anywhere.

**Riley (stress tester):** catches the self-contradiction — timeline step 1 says "no account to create" while the page ships Clerk sign-in and a checkout funnel; catches the /setup link mismatch; dead anchor `#get-started` referenced by nothing; with JS disabled the nav has no CTA at all despite the code's no-JS-safety claim.

**Casey (mobile):** at ≤560px Sign in/Open the app vanish from the nav entirely; Clerk on 3G delays the only remaining CTA; 38×38px theme button sits under the 44pt touch floor next to the primary CTA; no bottom-anchored action on a very long page.

## Minor Observations

- `.signal-panel` is `aria-hidden` — screen-reader users get none of the page's proof content; add an sr-only summary.
- No Open Graph/Twitter meta — shares to LinkedIn/Facebook agent groups (this audience's channels) get no card.
- /checkout reuses the landing `<title>` verbatim (detector catch) — tabs/history lose the distinction.
- Dark-theme #E8555B on #1D1D38 ≈ 4.6:1 — passes AA with no margin; watch 12.5px `.price-offer` text.
- Landing Defend sky-blue (#0369A1) differs from app Defend Blue (#1B6CA8) — sanctioned by the no-shared-tokens rule but a learnable-code mismatch.
- `autoComplete="off"` emitted camelCase in checkout SSR — harmless, worth a glance.

## Questions to Consider

1. If everyone gets the code, is the page braver keeping it mysterious (exclusivity) or granting permission ("every agency qualifies — grab your code at checkout")? Right now it gets neither.
2. Does the HR & Compliance Hub deserve co-equal hero billing, or is a retention feature being sold as an acquisition feature — costing the hero its single sharp claim?
3. The timeline still promises "no account to create." Leftover from the pre-Clerk era, or positioning the funnel no longer honors?
