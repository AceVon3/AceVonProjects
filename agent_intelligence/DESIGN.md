---
name: AgencyMan.ai
description: Rate-filing signals for insurance agents — navy command rail, calm white desk, red means act.
colors:
  brand-red: "#C42127"
  brand-red-soft: "#E8555B"
  brand-navy: "#14142B"
  canvas: "#F7F8FB"
  surface: "#FFFFFF"
  surface-2: "#FAFBFD"
  soft: "#F1F2F7"
  ink: "#14142B"
  ink-2: "#6B7080"
  ink-3: "#9AA0B0"
  ink-mid: "#4A4E63"
  card-line: "#E5E8F0"
  line: "#EDEFF4"
  line-2: "#DDE1EA"
  blue-fill: "#E5F0FA"
  blue-text: "#1B6CA8"
  green-fill: "#E7F3EC"
  green-text: "#1B7F4B"
  amber-fill: "#FCF1E3"
  amber-text: "#8A5A10"
  red-fill: "#FBEAEB"
  red-text: "#8A1B1F"
  gray-fill: "#F1F2F7"
  gray-text: "#4A4E63"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2.2rem, 4.6vw, 3.4rem)"
    fontWeight: 800
    lineHeight: 1.07
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.6px"
rounded:
  card: "14px"
  tile: "10px"
  badge: "7px"
  lp-card: "16px"
  lp-btn: "11px"
spacing:
  badge-y: "2px"
  badge-x: "8px"
  card-pad: "20px"
  gutter: "24px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.brand-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.tile}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "#A81B21"
  lp-button-primary:
    backgroundColor: "{colors.brand-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lp-btn}"
    padding: "11px 18px"
  lp-button-ghost:
    backgroundColor: "transparent"
    textColor: "#45455E"
    rounded: "{rounded.lp-btn}"
    padding: "11px 18px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  badge:
    rounded: "{rounded.badge}"
    padding: "2px 8px"
  rail-tile-active:
    backgroundColor: "{colors.brand-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.tile}"
---

# Design System: AgencyMan.ai

## Overview

**Creative North Star: "The Command Rail"**

A navy command rail steers a calm, white signal desk. The agent sits in front of a bright, orderly workspace — Fog White canvas, white cards, hairline borders — while the Command Navy rail anchors the left edge like an instrument panel. Against all that calm, exactly one color is allowed to shout: Signal Red means *act now*. The mood is crisp, confident, energetic — a sales instrument, not an analyst's terminal. Rate numbers and color-coded signals carry the urgency; the chrome around them stays composed so the signals never compete with their frame.

Components are tactile and confident: surfaces feel physical, buttons press, interactive elements respond. The product is free but presented as a $14.99/mo tool (see PRODUCT.md), so perceived polish is load-bearing — every surface must look like it belongs in a product people pay for.

Two scoped expressions of one identity: the **app** (light-only, token-driven, Tailwind) and the **marketing landing** (`.lp`, self-contained CSS derived from the logo, light + dark). They share the brand trio and the red-as-signal doctrine but deliberately do not share tokens; the landing derives its neutrals as tints of the navy.

Confirmed anti-references: never the dark-terminal aesthetic (no Bloomberg-style dark app UI — dark mode exists only on the landing), and never government-form austerity (this renders regulatory data but must never look like a DOI filing portal).

**Key Characteristics:**
- Navy rail + white desk: one dark anchor, everything else light and airy
- Red is rationed to action and identity; four signal families (red/blue/green/amber) encode meaning uniformly
- Hairline borders (0.5px) and pixel-precise type sizes give a machined, exact feel
- Uppercase letter-spaced kickers structure every card and table
- Tactile, confident components — surfaces assert themselves, interactions respond

## Colors

A disciplined palette: one loud voice (Signal Red), one dark anchor (Command Navy), a field of navy-tinted neutrals, and four functional signal families.

