---
name: SPEED Training Site
description: A State Farm agency's customer-communication system, presented as the operations binder already on every agent's desk.
colors:
  binder: "#1b2a4a"
  binder-deep: "#10192e"
  binder-edge: "#2c4070"
  on-binder: "#ffffff"
  on-binder-2: "#b9c6e4"
  paper: "#ffffff"
  paper-2: "#f3f4f7"
  rule: "#d3d7e0"
  rule-2: "#aeb5c4"
  ink: "#15171c"
  ink-2: "#454b5a"
  ink-3: "#626878"
  saffron: "#f2b233"
  saffron-hover: "#f6c04f"
  saffron-deep: "#d79a12"
  tape-stock: "#f7f7f4"
  tab-red: "#c8352b"
  tab-green: "#2f6f4e"
  tab-blue: "#2d63c9"
  tab-slate: "#5b6b8c"
typography:
  display:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(2.4rem, 5.1vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 96"
  display-close:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(1.9rem, 3.6vw, 3.2rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 96"
  headline:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(1.9rem, 3.3vw, 2.9rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 96"
  title:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  lede:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(1.05rem, 1.35vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "'tnum' 1, 'ss01' 1"
  button:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 800
    letterSpacing: "0.01em"
  button-compact:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "0.94rem"
    fontWeight: 800
    letterSpacing: "0.01em"
  link-small:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 700
  small:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "0.85rem"
    fontWeight: 400
  label:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.12em"
  label-big:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "0.06em"
  memo:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  running:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "0.78rem"
    fontWeight: 400
rounded:
  none: "0"
  numeral: "1px"
  hairline: "2px"
  button-bind: "4px"
  divider: "8px"
  tab: "10px"
  button-lead: "14px"
  button: "4px 14px 14px 4px"
  round: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  page-gap: "14px"
components:
  button-primary:
    backgroundColor: "{colors.saffron}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0.95rem 1.4rem"
  button-primary-hover:
    backgroundColor: "{colors.saffron-hover}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0.95rem 1.4rem"
  button-ghost-hover:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
  button-wrap-compact:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.button-compact}"
    rounded: "{rounded.button}"
    padding: "0.95rem 1rem"
  tab-divider:
    backgroundColor: "{colors.binder-edge}"
    textColor: "{colors.on-binder}"
    rounded: "0 10px 10px 0"
    height: "112px"
    width: "44px"
  tab-divider-active:
    backgroundColor: "{colors.binder-edge}"
    textColor: "{colors.on-binder}"
    width: "52px"
  tab-divider-pricing:
    backgroundColor: "{colors.saffron}"
    textColor: "{colors.ink}"
  tape-label:
    backgroundColor: "{colors.tape-stock}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.3rem 1rem 0.3rem 0.95rem"
  tape-label-big:
    backgroundColor: "{colors.tape-stock}"
    textColor: "{colors.ink}"
    typography: "{typography.label-big}"
    rounded: "{rounded.none}"
    padding: "0.4rem 1.25rem 0.4rem 1rem"
  tape-numeral:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-binder}"
    rounded: "{rounded.numeral}"
    padding: "0.1em 0.4em 0.12em"
  sleeve:
    backgroundColor: "{colors.paper-2}"
    rounded: "{rounded.none}"
    padding: "16px"
  memo:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.memo}"
    rounded: "{rounded.none}"
    padding: "1.5rem 1.5rem 1.25rem"
  ticket:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.hairline}"
    padding: "0.18rem 0.45rem"
  page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "clamp(1.5rem, 4vw, 3.5rem) clamp(1rem, 4vw, 4rem) clamp(2.5rem, 5vw, 4.5rem)"
  page-back:
    backgroundColor: "{colors.binder-deep}"
    textColor: "{colors.on-binder}"
---

