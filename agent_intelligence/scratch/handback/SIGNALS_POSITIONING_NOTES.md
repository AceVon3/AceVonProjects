# Positioning signals — design decisions and porting notes

Companion to two self-contained HTML files. Both are single-file, inline CSS/JS,
no CDNs, real tokens from the design system.

| File | Surface | Status |
|---|---|---|
| `positioning_dumbbell.html` | Primary Positioning chart | Ready to port |
| `positioning_quadrant.html` | Second view, split Auto / Home | Exploration, blocked on Home data |

---

## 0. Blocking item before anything ships

**The Homeowners series in the quadrant file is invented.** Personal Auto is real
engine output as of Aug 10, 2026. Home per-state values do not exist anywhere in
the brief or the database and were fabricated to test whether a 2x2 layout holds
once a second line of business exists.

Shipping them violates rule 4 (no fake data). Before port, either replace the
`HOME` array with engine output or drop the Home panel entirely. The direction is
grounded (Home moving up nearly across the board while Auto splits); the numbers
are not.

The dumbbell file has no such problem. Every value in it is real.

---

## 1. Sign convention conflict — needs a decision

The two files currently disagree, and both render a "gap"-style column:

- Dumbbell: `gap = market − you`. CO shows **6.0**.
- Quadrant: `difference = you − market`. CO shows **−6.0**.

Same state, same data, opposite sign, two tables in the same product. Pick one
before port.

**Recommendation: standardize on `you − market`**, signed, negative meaning your
carrier's filed change ran further down than the market. Label the column
"Your change vs market (pts)". Reason: it reads as a property of your carrier,
which is what the page is about, and it survives the axis change in the quadrant
without inverting. If you prefer the dumbbell's convention instead, that is fine
too, but then the quadrant table has to flip.

---

## 2. Dumbbell — the primary chart

Per state: red dot is your carrier's premium-weighted average filed change, blue
dot is the pooled competitor average, connector is the spread. Sorted by gap
descending, thin rows pinned last.

### Hardcoded values to make dynamic

- `HEADLINE_STATE` is set to `"CO"`. Should be computed as the comparable row with
  the largest absolute gap.
- The headline sentence counts comparable states. It currently reads "all 6
  comparable states" because all 6 happen to run below market. If a future profile
  is mixed, the sentence must become "N of M". Do not template it as a fixed
  string.
- Domain is fixed at −9.5 to 8.5 with ticks at −8/−4/0/+4/+8. Derive from data with
  padding, and keep tick count low enough that labels do not collide at 560px.

### Corrections already applied versus the earlier screenshot

- The headline said "below the market in 6 of 7 comparable states" while also
  labeling MT as not comparable. It counted MT both ways. Now: 6 comparable
  states, MT accounted for separately in the footnote.
- MT no longer draws a connector. A one-filing side gets no computed spread, and
  a connector is a drawn spread.
- The "Gap (pts)" header is neutral gray rather than red. Gap magnitude is not
  directional, and a red header reads as alarm on rows that may be good news.

### Mobile

Below 560px the SVG is replaced by stacked rows: state, both values labeled "you"
and "market", gap on the right, mini strip underneath. Every strip uses the same
domain as the full chart, so states stay comparable rather than each row
auto-scaling to its own range. This is the answer to open question 3 in the brief.

---

## 3. Quadrant — second view, split by line

### Why the axes changed

The first version used x = market change, y = gap in points. That failed on two
counts. The gap is a derived number the reader must decode, and its plain reading
("you below the market") sits one step from a price-level determination the
blocklist forbids.

Both axes now carry the same kind of number: what your carrier filed, and what
competitors filed on average. No subtraction. The gap survives as distance from
the dashed parity line and as a table column. The four boxes read as **Both cut**,
**Both raised**, **You up / them down**, **You down / them up**, which an agent can
say out loud without a legend.

### Why MT appears here but not in the dumbbell

