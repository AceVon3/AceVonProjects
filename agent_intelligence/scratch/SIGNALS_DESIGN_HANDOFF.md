# Signals feature — design handoff brief

**How to use this file:** paste it (plus `signals_preview_v2.html`, the current
preview) into a Claude conversation and iterate on the design there. When you're
done, bring back a single self-contained HTML file (and any notes) — Claude Code
will port it into the app as real React/Tailwind components. Everything the
design conversation needs is in this one file; it has no access to the repo.

---

## What the product is

AgencyMan.ai turns state insurance rate filings (SERFF) into signals for
insurance agents. An agent sets up a profile (captive for one brand, or
independent with several carriers, plus licensed states) and the app shows:

- **Prospect** — competitors that RAISED rates ≥ +5% (their customers will shop;
  go win them)
- **Defend** — competitors that CUT rates ≤ −2% (your customers may shop; defend
  your book)
- **My Carriers** — the agent's own carriers' moves
- **Competitive Positioning** — per state, the agent's carrier's premium-weighted
  average rate change vs each competitor's, with an honesty tier (a comparison is
  "higher-confidence" only when BOTH sides have ≥ 2 filings; one-filing sides are
  "thin" and never get a computed spread)

## The feature being designed: "Signals"

A synthesis layer that turns all of the above into at-a-glance insights. The
engine is already built and computes real signals from the database. Two
surfaces:

1. **Overview dashboard strip** — recency-driven: what moved in the agent's
   states in the last 6 months (plus announced future changes).
2. **Positioning page strip** — derived strictly from the positioning comparison
   data shown below it on the same page.

**Direction already chosen by Ryan (the owner): GRAPHS, not text chips.**
The current preview (`signals_preview_v2.html`) implements:

- Overview → **diverging horizontal bar chart**: cuts pull left (blue),
  increases push right (brand red); hover gives the plain-English signal
  ("Defend in ID — Allstate filed −12.1% Homeowners…"); each bar click-throughs
  to the backing page (Defend / Prospect / My Carriers).
- Positioning → **dumbbell chart**: per state, red dot = agent's carrier
  premium-weighted avg change, blue dot = pooled competitor avg, connector =
  the spread. Hollow dot = one-filing side (thin data).

Design task: refine/evolve this visual direction. Layout, chart polish,
annotations, headline treatments, empty states, mobile behavior are all open.

## Real data to design with (never use lorem numbers)

All values below are real, computed from the live database, **as of Aug 10,
2026**, for a captive **State Farm** agent licensed in AZ, CO, ID, MT, NV, OR,
UT, WA. Data refreshes monthly.

### Overview strip (recency-ranked, 6-month window, cap 6)

| Signal | Detail | Links to |
|---|---|---|
| Defend in ID | Allstate filed −12.1% Homeowners, effective Apr 14, 2026 (+4 more recent cuts) | Defend |
| Defend in AZ | COUNTRY Financial filed −11.7% Personal Auto, effective Jul 23, 2026 (+8 more recent cuts) | Defend |
| Price pressure on Allstate | 9 recent increases — largest +20.1% (MT Homeowners), effective Apr 6, 2026 | Prospect |
| State Farm trending up | +93.7% in WA Homeowners, effective Apr 15, 2026 (7 recent increases) — the agent's OWN carrier | My Carriers |
| Defend in NV | Liberty Mutual filed −9.2% Homeowners, effective Aug 1, 2026 | Defend |
| Price pressure on Safeco | 6 recent increases — largest +11.0% (CO Personal Auto), effective Jul 1, 2026 | Prospect |

Note the **+93.7%** is a real filing and will dominate any linear axis — the
current preview clips the bar and labels the true value. Better ideas welcome.

### Positioning dumbbell (Personal Auto, trailing 12 months)