<!--
PROVENANCE
Recorded 2026-09-22 from the shipped build (scan mode), not from the plan.
Direction contract: The Operations Binder, seed 9a6af889, code-led with no
comps. No rasters were produced for this build: the only imagery is the
product's existing CloudFront logo (see PRODUCT.md); the rings, tape, holes,
vinyl grain and every icon are drawn in CSS or inline SVG. Finish review
disposition: ship, after two fix rounds.
Token source of truth: src/app/globals.css :root. tailwind.config.ts mirrors
those variables by name (bg-paper, text-ink-2, border-rule, text-tabblue).
Sidecar: .impeccable/design.json (shadows, motion, breakpoints, snippets).
-->

# Design System: SPEED Training Site

## Overview

**Creative North Star: "The Operations Binder"**

The site is a State Farm agency's SOP binder lying open on a desk under office light. A navy vinyl cover is the frame: it carries a spine label on the left, three chrome rings clasping the page stack, and a column of colored tab dividers hanging off the right edge. Everything the visitor reads sits on white bond pages that stack with a 14px gap, each printed with a typewriter running header ("SPEED Operations Manual · Tab 3 · Results · Rev. 09/2026"). The back cover is the same navy vinyl, printed white.

Density is documentary rather than promotional. Facts arrive as the binder would hold them: a Contents sheet with dot leaders, a coverage table with item codes, label-maker tape for the four headline numbers, ruled checklists whose ink checks draw in on scroll, and typewritten memo cards for testimonials. Color is almost entirely structural; the page is black ink on white with navy around it, and the five tab hues appear only where a divider, its swatch, or its printed edge would appear. One warm color, saffron, is reserved for the thing the visitor is meant to do: the Pricing tab and the View Plans & Pricing button are cut from the same stock.

The world explicitly refuses the dark hero, the stat row, and the icon-card grid of the generic course page. There are no photos, no hero background, no gradient buttons, and no icon circles. All depth is physical: sheets stacked on sheets, a sleeve's gloss, a tab's paper shadow.

**Key Characteristics:**
- Navy vinyl frame (spine, rings, tabs) around white bond pages; never a page floating on white
- Tab dividers are the only navigation; the active tab is the one pulled out
- Saffron appears only on the primary action (Pricing tab, primary button, selection highlight)
- Two voices: Archivo (condensed, heavy) for everything printed on the page; Courier Prime for anything typed onto it (running headers, memos, item codes, captions)
- Depth is paper: stacked-sheet shadows, sheet-protector sheen, tape laminate, chrome ring drop-shadow
- One authored motion moment: the checklist ticks draw in; everything else is a short slide or rotate

## Colors

Structural navy around ink-on-white pages, with five tab hues and one warm action color.

### Primary
- **Saffron** (`{colors.saffron}`): the action color. The Pricing tab, the primary button, and `::selection`. Nowhere else.
- **Saffron Hover** (`{colors.saffron-hover}`): the primary button's hover fill only, one step lighter so the pulled tab reads as catching light. A literal in `globals.css` (`.btn--primary:hover`), not a `:root` variable.
- **Saffron Deep** (`{colors.saffron-deep}`): the filled testimonial stars. A darker cut of the same tape so the stars read as printed, not glowing.
- **Tape Stock** (`{colors.tape-stock}`): the off-white label-maker tape under its top-highlight gradient. A literal in `.tape`, not a `:root` variable; the only non-paper light surface in the world.

### Secondary (the tab dividers)
- **Binder Edge** (`{colors.binder-edge}`): the navy divider (Included tab), the navy Contents swatch, the display headline's second clause, focus scrollbar thumb.
- **Tab Blue** (`{colors.tab-blue}`): the Workshop tab, the `:focus-visible` ring (3px), FAQ summary hover, link hover on inline "About the On Demand workshop" links.
- **Tab Green** (`{colors.tab-green}`): the Results tab and its divider only.
- **Tab Red** (`{colors.tab-red}`): the FAQ tab and its divider only.
- **Tab Slate** (`{colors.tab-slate}`): the Contact tab and its divider. The build ships this as a literal (`#5b6b8c` in both `globals.css` and `page.tsx`), not a `:root` variable, and the direction contract named only five tab colors; the sixth landed in the build. Future work should promote it to `--slate` in `:root`.

