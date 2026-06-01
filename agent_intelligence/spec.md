# Insurance Agent Intelligence Platform — v1 Spec

## Purpose

A public-facing web app that turns SERFF rate filing data into actionable signals for licensed insurance agents. v1 ships these things:

1. **Profile Setup** — agent enters licensed states and authorized carriers; everything filters to their world.
2. **Overview** — the landing page. An at-a-glance dashboard: Prospect / Defend counts, the single most urgent item, a compliance-tracking card, and a recent-changes feed. Drills into the tables below.
3. **Prospect Table** — competitors raising rates in the agent's states. Attack opportunities.
4. **Defend Table** — competitors lowering rates in the agent's states. Retention risks.
5. **My Carriers Table** — (all agent types; labelled "My Carrier" for captives) every recent filing involving the carriers the agent sells.
6. **Compliance** — per-state HR & insurance regulatory resources (Labor Dept, Tax/Revenue, Insurance Dept, Workers' Comp), keyed off the agent's employee work/live states, with on-demand AI summaries grounded in the official source pages.
7. **Rate Positioning** — (all agent types) per (line, state), the agent's carrier's premium-weighted average rate *change* vs each competitor individually, with confidence tiering and a persistent "rate change, not price" frame. Sparse, comparison-first.
8. **Sub-type column** — a Sub-type column in the filings tables (next to Line) with a clickable info bubble defining each of the 11 sub-types; single-valued per filing (recon-confirmed), catch-alls explicitly flagged.

A further page, **Methodology**, is required for credibility but contains no interactive features.

Brand Health Score is explicitly NOT part of the Overview or v1 — see "Out of scope" below.

### Out of scope for v1

Not to be built, not even as stubs:

- Brand Health Score
- HR & Compliance — "new law" change detection (Phase B). The Compliance tab itself (per-state resources + on-demand grounded AI summaries) IS in v1 — see Feature 6. What's deferred is the snapshot/diff pipeline that detects when a regulation has *changed*, which is what would let the Overview truthfully highlight "new" laws. That requires storing regulation snapshots over time and is its own milestone — see "Phase B" near the end of this doc.
- Monthly Digest emails
- Pro tier features (AI Lead Optimization, Lead Vendor Normalization, Team Routing, LTV Modeling, ROI Blueprint)
- User accounts and authentication (no email, no password)
- Payments

---

## Data source

Source of truth: `output/all_states_final_rates.xlsx`, sheet `rate_filings`. **468 rows, 17 columns.** A `README` sheet sits alongside it with field definitions; the data lives in `rate_filings`.

**Build step:** a Python script (`scripts/import_filings.py`) reads the xlsx, derives the `brand` column from `company_name`, normalizes types, and writes to `data/filings.db` (SQLite). The web app reads only from SQLite. Monthly refresh = drop in new xlsx, re-run import, redeploy.

### Source columns (exactly as they appear in the xlsx)

| Column | Type in source | Notes |
|---|---|---|
| `state` | string | Two-letter. Actual states with rows: AZ, CO, ID, MT, NV, OR, UT, WA. WY has zero rows. |
| `effective_date` | string | Format: `MM/DD/YYYY` |
| `company_name` | string | Filing entity. 43 unique values; `brand` must be derived from this. |
| `line_of_business` | string | Two values: `"04.0 Homeowners"`, `"19.0 Personal Auto"` |
| `sub_type_of_insurance` | string | e.g. `"19.0001 Private Passenger Auto (PPA)"` |
| `overall_indicated_change` | string | e.g. `"15.800%"` — strip `%`, parse to float (whole-number percent: 15.8, not 0.158) |
| `overall_rate_impact` | string | Same format as above |
| `written_premium_change` | float | Dollar amount, can be null |
| `policyholders_affected` | float | Integer count stored as float; can be null |
| `written_premium_for_program` | float | Can be null |
| `maximum_percent_change` | string | e.g. `"18.600%"` — same normalization |
| `minimum_percent_change` | string | Same |
| `rate_activity` | string | 4 values: `rate_change` (445), `rate_change_pending` (7), `rate_change_withdrawn` (9), `rate_change_disapproved` (7) |
| `serff_tracking_number` | string | Primary natural key |
| `disposition_status` | string | 11 variants: `Filed`, `FILED FOR USE`, `Acknowledged`, `Approved`, `FILED`, `Rates Reviewed and Filed`, `REJECTED`, `WITHDRAWN`, `Open`, `Withdrawn`, `Review pending` |
| `filing_date` | string | Format: `YYYY-MM-DD` (different from effective_date!) |
| `source_pdf` | string | Local file path (e.g. `output/pdfs/az/SERFF-12345/filing_summary.pdf`). Unusable as a web link — see Open Question #2. |

### Brand derivation (must be done in the import script)

The xlsx has **no `brand` column**. Derive it from `company_name` at import time using prefix/keyword matches. Apply rules in order; first match wins.

```python
def derive_brand(name: str) -> str | None:
    n = name.lower()
    if n.startswith("state farm") or "mga insurance" in n:
        return "State Farm"   # MGA Insurance Company is State Farm's MGA arm
    if n.startswith("geico") or "government employees" in n:
        return "GEICO"
    if n.startswith("allstate"):
        return "Allstate"
    if n.startswith("encompass"):
        return "Encompass"
    if "travelers" in n:
        return "Travelers"
    if n.startswith("progressive") or "artisan and truckers" in n:
        return "Progressive"
    if n.startswith("safeco"):
        return "Safeco"
    if "liberty" in n:  # Liberty Mutual, Liberty Insurance Corporation, The First Liberty
        return "Liberty Mutual"
    return None  # log and fail loudly — should not happen given current scope
```

The import script must log any `company_name` that doesn't match and fail loudly if the unmatched count is non-zero. This is the single point where scope drift will appear in a monthly refresh.

### Multi-entity filing rollup (important — read before the schema)

**31.5% of filings in the source data** (99 of 314) have multiple rows for the same `(serff_tracking_number, line_of_business)` pair, one per underwriting entity. The most extreme example: GEICO's NV Personal Auto filing `GECC-134661852` has two rows — GEICO Indemnity Company at +30.49% (covers 2,351 policyholders, $7.9M premium), GEICO General Insurance Company at +56.47% (13,269 policyholders, $28.8M premium). Both numbers are real `overall_rate_impact` values; both belong to the same filing.

For the web app, **roll these multi-entity rows into a single record per filing** using a **premium-weighted average of `overall_rate_impact`**, weighted by `written_premium_for_program`. The agent sees one row per filing.

Why weighted-average (not max, not separate rows):
- Most multi-entity filings have a trivial spread between entities — only ~5 in the active 12-month window have a >5-point range — so the weighted average reads basically the same as either individual row.
- For wide-spread cases like the GEICO NV example, the weighted average (+50.88%) honestly reflects where the actual customer base sits — GEICO General has ~5.6× as many policyholders as Indemnity, so the typical NV GEICO customer is much closer to +56% than +30%.
- Max would overstate the average customer's pain. Showing separate rows visually duplicates carriers and confuses the Prospect read.

### SQLite schema (target — what the web app reads)

Two tables. The raw table preserves the source exactly (one row per entity, for traceability and methodology auditing). The rolled-up table is what the web app queries.

```sql
-- Raw: one row per source xlsx row. Source of truth, never modified post-import.
CREATE TABLE filings_raw (
  id INTEGER PRIMARY KEY,
  state TEXT NOT NULL,
  brand TEXT NOT NULL,
  company_name TEXT NOT NULL,                 -- the underwriting entity
  line_of_business TEXT NOT NULL,             -- "Personal Auto" or "Homeowners" (cleaned)
  sub_type_of_insurance TEXT,
  overall_rate_impact REAL,                   -- whole-number percent: 8.5 means 8.5%
  overall_indicated_change REAL,
  maximum_percent_change REAL,
  minimum_percent_change REAL,
  written_premium_change REAL,
  policyholders_affected INTEGER,
  written_premium_for_program REAL,
  rate_activity TEXT NOT NULL,
  serff_tracking_number TEXT NOT NULL,
  disposition_status TEXT,
  effective_date TEXT,                        -- ISO: YYYY-MM-DD; nullable (real SERFF data has approved 0% filings with no effective_date — keep them; downstream excludes nulls from window/Prospect/Defend/Most-Urgent, shows in My Carriers as "date unknown")
  filing_date TEXT,                           -- ISO: YYYY-MM-DD
  source_pdf TEXT
);

-- Rolled up: one row per (serff_tracking_number, line_of_business). What the UI reads.
CREATE TABLE filings (
  id INTEGER PRIMARY KEY,
  serff_tracking_number TEXT NOT NULL,
  state TEXT NOT NULL,
  brand TEXT NOT NULL,
  line_of_business TEXT NOT NULL,
  overall_rate_impact REAL NOT NULL,          -- premium-weighted across entities
  rate_activity TEXT NOT NULL,
  effective_date TEXT,                        -- nullable; see filings_raw.effective_date note above
  filing_date TEXT,
  entity_count INTEGER NOT NULL,              -- # of company_name rows rolled up
  total_policyholders INTEGER,                -- sum across entities, null if any row is null
  total_written_premium REAL,                 -- sum across entities, null if any row is null
  min_entity_impact REAL NOT NULL,            -- for transparency / hover detail
  max_entity_impact REAL NOT NULL,            -- for transparency / hover detail
  entity_names TEXT NOT NULL,                 -- JSON array of company_name strings
  disposition_status TEXT,
  UNIQUE (serff_tracking_number, line_of_business)
);

CREATE INDEX idx_filings_state_brand ON filings(state, brand);
CREATE INDEX idx_filings_effective ON filings(effective_date);
CREATE INDEX idx_filings_activity ON filings(rate_activity);
```

Notes on the rollup key:
- Group by `(serff_tracking_number, line_of_business)`, **not just `serff_tracking_number`** — a single SERFF number can in theory cover multiple lines, and you never want to weighted-average Auto and Homeowners together.
- `state` and `brand` are constant within a group; assert this during import and fail loudly if not.
- If `written_premium_for_program` is null for any entity in a group, fall back to a simple unweighted average and log a warning. (Acceptable because the only filings where this happens tend to be small; logging surfaces the cases worth reviewing.)

Also write `data/last_updated.txt` with an ISO date — the import script's run timestamp. The methodology page reads this.

### Import script normalization (concrete steps)

1. Read sheet `rate_filings` into a DataFrame.
2. Strip `%` from percent columns and convert to float. Empty string or null → NULL.
3. Parse `effective_date` (`MM/DD/YYYY`) and `filing_date` (`YYYY-MM-DD`) into ISO `YYYY-MM-DD` strings.
4. Clean `line_of_business`: `"04.0 Homeowners"` → `"Homeowners"`, `"19.0 Personal Auto"` → `"Personal Auto"`.
5. Derive `brand` from `company_name`.
6. Fail loudly if any `brand` is null (unmatched `company_name`), if any genuinely-required field is null (`serff_tracking_number`, `company_name`, `line_of_business`, `overall_rate_impact`), or if any date fails to parse. **`effective_date` is allowed to be null** — see schema note; don't reject those rows.
7. Insert all rows into `filings_raw`.
8. **Roll up into `filings`:**
   - Group by `(serff_tracking_number, line_of_business)`.
   - Within each group, assert `state` and `brand` are constant.
   - Compute `overall_rate_impact` as `sum(impact_i * premium_i) / sum(premium_i)`, where the sums are taken over entities with non-null `written_premium_for_program`. If all entities in a group have null premium, fall back to a simple mean of `overall_rate_impact` and log a warning row.
   - Sum `policyholders_affected` and `written_premium_for_program` across entities (null if any source value is null).
   - Track `min_entity_impact`, `max_entity_impact`, `entity_count`, `entity_names` (JSON list).
   - For other one-row-per-filing fields (`rate_activity`, `effective_date`, `filing_date`, `disposition_status`): take the value from the highest-premium entity, and assert they match across the group within tolerance; warn if they don't.
9. All inserts atomic via a single transaction. Drop both tables first if they exist.

---

## Tech stack

- **Frontend + backend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database:** SQLite via `better-sqlite3`. File at `data/filings.db`, committed to git so Vercel deploys are reproducible.
- **Hosting:** Vercel free tier
- **Import script:** Python with `pandas` + `sqlite3` (stdlib)
- **No ORM.** Raw SQL with prepared statements.
- **No auth in v1.** Profile persists in `localStorage`.

### Project structure

```
/
├── data/
│   ├── filings.db                  # Generated; committed
│   └── last_updated.txt            # ISO date; committed
├── scripts/
│   ├── import_filings.py           # xlsx → SQLite
│   └── generate_compliance.ts      # fetch official pages → grounded summaries → complianceData
├── src/
│   ├── app/
│   │   ├── page.tsx                # Overview — the landing page (redirects to /setup if no profile)
│   │   ├── setup/page.tsx
│   │   ├── prospect/page.tsx
│   │   ├── defend/page.tsx
│   │   ├── my-carriers/page.tsx       # Independents only
│   │   ├── compliance/page.tsx        # Feature 6 — grid of pre-generated topic cards
│   │   ├── methodology/page.tsx
│   │   └── api/
│   │       └── filings/route.ts    # GET with query params
│   ├── components/
│   │   ├── ProfileForm.tsx
│   │   ├── OverviewCards.tsx       # The four summary cards (incl. compliance entry-point)
│   │   ├── RecentChanges.tsx       # The recent-changes feed
│   │   ├── FilingsTable.tsx        # Shared by Prospect, Defend, My Carriers
│   │   ├── ComplianceCard.tsx      # One topic card: tag, state badge, title, summary, sources, last-checked
│   │   ├── ScopeStrip.tsx          # "Showing: AZ, NV · vs competitors of State Farm"
│   │   └── NavBar.tsx              # "My Carrier(s)" link shown for both (singular label for captives)
│   ├── lib/
│   │   ├── db.ts                   # better-sqlite3 wrapper
│   │   ├── profile.ts              # localStorage read/write + type
│   │   ├── filings.ts              # Query builders (incl. counts + most-urgent for Overview)
│   │   ├── resourceUrls.ts        # Per-state, per-topic official .gov URL map (input to generation)
│   │   ├── complianceData.ts      # Pre-generated ComplianceSummary records the app reads at runtime
│   │   ├── format.ts              # formatPolicyholders, etc.
│   │   └── constants.ts
│   └── types.ts
├── package.json
└── README.md
```

---

## UI / design system

The visual style is **flat, clean, and minimal** — think a focused internal tool, not a marketing site. Information density is high but the page should feel calm: lots of whitespace, no gradients, no shadows, no decorative effects. The agent should land on Prospect and immediately see what's actionable.

### Foundations

- **Typography:** system sans-serif stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`). A mono font (`ui-monospace, SFMono-Regular, Menlo, monospace`) is available if SERFF tracking numbers are ever surfaced as visible text, but in v1 they live only in row tooltips, so the table itself is all sans-serif.
- **Type scale:** body 13–14px, table cells 13px, page title 18px, big numbers 22px, column headers 11px uppercase with 0.4px letter-spacing.
- **Weights:** 400 (regular) and 500 (medium) only. Never 600 or 700.
- **Casing:** sentence case throughout. Column headers are the only exception (uppercase).
- **Corners:** 8px (`md`) for most elements, 12px (`lg`) for cards, 999px for pill badges.
- **Borders:** 0.5px hairlines in a low-contrast neutral. 1.5px only for the active nav tab underline.
- **No shadows, no gradients, no glow.** Functional focus rings only.
- **Dark mode is required.** Every color must work in both modes. Build with CSS custom properties for backgrounds, text, and borders — don't hardcode hex outside of the semantic palette below.

### Color usage

Semantic colors only — colors carry meaning, never decoration. Pull from a single palette defined in Tailwind config:

- **Neutral surfaces:** white primary, very-light-gray secondary (used for the scope strip, header card, and metric backgrounds), near-black text.
- **Red** for rate increases ≥10% and for the Defend page's risk-window badges. (Light red fill `#FCEBEB`, dark red text `#A32D2D` for badges.)
- **Green** for the Prospect page's "future window" badges. (Light fill `#EAF3DE`, dark text `#27500A`.)
- **Amber** for "effective this week" / pending review. (Light fill `#FAEEDA`, dark text `#633806`.)
- **Blue** for "already in effect" badges and informational accents like the "Edit" link. (Light fill `#E6F1FB`, dark text `#0C447C`.)
- **Black text** for rate impacts that don't cross the red threshold (Prospect: 5–10%; Defend: -2% to -5%).

Rule of thumb: at most three colored elements visible per screen. If everything is colored, nothing reads as urgent.

### Layout primitives

Every page follows the same chrome:

1. **Top bar** (56px tall, white, with a 0.5px bottom border)
   - Left: small dark square logo mark + product name in 14px medium.
   - Right: nav links — Overview · Prospect · Defend · Methodology · Profile. 13px, secondary text color. The active page is medium weight with a 1.5px underline beneath it (2px below the baseline).

2. **Scope strip** (slim, light-gray background, only on Prospect / Defend / My Carriers)
   - Full width, ~8px vertical padding, 12px text.
   - Left: a filter glyph + `"Showing: {states}"` in secondary text. For captives, also appends `" · vs competitors of {captive_brand}"`. For independents, no carrier suffix — the page already shows all relevant brands.
   - Right: an "Edit" link in blue, routes to `/setup`.

3. **Page body** (16px horizontal padding, 20px top padding)
   - Page title (18px medium) + one-line subtitle (13px secondary).
   - Header card (see below).
   - Filter chip row.
   - Table.

### Header card

A single horizontal bar in the secondary background color, 14px/16px padding, 8px radius. Two or three stat cells separated by 0.5px vertical dividers. Each cell has:

- 11px uppercase secondary-color label with 0.4px letter-spacing
- 22px medium-weight value on the line below

Prospect: `Filings | Largest move` — and the "largest move" cell renders the percentage in red and the carrier/state in plain text. Defend uses the same shape (`Filings | Biggest cut`).

### Filter chip row

Below the header card, above the table. Inline pills with a 0.5px border, 8px radius, 5px/10px padding, 12px text. Each chip shows the current selection plus a small chevron icon. Clicking opens a dropdown — not built out in v1 visually, but the chip itself must render.

A small 11px uppercase "Filters" label sits at the left, same secondary color as column headers.

### Table

The core of the product. Specifically:

- **No outer border.** Just hairline row dividers.
- **Header row:** 0.5px bottom border in the secondary border color (slightly darker than row dividers). Column titles in 11px uppercase, 0.4px letter-spacing, left-aligned, secondary text color.
- **Body rows:** 12px vertical padding, 8px horizontal padding (no padding-left on the first cell — it aligns with the page edge content). 0.5px bottom hairline between rows.
- **Fixed column widths** using `table-layout: fixed`. The widths from the Prospect mockup work: 16% Competitor / 7% State / 17% Line / 13% Impact / 20% Effective / 13% Status / 14% Filing.

### Cell formatting

- **Competitor / Threat / Carrier:** plain text, regular weight. For independents, an inline "Mine" pill (see Prospect columns) when the brand is one of the agent's authorized brands.
- **State:** two-letter, plain.
- **Line:** "Personal Auto" or "Homeowners".
- **Rate Impact:** medium weight, colored per the rules above. When `entity_count > 1` and `(max_entity_impact - min_entity_impact) > 5`, render a 14px circular "i" glyph immediately after the number, light-gray background, with a `title` attribute showing *"Premium-weighted across {entity_count} entities. Range: {min}% to {max}%."*
- **Effective:** the date on the first line in 12px, then a pill badge below it in 11px. Badge color follows the rules in the Window-badge tables above.
- **Status:** pill badge — green-ish "Approved" or amber "Pending".
- **Policyholders affected:** right-aligned, abbreviated (`13.3k` / `850` / `—`). Regular weight, primary text color; the `—` for null values uses secondary text color.
- **SERFF tracking number:** not a cell. Applied as a `title` attribute on the `<tr>` so it surfaces on row hover.

### Badge style

All badges use the same shape: pill (999px radius), 2px vertical / 8px horizontal padding, 11px text. Light-color fill, dark-color text from the same color family (never plain black on a colored fill). Never a colored border on a pill.

### Empty states

Centered in the table area, 14px secondary text, no illustration. The copy from each page's spec sections is the exact text.

### Coverage warning

Because setup only lets agents select states with `data_coverage: true`, a saved profile shouldn't normally contain an uncovered state. But as a defensive guard (e.g. a profile saved before coverage rules changed), if any state in `licensed_states` has `data_coverage: false`, show a single-line banner above the table: amber background, 11px/14px padding, 12px text, dark-amber text. *"{State name} isn't covered yet. Showing your other states."* If multiple, list them.

### Mobile

Below ~700px viewport width, the table becomes a vertical card stack. Each card contains the same fields, stacked with the label on the left and value on the right. The header card collapses from horizontal to two stacked rows. Nav links collapse into a hamburger menu (`ti-menu-2`). v1 doesn't need this to be beautiful, just legible.

### Reference mockup

A live HTML/CSS reference mockup is included in the project repo at `/docs/ui-reference.html`. It contains **all five screens as labeled sections** — Agency Profile, Overview, Prospect, Defend, and My Carriers — stacked vertically so the whole product can be reviewed in one file. It is self-contained (only an icon webfont loaded from CDN; all styles inline) and uses representative data pulled from the real dataset.

Use it as the visual source of truth for spacing, color, badges, chips, and rhythm — when the prose spec and the HTML disagree on *appearance*, copy the HTML. When they disagree on *logic, data, or behavior*, the prose spec wins (the HTML uses sample data and is illustrative only). The reference-only section labels and the dashed "State Resources / coming with HR" placeholder are scaffolding to aid review, not part of the product to build.

---

## Constants (`src/lib/constants.ts`)

```ts
export const BRANDS = [
  "State Farm", "GEICO", "Allstate", "Travelers",
  "Progressive", "Liberty Mutual", "Safeco", "Encompass"
] as const;

// All 50 states are listed so the setup grid shows the full national map.
// `data_coverage: true` is the ONLY flag that makes a state selectable in v1.
// As data expands, flip more states to true — no other code changes needed.
// `validated` reflects AM Best cross-check status (only meaningful where data_coverage is true).
export const STATES = [
  { code: "AL", name: "Alabama",        data_coverage: false },
  { code: "AK", name: "Alaska",         data_coverage: false },
  { code: "AZ", name: "Arizona",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "AR", name: "Arkansas",       data_coverage: false },
  { code: "CA", name: "California",      data_coverage: false },
  { code: "CO", name: "Colorado",       data_coverage: true,  validated: { auto: false, home: false } },
  { code: "CT", name: "Connecticut",    data_coverage: false },
  { code: "DE", name: "Delaware",       data_coverage: false },
  { code: "FL", name: "Florida",        data_coverage: false },
  { code: "GA", name: "Georgia",        data_coverage: false },
  { code: "HI", name: "Hawaii",         data_coverage: false },
  { code: "ID", name: "Idaho",          data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "IL", name: "Illinois",       data_coverage: false },
  { code: "IN", name: "Indiana",        data_coverage: false },
  { code: "IA", name: "Iowa",           data_coverage: false },
  { code: "KS", name: "Kansas",         data_coverage: false },
  { code: "KY", name: "Kentucky",       data_coverage: false },
  { code: "LA", name: "Louisiana",      data_coverage: false },
  { code: "ME", name: "Maine",          data_coverage: false },
  { code: "MD", name: "Maryland",       data_coverage: false },
  { code: "MA", name: "Massachusetts",  data_coverage: false },
  { code: "MI", name: "Michigan",       data_coverage: false },
  { code: "MN", name: "Minnesota",      data_coverage: false },
  { code: "MS", name: "Mississippi",    data_coverage: false },
  { code: "MO", name: "Missouri",       data_coverage: false },
  { code: "MT", name: "Montana",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "NE", name: "Nebraska",       data_coverage: false },
  { code: "NV", name: "Nevada",         data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "NH", name: "New Hampshire",  data_coverage: false },
  { code: "NJ", name: "New Jersey",     data_coverage: false },
  { code: "NM", name: "New Mexico",     data_coverage: false },
  { code: "NY", name: "New York",       data_coverage: false },
  { code: "NC", name: "North Carolina", data_coverage: false },
  { code: "ND", name: "North Dakota",   data_coverage: false },
  { code: "OH", name: "Ohio",           data_coverage: false },
  { code: "OK", name: "Oklahoma",       data_coverage: false },
  { code: "OR", name: "Oregon",         data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "PA", name: "Pennsylvania",   data_coverage: false },
  { code: "RI", name: "Rhode Island",   data_coverage: false },
  { code: "SC", name: "South Carolina", data_coverage: false },
  { code: "SD", name: "South Dakota",   data_coverage: false },
  { code: "TN", name: "Tennessee",      data_coverage: false },
  { code: "TX", name: "Texas",          data_coverage: false },
  { code: "UT", name: "Utah",           data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "VT", name: "Vermont",        data_coverage: false },
  { code: "VA", name: "Virginia",       data_coverage: false },
  { code: "WA", name: "Washington",     data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "WV", name: "West Virginia",  data_coverage: false },
  { code: "WI", name: "Wisconsin",      data_coverage: false },
  { code: "WY", name: "Wyoming",        data_coverage: false }, // listed but no filings yet
] as const;

// Convenience: the states currently selectable. Derive, don't hardcode.
export const COVERED_STATES = STATES.filter(s => s.data_coverage);

export const LINES = ["Personal Auto", "Homeowners"] as const;

// --- Compliance resources (Feature 6) ---
// Eight TOPIC categories shown per state, in this order. These are topics an agent
// needs to understand, not government departments — a single topic (e.g. Leave Laws)
// may draw on several agencies' pages.
export const RESOURCE_TOPICS = [
  { key: "wage_hour",   label: "Wage & Hour" },
  { key: "leave",       label: "Leave Laws" },
  { key: "payroll",     label: "Payroll" },
  { key: "workers_comp",label: "Workers' Comp" },
  { key: "termination", label: "Termination" },
  { key: "nexus",       label: "Nexus & Licensing" },
  { key: "hiring",      label: "Hiring Basics" },
  { key: "remote",      label: "Remote Work" },
] as const;

// Per-state, per-topic official source URLs. Because a topic can span multiple
// agencies, each (state, topic) maps to an ARRAY of official source URLs — one or
// more. The AI summary fetches ALL mapped pages for that topic and summarizes
// strictly from their combined content, never the model's own knowledge. Every
// source URL used is shown as a link beneath the summary.
//
// This is a hand-maintained map of official .gov pages and is the ONLY place the
// Compliance feature gets its source URLs. Keep it in src/lib/resourceUrls.ts.
//
// Shape:
//   export const RESOURCE_URLS:
//     Record<StateCode, Partial<Record<TopicKey, string[]>>> = {
//       WA: {
//         wage_hour: [
//           "https://www.lni.wa.gov/workers-rights/wages/minimum-wage/",
//           "https://www.lni.wa.gov/workers-rights/wages/overtime/",
//         ],
//         leave: [
//           "https://paidleave.wa.gov/",
//           "https://www.lni.wa.gov/workers-rights/leave/paid-sick-leave/",
//         ],
//         payroll:      ["https://dor.wa.gov/"],
//         workers_comp: ["https://www.lni.wa.gov/insurance/"],
//         termination:  ["https://esd.wa.gov/..."],
//         nexus:        ["https://www.insurance.wa.gov/licensing"],
//         hiring:       ["https://esd.wa.gov/..."],
//         remote:       ["https://www.lni.wa.gov/..."],
//       },
//       ...
//     };
//
// URLs above are illustrative placeholders — real official URLs must be filled in.
// Coverage must extend to every state an agent can pick in employee_states (up to
// all 50). A topic with no mapped URLs renders the "source coming soon" fallback.
// A topic may map to several URLs; the summary spans all of them.

// All percent values throughout the app are stored as WHOLE-NUMBER PERCENT.
// 5.0 means "5%". Display formatting adds the % sign.
export const PROSPECT_MIN_IMPACT = 5.0;    // ≥ +5% counts as "raising"
export const DEFEND_MAX_IMPACT  = -2.0;    // ≤ -2% counts as "lowering"
export const LOOKBACK_MONTHS    = 12;
```

These thresholds **must be defined in one place**. Never hardcode them in queries or components. Likewise, the set of selectable states is derived from `data_coverage`, never hardcoded as a separate list — expanding coverage is a one-flag change per state.

Note: the 8 states with `data_coverage: true` are AZ, CO, ID, MT, NV, OR, UT, WA. WY is listed but not yet covered (zero filings in the current dataset).

---

## Feature 1: Agency Profile (`/setup`)

This screen — labeled "Agency Profile" in the UI — is what the product summary doc calls "Step ① — Set up your profile." It collects everything that personalizes the agent's world: who they sell for, where they sell, and (for the future HR & Compliance module) basic agency details and where their staff work. The exact doc language for the core piece: *"Enter your licensed states and the carriers you are authorized to sell. Captive agents select one carrier (e.g. State Farm). Independent agents can select many. Everything filters to your world from here."*

Header copy: title **"Agency Profile"**, subtitle *"Update your agency details to keep your intelligence and (soon) compliance feeds relevant."*

### What it collects

```ts
type AgentProfile = {
  // --- All fields required ---
  agent_type: "captive" | "independent";
  authorized_brands: string[];      // subset of BRANDS — exactly 1 if captive
  licensed_states: string[];        // "Licensed / doing business" states — where they SELL.
                                     // Only data_coverage:true states allowed. Drives Prospect/Defend/My Carriers.
  full_name: string;
  zip_code: string;                 // 5-digit US ZIP
  home_state: string;               // single state (any of the 50)
  employee_count: number;           // office size, >= 1
  employee_states: string[];        // "Employee work/live" states — any of the 50, not data-gated.
                                     // Collected for the future HR module; not used by any v1 feature.
  created_at: string;               // ISO
};
```

Stored in `localStorage` under key `agent_profile`. No backend, no email, no password.

**All fields are required.** The agent cannot save an incomplete profile. This includes the agency-details and employee-states fields, even though several of them don't feed any v1 query — collecting them up front means the HR & Compliance module has a complete profile to work with the day it launches, and it keeps every agent's record uniform.

**Important distinction between the two state lists:**
- `licensed_states` ("Licensed / doing business states") = where the agent sells. This is the list that powers every v1 query. It is restricted to `data_coverage: true` states, because there's no filing data for the others.
- `employee_states` ("Employee work/live states") = where the agent's staff work and live. This drives the future HR & Compliance feed (state labor law, workers' comp, etc.) and is NOT used by any v1 feature. It is collected now to future-proof the profile. It is NOT data-gated — any of the 50 states can be selected, because compliance applies regardless of whether we have filing data there.

