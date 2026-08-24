# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

US property & casualty insurance agents, in two audiences served **equally** (confirmed 2026-08-24 — neither leads product decisions):

- **Captive agents** (State Farm, Allstate, etc.): one carrier, use *competitors'* rate increases to prospect and watch their own carrier's changes to defend their book.
- **Independent agents / agency principals**: multiple carriers, use filings to win business (Prospect), retain it (Defend), and track their appointed lineup (My Carriers — independent-only feature).

Situation: an agent checking "what just moved in my market" across their licensed states — before a sales push, when a client calls about a rate hike, or via the monthly email digest.

## Product Purpose

AgencyMan.ai turns public state rate-filing data (SERFF and state DOI sources) into sales signals for agents: which carriers just raised rates (prospect their customers), which cut or raised on the agent's own book (defend it), and what compliance obligations apply per state. Success is agents habitually returning to the dashboard and opening the monthly digest — engagement, not revenue (see Positioning).

## Positioning

The only agent-facing tool that translates regulatory rate filings into "who to call and why." A competitor could scrape the same public data, but the product's mechanism is the translation layer: premium-weighted multi-entity rollups to consumer-facing brands, captive/independent visibility logic, and pre-generated per-state compliance summaries.

**Commercial position (confirmed 2026-08-24): permanently free, presented as paid.** The product is priced as "AgencyMan Pro — $14.99/mo," but every user receives a free access code and no card fields exist anywhere. This is deliberate and durable: the price anchors perceived value so users feel they got a great deal. Design must keep the product *looking and feeling* worth $14.99 — and must never add real billing, card fields, or scarcity mechanics that would break the "everyone gets the code" promise. "Launch offer" wording on the funnel is locked copy.

## Operating Context

- Data arrives via an offline scraper/import pipeline (separate project in the monorepo): Python import script → SQLite committed to the repo. The app never fetches filing data live.
- Compliance summaries and digest content are **pre-generated** offline and shipped as data files; never composed at view time.
- Monthly email digest is live with **manual review-before-send staging** (cron removed; bookmarkable trigger); replies route to the monitored support inbox. Sent via Resend.
- Accounts: Clerk auth + Neon Postgres profiles (JSONB per user), dormant without env keys; localStorage remains a fast-paint cache.
- Production deploys go through the dedicated repo `AceVon3/agent_intelligence` (import commits only), live at https://agencyman.ai on Vercel — not the monorepo origin.

## Capabilities and Constraints

Surfaces: marketing landing `/` + `/checkout` (public funnel); app: Overview (Mover / Next 30 / Momentum modules), Prospect, Defend, My Carriers (independents only), Compliance (50-state), Positioning (dumbbell chart live), Setup (agent profile), Methodology. Brand Health (4 pillars: Price / Website / Sentiment / Search) is built but **excluded from production**.

- Coverage: 48 states imported (CA/NY/TX via non-SERFF sources; FL still pending). 13 customer-facing brands. Coverage expands over time — never hardcode state or brand counts in UI copy.
- Signal thresholds: Prospect ≥ +5%, Defend ≤ −2%, 12-month lookback — defined once in constants.
- Stack (fixed): Next.js 14 App Router + TypeScript + Tailwind; SQLite via better-sqlite3 with raw SQL (no ORM); Vercel hosting.
- `spec.md` is the behavior/logic authority; note its verification numbers and CLAUDE.md's date from the 8-state/8-brand era and are stale as hard checks.
- Explicitly undecided: Signals quadrant v2 (company 2×2) is preview-only, paused awaiting Ryan's call; digest ↔ compliance-regen pairing still open.

## Brand Commitments

- Name: **AgencyMan.ai** (plan name "AgencyMan Pro"). Red accent `#C42127`; brand marks at `public/brand/agencyman-mark-red.svg` / `-white.svg`.
- Tagline in production: "Know every rate move in your market."
- Pricing-funnel copy locked: "$14.99" anchor, "launch offer" wording, no card fields ever.
- Email digest follows the established card visual language (per Ryan's approved screenshot, commit 691ac3d).

## Evidence on Hand

- Real filing data: ~10.6k raw rows / ~6.7k rolled-up filings / ~2.3k active-window signals as of 2026-08 (counts grow with refreshes).
- Every rate number traces to a public regulatory filing; values are parsed from filings, **never estimated or guessed**.
- No testimonials, case studies, customer logos, or usage stats exist — marketing surfaces must not fabricate them.

## Product Principles

1. **Real filings only.** Every number on screen traces to a public regulatory filing. No estimates, no invented data, no fabricated social proof.
2. **Signals, not data dumps.** Translate filings into "who to call and why" — the agent's next action, framed correctly for captive vs. independent.
3. **Feel worth $14.99.** The product is free for everyone, so polish and perceived value are the pricing mechanism. Design quality is load-bearing.
4. **Captive/independent parity.** Every feature must resolve sensibly for both agent types; visibility logic is core product behavior, not a filter.
5. **Pre-generate the expensive parts.** Compliance summaries, digests, and derived signals are built offline and shipped as data — the app stays fast and cheap.