### Neutral
- **Binder** (`{colors.binder}`): the `body` background, i.e. the vinyl cover seen around every page. The vinyl grain (`body::before`, mix-blend overlay) sits on top of it.
- **Binder Deep** (`{colors.binder-deep}`): the back cover, the punched holes, the mobile tab strip, the video container's empty state, scrollbar track.
- **On Binder** (`{colors.on-binder}`) and **On Binder Muted** (`{colors.on-binder-2}`): white and pale-blue text printed on the vinyl (back cover copy, the spine label).
- **Paper** (`{colors.paper}`): every page, the sleeve's inner sheet, the memo card, the ticket chip, the checkbox fill.
- **Paper 2** (`{colors.paper-2}`): the sheet-protector's frosted plastic and the table row hover.
- **Rule** (`{colors.rule}`): every hairline: checklist rows, table rows, sleeve and memo borders, the running-header underline, cover header underline.
- **Rule 2** (`{colors.rule-2}`): dot leaders, ghost-button border, ticket border, the memo's perforated top edge.
- **Ink** (`{colors.ink}`), **Ink 2** (`{colors.ink-2}`), **Ink 3** (`{colors.ink-3}`): headline and emphasis, body copy, and captions/codes/running header respectively. Ink also draws every button border (2px), the FAQ and CTA top rules (2px), and the table header rule (2px).

### Named Rules
**The Saffron Ledger Rule.** Saffron is spent only on the primary action and its tab. A second saffron element on a page means one of them is not the primary action.

**The Divider Hue Rule.** Each tab hue belongs to one section and appears exactly three times: the divider on the right edge, the swatch in the Contents, and the printed edge above the section headline. Tab hues never color text, backgrounds, or icons.

**The Ink-Not-Navy Rule.** Text on paper is ink (`{colors.ink}` and its two tints), never navy. Navy is vinyl, not type; the one exception is the display headline's second clause in `{colors.binder-edge}`.

## Typography

**Display Font:** Archivo (variable, `wdth` axis loaded via `next/font`; fallback Arial, sans-serif)
**Body Font:** Archivo (same family)
**Label/Mono Font:** Courier Prime 400/700 (fallback "Courier New", monospace)

**Character:** Archivo set heavy and slightly narrowed (`'wdth' 96`) for anything the binder's owner printed: headlines, buttons, table names, tab labels. Courier Prime for anything typed onto the page afterward: running headers, item codes, page numbers in the Contents, captions ("Exhibit A"), and the testimonial memos. The pairing is a printed manual with typed annotations. `body` enables tabular numerals and `ss01` globally.

