# Coverage Compare — "Who's Covered" research gaps

The `scenarios` line in `src/lib/coverageCompare.ts` answers "when someone other
than the named insured drives, or the insured drives a car they don't own, what
changes — by carrier." Most carrier cells hold a shared baseline drawn from the
standard ISO Personal Auto Policy (PP 00 01) that carriers broadly follow, **not
yet individually verified**. This file is the per-carrier / per-state research
backlog.

### Verification progress

- **State Farm — VERIFIED** against two actual filed forms — **Washington** Car
  Policy **9847C** (2024) and **Oregon** Car Policy **9837B**, which agree on the
  core (the P2P exclusion is explicit in WA, general "rented to others" in OR) —
  on 8 of 10 scenarios (permissive use, unlisted household driver,
  borrowed car, rental personal / business-abroad / other-driver, P2P, excluded
  vehicles). Those cells are now **high** with form-section citations. Still open
  for State Farm: **named-driver exclusion** (a separate state endorsement, not
  in the base booklet) and **regular use** (an underwriting threshold — the form
  covers permissive users regardless of frequency, so it's a rating/misrep
  matter, not a coverage line).
- **GEICO — VERIFIED** against its **Washington** Family Auto Policy **A30WA
  (12-22)** on 8 of 10 scenarios. It agrees with State Farm on the core
  (permissive-covered/no-step-down, non-owned = you+relatives only & excess,
  physical-damage-if-carried, US/Canada territory, P2P-owner excluded — GEICO
  also names peer-to-peer explicitly). **Differences found:** (1) GEICO's Other
  Insurance clause is broadly *excess over any other applicable insurance* rather
  than State Farm's explicit "primary on your car"; (2) GEICO excludes a vehicle
  *regularly rented* daily/weekly/monthly unless declared (excl. 19), and
  leased-<6-months / business-owned vehicles unless declared (excl. 18, 21) —
  where State Farm uses a 31-day-possession rule. Named-driver exclusion and
  regular-use stay medium (as with State Farm).
- **Remaining 6 carriers** (Allstate, Progressive, Travelers, Nationwide, USAA,
  American Family) — still on the shared baseline; pull each carrier's auto
  policy form the same way (a sample-policy PDF or SERFF form filing).

> **State-scope caveat:** carrier policy forms are filed **per state** (different
> form numbers, and state-mandated PIP/UM/exclusion language). State Farm was
> verified against two states — **WA 9847C** and **OR 9837B** — which agree on
> the core (permissive-user-covered, non-owned-excess, physical-damage-if-carried,
> territory, 31-day rule), strong evidence these are State Farm's standard
> nationwide. The one observed difference: the P2P exclusion is explicit in WA and
> the older general "rented to others" wording in OR (same outcome). State-variable
> items (PIP/UM, permissive-use step-downs, driver-exclusion validity) still need
> the agent's own state form; the tool's state filter is where per-state
> resolution would eventually live.

Carriers in scope (all 8): **Allstate, State Farm, GEICO, Progressive,
Travelers, Nationwide, USAA, American Family.**

## What the confidence dot means here

| Dot | Meaning | Action |
|-----|---------|--------|
| 🟡 medium | Standard-PAP baseline applied uniformly to all 8 carriers | Confirm against each carrier's actual policy form + endorsements |
| 🔴 low | No reliable baseline; shown as a caution | Research before treating as anything but "Data not publicly available" |
| ⚪ dnpa ("Unknown") | Genuinely not determinable from public sources | Pull the carrier form; do not guess |

State Farm and GEICO are verified (8 of 10 scenarios each, now high). The
remaining ~64 cells (the other 6 carriers, plus the 2 open scenarios each for
State Farm and GEICO) still need verification. The list below is organized by
what specifically to check, not by identical rows.

## Fully unknown (dnpa) — highest priority, currently shows "Unknown"