| State | You (State Farm) | filings | Market avg (competitors) | filings |
|---|---|---|---|---|
| CO | −7.7% | 3 | −1.7% | 21 |
| NV | +2.7% | 4 | +6.2% | 27 |
| UT | −3.9% | 4 | −0.4% | 13 |
| AZ | −3.0% | 5 | −0.4% | 29 |
| ID | −4.6% | 3 | −2.0% | 15 |
| OR | −2.6% | 4 | −1.1% | 23 |
| MT | 0.0% | **1 (thin)** | −0.6% | 7 |

WA has no State Farm Auto filing in the window → no row (the app never fakes a
zero). The story in this data: State Farm cut Auto rates more than the market
almost everywhere — CO is the headline gap.

## Design system (must match — the app already exists)

Font: `"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`.
Light theme ONLY (the app has no dark mode). Base text 13px.

```
canvas #F7F8FB · surface #ffffff · surface-2 #FAFBFD · soft #F1F2F7
ink #14142B · ink-2 #6B7080 · ink-3 #9AA0B0 · ink-mid #4A4E63
card-line #E5E8F0 · line #EDEFF4 · line-2 #DDE1EA
brand-red #C42127 · brand-red-soft #E8555B · brand-navy #14142B
blue-fill #E5F0FA · blue-text #1B6CA8 · green-fill #E7F3EC · green-text #1B7F4B
amber-fill #FCF1E3 · amber-text #8A5A10 · red-fill #FBEAEB · red-text #8A1B1F · red-border #F0C8CA
radii: cards 14px · tiles 10px · badges 7px
shadows: card 0 2px 8px rgba(20,20,43,0.05) · popover 0 8px 28px rgba(20,20,43,0.14)
```

**App-wide color convention (uniform, do not invert):** Prospect / retention
risk = brand red · Defend = blue · opportunity = green · neutral = navy/gray.
So in charts: increases/price-pressure marks are red, cuts/defend marks are
blue. The dumbbell uses red = "you", blue = "market avg" (per-page legends make
this unambiguous). The pair #C42127 / #1B6CA8 is validated colorblind-safe on
white; keep chart mark colors to validated pairs.

## Hard rules (legal/honesty — the design must not break these)

1. **No determinations.** Copy may state what the market did, never a
   per-reader conclusion. Banned patterns (enforced by automated tests):
   "you are/you're cheaper|covered|exempt|required|liable|owed",
   "switch to", "cheapest", "guaranteed". Say "Allstate's filed rates rose
   8.1 pts more than State Farm's", never "you're cheaper than Allstate".
2. **Rate changes, not price levels.** The Positioning page carries a
   persistent red framing band: "These are rate changes, not price levels…".
   Any chart of this data must keep that framing visible nearby.
3. **Honesty tiering.** A side with 1 filing is never presented as an
   "average" and never gets a computed spread. The preview marks these with a
   hollow dot; keep some visible thin-data treatment.
4. **No fake data.** Missing state/carrier = absent or explicitly "no filings",
   never zero.
5. **Accessibility.** Chart identity never rides on color alone (legend +
   direct labels), hover tooltips on every mark, and a "view as table"
   fallback under each chart.

## What to bring back to Claude Code

- One **self-contained HTML file** (inline CSS/JS, no CDNs) showing the final
  design of both surfaces — same format as `signals_preview_v2.html`. Real
  numbers from this brief, not placeholders.
- Optionally a short list of decisions/notes (what changed and why, anything
  intentionally deferred).

Claude Code will then port it into the app: a `SignalCharts` component family
reading from the already-built engine (`src/lib/signals.ts`,
`computePositioningSignals` + `computeRecentSignals`), wired into the Overview
and Positioning pages, with e2e checks for the language blocklist.

## Open design questions (explore freely)

1. Do the charts carry a one-sentence plain-English headline above/below for
   customers who don't read charts?
2. Better treatment for the +93.7% outlier than bar-clipping?
3. Mobile: how do the charts degrade below ~500px width?
4. Does the Overview chart show single largest filings (current) or per-carrier
   averages?
5. An Auto/Home toggle on the dumbbell (the Positioning page is currently
   auto-only)?