### Hierarchy
- **Display** (800, `clamp(2.4rem, 5.1vw, 4.5rem)`, 0.98, `-0.025em`, `'wdth' 96`): the cover headline only. Balanced wrap, `max-width: 14ch`.
- **Display Close** (800, `clamp(1.9rem, 3.6vw, 3.2rem)`, 0.98, `-0.025em`, `'wdth' 96`): the same voice one step down for the closing "Start today" line on the Contact page, `max-width: 22ch`. Set inline on `.display` in `page.tsx`.
- **Headline** (800, `clamp(1.9rem, 3.3vw, 2.9rem)`, 1.04, `-0.02em`, `'wdth' 96`): one per page, directly under the printed divider edge. `max-width: 20ch`.
- **Title** (700, `1.2rem`, 1.15, `-0.01em`): sub-blocks within a page ("Contents", "Getting started, in order", "Also in the binder").
- **Lede** (400, `clamp(1.05rem, 1.35vw, 1.25rem)`, 1.55, `{colors.ink-2}`): the paragraph under each headline. `max-width: 60ch`, `text-wrap: pretty`.
- **Body** (400, `1.0625rem`, 1.6, `{colors.ink-2}`): FAQ answers and running copy. `max-width: 66ch`; Tailwind `max-w-measure` is 68ch.
- **Button** (800, `1.02rem`, `0.01em`): every `.btn`. **Button Compact** (800, `0.94rem`): the wrapping contact buttons at ≤400px.
- **Link Small** (700, `0.92rem`): the "Other volumes" inline link list in the Contents sheet.
- **Small** (Courier Prime, `0.85rem`): the typed small step: Contents page numbers, table item codes, memo footers. In Archivo the same step is the numbered-step digit (800, `0.85rem`).
- **Label** (700–800, `0.70–0.74rem`, uppercase, `0.06em`–`0.14em`): tape text (800, `0.06em`), tab labels (800, `0.14em`), table headers and "Other volumes" (700, `0.12em`), ticket chips (700, `0.08em`).
- **Label Big** (800, `0.82rem`, uppercase, `0.06em`): the stat tape (`.tape--big`) on the cover.
- **Memo** (Courier Prime 400, `1rem`, 1.6, `{colors.ink}`): testimonial cards.
- **Running** (Courier Prime, `0.78rem`, `{colors.ink-3}`): the page running header; also captions and `Volume 1 · Customer Communication` at `text-xs`.

The full step ladder as built, smallest to largest: `0.70` (ticket) / `0.72` (label, tape, table head) / `0.74` (tab) / `0.78` (running) / `0.82` (tape big) / `0.85` (small) / `0.92` (link small) / `0.94` (button compact) / `0.98` (toc, table) / `1.0` (memo) / `1.02` (button, table count) / `1.05` (FAQ summary) / `1.0625` (body, checklist) / `1.2` (title) / lede clamp / display-close clamp / headline clamp / display clamp.

### Named Rules
**The Typed-vs-Printed Rule.** Archivo is what the binder was printed with; Courier Prime is what was typed on afterward. Metadata (codes, revisions, page numbers, captions, quotes) is typed. Content (headlines, names, copy, buttons) is printed. Never set a headline in Courier or a running header in Archivo.

**The Tape Numeral Rule.** A headline number ("4,000+") is set inside a tape label as a reversed ink block at `1.55em`, `'wdth' 88`, never as loose display type. The stat row the world refuses is exactly loose display numbers.

## Layout

The page is a fixed binder frame with a scrolling page stack inside it.

- **Frame (≥1024px):** `--spine-w: 92px` fixed spine on the left; `--tabs-w: 64px` fixed tab column on the right; `.binder` pads by both. Three rings are fixed at 18vh, 50vh, 82vh and pass through fixed punched holes, so they never scroll with the pages.
- **Page stack:** each `.page` is `max-width: 1240px`, centered, padded `clamp(1.5rem, 4vw, 3.5rem)` top / `clamp(1rem, 4vw, 4rem)` sides / `clamp(2.5rem, 5vw, 4.5rem)` bottom; at ≥1024px the left padding grows to `clamp(2.75rem, 5vw, 5rem)` to clear the holes, and a 26px binding-edge shade appears. Consecutive pages sit 14px apart. Every page after the cover opens with the running header, then the printed divider edge, then the headline.
- **Inside a page:** a 12-column grid at `lg`, typically 7/5 (cover: copy left, Contents right; workshop: video left, steps right; results: lede left, checklist right). Gaps are `gap-8` (32px) rising to `lg:gap-12` (48px). Vertical rhythm uses Tailwind's 4px scale: 20px after a lede, 32–40px before a new block, 56px before a sub-section title.
- **Below 1024px:** spine, rings, holes, and the right tab column disappear. Tabs become a sticky strip across the top of the stack (`.tabstrip`, `{colors.binder-deep}`); section tabs scroll horizontally behind a right-edge mask and the Pricing tab stays pinned outside the scroll. Grids collapse to one column.
- **Below 720px:** the coverage table drops its header row and re-flows each row into a three-column grid (code / name / count, with tool and description spanning).
- **Below 640px:** tape labels may wrap and lose their tilt.
- **Scroll:** `scroll-behavior: smooth` with `scroll-padding-top: 6rem` (honors reduced motion). Active tab is chosen by an IntersectionObserver with `rootMargin: -30% 0px -50% 0px`.