- **Scenario 4 — Occasional vs. regular use by a non-listed driver** — all 8
  carriers. There is no public threshold for when "occasional" becomes
  "regular." This is a carrier underwriting rule; pull underwriting guidelines
  or filed rules per carrier. Interacts with state misrepresentation law.

## Per-scenario baseline + what to verify per carrier

1. **Permissive use (friend borrows your car)** — baseline: *Covered, owner's
   policy primary.* Verify per carrier/state: **does a permissive-use step-down
   to state-minimum limits apply?** (Some carriers file step-down endorsements
   in some states.) Confirm collision/comp deductible treatment.
2. **Unlisted household driver** — baseline: *Relatives usually insured; misrep
   risk if undisclosed.* Verify: each carrier's rule for undisclosed resident
   drivers (surcharge vs. misrepresentation defense vs. exclusion), and which
   states limit denial for a non-excluded resident.
3. **Named-driver exclusion** — baseline: *Excluded driver = no coverage;
   state-restricted.* Verify: (a) the exact list of states that prohibit or
   restrict exclusions (baseline names NY, NC, MI, VA as examples only — confirm
   the full list); (b) per carrier, whether the exclusion also voids
   collision/comp and UM/UIM, or liability only.
4. **Occasional vs. regular use** — see "Fully unknown" above.
5. **Borrowed (non-owned) car** — baseline: *Covered, excess over owner, your
   deductible; regular-use & resident-relative exclusions apply.* Verify per
   carrier: exact non-owned physical-damage terms and any **broadened /
   extended non-owned auto endorsement** names.
6. **Rental car (personal, US/Canada)** — baseline: *Covered like your own car,
   your deductible, excess.* Verify per carrier: **loss of use, diminished
   value, admin/towing fees, and any day limit** (e.g., 30 days); whether a
   rental/CDW endorsement is offered and what it waives. (Links to Rental
   Reimbursement — do not duplicate.)
7. **Rental — business use / outside US-Canada** — baseline: *Not covered
   (territory / business use).* Verify: any carrier that extends territory
   (e.g., Mexico endorsements) or treats certain business use differently.
8. **Rental driven by someone other than you** — baseline: *Resident family yes,
   non-family friend no.* Verify per carrier: whether a permissive non-family
   driver of the insured's rental gets any extension.
9. **P2P car sharing (Turo / Getaround)** — baseline: *As owner excluded; as
   renter platform covers.* Verify per carrier: the **renter-side** position
   (does the personal policy extend at all to a Turo/Getaround rental?) and any
   P2P-specific state statutes. (Distinct from Rideshare — link only.)
10. **Company car, heavy vehicles & non-owned trailers** — baseline: *Regular-use
    / over-GVW vehicles excluded.* Verify per carrier: the exact GVW/vehicle-type
    definitions and any **"drive-other-car" / "extended non-owned"** endorsement
    that adds a company car.

## Cross-cutting unknowns (appear inside many baseline cells)

- **Permissive-use step-down** — which carriers, which states (Scenario 1).
- **Named-driver-exclusion state list** and whether comp/collision/UM are also
  voided (Scenario 3).
- **Rental loss-of-use / diminished value / admin fees / day limit** per carrier
  (Scenario 6).
- **P2P renter-side extension** per carrier (Scenario 9).
- **Regular-use threshold** per carrier (Scenario 4).
- **Endorsement names** per carrier: broadened/extended non-owned auto,
  drive-other-car, rental/CDW (Scenarios 5, 6, 10).

## Suggested sources for verification

- Each carrier's **Personal Auto Policy form and endorsements** via SERFF / state
  DOI filings (the same rate/rule/form filings this repo already scrapes).
- The **ISO PP 00 01** base form for the baseline language.
- **State DOI bulletins / statutes** on named-driver exclusions, permissive-use
  step-downs, and P2P car-sharing insurance.
- Carrier consumer pages only where they state form-level detail (rare for these
  scenarios — most is in the filed form, not marketing).

_Last updated with the initial scenarios build. Update this file as cells move
from medium/dnpa to high (carrier-verified)._
