# Carrier Scope — the governing principle and the 13-brand roster

## OPERATIVE INCLUSION TEST (user-confirmed 2026-06-10)

> **"What brand does the customer believe they bought?"**

- **IN** if the customer experiences the policy AS the parent brand, regardless
  of which legal entity underwrites it or that entity's heritage. (This is why
  Farmers GroupSelect — ex-MetLife entities now sold under the Farmers name —
  is IN, and why USAA's membership-tier entities are all IN.)
- **OUT** if the customer believes they bought a *different* brand, even when
  the parent owns it. (This is why CONNECT — the Costco channel — Foremost,
  Homesite, Bristol West, Allied-legacy entities, Noblr, The General etc. are
  OUT.)

**Rationale:** the dataset answers "what is [Brand]'s customer-facing rate
activity" for agent competitive intelligence. Each legal entity files rates
independently — a CONNECT filing does not change American Family's rates — so
rolling sub-brands into a parent would misattribute a distinct brand's
activity. A sub-brand's activity is real but belongs to THAT brand; it is
never folded into the parent. This test governs all future carrier/sub-brand
scope decisions (IL/OH/VA and beyond) deterministically: apply the test, don't
re-litigate.

## The 13 brands (2026-06-10 expansion: original 8 + 5)

### Original 8 (unchanged)
State Farm, GEICO, Allstate, Travelers, Progressive, Liberty Mutual, Safeco,
Encompass. Exclusions per the test: LM General, Standard Fire, Integon /
National General, American Economy, Peerless, Esurance, Drive, United
Financial. (Safeco and Encompass are themselves examples of the test: distinct
customer-facing brands despite Liberty Mutual / Allstate ownership.)

### 5 new carriers (Phase 1 analysis 2026-06-10, confirmed against the
### AZ / NM / GA AM Best reports + GA SERFF portal check)

| Brand | IN entities (as AM Best names them) | OUT (distinct brands / vehicles / collisions) |
|---|---|---|
| **USAA** | United Services Automobile Association, USAA Casualty Insurance Company, USAA General Indemnity Company, Garrison Property and Casualty Insurance Company (membership tiers of one brand) | Noblr Reciprocal Exchange (distinct telematics brand) |
| **Farmers** | Farmers Insurance Exchange, Fire Insurance Exchange, Truck Insurance Exchange, Mid-Century Insurance Company, Farmers Insurance Company of [state], Farmers Casualty / Farmers Property and Casualty / Farmers Direct P&C / Farmers Group P&C (GroupSelect — sold under the Farmers name) | Foremost (specialty brand), Bristol West + Coast National (non-standard brand), Toggle (digital brand), Economy Fire & Casualty / Economy Premier / Economy Preferred (legacy MetLife vehicles) |
| **Nationwide** | Nationwide Mutual, Nationwide Insurance Company of America, Nationwide General, Nationwide Affinity, Nationwide Property and Casualty | AMCO / Allied Property and Casualty / Depositors (Allied brand retired ~2020 — Peerless precedent), Titan/Victoria (non-standard) |
| **American Family** | American Family Insurance Company, American Family Mutual Insurance Company S.I. | Homesite (white-label/direct — underwrites Progressive Home; inclusion would double-count), American Family Connect (CONNECT/Costco brand), The General / Permanent General (non-standard brand), Midvale Indemnity, Main Street America. **NAME COLLISION:** see the Munich Re cluster note below. |
| **Country Financial** | COUNTRY Mutual, COUNTRY Preferred, COUNTRY Casualty (AM Best styles them ALL-CAPS "COUNTRY") | ("Country-Wide Insurance" is an unrelated NY carrier — GROUP_KW anchors avoid it) |

## KNOWN COLLISION CLUSTER — Munich Re / American Modern

The "american family" keyword space collides with **Munich Re's American
Modern Insurance Group**, whose entities deliberately resemble AmFam naming.
Both observed members are hard-excluded in `EXCLUDED_SUBSIDIARY_PATTERNS`
(scraper AND compare scripts):

1. **American Family Home Insurance Company** (NAIC 23450) — verified Munich
   Re/American Modern via NY DFS + corporate records, 2026-06-10.
2. **American Modern \*** (Home / Property and Casualty / Select / ...) —
   siblings that ride the same filings' per-company rate tables; caught by
   the Phase 3 guardrail differ as 3 unclassified GA rows, 2026-06-10.

**If a third sibling appears in IL/OH/VA (any "American Modern"-family or
AmFam-adjacent name that isn't on the IN list), it is the same cluster —
exclude it, don't re-research.** The guardrail pattern (diff per-carrier new
rows, flag UNCLASSIFIED company names) is the detection mechanism.

## SERFF name traps (why GROUP_SEARCH ≠ GROUP_KW)

Search keywords must catch every IN entity; classification anchors must be
tighter than the keywords:
- USAA needs THREE keywords — `usaa`, `united services`, `garrison` — the GA
  portal check showed three disjoint result buckets (NAIC 25941 United
  Services, 21253 Garrison).
- Farmers needs `farmers` + `mid-century` + `fire insurance exchange`
  (+ `truck insurance exchange`); Fire/Truck/Mid-Century contain no "farmers".
- Bare-keyword GROUP_KW risks: `farmers` ↔ Farm-Bureau-style strays,
  `country` ↔ Country-Wide, `american family` ↔ the Munich Re collision —
  anchored entity names + EXCLUDED_SUBSIDIARY_PATTERNS carry the precision.

## Footprint facts that affect state planning

- USAA: absent from the AZ AM Best report (cannot be cross-checked there).
- Country Financial: not licensed in NM (19-state footprint incl. AZ/GA/CO/OR/ID/NV/WA).
- American Family: ~19 states incl. AZ/CO/GA/ID/NV/OR/UT/WA — NOT NM.
- Nationwide: personal-lines pullback visible (AZ in-window PPA = 0; NM in-window = 0).
- GA is the only current state where all 5 appear in both AM Best and SERFF —
  hence the Phase 3 validation state.