## Elevation & Depth

Depth is physical paper, not UI elevation. The system uses shadows, but every shadow describes a material: sheets stacked under a page, a tab's paper edge, the ring's chrome, the tape's laminate. There is no ambient "card lift" vocabulary and no hover-raises-the-card behavior.

### Shadow Vocabulary
- **Page stack** (`0 1px 0 rgba(255,255,255,0.08) inset, 2px 3px 0 -1px #eceef3, 4px 6px 0 -2px #dfe2ea, 6px 9px 0 -3px #d0d4de, 0 22px 40px -20px rgba(0,0,0,0.75)`): three hard-offset sheets in graduated paper tints under every page, then a deep soft drop onto the vinyl. The offsets are the sheets underneath, which is why they are hard-edged.
- **Sleeve** (`inset 0 0 0 1px rgba(255,255,255,0.7), 0 8px 24px -16px rgba(0,0,0,0.5)`): the sheet protector's inner highlight plus a shallow drop; its `::after` is the plastic sheen (`118deg` white gradient, 55% to 0 by 48%).
- **Tab, rest / active** (`3px 3px 8px -4px rgba(0,0,0,0.6)` / `4px 6px 12px -6px rgba(0,0,0,0.7)`): a divider's paper edge; the pulled-out tab casts more.
- **Button, rest / hover** (`0 6px 14px -10px rgba(0,0,0,0.6)` / `0 10px 20px -12px rgba(0,0,0,0.6)`): the tab-shaped button lifts slightly as it slides right.
- **Tape** (`filter: drop-shadow(0 1px 1px rgba(0,0,0,0.35))`): the label's thickness; `::after` is the laminate sheen.
- **Divider edge** (`0 2px 3px -1px rgba(0,0,0,0.35)`): the printed tab stub above a headline.
- **Ring** (`filter: drop-shadow(2px 4px 4px rgba(0,0,0,0.45))`); **hole** (`inset 0 2px 3px rgba(0,0,0,0.7), 0 0 0 3px rgba(255,255,255,0.9)`); **spine** (`inset -6px 0 12px -8px rgba(0,0,0,0.6)`).

### Shadow & Overlay Alpha Scale
Every translucent value in the build is black or white at one of these stops. New materials pick from the scale rather than inventing a stop.

Black (shade):
- **0.07** (`rgba(0,0,0,0.07)`): the 26px binding-edge shade down the left of each page (`.page::before`, fading to 0).
- **0.28** (`rgba(0,0,0,0.28)`): the dark dots of the pebbled vinyl grain (`body::before`, second radial layer).
- **0.35** (`rgba(0,0,0,0.35)`): tape thickness and the printed divider stub.
- **0.4** (`rgba(0,0,0,0.4)`): the ring's dark shroud stroke and base-plate outline (SVG); **0.5** (`rgba(0,0,0,0.5)`): the rivets on the ring plate and the sleeve's drop.
- **0.45** (`rgba(0,0,0,0.45)`): the ring's drop-shadow onto the page.
- **0.6** (`rgba(0,0,0,0.6)`): the working shadow: spine inset, button rest and hover, tab rest.
- **0.7** (`rgba(0,0,0,0.7)`): the deep stop: hole inset, active tab.
- **0.75** (`rgba(0,0,0,0.75)`): the page stack's drop onto the vinyl, the darkest shadow in the world.
- **Opaque** (`#000`): only as the solid stop of the mobile tab strip's `mask-image` (`#000` to transparent over the last 28px); never as a paint color.