Do not let the two lists share state in the UI — they are independent selections.

### UX

Single page, laid out as an "Agency Details" card. Sections in this order:

1. **Agency details (top).** All required:
   - **Full name** — text input, non-empty.
   - **ZIP code** — text input, exactly 5 digits.
   - **Home state** — single-select dropdown of all 50 states.
   - **Employees** — number input, integer ≥ 1.
   These don't affect any v1 query; they're captured for the future HR module and personalization. They're required so every profile is complete and uniform.

2. **Agent type** — two radio cards side by side:
   - "Captive — I sell one carrier (e.g. State Farm)"
   - "Independent — I sell multiple carriers"

   Selecting Captive constrains the carriers section to single-select (radio behavior); Independent makes it multi-select (checkbox behavior).

3. **Authorized carriers** — *"Which carriers are you authorized to sell?"* Selection grid of the 8 brands. Radio buttons (single-select) if Captive, checkboxes (multi-select) if Independent. Brand names exactly as in `BRANDS`. **Required.** (The screenshot omits carriers, but they are non-negotiable — they drive the entire Prospect/Defend model. Keep this section.)

4. **Licensed / doing business states** — *"Which states are you licensed to sell in?"* A grid of **all 50 states** from the `STATES` constant. Only `data_coverage: true` states (currently 8: AZ, CO, ID, MT, NV, OR, UT, WA) are selectable; the other 42 render greyed out (~0.4 opacity, `cursor: not-allowed`, a "Soon" pill). Selected states show as removable chips above the grid (matching the screenshot's chip pattern: "WA ×  ID ×  OR ×"). A "Search states…" input filters the list. **Required (≥1).**
   - Above the grid, a notice: *"We currently have data for 8 states, with all 50 coming soon. You can only select states we cover today."*
   - Selectability is driven purely by `data_coverage` — expanding coverage is a one-flag change.

5. **Employee work / live states** — *"Which states do your employees work or live in?"* Same chip + search + checkbox-grid pattern as section 4, but **all 50 states are selectable** (no data gating, no "Soon" tags). **Required (≥1).** A small note: *"Used for compliance features coming soon."* This list is stored but not used in v1.

"Save changes" button validates **all** fields: `agent_type` set; ≥1 authorized carrier (exactly 1 if captive); ≥1 licensed state with every licensed state `data_coverage: true` (tamper guard); full name non-empty; ZIP exactly 5 digits; home state selected; employee count an integer ≥ 1; ≥1 employee state. Any failure blocks save and surfaces an inline error on the offending field. On success, writes to localStorage and routes to `/` (the Overview).

### Future HR & Compliance note

The screenshot also shows a **State Resources** panel (per-state links to Labor Dept, Tax/Revenue, Insurance Dept, Workers' Comp) keyed off the employee states. This panel and the compliance feed it implies are part of the future HR & Compliance module and are **out of scope for v1** — do not build them. Section 5 above exists only to capture `employee_states` so that module has its input ready when it's built. The State Resources panel is explicitly deferred.

### Redirect logic

On every page load, if `localStorage.agent_profile` is missing, all routes except `/setup` and `/methodology` redirect to `/setup`. After a successful save, route to `/` (the Overview).

### Edit

"Profile" link in the nav opens `/setup` pre-filled with all saved values.

---

## Carrier visibility model

The whole product is shaped by one rule: **what an agent sees on Prospect, Defend, and My Carriers depends on whether they're captive or independent.** This rule replaces the previous "active_carrier" / Carrier Toggle concept entirely.

### Captive agents

A captive only sells one carrier. They want to know about **competitors** — full stop. The view from a State Farm agent's seat in AZ + NV is: who else is moving rates in my states, and how should I react.

- **Prospect:** filings where `brand != captive_brand` AND `overall_rate_impact >= +5%`. Competitors raising rates → opportunities to attack.
- **Defend:** filings where `brand != captive_brand` AND `overall_rate_impact <= -2%`. Competitors cutting rates → retention risks.
- **My Carrier tab:** visible (labelled singular). Filings where `brand = captive_brand`, no threshold — every recent filing for the carrier they sell, so they have their own carrier's rate moves in front of them when customers call. (Earlier this was hidden for captives; that was reversed — see Resolved decisions.)

### Independent agents

An independent can quote with any carrier they're authorized to sell. **They need full market visibility** — including their own carriers — so they can decide which carrier to lead with on any given quote. If State Farm just raised rates in AZ and Travelers didn't, an independent who sells both should be steering AZ quotes toward Travelers. That decision requires seeing State Farm's move.

- **Prospect:** filings where `brand IN (all 8 brands)` AND `overall_rate_impact >= +5%`. Every meaningful rate increase in the agent's states, including ones from carriers they sell. The framing is no longer "attack competitors" — it's "rate moves you should know about."
- **Defend:** filings where `brand IN (all 8 brands)` AND `overall_rate_impact <= -2%`. Every meaningful rate cut in the agent's states.
- **My Carriers tab:** filings where `brand IN (authorized_brands)`. No threshold filter — every recent filing involving the agent's own carriers, so they can see what's happening across their full book at once.

### Important framing change

For independents, **Prospect is no longer literally "carriers to attack."** It's more like "rate moves in your states that affect prospecting decisions." Some of those moves are from carriers the agent sells (which is useful — it means *their own* book may shop) and some are from carriers the agent doesn't sell (which means competitor customers are shopping).

The Prospect page header copy should reflect this distinction for independents. See "Page copy by agent type" below.

### Page copy by agent type

Same components, slightly different framing text. Drives this from `agent_type` in the profile.

| Page | Captive copy | Independent copy |
|---|---|---|
| Prospect title | "Prospect" | "Prospect" |
| Prospect subtitle | "Competitors raising rates in your states — your opportunity." | "Rate increases in your states — opportunities to attack and decisions to make." |
| Prospect header card label | "Filings vs {captive_brand}" | "Filings in your states" |
| Defend title | "Defend" | "Defend" |
| Defend subtitle | "Competitors lowering rates — your customers may shop." | "Rate decreases in your states — your customers may shop." |
| My Carriers visible? | Yes (labelled "My Carrier", singular) | Yes ("My Carriers", plural) |

---

## Feature 2: Overview (`/` — the landing page)

The default landing page after setup. A calm, scannable dashboard that answers "what should I care about right now?" in one screen, then sends the agent into the detailed tables. Everything here is derived from the same rolled-up `filings` data and the same captive/independent visibility rules as the tables — the Overview is a summary layer, not a separate data path.

### Routing

- Route: `/`
- If no profile in localStorage → redirect to `/setup` (same guard as the other pages).
- After setup's "Save and continue," route here (not to `/prospect`).

### Page header

- Title: **"Overview"** (18px medium).
- Subtitle: the agent's scope, e.g. *"State Farm · AZ, NV"* (captive) or *"AZ, NV · 3 carriers"* (independent). Secondary text, 13px.

No "Demo Mode" badge — the Overview always renders real data for the agent's actual profile. (Demo mode is not a v1 feature.)

### Summary cards (four)

A row of cards, equal width, `var(--border-radius-lg)`, white background, 0.5px border, ~16px padding. On desktop, four across; on mobile they stack vertically (or wrap 2×2 on mid widths). Brand Health is deliberately NOT one of them (out of scope for v1).

1. **Prospect opportunities**
   - Small icon (e.g. `ti-target-arrow`) in a light-neutral rounded square.
   - Label "Prospect opportunities" (13px secondary).
   - Big number (22px medium) = count of rows the Prospect query returns for this profile.
   - "View all →" link routing to `/prospect`.

2. **Defend risks**
   - Icon `ti-shield-half` in a light-amber rounded square.
   - Label "Defend risks."
   - Big number = count from the Defend query.
   - "View all →" link routing to `/defend`.

3. **Most urgent**
   - Accented card: 2px border in `--color-border-danger` (the one allowed exception to 0.5px borders, for the featured item), light-danger tint icon `ti-alert-triangle`.
   - Label "Most urgent."
   - Body: the carrier + signed impact of the single most urgent filing, e.g. **"GEICO +50.9%"**, in 14px medium.
   - A red pill below showing the time window, e.g. "1 week left" (future) or "In effect 6w" (past).
   - Clicking the card routes to whichever table that filing belongs to (Prospect if it's an increase, Defend if a decrease), ideally scrolled/highlighted to that row (highlight is a nice-to-have; routing to the right table is the requirement).

4. **Compliance** (lightweight v1 version)
   - Icon `ti-gavel` (or `ti-scale`) in a light-neutral rounded square.
   - Label "Compliance."
   - Body: "{n} states tracked" where n = `employee_states.length`, in 14px medium.
   - A small secondary line: "Last checked {date}" — for v1 this is simply today's date / the date the page loaded, since there's no snapshot pipeline yet. Keep the phrasing factual; do NOT claim anything is "new" or "changed."
   - "View resources →" link routing to `/compliance`.
   - **Important:** this card must not imply change-detection it doesn't have. It's a presence/entry-point card, not a "new law" alert. The real "new law" highlight is Phase B and only ships once the snapshot/diff pipeline exists.

### "Most urgent" selection logic

The single highest-priority filing for this agent, chosen by a two-tier rule (important: the current dataset has no future-dated filings, so the fallback tier is not hypothetical — it is what actually renders):

1. **Tier 1 — soonest upcoming.** Among filings in the agent's scope that cross a threshold (Prospect ≥ +5% or Defend ≤ −2%) and have a *future* effective date, pick the one with the soonest effective date. Ties broken by larger absolute impact. Pill: "{n} week(s) left" (or "Effective this week" if ≤6 days out).
2. **Tier 2 — largest impact in window.** Otherwise, pick the threshold-crossing filing with the largest absolute impact across the whole 12-month window. Ties broken by recency (newer first). Pill: "In effect {n}w" (or "Pending review" if no effective date).
3. **Empty.** If the agent has zero threshold-crossing filings at all, hide the Most Urgent card and render only the two count cards. (Or show a muted "Nothing urgent right now" card — engineer's choice, but don't show a broken/empty card.)

For independents, "scope" means all 8 brands (matching their Prospect/Defend visibility); for captives it excludes their own brand.

**Why two tiers, not three.** Earlier drafts had Tier 2 = "largest |impact| within the last 8 weeks" and Tier 3 = "largest |impact| in the window," intended to favor recent moves. The reason that's not load-bearing: Tier 1 is the real urgency signal — "act before this hits." Once nothing is in the future, recency stops being a useful proxy for urgency; magnitude is. A small recent defend filing (e.g. −5% effective last week) is not more important to surface than a 50% prospect move from two months ago. The pill text still reflects recency, so the agent can tell at a glance whether the headline move is fresh or older, but the *selection* is by magnitude. Captures the spec verification's intent ("largest absolute impact in window") cleanly.

### Recent changes feed

Below the cards, a single white card titled "Recent changes." A list (not a table) of the most recent threshold-crossing filings in the agent's scope, newest first, capped at a sensible number (e.g. 8).

Each row:
- Left: carrier name (14px medium) on the first line; below it, a 12px secondary line: *"{signed impact} in {state} · {prospect|defend}"* — e.g. *"+15% in AZ · prospect"* or *"−5% in AZ · defend"*.
- Right: a small age pill, e.g. "1w", "3w" — weeks since (or until) the effective date. Red tint if it's a Defend risk or a near-term/future Prospect move; neutral gray otherwise. (Keep it simple: red for defend rows and for prospect rows ≤2 weeks out, gray otherwise.)
- 0.5px hairline divider between rows.

The feed is informational and uses the same data the tables do; clicking a row routes to that filing's table (Prospect or Defend).

### Data note

All three card counts and the feed must reconcile exactly with what the agent sees when they click through to the tables — same queries, same filters, same 12-month default window. The Overview is not allowed to use a different threshold or window than the tables, or the numbers won't match and the agent will lose trust.

### Verification (sample profile: captive State Farm, AZ + NV)

- Prospect opportunities: **12**
- Defend risks: **8**
- Most urgent: no future filings in the dataset → Tier 2/3 fallback → the GEICO NV +50.9% filing (largest absolute impact in window) with an "in effect" pill.
- Recent changes (newest first): Travelers −5.0% AZ (defend), Allstate −2.0% AZ (defend), GEICO +6.3% NV (prospect), GEICO +50.9% NV (prospect), Liberty Mutual +10.0% NV (prospect), …

These come from the same queries as the tables; if the Overview counts don't match the table row counts for the same profile, something is wired wrong.

---

## Feature 3: Prospect Table (`/prospect`)

### Concept

"Competitors raising rates in your states = your opportunity."

### Query

The brand filter depends on `agent_type` (see "Carrier visibility model" above).

```sql
-- Captive: exclude the agent's one brand. Competitors only.
SELECT * FROM filings
WHERE state IN (:agent_states)
  AND brand != :captive_brand
  AND rate_activity IN ('rate_change', 'rate_change_pending')
  AND overall_rate_impact >= 5.0
  AND effective_date >= date('now', '-12 months')
ORDER BY effective_date DESC, overall_rate_impact DESC

-- Independent: all 8 brands, no exclusion.
SELECT * FROM filings
WHERE state IN (:agent_states)
  AND rate_activity IN ('rate_change', 'rate_change_pending')
  AND overall_rate_impact >= 5.0
  AND effective_date >= date('now', '-12 months')
ORDER BY effective_date DESC, overall_rate_impact DESC
```

(`5.0` is `PROSPECT_MIN_IMPACT`, passed as a parameter — do not inline.)

The query builder in `src/lib/filings.ts` should branch on `profile.agent_type`. Both queries are otherwise identical.

### Columns

| Column | Source | Display |
|---|---|---|
| Carrier | `brand` | Plain text. **For independents only:** if `brand IN authorized_brands`, append a small blue "Mine" pill badge (10px text, light-blue fill, dark-blue text, 6px horizontal padding) inline to the right of the brand name. Captives don't see this — every row by definition isn't their brand. |
| State | `state` | Two-letter |
| Line | `line_of_business` | Personal Auto / Homeowners |
| Rate Impact | `overall_rate_impact` | `+8.5%`, bold; red text if ≥ +10%, **black** if 5–10%. **If `entity_count > 1` and `max_entity_impact - min_entity_impact > 5`, append a small info icon with a tooltip:** *"Premium-weighted across {entity_count} entities. Range: {min_entity_impact}% to {max_entity_impact}%."* |
| Effective | `effective_date` + Window badge | See below |
| Status | `rate_activity` | Badge: "Approved" or "Pending review" |
| Policyholders affected | `total_policyholders` | Abbreviated count: `13.3k`, `2.4k`, `850`. Right-aligned. If null, render `—` (em dash) — null means "not disclosed," not zero. See formatting rule below. |

The first column header reads **"Carrier"** for independents and **"Competitor"** for captives.

The SERFF tracking number is **no longer its own column.** It moves to a row-level hover tooltip: hovering anywhere on the row shows `title="Filing: {serff_tracking_number}"`. This frees the column width for the policyholders count, which is far more useful at a glance, while keeping the tracking number accessible for agents who want to look it up on SERFF.

### Policyholder count formatting

`total_policyholders` is summed across entities in the rollup. Format for compactness:

- `>= 1,000,000` → one decimal + "M": `1366100` → `1.4M`. (The data does contain filings affecting over a million policyholders — large multi-entity State Farm rollups, for example — so handle this tier.)
- `>= 1000` and `< 1,000,000` → one decimal + "k": `13269` → `13.3k`, `2400` → `2.4k`. Round to one decimal; drop a trailing `.0` (so `2000` → `2k`, not `2.0k`).
- `< 1000` → plain integer: `850`, `47`.
- `null` → `—`. Roughly a portion of source filings have null `policyholders_affected`; this is expected, not an error. Render the em dash in secondary text color.

This formatting lives in a shared helper (e.g. `formatPolicyholders(n)` in `src/lib/format.ts`) used by all three tables.

For independents, rows where `brand IN authorized_brands` also get a very subtle warm-tinted background (`rgba(255, 230, 200, 0.18)` over the white row background) so the agent can scan their own carrier moves at a glance. This is the visual signal that "this row is about your book, not someone else's."

`sub_type_of_insurance` is **not** displayed at this level — it only exists in `filings_raw` and varies across entities within a filing. The `line_of_business` granularity is sufficient for v1.

### Window badge

Compute `days_delta = effective_date - today` and `weeks = round(days_delta / 7)`.

| Condition | Badge color | Text |
|---|---|---|
| Pending (no confirmed effective date) | Yellow | "Pending review" |
| `days_delta > 0` and `weeks >= 1` | Green | "In {weeks} weeks" |
| `0 <= days_delta <= 6` | Orange | "Effective this week" |
| `-56 <= days_delta < 0` | Blue | "In effect {abs(weeks)} weeks" |
| `days_delta < -56` | Gray | "In effect (older)" |

### Filters above the table

- State multi-select (defaults to all of the agent's licensed states)
- Line multi-select (Personal Auto, Homeowners; default both)
- **Time window** dropdown: "Last 12 months" default, plus "Last 30 days" and "Last 90 days" options. Filters by `effective_date` relative to today — narrows in for "what changed recently" without losing the 12-month default that powers the rest of the spec.
- Sort dropdown: "Effective date (newest)" default, "Rate impact (largest)" alternative

### Header card

Above the table: *"X filings across Y states. Largest move: +Z% by **{Carrier}** in **{State}**."* If zero results, omit the card.

### Empty state

*"No competitors are raising rates in your states right now (≥5% threshold). Check back next month — data refreshes monthly."*

### Coverage warning

If any of the agent's licensed states has `data_coverage: false`, show the coverage-warning banner described in the UI section. In normal operation this won't fire, since setup prevents selecting uncovered states.

---

## Feature 4: Defend Table (`/defend`)

### Concept

"Competitors lowering rates = customers about to shop you."

### Query

```sql
-- Captive
SELECT * FROM filings
WHERE state IN (:agent_states)
  AND brand != :captive_brand
  AND rate_activity IN ('rate_change', 'rate_change_pending')
  AND overall_rate_impact <= -2.0
  AND effective_date >= date('now', '-12 months')
ORDER BY effective_date DESC, overall_rate_impact ASC

-- Independent
SELECT * FROM filings
WHERE state IN (:agent_states)
  AND rate_activity IN ('rate_change', 'rate_change_pending')
  AND overall_rate_impact <= -2.0
  AND effective_date >= date('now', '-12 months')
ORDER BY effective_date DESC, overall_rate_impact ASC
```

### Columns — same shape as Prospect, with these differences

- Column header renames: "Competitor" → "Threat"
- Rate Impact: format `-3.2%`, red if ≤ -5%, black if -2 to -5%
- Window badge phrasing:
  - `days_delta > 0` and `weeks >= 1` → Red badge: **"Risk window opens in {weeks} weeks"**
  - `0 <= days_delta <= 6` → Red badge: **"Risk window open now"**
  - `days_delta < 0` → Orange badge: **"Customers may already be shopping"**
  - Pending → Yellow: "Pending review"

### Filters above the table

Same as Prospect: State multi-select, Line multi-select, **Time window dropdown** (Last 12 months default; 30/90 days options), Sort dropdown. The time window filter applies the same `effective_date >= date('now', '-{N} days')` pattern.

### Header card

*"X carriers are getting cheaper in your markets. Biggest cut: **-Z%** by **{Carrier}** in **{State}**."*
(Drop the per-policy dollar figure — `written_premium_change / policyholders_affected` is noisy and many rows are null.)

### Empty state

*"No competitors are cutting rates in your states (≤ -2% threshold). Your book is safe — for now."*

---

## Feature 5: My Carriers Table (`/my-carriers`) — all agent types

### Concept

*"What's happening across the carrier(s) I sell?"* Shows every recent filing involving the agent's authorized brands in their licensed states, regardless of impact magnitude. The agent uses this to monitor their own book — which of their carriers just moved rates, in which direction, where.

**Available to both captive and independent agents.** An independent sees all the carriers they sell; a captive sees their single carrier's filings. A captive State Farm agent very much wants their own carrier's rate moves in front of them — they're the ones fielding customer calls when State Farm changes rates. (This reverses an earlier "independents-only" decision; see Resolved decisions.)

### Route & visibility

- Route: `/my-carriers`
- Visible in the nav for **both** agent types. The nav label is **"My Carrier"** (singular) for captives, **"My Carriers"** (plural) for independents.
- No redirect — both agent types can load the page directly.

### Single-carrier (captive) framing

Because a captive sells exactly one carrier, the page adapts:
- Nav label: **"My Carrier"** (singular).
- Page title **"My Carrier"**; subtitle names the carrier, e.g. *"Every recent State Farm filing in your states — so you know what your book is doing."*
- Header card: instead of a "Carriers tracked: N" count (always 1 for a captive), the first cell reads **"Your carrier"** and shows the carrier name.
- The Carrier filter chip is hidden (a one-option filter is pointless).
- The query is unchanged — `brand IN (authorized_brands)`, which for a captive is just their single brand.

### Query

```sql
SELECT * FROM filings
WHERE state IN (:agent_states)
  AND brand IN (:authorized_brands)
  AND rate_activity IN ('rate_change', 'rate_change_pending')
  AND effective_date >= date('now', '-12 months')
ORDER BY effective_date DESC, overall_rate_impact DESC
```

No threshold filter — `overall_rate_impact` is shown as-is, including small moves and zeros. This is the surveillance view, not the action view.

### Columns

Same shape as Prospect/Defend with these differences:

- Column header "Competitor" → **"Carrier"** (these are the agent's own brands)
- Rate Impact: format with explicit `+` or `−` sign. Red if ≥ +5%, green if ≤ -2%, black otherwise. (Matches Prospect's red threshold and Defend's green threshold, but applied to a single column so the agent can scan direction at a glance.)
- No "Status" pill differentiation — render Approved and Pending using the same pill styles as the other pages.
- Window badge phrasing is **neutral**, not action-oriented:
  - `days_delta > 0` and `weeks >= 1` → Gray badge: **"In {weeks} weeks"**
  - `0 <= days_delta <= 6` → Gray badge: **"Effective this week"**
  - `days_delta < 0` → Gray badge: **"In effect {abs(weeks)} weeks"**
  - Pending → Yellow: "Pending review"

The neutral coloring is intentional — this tab is informational, not opportunity-flagging.

Like Prospect and Defend, the last column is **Policyholders affected** (`total_policyholders`, abbreviated, `—` when null), and the SERFF tracking number lives in the row hover tooltip rather than its own column.

### Filters above the table

- State multi-select (defaults to all of the agent's licensed states)
- Carrier multi-select (defaults to all of the agent's `authorized_brands`)
- Line multi-select (Personal Auto, Homeowners; default both)
- **Time window** dropdown: "Last 12 months" default, plus "Last 30 days" and "Last 90 days" options
- Sort: "Effective date (newest)" default, "Rate impact (largest move, abs value)" alternative

### Header card

A horizontal three-cell card:

- **Carriers tracked:** `authorized_brands.length`
- **Filings this period:** total in result set
- **Largest move:** the absolute-value max impact, signed: e.g. *"+24.9% — State Farm in NV"* or *"-8.5% — Travelers in AZ"*

### Empty state

*"No recent filings from your authorized carriers in your states. The data refreshes monthly — check back."*

---

## Feature 6: Compliance (`/compliance`)

Per-state HR & insurance regulatory resources for the agent's **employee work/live states** (`employee_states` from the profile — where their staff are, since that's what drives labor-law and workers'-comp obligations). The page is a **grid of topic cards**: for each employee state, one card per topic from `RESOURCE_TOPICS` (Wage & Hour, Leave Laws, Payroll, Workers' Comp, Termination, Nexus & Licensing, Hiring Basics, Remote Work). Each card shows a short, pre-generated, plain-language summary grounded in official source pages, plus links to those sources.

These are practical topics an agent needs to understand, not government departments. A single topic can span more than one agency, so each (state, topic) maps to **one or more** official source URLs (see `RESOURCE_URLS`).

### Architecture — pre-generated & cached (not live-fetch)

Summaries are **generated ahead of time and stored**, not fetched live when the agent views the page. This is the safer, faster model for a compliance feature:

- No per-request latency, no per-view API cost, and no exposure to .gov sites blocking a server-side fetch at view time.
- The agent always sees a vetted, stored summary rather than whatever a live fetch happens to return.
- Each summary carries its own `last_checked` date, shown on the card — which is exactly why the design has a per-card date.

A **regeneration job** (run manually or on a schedule, e.g. monthly) fetches the mapped official pages for each (state, topic), generates the grounded summary, and writes the result — summary text, source URLs used, and `last_checked` date — to stored content (a JSON/data file committed to the repo, or a row in the data layer). The web app reads only this stored content; it never fetches official pages at view time. This regeneration job is also the natural foundation for Phase B change detection (see end of doc).

Stored shape per (state, topic):
```ts
type ComplianceSummary = {
  state: StateCode;
  topic: ResourceKey;
  title: string;        // descriptive card title, e.g. "Washington Paid Family & Medical Leave"
  summary: string;      // 2–3 short plain sentences
  sources: string[];    // official URLs used, displayed as bare domains
  last_checked: string; // ISO date, shown on the card
};
```

### Routing & visibility

- Route: `/compliance`. Visible in the nav for all agent types (captive and independent both have compliance needs).
- If no profile → redirect to `/setup`.
- If the agent's `employee_states` is empty (shouldn't happen — it's required at setup), show an empty state prompting them to add employee states in their profile.

### Layout — grid of topic cards

- Page title "Compliance", subtitle *"HR & insurance regulations for the states your team works in: {list of employee_states}."*
- A short disclaimer banner at the top (see "Disclaimer").
- Below it, a responsive **grid of cards** (e.g. 3 across on desktop, 1 on mobile). Cards are grouped/ordered by state, then by the fixed `RESOURCE_TOPICS` order within each state. (Optionally a state filter to focus on one state.)

### Card design (match the reference exactly)

Each card is a white surface, 0.5px border, `var(--border-radius-lg)`, ~16px padding, containing:

1. **Header row:** a small colored topic **tag** on the left (e.g. "Leave Laws" — light fill, dark text from the same color family) and a small **state badge** on the right (e.g. "WA" — neutral pill).
2. **Title:** a descriptive, specific title in 15px medium, e.g. "Washington Paid Family & Medical Leave" — distinct from the topic tag. The regeneration job writes this.
3. **Summary:** 2–3 short, plain-language sentences (13–14px, secondary text). Short and scannable — not a dense paragraph. Example: *"Paid Leave Oregon provides up to 12 weeks of paid leave for family, medical, or safe leave. Contributions are split between employer and employee."*
4. **Divider**, then a **"Sources"** label (11px uppercase secondary).
5. **Source links:** each official source as a **bare domain** with a small external-link icon, e.g. "↗ paidleave.wa.gov" / "↗ lni.wa.gov". One line per source.
6. **"Last checked: {date}"** in small tertiary text at the bottom.

### Grounding requirement (still non-negotiable, applied at generation time)

The regeneration job's prompt must instruct the model to write the summary **strictly from the fetched official page content** — never the model's own knowledge — to omit anything the pages don't clearly support, and to keep it to 2–3 sentences. The stored `sources` are exactly the pages the summary was generated from. This is what keeps a wrong summary from being presented as authoritative.

### Fallbacks

- **No URLs mapped for a (state, topic):** don't render a card for it (or render a muted "Coming soon" card). Don't show a broken link.
- **Regeneration fetch failed for a source:** that source is dropped from the stored `sources`; if all sources failed, no summary is stored and the card shows the bare official link(s) with "Summary coming soon." (Because generation is offline, these failures are caught by whoever runs the job — not by the end user at view time.)

### Disclaimer

A persistent disclaimer banner at the top of the page, and a small repeated line on each card or its summary: *"AI-generated summary of the official source(s), which may be incomplete or out of date. Always verify on the official site. This is not legal advice."* Non-optional for a compliance feature.

### What this feature does NOT do in v1

- It does **not** detect or highlight *changes* to regulations ("new law"). That's Phase B — but note the regeneration job is the groundwork for it: once summaries are regenerated on a schedule, comparing successive versions is the natural next step.
- It does **not** tailor content by office size. `employee_count` is captured and many obligations are size-dependent (FMLA at 50, ACA at 50 FTEs), but v1 surfaces topic-level sources, not headcount-specific determinations.

### Regeneration job

A script (e.g. `scripts/generate_compliance.ts` or a serverless cron) iterates over the covered states × topics in `RESOURCE_URLS`, fetches each mapped page, generates the grounded 2–3 sentence summary + descriptive title, and writes the `ComplianceSummary` records (with today's date as `last_checked`) to stored content the app reads. v1 can run this manually; scheduling it is a small enhancement and the bridge to Phase B.

---

## Shared component: `FilingsTable`

All three pages render via this single component. Props:

```ts
type FilingsTableProps = {
  mode: "prospect" | "defend" | "my-carriers";
  filings: Filing[];
  loading: boolean;
};
```

`mode` controls: column header text ("Competitor" / "Threat" / "Carrier"), badge colors and phrasing, threshold display, empty-state copy. Do not duplicate the component per page.

---

## Filter state management

Each page (Prospect, Defend, My Carriers) owns its own filter state — React state inside the page component, not localStorage. **Filters don't persist across page navigations or reloads.** Refreshing the page resets every filter chip to its default.

This is intentional. Persisting filters across visits creates a subtle trust problem: an agent visits Prospect on Monday with a Last-30-days filter set, returns Friday to glance at the dashboard, and sees a near-empty table because they forgot they'd narrowed it. The product summary doc's promise is *"see exactly where competitors are raising or lowering rates"* — the default view should always show the full 12-month picture.

Defaults per page:

| Filter | Prospect | Defend | My Carriers |
|---|---|---|---|
| State | All licensed states | All licensed states | All licensed states |
| Carrier | n/a | n/a | All authorized brands |
| Line | Both | Both | Both |
| Time window | Last 12 months | Last 12 months | Last 12 months |
| Sort | Effective date (newest) | Effective date (newest) | Effective date (newest) |

The time window dropdown's three options have the same semantics across server and client: `effective_date >= date(:asOf, '-30 days' | '-90 days' | '-12 months')`. The query builder in `src/lib/filings.ts` accepts a window parameter so callers can ask for a narrower window directly, but **the table pages always fetch the broadest 12-month set once per profile and narrow client-side** via `applyFilters()` in `src/lib/filters.ts`. This makes every filter change (window, state, line, carrier, sort) instant — no refetch latency — and lets `filteredToEmpty` be distinguished from no-data because the raw fetch always carries the full 12-month set.

Callers other than the table pages (e.g. Overview Most Urgent / Recent Changes) use the 12-month default and don't expose a window picker, so the architecture is invisible to them.

**`:asOf` anchors to data freshness, not the wall clock.** The query builder defaults `:asOf` to the date in `data/last_updated.txt` (written by `scripts/import_filings.py` as the source xlsx's mtime). The client-side `windowCutoff()` helper uses the same `asOf` from the API response — so both paths produce identical cutoffs and the spec's verification counts stay valid until the data is regenerated. The active window doesn't silently shed filings as the calendar advances between deploys.

---

## Feature 7: Rate Positioning (`/positioning`) — all agent types

### Concept

Per (line, state), the **premium-weighted average rate *change*** the agent's carrier filed, compared against **each competitor individually** — the spread, never a blended field average. This is a sparse, comparison-first view: only cells where the agent's carrier actually filed are shown; competitors absent from a cell are labeled "insufficient data"; every comparison expands to the underlying filings that produced it. The data is genuinely sparse (see recon below), so the design surfaces the real comparisons rather than rendering a mostly-empty matrix.

Captive = their one carrier vs the field. Independent = each of their carriers vs the rest (brands they don't sell), per carrier — never blended.

### Route, nav, chrome

- **Route:** `/positioning`. **Nav label:** "Positioning" (icon `ti-arrows-left-right`, confirmed present in the self-hosted Tabler webfont). Shown for **both** agent types. Hidden in the no-profile nav; redirects to `/setup` when no profile (same guard as Prospect/Defend/My Carriers).
- **ScopeStrip:** shown — `"Showing: {states} · vs competitors of {brand}"` (captive) / `"Showing: {states}"` (independent).
- **Title:** "Rate positioning." **Subtitle (captive):** *"How {brand}'s recent rate changes compare to each competitor, by line and state."* **(independent):** *"How your carriers' recent rate changes compare to the rest of the market."*

### Rate-change framing is LOAD-BEARING PRODUCT COPY, not a footnote

This feature's central risk is being read as a price/cheapness comparison. The disclaimer carries more weight here than anywhere else in the app and is treated as primary product copy:

- A **persistent, always-visible callout band** sits directly under the page title (full width, amber-neutral, ~13px, sticky to the top of the page body — it does not scroll away):

  > **These are rate *changes*, not prices.** Every figure is the average percentage a carrier *changed* its filed rates — not how cheap it is. A carrier raising less or cutting more is moving more favorably for shoppers; it says nothing about whose premium is lower today.

- Reinforced so the frame travels with the data: the comparison column header reads **"avg rate change"** (never "rate"/"avg" alone), and each expanded audit panel repeats a one-line **"change filed, not price"** caption.

This band is not dismissible and not collapsible. If it is ever rendered as fine print or removed, the feature is mis-built.

### Computation (no new data path — same source as every other page)

- Source: rolled-up `filings`, **active** activities (`rate_change`, `rate_change_pending`), **non-null** `effective_date`, `effective_date >= date(:asOf, '-12 months')`. Identical filter to Prospect/Defend — this is what makes the verification numbers reproduce. **If a new query is needed, the logic has diverged from recon — it shouldn't be.**
- For each (line, state, brand): **premium-weighted average** = `Σ(overall_rate_impactᵢ × total_written_premiumᵢ) / Σ(total_written_premiumᵢ)` over that brand's filings in the cell. Fall back to a simple mean only if *every* premium in the group is null (1 of 180 filings is null, so this is essentially never) and flag the fallback. Retain the filing count and the underlying rows for the audit panel.
- **Agent carriers:** captive `= [captive_brand]`; independent `= authorized_brands`. **Competitors:** every brand the agent does *not* sell. (An independent who sells all 8 brands has no competitor set — render a graceful "you sell every covered carrier" empty state.)
- **Anchored cell:** a (line, state) where ≥1 agent carrier filed.
- **Comparison:** (anchored cell, agent_carrier, competitor). **Comparable** = competitor has ≥1 filing in the cell. **Higher-confidence** = both sides ≥2 filings. **Thin** = comparable but at least one side has exactly 1 filing. **Insufficient** = competitor has 0 in the cell.

### Confidence tiering — the central honesty mechanic

The visual hierarchy *is* the honesty signal; this is spec-load-bearing, not cosmetic.

- **Higher-confidence (≥2 each side):** the primary spine. Full-strength text, normal weight, no caveat — genuine multi-filing averages.
- **Thin (either side has exactly 1 filing):** visually demoted (muted, smaller, indented). **A one-filing side is NEVER labeled "avg."** It renders `"1 filing: +X%"`, not `"+X% avg"`. Dressing a single number as an average is the trap the rename guardrail prevents.
- **No computed spread for thin comparisons.** The signed pts-spread (e.g. "+6.2 pts higher") is shown **only for higher-confidence comparisons** where both sides are genuine averages. A thin comparison shows the two figures side by side with **no** computed difference — a spread between an average and a single filing borrows the visual grammar of a real comparison and over-implies certainty one filing can't support. Spread is therefore a higher-confidence-only affordance.
- **Insufficient (competitor 0):** not a comparison; folded into a muted "Insufficient data: {brands}" line at the foot of the card.

### Layout — sparse, comparison-first

**Ordering:** anchored cells sorted by higher-confidence count desc, then comparable count desc (richest comparisons first); line then state as tiebreak.

**Each anchored cell is a card:**
- Header: `"{Line} · {State}"` and the agent carrier's own average change with its filing count (the anchor everything is measured against). If the agent carrier itself has only 1 filing in the cell, the header reads `"1 filing: +X%"` (not "avg") and every comparison in that card is therefore thin.
- Competitor rows: competitor name · their avg change (or `"1 filing: +X%"`) · filing count · **signed pts-spread vs the agent carrier — higher-confidence rows only**. Each row expands to an audit panel listing the underlying filings on **both** sides (brand, effective date, signed impact, premium, SERFF #, pending flag), with the "change filed, not price" caption.
- Absent competitors collapse into one muted "Insufficient data: …" line at the card foot — never empty rows.
- **Independent** with multiple owned carriers present in a cell: each owned carrier is its own anchor block within the card (own header average + its own competitor rows). The spread stays per-carrier, never blended across the agent's carriers.

**Unanchored cells (agent carrier didn't file):** not cards. A single compact section at the bottom — *"No filings from your carrier in: {Line · State}, …"* — plain text, no competitor rows.

### Verification numbers (the answer key — the built classifier MUST reproduce these)

These come from the data recon and are the hard check; if the built feature doesn't reproduce them, the query logic diverged from recon.

**Captive State Farm, all 8 covered states:**
- Anchored (line, state) cells: **10**; unanchored cells: **6**
- Competitor slots within anchored cells (10 × 7 competitors): **70**
  - **Comparable: 41** — of which **higher-confidence (≥2 each): 24**, **thin: 17**
  - Insufficient (competitor absent): **29**

**Independent {State Farm, Travelers, Progressive}, all 8 states:** comparable **69**, of which higher-confidence **34**.

A `verify_positioning.ts` (Node, no browser — like `verify_queries.ts`) must assert **10 / 41 / 24** for the captive case before the page is wired. The 1-vs-1 display decision (below) does not change these computed counts — it only changes whether the 17 thin comparisons are *rendered* or folded into the insufficient line; per the decision, they are rendered.

### Edge cases

- Independent selling all 8 brands → no competitor set → graceful empty state, not an empty grid.
- All-null-premium group → unweighted mean + a "weighting unavailable" flag (≈never; 1/180).
- Pending filings (`rate_change_pending`) are in the active set and marked "pending" in the audit panel.

---

## Feature 8: Sub-type column & info bubble (filings tables) — all agent types

Adds a **Sub-type** column to the shared `FilingsTable` (so it appears on Prospect, Defend, and My Carriers), immediately after **Line**, with a clickable info bubble explaining each sub-type.

### Recon basis (settled before building)

`sub_type_of_insurance` lives in `filings_raw`, not the rolled `filings` table, because it can in theory vary across the entities that roll into one filing. The recon over the active set (active activities, 12-month, non-null effective) found:

- **180 / 180 (100%) of active rolled filings are single-valued** — exactly one distinct non-null sub_type across their entities. **0 mixed, 0 all-null.** A single-value column is honest for every row; the theoretical "mixed" case does not occur in the data (the NAIC "Combinations" code already absorbs multi-sub-type filings upstream).
- **11 distinct sub-types** total (5 Personal Auto, 6 Homeowners) — the active set covers the full vocabulary.

### Data path (`import_filings.py`)

- Add a `sub_type TEXT` column to the rolled **`filings`** table — keeps `filings_raw` out of the app's query path.
- During rollup (group by `serff_tracking_number, line_of_business`), collect the distinct **non-null** `sub_type_of_insurance` across the group:
  - **exactly 1 → store it** (the raw source string, e.g. `"19.0001 Private Passenger Auto (PPA)"`; label cleanup is display-time);
  - **≥2 distinct → FAIL LOUDLY** (`raise`, same fail-loud pattern as the brand-derivation rules) — turns the theoretical mixed case into a loud guard on a future monthly refresh, not a silent surprise;
  - **0 (all null) → store NULL + log a warning** (doesn't occur in the active set today; don't fail).
- **Regeneration:** schema change ⇒ the committed `data/filings.db` must be rebuilt by re-running `import_filings.py`. `filings_raw` is already in the committed db, so it doubles as a cross-check and a fallback backfill source if the source xlsx isn't on hand.
- **Verification the rebuilt db must reproduce** (assert in a verify script): active set **180/180 single-valued, 0 mixed**; **11 distinct** sub-types — Personal Auto: PPA **71**, Combinations **24**, Motorcycle **11**, RV **7**, Other **3**; Homeowners: Owner-Occupied **25**, Combinations **17**, Condo **10**, Other **7**, Tenant **3**, Mobile **2**.

### Column presentation (shared `FilingsTable`)

- New **"Sub-type"** column immediately after **Line**, on all three table modes.
- Shows the **cleaned human label** (strip the NAIC code prefix and trailing abbreviation), per the explicit map below. A deterministic fallback (strip `^\d+\.\d+\s+` and a trailing ` (ABBR)`) keeps any future unmapped value legible.
- **Layout cost:** inserting after Line **shifts every downstream `nth-child` index by +1** (tables go 7→8 columns; Defend 8→9 with its Action column). Re-budget the colgroup and bump `min-w` (~+140px). The position-based e2e selectors (`e2e_defend`, `e2e_my_carriers`, `e2e_prospect`, `e2e_filters`) must be updated in lockstep, plus a positive assertion that the column-4 header is "Sub-type" on all three modes.
- **Mobile (375px):** the tables already scroll horizontally inside their `overflow-x-auto` wrapper; the extra column widens that scroll region (consistent with existing behavior — no new page-body overflow). The info bubble is **click-based** (not a `title` tooltip), so it is fully usable on touch.

### Info bubble (the 11 definitions — source of truth)

A clickable **`i`** next to each sub-type label opens a small dismissible popover (click-outside / Esc). **Click-based, not a `title` tooltip**, so it works on touch as well as desktop. The audience is insurance agents, so these definitions are accurate product descriptions, reviewed for correctness; the four catch-alls (**Combinations** ×2, **Other** ×2) are explicitly framed as "spans multiple / residual, not a single specific product."

**Personal Auto (`19.xxxx`):**

| Code (DB value) | Label | Bubble copy |
|---|---|---|
| 19.0001 Private Passenger Auto (PPA) | Private Passenger Auto | Standard personal auto coverage for private passenger vehicles — the everyday cars, SUVs, and light trucks individuals own for personal use. This is the core personal-auto product (liability, collision, comprehensive). |
| 19.0000 Personal Auto Combinations | Personal Auto Combinations | **(catch-all)** A combination filing that spans multiple personal-auto sub-types at once (for example private passenger auto together with motorcycle or RV). Not a single specific product — it means this rate filing covers several personal-auto sub-types under one filing. |
| 19.0002 Motorcycle | Motorcycle | Personal auto coverage written specifically for motorcycles (and often scooters and mopeds) — a distinct rating class from standard private passenger auto. |
| 19.0003 Recreational Vehicle (RV) | Recreational Vehicle | Personal auto coverage for recreational vehicles — motorhomes, travel trailers, and campers. Rated separately from standard autos because of their use and value profile. |
| 19.0004 Other | Other | **(catch-all)** A residual category for personal-auto filings that don't fall under the named sub-types (private passenger, motorcycle, RV). Not a specific product — it groups miscellaneous personal-auto sub-types. |

**Homeowners (`04.xxxx`):**

| Code (DB value) | Label | Bubble copy |
|---|---|---|
| 04.0003 Owner Occupied Homeowners | Owner-Occupied Homeowners | Standard homeowners insurance for a home occupied by its owner — the classic owner-occupant policy (e.g. HO-3) covering the dwelling, other structures, personal property, and personal liability. |
| 04.0000 Homeowners Sub-TOI Combinations | Homeowners Combinations | **(catch-all)** A combination filing that spans multiple homeowners sub-types at once (for example owner-occupied together with condo or tenant). Not a single specific product — it means this rate filing covers several homeowners sub-types under one filing. |
| 04.0001 Condominium Homeowners | Condominium Homeowners | Condominium unit-owner insurance (HO-6). Covers the unit's interior, personal property, and liability, sitting on top of the condo association's master policy that insures the building structure and common areas. |
| 04.0005 Other Homeowners | Other Homeowners | **(catch-all)** A residual category the carrier uses for homeowners filings that don't map to a named sub-type (owner-occupied, condo, tenant, mobile). It can include things like umbrella or excess-liability policies the carrier files under the homeowners line. Not a single specific product, and the exact contents aren't broken out in the filing data — so a given filing here may or may not be umbrella. [†](#subtype-umbrella-provenance) |
| 04.0004 Tenant Homeowners | Tenant Homeowners | Renters insurance (HO-4) for tenants. Covers personal property and personal liability for someone renting a home or apartment; it does not insure the building structure, which the landlord covers. |
| 04.0002 Mobile Homeowners | Mobile Homeowners | Homeowners coverage adapted for manufactured and mobile homes — written on a specialized mobile/manufactured-home form that reflects their construction and risk profile. |

<a id="subtype-umbrella-provenance"></a>**† Provenance of the 04.0005 umbrella mention.** The "can include umbrella / excess-liability" clause is from **domain knowledge — a working State Farm agent who confirms these filings can contain umbrella/excess-liability — NOT from any field in the data.** The dataset has no product/coverage-description field; recon of the 7 active "Other Homeowners" filings showed only entity name (6× State Farm Fire and Casualty Company, 1× Liberty Mutual Fire Insurance Company), state, impact, and the `sub_type` string — nothing that identifies umbrella at the row level. Hence the deliberately hedged wording ("can include", "may or may not be"): the category *can* contain umbrella, but the data can't confirm which specific rows are. Do not harden this into a certainty.

### Verification numbers

- Import/db: as listed under Data path (180/180 single-valued; 11 distinct with the per-sub-type rolled counts).
- Column header text "Sub-type" present at column 4 on Prospect, Defend, My Carriers; existing per-mode counts unchanged (this is presentational + a new column — no row/count changes).

---

## Feature 9: Compliance office briefing (`/compliance`) — all agent types

A personalized, grounded "office briefing" at the top of the Compliance page: a plain-language read of the employment/tax rules that apply to the agent's own staff, scoped to their `employee_states`, ordered with their primary state first. It reuses the existing grounded Compliance summaries where they already cover a topic and adds four new grounded topics. Washington is built first (fully mapped); employee states that aren't mapped yet show the existing coming-soon fallback — state expansion is a separate effort.

### Scope (sections, in order)

1. **Minimum wage** — reuses `wage_hour`.
2. **Overtime (hourly vs salary)** — reuses `wage_hour`.
3. **Salary / exempt thresholds** — NEW topic `salary_threshold`.
4. **Key state laws** — WA Family Leave (PFML) reuses `leave`; **WA Cares** is NEW topic `wa_cares`.
5. **At-will termination** — NEW topic `at_will`.
6. **Business tax basics (B&O)** — NEW topic `business_tax`.

So three sections reuse existing grounded WA summaries; four require new grounded generation.

### Data model (no live fetch; reuses the Feature 6 pipeline)

- `ResourceKey` extended with `salary_threshold`, `wa_cares`, `at_will`, `business_tax`. WA URLs added to `RESOURCE_URLS` (verified official `.gov` sources — see below). Other states leave these unmapped → coming-soon.
- `scripts/generate_compliance.ts` produces grounded summaries for the new keys into `complianceData.ts` (the app still reads only the pre-generated file). Same strict-grounding system prompt + refusal→coming-soon handling as Feature 6.
- The briefing assembles its six sections from `complianceData.ts`: reused keys (`wage_hour`, `leave`) and the four new keys. A briefing-section config maps each section → its topic key(s), size-gate config, and framing copy.

### Verified sources (WA)

- `salary_threshold` → `lni.wa.gov/workers-rights/wages/overtime/changes-to-overtime-rules` (L&I; EAP exempt-salary threshold, tiered small ≤50 / large 51+).
- `wa_cares` → `wacaresfund.wa.gov/` + `wacaresfund.wa.gov/employers/` (DSHS/HCA/ESD program + employer duties / no-size-gate framing).
- `at_will` → `lni.wa.gov/workers-rights/workplace-policies/termination-retaliation` (L&I; states + defines at-will and its exceptions).
- `business_tax` → `dor.wa.gov/taxes-rates/business-occupation-tax` + `dor.wa.gov/open-business` (DOR B&O gross-receipts tax + licensing).

### Numbers: qualitative, defer figures to source (decision A — firm)

Summaries stay qualitative and send the agent to the official page for any current figure; a stale number is worse than none. **Firm on `salary_threshold`:** never print an actionable salary figure even though the source page lists one — a stale threshold could drive a worker misclassification. Enforced via a per-topic instruction in `generate_compliance.ts` (`EXTRA_GUIDANCE`): describe that a tiered, size-dependent threshold exists and that the current figure is on the source page; print no number.

### At-will: exceptions are mandatory (verification gate)

The `at_will` summary MUST carry both halves: (1) WA is at-will (terminate without cause or notice), AND (2) the exceptions — no termination for an unlawful/protected reason (discrimination, retaliation for a protected right/complaint, or using protected leave). Enforced via `EXTRA_GUIDANCE`. **An exceptions-light summary is a fail** — regenerate, or hold the section to coming-soon. This is checked at the review gate before anything ships.

### Team-size handling (surface the line, never a determination)

Only two sections are size-gated in WA; the framing surfaces the threshold and where the agent's `employee_count` (N) sits, then explicitly defers the legal conclusion (counting rules — FTE math, common ownership, look-back — decide it).

| Section | Size-gated | Threshold | Framing |
|---|---|---|---|
| `salary_threshold` | yes | 50 (small ≤50 / large 51+ schedules) | "WA's exempt-salary threshold uses separate small (≤50) and large (51+) employer schedules. You have N — that's [below / at-or-above] 50. Which applies depends on how employees are counted; verify with L&I." |
| PFML (within Key state laws) | yes | 50 (employer premium share) | "The employer share of PFML premiums applies at 50+ employees; under 50, only the employee share is withheld. You have N. Counting rules vary — verify." |
| min wage, overtime, WA Cares, at-will, B&O | no | — | "Applies regardless of company size." |

Rule: state the threshold, state N, state the neutral above/below comparison, then defer the determination ("verify"). **Never** "you are exempt / you are subject." (The federal FMLA 50+/75-mile gate is federal, out of this state-scoped briefing — at most a one-line aside.)

### Layout

- The briefing sits **at the top of `/compliance`**; the existing 8-topic card grid stays **below** as the comprehensive source-linked reference (one source of truth — the briefing reuses those summaries).
- Ordered by **primary state** = `home_state` if it's an employee state, else the first mapped employee state. The primary (mapped) state renders the full briefing; each other employee state renders a compact "Briefing for {state} — coming soon" block. If no employee state is mapped, the whole briefing is the coming-soon fallback.
- Behavior change: the current page silently drops non-covered employee states; the briefing instead surfaces them as coming-soon.

### Load-bearing disclaimer (prominent, like Positioning's band)

A persistent, prominent band at the top of the briefing — not fine print:

> **This summarizes what the rules say — verify with a qualified professional. Not legal or tax advice.**

This is product copy, not a footnote, and is the feature's central risk control (employment + tax content). The existing amber disclaimer line is retained for the card grid below.

### Verification gate (human review before ship)

Like the Sub-type definitions, the four new grounded summaries (`salary_threshold`, `wa_cares`, `at_will`, `business_tax`) are reviewed verbatim by the user before the feature ships — specifically: does `at_will` carry the exceptions, and does `salary_threshold` avoid an actionable number while staying useful. If either fails, regenerate or hold to coming-soon.

---

## Methodology page (`/methodology`)

Static page. Must include:

- **Scope:** 8 brands; 8 states currently covered (AZ, CO, ID, MT, NV, OR, UT, WA), with all 50 listed in setup and more coming; Personal Auto + Homeowners; 2025–2026 effective dates.
- **Excluded brands:** National General, Standard Fire, LM General, American Economy, Peerless, Drive, Esurance. One line each on why.
- **Validation table:** the AM Best per-state results, one row per covered state, columns for Auto and Homeowners. Pull from the `validated` field on `STATES` (only covered states have it).
- **Known limitations:** SERFF visibility gaps (~10–12 missing filings estimated), CO entirely unvalidated, 42 states not yet covered, snapshot pending data.
- **What "raising" / "lowering" means:** the threshold values plainly stated.
- **Last updated:** read `data/last_updated.txt` and display.

Agents are skeptical. This page is what makes them trust the rest.

---

## Navigation

Persistent across all pages:

- Product name (left)
- Links (right):
  - Captive: Overview · Prospect · Defend · **My Carrier** · Compliance · Methodology · Profile
  - Independent: Overview · Prospect · Defend · **My Carriers** · Compliance · Methodology · Profile

The My Carrier(s) link is shown for **both** agent types. Its label is `agent_type`-dependent: **"My Carrier"** (singular) for captives, **"My Carriers"** (plural) for independents.

On Prospect, Defend, and My Carriers pages, a thin strip below the nav (`<ScopeStrip />`) shows the agent's current scope: *"Showing: AZ, NV"* (independents) or *"Showing: AZ, NV · vs competitors of State Farm"* (captives), with an "Edit" link to `/setup`. Always visible — agents need to know what filter they're looking through.

---

## Build order

Do these in sequence. Don't move on until the previous step works end-to-end.

1. Scaffold Next.js 14 + TS + Tailwind. Verify dev server runs.
2. Write `scripts/import_filings.py`.
   - Verify `filings_raw` is created and contains **468 rows** with `brand` correctly derived. Zero unmatched company names is the expected result.
   - Spot-check that `MGA Insurance Company, Inc.` → State Farm.
   - Verify the rollup into `filings` collapses multi-entity rows correctly: **314 total rolled rows**. Spot-check `GECC-134661852` Personal Auto (GEICO NV): two `filings_raw` rows → one `filings` row, `overall_rate_impact ≈ 50.88`, `entity_count = 2`, `min_entity_impact = 30.49`, `max_entity_impact = 56.47`.
3. Build `src/lib/db.ts` and `src/lib/filings.ts` with the query builder branching on `agent_type`. Write a small Node script that runs the Prospect, Defend, and My Carriers queries against the test cases in the verification section. Confirm each case matches expected row counts exactly.
4. Build `/setup` (the "Agency Profile" page) with `ProfileForm` and localStorage persistence: agency details (name, ZIP, home state, employees — all optional), agent type, authorized carriers (required; radio if captive, checkbox if independent), licensed/doing-business states (required; all-50 grid, only data_coverage states selectable, chip + search UI), and employee work/live states (optional; all-50 grid, no data gating). On save, validate only the required fields, then route to `/` (Overview). Verify redirect to `/setup` when no profile exists. Do NOT build the State Resources panel — it's deferred with HR.
5. Build `FilingsTable` as a presentational component with the three modes (`prospect`, `defend`, `my-carriers`). Wire it to `/prospect`, reading the profile and using the agent-type-aware query. Render the multi-entity tooltip.
6. Build `/defend` reusing `FilingsTable` with `mode="defend"`.
7. Build `/my-carriers` reusing `FilingsTable` with `mode="my-carriers"`. Add the route-guard that redirects captives to `/`.
8. Build the **Overview** landing page (`/`): `OverviewCards` (Prospect count, Defend count, Most Urgent with the tiered selection logic, and the lightweight Compliance entry-point card) and `RecentChanges` feed. All rate counts must reconcile exactly with the table queries for the same profile. Verify against the sample-profile numbers in the Overview verification section.
9. Build **Compliance** (`/compliance`): the `resourceUrls.ts` map (eight topics, one-or-more URLs each; start with the 8 covered states), the `generate_compliance` script that fetches mapped pages and writes grounded 2–3 sentence summaries + titles + `last_checked` into `complianceData.ts`, and the `/compliance` page rendering a grid of `ComplianceCard`s (topic tag, state badge, title, short summary, bare-domain source links, last-checked date). The app reads only the pre-generated data — no live fetching at view time. Include the disclaimer banner and the "Coming soon"/bare-link fallback for unmapped or failed-generation cells.
10. Build `NavBar` (Overview first; "My Carrier(s)" for all agent types — singular label for captives; Compliance for all) and `ScopeStrip` (with the conditional captive suffix).
11. Build `/methodology`.
12. Polish:
    a. **PINNED — first task, before any cosmetic polish:** run
       `ANTHROPIC_API_KEY=… npx tsx scripts/generate_compliance.ts` for
       the WA topics against the live Anthropic API, then verify 2-3
       generated summaries against the hand-validated reference summaries
       for WA Wage & Hour and Leave. Confirm no facts appear in the
       output that aren't on the source pages, and that a deliberately
       broken URL falls through to the bare-link "Summary coming soon"
       card rather than producing invented content. This is the real
       test of the grounding pipeline — the WA summaries currently in
       `src/lib/complianceData.ts` are hand-seeded placeholders.
    b. Empty states, loading states, badge colors, mobile layout.
13. Deploy to Vercel.

---

## Expected verification numbers

These are computed from the current 468-row dataset and have been verified against the actual file. Use them as hard sanity-checks during build.

> **Dataset note — no future-dated filings.** As of the current xlsx (mtime 2026-05-27), every `effective_date` in the active window is in the past relative to `asOf`. Features keyed on upcoming dates therefore run entirely on their fallback paths today: the Overview's Most Urgent card always renders via Tier 2 (largest |impact| in window), and the Defend table's window badges always render as orange "Customers may already be shopping" rather than red "Risk window opens in N weeks". The future-dated branches (Most Urgent Tier 1, Defend red badges) are wired and intentional — they will light up as soon as the next monthly refresh introduces a future-dated filing.

**Import-level (totals — no agent profile applied):**

- **468 rows total** loaded into `filings_raw`
- Zero unmatched `company_name` values under the brand rules above
- 468 raw rows → **314 rolled-up filings** in `filings` (one per `(serff_tracking_number, line_of_business)`)
- **99 of 314 (~31.5%)** are multi-entity rollups
- Of multi-entity rollups, only ~5 in the 12-month active window have a wide spread (>5 points between min and max entity impact) — meaning the tooltip on the Rate Impact column will be a quiet feature, not a constant interruption

**Active-window totals (in `filings`, within 12 months, rate_change or rate_change_pending):**

- **180 rolled-up filings** in the active window
- **Max impact: +93.7%** — a State Farm Washington Homeowners filing (`SFMA-134315091`, single entity)
- **Min impact: -14.79%** — within the active window

**Per-query verification (use these to test Prospect, Defend, and My Carriers end-to-end):**

Captive cases — Prospect/Defend exclude the agent's brand:

| Test case | States | Captive brand | Prospect rows | Defend rows |
|---|---|---|---|---|
| Captive State Farm | AZ, NV | State Farm | 13 | 8 |
| Captive Allstate | AZ, NV | Allstate | 10 | 7 |
| Captive State Farm, all states | all 8 | State Farm | 41 | 30 |

Independent cases — Prospect/Defend show all 8 brands flatly:

| Test case | States | Prospect rows | Defend rows |
|---|---|---|---|
| Independent in AZ + NV | AZ, NV | 14 | 10 |
| Independent in all 8 states | all 8 | 49 | 40 |

My Carriers cases — no impact threshold, filtered to authorized_brands only:

| Test case | States | Authorized brands | My Carriers rows |
|---|---|---|---|
| Sells SF + Travelers | AZ, NV | State Farm, Travelers | 12 |
| Sells SF + Travelers + Progressive | AZ, CO, NV | + Progressive | 32 |
| Sells Allstate + Liberty + Safeco, all states | all 8 | Allstate, Liberty Mutual, Safeco | 110 |

These are the exact numbers your queries should return against the current xlsx. If they don't, something is off — either the rollup logic, the brand derivation, the date parsing, or the captive/independent branch. Stop and investigate before continuing.

**GEICO NV spot-check (filing `GECC-134661852`):**

- 2 raw rows: GEICO Indemnity Company at +30.49%, GEICO General Insurance Company at +56.47%
- Should roll up to 1 record with `overall_rate_impact ≈ 50.88`, `entity_count = 2`, `min_entity_impact = 30.49`, `max_entity_impact = 56.47`, `total_policyholders = 15,620`, `total_written_premium ≈ 36,718,099`. This is the canonical sanity-check for the rollup logic.

As part of step 2 of the build order, the import script should print the import-level and active-window totals (no profile applied) so you have hard numbers to refer back to in future refreshes.

The UI must handle large positive values gracefully (e.g. +93.7%) without breaking column widths.

---

## Open questions (for the user — not for Claude Code to decide)

1. **PDF links.** `source_pdf` is a local Windows path. Three options for v1: (a) drop the column from UI entirely, (b) display the SERFF tracking number so agents can self-look-up on filingaccess.serff.com, (c) host the PDFs publicly. Spec assumes (b). Confirm.

2. **Thresholds.** ±5% / -2% are educated guesses. With current cutoffs, an independent in all 8 states sees 49 Prospect / 40 Defend rows — populated but not overwhelming. Lower thresholds would balloon to hundreds. Confirm or specify.

3. **Accounts / auth — deliberately deferred past v1.** No email/password, no login. The profile lives in `localStorage` and the data is open. This was a conscious decision: it keeps v1 backend-free, avoids the risk and overhead of a credential system, and lets the rate intelligence ship without that dependency. When accounts are added later, the likely path is a managed auth service (Clerk, Supabase Auth, or NextAuth) rather than hand-rolled password storage — and the decision to make at that point is what the account *buys* the user (cross-device profile sync, a user list for outreach, or gating the data). Not a v1 concern.

4. **Brand expansion.** If the dataset ever picks up new filing entities (next monthly refresh), the import script's `derive_brand` will fail loudly. That's the right behavior — but worth knowing it means a refresh can break the build until you update the brand-mapping rules.

---

## Resolved decisions (for reference — already baked into the spec)

- **Carrier visibility.** Captives see Prospect/Defend filtered to competitors only (their own brand excluded). Independents see Prospect/Defend with all 8 brands flat — no exclusion, no POV toggle — because they can quote with multiple carriers and need full market visibility. Both agent types get the **My Carriers** tab (every recent filing involving the carriers they sell, no threshold filter); for a captive it shows their single carrier and is labelled "My Carrier" (singular).

- **My Carriers is available to captives too (REVERSED 2026-05-29).** Originally My Carriers was independents-only, on the reasoning that "a one-carrier book doesn't need a my-carriers tab — Prospect/Defend already is their POV." That was wrong: Prospect/Defend show *competitors*, never the captive's own carrier, so a captive had no view of their own carrier's filings at all. But a captive State Farm agent is exactly who needs to see State Farm's own rate moves — they field the customer calls when rates change. The view already does the right thing (it filters `brand IN authorized_brands`, which for a captive is their single brand), so opening it was a matter of removing the restriction, not building a feature. The restriction had been enforced in four places, all now reversed: the nav (was hidden for captives), the `/my-carriers` route guard (redirected captives to `/`), the API `mode=my-carriers + agent_type=captive` 400 check, and the `getMyCarriersFilings` parameter type. Single-carrier framing was added (singular "My Carrier" label/title, "Your carrier" header cell, carrier-name subtitle, hidden carrier filter chip). **Do not re-add the independents-only restriction.** Independent behavior is unchanged.

- **Rate Positioning thin (1-vs-1) comparisons: SHOWN, demoted, never called "avg", no spread (decided 2026-05-29).** In Feature 7, a "thin" comparison is one where either side has exactly one filing. The options were (A) show them visually-demoted with a one-filing flag, or (B) exclude them as insufficient. **Chosen: A**, with two guardrails: (1) a one-filing side renders `"1 filing: +X%"`, never `"+X% avg"` — a single number must not be dressed as an average; (2) **no computed pts-spread for thin comparisons** — the signed difference is a higher-confidence-only affordance, because a spread between a genuine average and a single filing borrows the grammar of a real comparison and over-implies certainty. Rationale for A over B: the confidence tiering already tells the eye to trust the ≥2-each spine first; the audit-panel expansion makes a thin row transparent rather than black-box; hiding real, auditable filings is *less* honest than showing them well-labeled; and the data is sparse enough (recon: only 24 of 41 comparable comparisons are higher-confidence) that excluding the 17 thin ones would drop 41% of the comparable surface and hurt utility more than well-labeled thin rows risk misleading. Do not silently exclude thin comparisons or add a thin-row spread.

- **No Carrier Toggle.** An earlier draft included a "POV" dropdown to switch the comparative anchor. That was removed — independents now see everything flatly, and captives only have one POV anyway. The toggle was solving a problem the agent doesn't actually have.

- **Coverage-warning banner intentionally NOT implemented in v1** (the amber *"{State} isn't covered yet. Showing your other states."* banner described under *UI / design system → Coverage warning*). The condition it guards is already prevented by two existing layers: the setup UI disables uncovered (`data_coverage: false`) states, and save-validation rejects any licensed state that isn't covered (the tamper guard from build step 4). With both in place, an uncovered state in a saved profile is unreachable in normal operation — the banner would only ever fire on hand-edited `localStorage`. Building display-time UI for a validation-unreachable condition isn't worth the effort for v1. Revisit if profile state ever becomes server-sourced or shareable (i.e. if a profile could arrive without passing through this app's save-validation). Decision made 2026-05-29.

---

## Phase B — Compliance change detection ("new law" highlights)

Deferred past v1. This is the piece that lets the Overview truthfully highlight *new or changed* regulations, rather than just linking to current resources.

### Why it can't be done with the v1 approach

The v1 Compliance feature summarizes a page at view-time. A view-time summary knows only what the page says *today* — it has no memory of what it said before, so it fundamentally cannot tell whether anything *changed*. Detecting "new" requires comparing today's content against a stored prior version.

### What Phase B requires

1. **A scheduled fetch job.** Periodically (e.g. weekly) fetch each mapped official page for every state in coverage.
2. **Snapshot storage.** Store a normalized text snapshot (or a content hash) of each page per fetch, with a timestamp. This is new persistent storage — the v1 app has no backend DB for this; Phase B introduces one (or extends the SQLite/data layer).
3. **Diffing.** Compare each new fetch against the prior snapshot. When meaningful content changes (not just boilerplate/markup churn — needs a sensible diff heuristic, possibly an LLM judging "is this a substantive regulatory change?"), flag it.
4. **Change records.** Persist a record: state, resource type, what changed (a short AI-generated description of the diff), detected date, source URL.
5. **Surfacing.** The Overview's Compliance card upgrades from "X states tracked" to a real alert: "{n} regulatory changes in your states" with the most recent change highlighted, mirroring how Recent Changes works for rate filings. A dedicated changes feed on the Compliance page lists them.

### Risks to handle in Phase B

- **False positives from cosmetic page changes** (nav tweaks, dates, unrelated edits). The diff heuristic must distinguish substantive regulatory change from noise, or agents lose trust fast.
- **Fetch reliability.** The same .gov-blocking problem from v1 applies; states whose pages can't be fetched can't be diffed, and the UI must be honest about which states are actually monitored.
- **Accuracy of the change description.** An AI describing a diff inherits the same "must be grounded, must be disclaimed" requirements as the v1 summaries.

Phase B is a meaningfully larger build than the v1 Compliance tab (scheduled jobs + storage + diffing), which is exactly why it's separated out. The v1 Compliance card is deliberately worded to never claim change-detection it doesn't have, so shipping v1 first doesn't make a promise Phase B has to walk back.
