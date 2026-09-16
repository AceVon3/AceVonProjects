# Coverage Compare — "Who's Covered" research gaps

The `scenarios` line in `src/lib/coverageCompare.ts` answers "when someone other
than the named insured drives, or the insured drives a car they don't own, what
changes — by carrier." **Every carrier cell currently holds the same baseline
answer**, drawn from the standard ISO Personal Auto Policy (PP 00 01) that
carriers broadly follow. **None of it is individually verified against a
carrier's actual form or a state's law.** This file is the per-carrier /
per-state research backlog.

Carriers in scope (all 8): **Allstate, State Farm, GEICO, Progressive,
Travelers, Nationwide, USAA, American Family.**

## What the confidence dot means here

| Dot | Meaning | Action |
|-----|---------|--------|
| 🟡 medium | Standard-PAP baseline applied uniformly to all 8 carriers | Confirm against each carrier's actual policy form + endorsements |
| 🔴 low | No reliable baseline; shown as a caution | Research before treating as anything but "Data not publicly available" |
| ⚪ dnpa ("Unknown") | Genuinely not determinable from public sources | Pull the carrier form; do not guess |

There are **no high-confidence (carrier-verified) cells in this line yet** — so
every one of the 80 cells (10 scenarios × 8 carriers) needs verification. The
list below is organized by what specifically to check, not 80 identical rows.

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