White (light):
- **0.08** (`rgba(255,255,255,0.08)`): the 1px inset highlight along a page's top edge.
- **0.12** (`rgba(255,255,255,0.12)`): the sleeve sheen's mid-stop.
- **0.16** (`rgba(255,255,255,0.16)`): the light dots of the vinyl grain and the office-light falloff from the top of the cover.
- **0.45** (`rgba(255,255,255,0.45)`): the chrome ring's specular highlight (dashed SVG stroke).
- **0.55** (`rgba(255,255,255,0.55)`): the laminate sheen peak on tape and the sleeve's sheen start; also the active tab's 3px white edge line.
- **0.7** (`rgba(255,255,255,0.7)`): the sleeve's 1px inner rim.
- **0.85** (`rgba(255,255,255,0.85)`): the divider stub's die-cut label window.
- **0.9** (`rgba(255,255,255,0.9)`): the punched hole's reinforcement ring and the tape's top-edge highlight.

### Named Rules
**The Material Shadow Rule.** A shadow is allowed only when it names the physical thing casting it (sheet, tab, tape, ring). A shadow that exists to make a box "pop" is not in the world.

**The Sheen-Over-Media Rule.** Anything that is not paper (video, the Contents sheet) goes inside a sleeve, and the sleeve carries the gloss. Media is never placed bare on a page.

## Shapes

The form language is cut paper and office plastic.

The radius scale as built: `0` (paper), `1px` (tape numeral), `2px` (die-cut hairline), `4px` (button binding side), `8px` (divider stub, mobile tab, scrollbar thumb), `10px` (desktop tab free edge), `14px` (button leading edge), `50%` (holes).

- **Pages, sleeves, memos, tables, checkboxes: square** (`0`). Paper has no radius. The checkbox rect is `rx 2` at 24-unit scale, effectively square.
- **Numeral** (`1px`): the reversed ink block inside a tape label. The one-pixel radius is the label-maker's rounded character cell.
- **Hairline radius** (`2px`): ticket chips, Contents swatches, the focus outline, the active tab's edge line. Enough to read as die-cut, not rounded.
- **Tab divider** (`0 10px 10px 0` desktop; `8px 8px 0 0` in the mobile strip): a plastic tab rounded on its free edge only. The printed divider stub above headlines is `0 0 8px 8px`, a tab seen from the page side, with a white die-cut label window inset 14px / 3px. The scrollbar thumb shares the `8px`.
- **Button** (`4px 14px 14px 4px`): a horizontal tab cut from the divider stock; `4px` on the binding side, `14px` on the leading edge. Slides right (`translateX(4px)`) on hover, like a tab being pulled.
- **Round** (`50%`): the punched holes only; rings are SVG circles.
- **Tape** (clip-path notched ends, `6px` cut on each side): the label-maker cutter's shape. Stats tilt `-1.2deg` / `0.8deg` alternately.
- **Borders:** 2px ink for buttons, the FAQ list's top, the closing CTA's top, and table header; 1px `{colors.rule}` for everything else; 1.6px for the checkbox and numbered step box.
- **Rings and holes:** true circles (SVG); holes are 22px `{colors.binder-deep}` with a 3px white punched rim.

## Components

### Buttons
Tab-shaped, cut from divider stock; heavy Archivo, ink border, slides right when pulled.
- **Shape:** near-square on the left, rounded on the right (`4px 14px 14px 4px`), 2px ink border.
- **Primary:** saffron fill, ink text (`0.95rem 1.4rem`, 800, `1.02rem`), trailing hand-drawn arrow at `1.1em`. Hover: `#f6c04f` fill, `translateX(4px)`, deeper shadow. Active: `translateX(2px)`. Used for View Plans & Pricing only (cover, Included, Contact close).
- **Ghost:** transparent fill, `{colors.rule-2}` border, `{colors.ink-2}` text; hover restores ink border and text. Used for the secondary action beside a primary ("Watch the workshop", "Get instant access").
- **Wrap variant** (`.btn--wrap`): full-width, left-aligned, wrapping text for the contact list; at ≤400px drops to `0.94rem` with 1rem side padding.
- **Focus:** the global `:focus-visible` ring, 3px `{colors.tab-blue}` offset 3px.