### Primary
- **Signal Red** (#C42127): the brand mark's red and the app's only imperative. Active rail tile, primary buttons, PROSPECT badges, retention-risk numbers, the ".ai" in the wordmark. If it's Signal Red, the agent should do something about it.
- **Soft Signal** (#E8555B): the red the logo itself uses on dark navy. The only red permitted on navy/dark surfaces — the wordmark dot on the rail, CTAs inside the navy closing band, the landing's dark theme brand color.

### Secondary
- **Command Navy** (#14142B): the rail's background, the wordmark, the landing's footer and closing band — and, doubling as `ink`, the primary text color. Authority and structure; never used as a signal.

### Tertiary
The four signal families, each a pale fill + deep text pair, applied identically everywhere (badges, pills, bands):
- **Defend Blue** (fill #E5F0FA / text #1B6CA8): DEFEND — rate decreases threatening the agent's book.
- **Opportunity Green** (fill #E7F3EC / text #1B7F4B): opportunity, approved, positive movement.
- **Pending Amber** (fill #FCF1E3 / text #8A5A10): pending, warnings, in-progress filings.
- **Risk Red** (fill #FBEAEB / text #8A1B1F): the badge-scale expression of Signal Red — PROSPECT and retention risk.
- **Neutral Gray** (fill #F1F2F7 / text #4A4E63): no signal; informational chips.

### Neutral
- **Fog White** (#F7F8FB): the app canvas — a cool, barely-there navy tint that makes white cards read as raised surfaces.
- **Surface White** (#FFFFFF) and **Surface Band** (#FAFBFD): card bodies and table-header/footer bands respectively.
- **Ink scale**: ink #14142B (primary text) → ink-mid #4A4E63 → ink-2 #6B7080 (secondary) → ink-3 #9AA0B0 (tertiary/kickers).
- **Line scale**: card-line #E5E8F0 (card borders) → line-2 #DDE1EA (inputs, chips) → line #EDEFF4 (row hairlines).

### Named Rules
**The One Alarm Rule.** Signal Red appears only where action or identity lives — never as decoration, never for emphasis a neutral could carry. Its scarcity is what makes the PROSPECT column feel urgent.

**The Logo Is the Source Rule.** All three brand hexes come from `public/brand/*.svg`. Any new brand-color usage must trace back to the logo; the landing's neutrals are tints of the navy for the same reason.

## Typography

**Display Font:** System UI stack (Segoe UI / -apple-system first, per surface)
**Body Font:** Same system stack — the product owns no webfont; icons are the self-hosted Tabler webfont.

**Character:** Machined and exact. The system stack is deliberate (fast, native, trustworthy), and personality comes from discipline instead: pixel-precise sizes (`text-13`, not `text-sm`), heavy weights up top (750–800 on the landing), and uppercase letter-spaced kickers that make every card scannable.

### Hierarchy
- **Display** (800, clamp(2.2rem, 4.6vw, 3.4rem), 1.07, −0.025em): landing hero only. Section titles step down to clamp(1.7rem, 3.4vw, 2.35rem) at the same weight.
- **Headline** (600, 20–22px): app page titles.
- **Title** (600, 15–16px): card titles, row primaries.
- **Body** (400, 13px, 1.45): the app's default reading size; tables, descriptions. 12px for dense secondary prose.
- **Label / Kicker** (600–700, 10–11px, +0.4–0.8px tracking, UPPERCASE, ink-3): card kickers, table column headers, chip text. The landing's version is the red `eyebrow` (0.74rem, +0.14em, with a 26px red rule before it).

### Named Rules
**The Kicker Rule.** Every card and table section opens with an 11px uppercase letter-spaced kicker in ink-3 (or Signal Red on the landing). It is the system's most recognizable habit — new surfaces must keep it.

**The Pixel-True Rule.** Type sizes are exact pixels from the 10–30px scale in `tailwind.config.ts`, not Tailwind's t-shirt sizes. Don't introduce `text-sm`/`text-lg` into the app.

## Layout

The app is a two-region shell: the Command Navy rail (sticky, full-height on md+; 68px icon-only collapsed, 248px expanded; below md it becomes a horizontal icon bar with sideways scroll) and the Fog White content region. Content lives in white cards on the canvas — cards are the only containers; there are no naked sections. Card interiors use 20px padding (`p-5`); tables bleed to card edges with `overflow-hidden` and use Surface Band (#FAFBFD) header bands. Density is confident but not cramped: 13px body in tables, generous card gaps.

The landing uses a 1120px max-width container (24px side padding), 96px section rhythm, and left-aligned editorial headers (red kicker rule + eyebrow, title, sub — deliberately never centered). Its signature moves: asymmetric hero with a signal panel, numbered problem columns, bento feature grid, vertical timeline, navy closing band.

Breakpint behavior is Tailwind-default (`md:` 768px is the main hinge — rail orientation, column stacking).

## Elevation & Depth

Depth doctrine (confirmed 2026-08-24, applied to the app's `shadow-card` token 2026-08-25): **firmer shadows everywhere** — surfaces feel physical at rest, not whispered. App and landing now share one shadow language: a tight contact line plus a soft distant drop. Interactive surfaces go firmer still on hover (the Biggest Mover card lifts to the popover shadow).

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 3px rgba(20,20,43,0.05), 0 14px 32px -18px rgba(20,20,43,0.22)`): resting cards — the `shadow-card` token in `tailwind.config.ts` and the landing's `--shadow-card`.
- **Popover** (`box-shadow: 0 8px 28px rgba(20,20,43,0.14)`): floating layers — tooltips, popovers, menus — and the hover-lift state of fully-clickable cards.

### Named Rules
**The Physical Surface Rule.** Shadows are navy-tinted (rgba(20,20,43,…)), never pure black, and always two jobs: a contact edge plus a soft drop. Flat gray boxes read as government forms — the confirmed anti-reference.

## Shapes

A three-step radius language, largest to smallest: cards and popovers 14px, interactive tiles and buttons 10px, badges and small pills 7px (the landing runs one notch rounder: 16px cards, 11px buttons). Category pills and movement chips are fully rounded (`rounded-full`). Borders are the system's precision instrument — 0.5px hairlines on rows and inner dividers, 1px on card edges — and corners are always rounded; nothing is ever sharp-cornered or pill-shaped except deliberate pills.

## Components

### Buttons
- **Character:** tactile and confident — filled, weighty, and they press (`:active` translates down 1px on the landing).
- **Shape:** app 10px radius (`rounded-tile`); landing 11px (13px for `.lg`).
- **Primary:** Signal Red fill, white text, semibold 13px, 10px × 24px padding (app) / 11px × 18px (landing). Hover darkens to #A81B21 (landing `--brand-hover`); on navy surfaces the fill is Soft Signal #E8555B hovering to #ED6B70.
- **Ghost (landing):** transparent, ink-soft text, 1px `--line-strong` border; hover fills with `--bg-alt` and darkens text.

### Cards / Containers
- **Corner Style:** 14px (`rounded-card`)
- **Background:** Surface White on Fog White canvas; header/footer bands in Surface Band #FAFBFD
- **Border:** 1px card-line #E5E8F0
- **Shadow Strategy:** the target card shadow (see Elevation)
- **Internal Padding:** 20px (`p-5`); tables bleed full-width inside `overflow-hidden`

### Badges & Pills
- **Badge:** 7px radius, 2px × 8px padding, 10–11px semibold; always a signal-family fill + text pair (e.g. `bg-red-fill text-red-text`). Meaning is fixed by the color code — red PROSPECT/risk, blue DEFEND, green opportunity, amber pending, gray neutral.
- **Movement/category pills:** `rounded-full`, 10–11px bold uppercase with +0.4–0.6px tracking.

### Inputs / Fields
- **Style:** Surface White, 1px line-2 #DDE1EA border, tile radius; labels are 11–12px uppercase kickers in ink-2.
- **Focus:** landing uses a brand ring (`rgba(196,33,39,0.28)`); app inputs follow the same red-ring focus language.

### Navigation (signature component)
The Command Rail: Command Navy, sticky and full-height on md+, 68px icon-only ↔ 248px expanded (preference persisted). Tiles are 10px-radius; the active tile is Signal Red with white text — the single strongest color moment in the app. Inactive tiles are white at 50% opacity, hovering to 80% over `white/5`. Collapsed tiles grow ink-colored tooltips. Brand lockup at top: white mark + "AgencyMan" with the ".ai" in Soft Signal. On mobile the rail becomes a horizontal scrolling icon bar.

### Tables (signature component)
White card shell, Surface Band header with 11px uppercase kicker column heads, 0.5px hairline row separators, 13px body. Policyholder counts abbreviate (13.3k / 1.4M / —); SERFF numbers live in row tooltips, not columns. Rate movement is always a signed, color-coded number.

### Email cards
The monthly digest renders the same card language in table-based HTML: white cards, 14px radius, kickers, signal-family badges (approved precedent: commit 691ac3d). Digest changes must match the app's card look, not generic email-template styling.

## Do's and Don'ts

### Do:
- **Do** open every card, table, and section with the 11px uppercase kicker — it's the system's signature.
- **Do** use the signal-family pairs exactly as coded: red = prospect/risk, blue = defend, green = opportunity, amber = pending. An agent who learns the code once must be able to trust it everywhere.
- **Do** keep shadows navy-tinted and two-part (contact edge + soft drop); firm is the doctrine, muddy gray is the failure mode.
- **Do** make interactive elements respond — hover color shifts, 1px active press, firmer shadow on lift.
- **Do** keep the app light-only; navy belongs to the rail, the landing's dark theme, and dark lockup surfaces.

### Don't:
- **Don't** use Signal Red decoratively — it is reserved for action, identity, and the red signal family.
- **Don't** drift toward the dark-terminal aesthetic: no dark app backgrounds, no green-on-black data displays.
- **Don't** let regulatory content look bureaucratic: no gray-on-gray tables, no unstyled government-form austerity.
- **Don't** introduce Tailwind t-shirt type sizes, non-token colors, or a webfont; the system stack and the pixel scale are deliberate.
- **Don't** share tokens between the app and the landing — the landing derives from the logo on purpose; keep both in sync with the brand trio only.