This is deliberate, not an inconsistency to fix. The dumbbell's y position *is*
the gap, so a one-filing state has no y value and cannot be placed. The quadrant
plots raw filed changes, so MT can be placed without computing anything. It
renders as a gray pill with an asterisk, described as a single filing, never an
average, with no difference calculated.

### Why both panels share one scale

A state sits in the same place for the same reason in each panel. The consequence
is that Auto occupies the lower band and Home the upper one, so each panel looks
partly empty. That emptiness is the finding. There is a line under the charts
saying so, because a reader would otherwise assume the two charts are drawn
differently. Per-panel auto-scaling is a one-line change but destroys
comparability.

### Cross-panel highlight

Hovering or focusing a state highlights it in both panels and dims everything
else. This replaced connector lines drawn between the same state's Auto and Home
points, which were the main source of visual noise when the lines shared one plot.

### Mark placement

The state code is the mark. A 29x17 pill sits on the data point, tries eleven
fallback positions if it would collide or leave the plot, and when displaced drops
a 2px dot at the true position with a leader line back to it. Nothing is ever
drawn somewhere it does not belong. Simulated at panel widths 330 / 370 / 430: all
15 marks place, worst case four nudges.

Pill styling encodes provenance, not line of business, since the panels already
separate the lines: navy = real filing average, gray with asterisk = single
filing, amber dashed = illustrative. When Home data becomes real, those pills turn
navy and nothing else changes.

---

## 4. Honesty rules encoded in both files

These are behaviors, not copy. Port them as behaviors.

1. **Thin data.** `thin(row) = yourFilings < 2 || marketFilings < 2`. A thin row
   gets no computed spread, no connector, no gap value, and is excluded from any
   headline count. **Do not reimplement this predicate in the component.** The
   engine already has a confidence tier for exactly this; read it from
   `computePositioningSignals` so there is one source of truth.
2. **No fake zeros.** A state with no filing gets no row and no point. WA Auto is
   named in a visible "not plotted" strip with the reason. That strip is a
   feature, not mock scaffolding.
3. **Framing band stays adjacent.** Both files render the "rate changes, not price
   levels" band directly above the chart. It is required near this data.
4. **Quadrant labels key only on axis sign.** "Both cut", "Both raised", and so on
   are true for any data that lands in that box. They cannot become false next
   month. Do not replace them with interpretive labels.
5. **Light theme lock.** Both files declare `color-scheme: light only` via meta tag
   and CSS. Without it, a device in dark mode auto-inverts the page and the
   backgrounds go black. **This belongs in the app document head, not just these
   mocks**, or every page hits the same problem.

### What the e2e language check should assert

The existing blocklist test checks static copy. These surfaces generate text at
runtime, so extend it to assert the blocklist against:

- the rendered headline sentence, for several profiles including a mixed one
- every tooltip string
- every mark `aria-label`
- the "not plotted" strip

Both files pass the current blocklist as written.

---

## 5. Accessibility, both files

- Chart identity never rides on color: legend, direct labels, per-mark tooltips,
  full table fallback under a `View as table` disclosure.
- Every mark is tab-focusable with a visible dashed focus ring. Focus fires the
  same tooltip as hover. Escape dismisses and clears any highlight.
- Mark `aria-label`s read the full comparison including the thin-data caveat.
- `prefers-reduced-motion` respected on the dim transition.

---

## 6. Open items

1. Sign convention, section 1. Decide before port.
2. Real Home positioning numbers, or drop the Home panel.
3. Whether the quadrant ships at all. My read: the dumbbell stays primary, and the
   quadrant is worth a second view on the same page only once Home is real. With
   Auto alone it puts 5 of 6 comparable states in one box, which the dumbbell says
   more directly in less space.
4. The Overview surface is still undecided between arrow tiles and the weighted
   card version. The weighted cards need per-carrier weighted aggregation plus a
   signal floor rule in the engine, which is new work rather than a port.