### Tape labels (chips)
The label-maker output; the world's only chip.
- **Style:** off-white tape (`#f7f7f4` under a top-highlight gradient), uppercase 800 label at `0.72rem` / `0.06em` (`.tape--big`: `0.82rem`), notched ends by clip-path, laminate sheen `::after`, drop-shadow for thickness. A leading `<b>` renders as a reversed ink block at `1.55em`, `'wdth' 88`.
- **State:** static. Alternating tilt on the stat cluster; no tilt below 640px.

### Ticket chips
- **Style:** the tool tag in the coverage table: white, 1px `{colors.rule-2}` border, `2px` radius, uppercase 700 at `0.7rem` / `0.08em`, `{colors.ink-2}`. Static.

### Cards / Containers
- **Page** (`.page`): the primary container. Paper white, square, page-stack shadow, clamped padding (see Layout), 14px gap between pages, running header first. **Back cover** (`.page--back`): `{colors.binder-deep}` with white text, no shadow.
- **Sleeve** (`.sleeve` > `.sleeve__inner`): sheet protector. Outer `{colors.paper-2}` with 1px rule border and 1rem padding; inner paper sheet with 1px rule border; gloss overlay. Holds the Contents sheet and the Kartra video.
- **Memo** (`.memo`): testimonial card. Paper, 1px rule border, `1.5rem 1.5rem 1.25rem`, Courier Prime 1rem/1.6, perforated top edge (6px repeating dash of `{colors.rule-2}` at 60%). Stars are 14px filled `{colors.saffron-deep}`; the footer cite is `0.85rem` `{colors.ink-2}`.

### Inputs / Fields
None in the build. The only form is the third-party Kartra embed; no native inputs are styled.

### Navigation
The tab dividers (`TabNav`) are the entire navigation; there is no header bar or menu.
- **Desktop (≥1024px):** fixed column at the right edge, vertically centered, 8px between tabs. Each tab is 112×44px, vertical text (`writing-mode: vertical-rl`), uppercase 800 at `0.74rem` / `0.14em`, white on its hue, radius `0 10px 10px 0`, resting 6px tucked in (`translateX(-6px)`). Hover/focus slides it out; the active tab (`aria-current="true"`) is out and widens to 52px with a 3px white edge line and the deeper shadow. Section order and hue: Workshop blue, Included navy, Results green, FAQ red, Contact slate, then a 10px gap and Pricing saffron with ink text and a small chevron; Pricing is an out-link and is never "current".
- **Mobile (<1024px):** a sticky strip on `{colors.binder-deep}`, tabs 40px tall with horizontal text, radius `8px 8px 0 0`, resting 4px down; the active tab rises and shows a 3px white underline. Section tabs scroll under a 28px right-edge fade; Pricing is pinned outside the scroll so it is always visible.
- **Contents sheet** (`.toc`): the in-page mirror of the tabs: 12px hue swatch, title, 2px dotted leader in `{colors.rule-2}`, then a Courier "Tab n" (or "Cloud" for the out-link with an external-link icon). Hover underlines the title. "Other volumes" beneath is a bold inline list of the product's other pages.

### Checklist (signature component)
Ruled rows whose ink checks draw in: the page's one authored motion moment.
- Rows are a `1.6rem 1fr` grid with 0.85rem gap, `0.7rem` vertical padding, 1px rule below (and above the first), `1.0625rem`/1.5 ink text.
- The box is a 24px SVG: white fill, 1.6 ink stroke; the check path is a 2.6 round-capped stroke with `stroke-dasharray: 30` that animates `stroke-dashoffset` 30→0 over 0.55s on `--ease-out`, staggered `calc(var(--i) * 120ms + 120ms)` per row, once the list is 35% in view (`.is-checked`). Reduced motion shows checks drawn.
- **Numbered variant** (`.check--num`): the box is a 1.6px ink-bordered square with the step number at 800 / `0.85rem`.

### Coverage table (signature component)
The "Everything in the binder" sheet (`.sheet`): uppercase label headers over a 2px ink rule; rows with 1px rule dividers and `{colors.paper-2}` hover; a Courier item code in `{colors.ink-3}`, a bold name, a bold Courier count at `1.02rem`, a ticket chip for the tool, and a description in `{colors.ink-2}`. Collapses to a card-like grid below 720px.

### Running header and divider edge
Every content page opens with `.running` (Courier `0.78rem`, `{colors.ink-3}`, product name bold in `{colors.ink-2}`, tab name hidden below `sm`, revision at right, 1px rule beneath) followed by `.divider`, the 120×14px printed tab stub in the section's hue with its white label window, then the headline.

### FAQ
`<details>` rows under a 2px ink top rule, each with a 1px rule beneath; the summary is a 700 / `1.05rem` grid with a 24px hand-drawn plus that rotates 45° when open; summary hover turns `{colors.tab-blue}`; answers are Body at `max-width: 68ch`.

### Icons
Hand-drawn inline SVG (`Icons.tsx`): one stroke weight (1.9), round caps and joins, `currentColor`, 24-unit viewBox, sized by context (`1.1em` in buttons, 14–16px inline). The star is the one filled glyph. No icon packages, no icon circles.

## Do's and Don'ts

### Do:
- **Do** keep every content surface a white bond page inside the navy frame, opened with the running header and the printed divider edge, with 14px between pages.
- **Do** spend saffron only on the primary action (Pricing tab, View Plans & Pricing button) and its `::selection` echo.
- **Do** set printed content in Archivo 800 `'wdth' 96` and typed metadata (codes, revisions, captions, quotes) in Courier Prime; use tabular numerals.
- **Do** put small facts on tape (`.tape`, reversed ink numeral) and media inside a sleeve; the sleeve carries the gloss.
- **Do** make every list a ruled checklist or a Contents sheet with dot leaders; every tag a ticket chip; every testimonial a Courier memo with a perforated edge.
- **Do** keep hues to their section: divider, Contents swatch, and printed stub only.
- **Do** honor `prefers-reduced-motion` by showing checks already drawn and disabling smooth scroll.
- **Do** keep the Pricing tab reachable at every viewport (pinned outside the mobile scroll run).

### Don't:
- **Don't** add a dark hero, a photo background, a stat row of loose display numbers, or an icon-card grid; the world exists to refuse them.
- **Don't** introduce a header bar, hamburger, or menu; the tab dividers are the only navigation.
- **Don't** color text with a tab hue or with navy (headline second clause excepted); text on paper is ink.
- **Don't** add a shadow that is not a named material (sheet stack, tab edge, tape, ring, sleeve); no ambient card lift, no hover-raise.
- **Don't** round paper. Pages, sleeves, memos, tables, and checkboxes stay square; only tabs, buttons, and die-cut chips carry radius.
- **Don't** use icon packages, icon fonts, or filled circular icon badges; icons are hand-drawn 1.9-stroke SVG.
- **Don't** show a second saffron element on any page, or a saffron ghost button.
- **Don't** hard-code new colors; `{colors.tab-slate}`, `{colors.saffron-hover}`, and `{colors.tape-stock}` are the three literals the build carries outside `:root` and should be promoted there before any new surface reuses them.
- **Don't** invent a new shadow or overlay alpha; pick from the recorded black (0.07–0.75) and white (0.08–0.9) stops.
