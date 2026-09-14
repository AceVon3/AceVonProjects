// Coverage Compare — factual auto & home coverage-feature comparison across
// carriers. Client-safe: pure data + resolve logic, no DB import (mirrors the
// verified proof-slice; framing follows a filing-comparison layout, data is
// independently sourced from carrier pages/policy contracts + Insurify, not
// copied from any carrier's internal tool).
//
// NOT the same as coverage.ts (that's the brand×state filing-coverage note).
//
// Sourcing honesty: most homeowners LIMIT values live on the declarations page
// and in state-filed forms, so competitor home cells frequently read
// "dnpa" (Data not publicly available) — the correct answer, not a guess.
// Confidence: high = carrier page / filed form; medium = carrier copy or
// consistent secondary sources; low = single weak source, verify.

export type Category =
  | "included" // standard in the base policy
  | "available" // optional add-on / endorsement (auto vocabulary)
  | "endorsement" // optional add-on (home vocabulary)
  | "varies" // availability/terms set by state
  | "none" // not offered
  | "dnpa"; // data not publicly available

export type Confidence = "high" | "medium" | "low";
export type LineKey = "auto" | "home";

export type Cell = {
  category: Category;
  value?: string; // measure/term shown as the headline (home); omitted for auto status-only cells
  note?: string;
  confidence: Confidence;
  source?: { label: string; url: string };
  safecoDerived?: boolean; // Liberty Mutual figures sourced from Safeco's filed forms
  excludeStates?: string[]; // states where this feature is NOT available (resolved by the state filter)
};

export type Feature = {
  id: string;
  name: string;
  description: string;
  // Glass mandate handling: states that mandate a $0-deductible option / must offer one.
  mandate?: { mandatory: string[]; mustOffer: string[] };
  cells: Record<string, Cell>; // carrierId -> Cell
};

export type Carrier = {
  id: string;
  name: string; // must match the profile brand string for anchor matching
  color: string;
  // Carrier-level state availability: states where this carrier doesn't write the line at all.
  unavailableStates?: string[];
};

export type Line = {
  key: LineKey;
  label: string;
  carriers: Carrier[];
  features: Feature[];
  legend: Category[];
  glossary: Array<[string, string]>;
  footnote: string;
};

// --- shared state rules (verified) ---------------------------------------
export const COASTAL_STATES = ["AL", "CT", "DE", "FL", "GA", "HI", "LA", "ME", "MD", "MA", "MS", "NH", "NJ", "NY", "NC", "RI", "SC", "TX", "VA"];
// Allstate homeowners extended-replacement-cost buffer, from Allstate's own state table.
const ALLSTATE_ERC_BUFFER: Record<string, string> = { CA: "150%", CT: "150%", AR: "125%", NC: "125%", NY: "125%" };
const ALLSTATE_ERC_SELECT_EXCL = ["AL", "GA", "IL", "MN", "NY", "ND", "SC", "SD", "AZ", "CA", "NV", "OK", "UT"];

const src = (label: string, url: string) => ({ label, url });

// --- AUTO -----------------------------------------------------------------
const AUTO: Line = {
  key: "auto",
  label: "Auto",
  legend: ["available", "none", "varies"],
  carriers: [
    { id: "allstate", name: "Allstate", color: "#1B6CA8" },
    { id: "statefarm", name: "State Farm", color: "#C42127", unavailableStates: ["MA", "RI"] },
    { id: "geico", name: "GEICO", color: "#1B7F4B" },
    { id: "progressive", name: "Progressive", color: "#8A5A10" },
  ],
  glossary: [
    ["Available", "Offered as an optional add-on / endorsement on top of the base policy."],
    ["Not offered", "The carrier does not sell this on the personal auto policy anywhere."],
    ["Accident forgiveness", "Keeps your first at-fault accident from raising your premium."],
    ["New car replacement", "Pays for a comparable new car after a total loss on a near-new vehicle."],
    ["Gap / loan-lease payoff", "Covers the loan/lease balance above the car's value after a total loss."],
    ["Diminishing deductible", "Reduces your deductible for each claim-free period."],
    ["OEM parts", "A guarantee that repairs use original-manufacturer parts."],
    ["Telematics discount", "Usage-based program (app or device) that discounts safe driving."],
    ["Data not publicly available", "Not published; confirm on a quote or policy form."],
  ],
  footnote:
    "Current (2025–2026) US personal-auto offerings, confirmed against carrier pages and policy contracts (incl. Allstate's ACR1), cross-checked with Insurify. The state filter resolves verified exclusions/mandates (accident-forgiveness bans, telematics exclusions, FL/KY/SC glass mandates, GEICO rideshare exclusions, State Farm not writing auto in MA/RI).",
  features: [
    { id: "accident-forgiveness", name: "Accident forgiveness", description: "First at-fault accident won't raise your rate", cells: {
      allstate: { category: "available", confidence: "high", note: '"Your Choice Auto" add-on; rate won\'t rise after an at-fault accident.', excludeStates: ["CA"], source: src("allstate.com", "https://www.allstate.com/auto-insurance/accident-forgiveness") },
      statefarm: { category: "none", confidence: "high", note: "No accident-forgiveness product anywhere — among the few majors with none.", source: src("insurify.com", "https://insurify.com/car-insurance/companies/state-farm/") },
      geico: { category: "varies", confidence: "high", note: "Earned (free ~5 yrs) or purchased; first at-fault only.", excludeStates: ["CA", "CT", "MA"], source: src("geico.com", "https://www.geico.com/auto-insurance/claim-forgiveness/") },
      progressive: { category: "available", confidence: "high", note: "Small (free, ≤$500), Large (free after ~5 yrs), or purchased.", excludeStates: ["CA"], source: src("progressive.com", "https://www.progressive.com/answers/what-is-accident-forgiveness/") },
    } },
    { id: "new-car-replacement", name: "New car replacement", description: "Total loss on a near-new car pays for a new one, not depreciated value", cells: {
      allstate: { category: "available", confidence: "high", note: "Same make/model on a totaled near-new car (≤2 model yrs); often bundled with gap.", source: src("allstate.com", "https://www.allstate.com/resources/car-insurance/new-car-insurance") },
      statefarm: { category: "none", confidence: "high", note: "Total loss at actual cash value; no NCR endorsement.", source: src("statefarm.com", "https://www.statefarm.com/insurance/auto/coverage-options") },
      geico: { category: "none", confidence: "high", note: "Total loss at actual cash value; no NCR endorsement.", source: src("valuepenguin.com", "https://www.valuepenguin.com/auto-insurance/new-car-replacement-insurance") },
      progressive: { category: "none", confidence: "high", note: "No NCR; Loan/Lease Payoff is the nearest substitute.", source: src("valuepenguin.com", "https://www.valuepenguin.com/auto-insurance/new-car-insurance") },
    } },
    { id: "gap", name: "Gap / loan-lease payoff", description: "Covers the loan balance above the car's value after a total loss", cells: {
      allstate: { category: "available", confidence: "high", note: '"Loan/lease gap"; loans up to 96 months / $50,000 balance.', source: src("allstate.com", "https://www.allstate.com/resources/car-insurance/types-of-car-insurance-coverage") },
      statefarm: { category: "none", confidence: "high", note: '"Payoff Protector" is a bank-loan feature — "not an insurance product."', source: src("statefarm.com", "https://www.statefarm.com/finances/banking/loans/payoff-protector") },
      geico: { category: "none", confidence: "high", note: "Not sold on the GEICO auto policy; use dealer/lender/standalone.", source: src("geico.com", "https://www.geico.com/living/what-is-gap-insurance/") },
      progressive: { category: "available", confidence: "high", note: '"Loan/Lease Payoff" — owed minus value, capped at 25% of value.', source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/") },
    } },
    { id: "roadside", name: "Roadside assistance", description: "Towing, jump-start, lockout, flat tire", cells: {
      allstate: { category: "available", confidence: "high", note: "On-policy coverage + standalone membership ($75/$99 a yr; 15/25-mi tows).", source: src("allstate.com", "https://www.allstate.com/roadside") },
      statefarm: { category: "available", confidence: "high", note: '"Emergency Road Service" — tow, flat, battery, lockout, 1 hr on-site labor.', source: src("statefarm.com", "https://www.statefarm.com/insurance/auto/coverage-options/emergency-road-service-coverage") },
      geico: { category: "available", confidence: "high", note: '"Emergency Road Service" — ~15-mi tow; ~$14/yr per car.', source: src("geico.com", "https://www.geico.com/auto-insurance/emergency-road-service/") },
      progressive: { category: "available", confidence: "high", note: "Optional — tow, lockout, tire, fuel/fluid, jump-start.", source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/") },
    } },
    { id: "rental", name: "Rental reimbursement", description: "Pays for a rental while your car is repaired", cells: {
      allstate: { category: "available", confidence: "high", note: '"Transportation Expense Coverage" — rental + alternate transport.', source: src("allstate.com", "https://www.allstate.com/resources/car-insurance/types-of-car-insurance-coverage") },
      statefarm: { category: "available", confidence: "high", note: '"Car Rental & Travel Expenses"; can reimburse rideshare/bus fares.', source: src("statefarm.com", "https://www.statefarm.com/insurance/auto/coverage-options/car-rental-and-travel-expenses-coverage") },
      geico: { category: "available", confidence: "high", note: "e.g. $25/day / $750 per claim; Enterprise direct-bill. Rental only.", source: src("geico.com", "https://www.geico.com/claims/claimsprocess/vehicle-rental/") },
      progressive: { category: "available", confidence: "high", note: "Rental during covered-loss repair, up to limits.", source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/") },
    } },
    { id: "rideshare", name: "Rideshare coverage", description: "Extends your policy while driving for Uber / Lyft", cells: {
      allstate: { category: "available", confidence: "high", note: '"Ride for Hire" — covers Phase 1 + the deductible gap.', source: src("allstate.com", "https://www.allstate.com/auto-insurance/ride-for-hire") },
      statefarm: { category: "available", confidence: "high", note: "Extends the personal policy incl. app-on/waiting. Varies by state.", source: src("statefarm.com", "https://www.statefarm.com/insurance/auto/coverage-options") },
      geico: { category: "varies", confidence: "medium", note: 'A "hybrid" policy; sources conflict on underwritten vs partner-brokered.', excludeStates: ["AK", "GA", "KY", "MI", "NV", "NJ", "NY", "NC", "TX", "UT"], source: src("insurify.com", "https://insurify.com/car-insurance/companies/geico/") },
      progressive: { category: "varies", confidence: "high", note: "Optional add-on covering Period 1. Most but not all states.", source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/") },
    } },
    { id: "diminishing-deductible", name: "Diminishing deductible", description: "Deductible drops for each claim-free period", cells: {
      allstate: { category: "available", confidence: "high", note: '"Deductible Rewards" — $100 + $100/accident-free yr, up to $500.', source: src("allstate.com", "https://www.allstate.com/auto-insurance/car-coverages") },
      statefarm: { category: "none", confidence: "medium", note: "No claim-free deductible-reduction program.", source: src("insurify.com", "https://insurify.com/car-insurance/companies/state-farm/") },
      geico: { category: "none", confidence: "high", note: "No diminishing/vanishing deductible program.", source: src("geico.com", "https://www.geico.com/information/aboutinsurance/auto/") },
      progressive: { category: "available", confidence: "high", note: '"Deductible Savings Bank" — −$50 per claim-free 6-month period.', source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/") },
    } },
    { id: "oem-parts", name: "OEM parts option", description: "Repairs guaranteed to use original-manufacturer parts", cells: {
      allstate: { category: "none", confidence: "medium", note: "No OEM-guarantee endorsement; ACR1 contract permits non-OEM parts.", source: src("allstate.com", "https://www.allstate.com/auto-insurance/car-coverages") },
      statefarm: { category: "none", confidence: "high", note: "No OEM endorsement; may request OEM at added cost. IN/MN require notice.", source: src("statefarm.com", "https://www.statefarm.com/claims/auto/replacement-parts") },
      geico: { category: "none", confidence: "medium", note: "No buyable OEM endorsement; aftermarket on older/higher-mileage cars.", source: src("geico.com", "https://www.geico.com/information/aboutinsurance/auto/") },
      progressive: { category: "none", confidence: "high", note: "OEM for motorcycles, not cars; auto defaults to aftermarket.", source: src("progressive.com", "https://www.progressive.com/answers/aftermarket-parts-and-insurance/") },
    } },
    { id: "telematics", name: "Telematics discount", description: "Safe-driving app / device discount program", cells: {
      allstate: { category: "available", confidence: "high", note: '"Drivewise" + "Milewise" (pay-per-mile).', excludeStates: ["CA", "AK"], source: src("allstate.com", "https://www.allstate.com/drive-wise") },
      statefarm: { category: "available", confidence: "high", note: '"Drive Safe & Save" — up to ~30% at renewal.', excludeStates: ["CA", "MA", "RI"], source: src("statefarm.com", "https://www.statefarm.com/insurance/auto/discounts/drive-safe-save") },
      geico: { category: "available", confidence: "high", note: '"DriveEasy" (app-based). Not in all states.', source: src("geico.com", "https://www.geico.com/driveeasy/") },
      progressive: { category: "available", confidence: "high", note: '"Snapshot" (app or plug-in). Impact varies by state.', source: src("progressive.com", "https://www.progressive.com/auto/discounts/snapshot/") },
    } },
    { id: "glass", name: "Full glass / windshield", description: "Low- or no-deductible glass repair & replacement", mandate: { mandatory: ["FL", "KY", "SC"], mustOffer: ["AZ", "CT", "MA", "MN", "NY"] }, cells: {
      allstate: { category: "varies", confidence: "high", note: "Glass under comp; deductible waived when repaired; claims via Safelite.", source: src("allstate.com", "https://www.allstate.com/claims/auto-motorcycle/windshield-glass") },
      statefarm: { category: "varies", confidence: "medium", note: "Follows state law; $0-deductible glass where required.", source: src("wallethub.com", "https://wallethub.com/answers/ci/state-farm-glass-coverage-1000040-2140732836/") },
      geico: { category: "varies", confidence: "medium", note: "Deductible waived for repairs; optional no-deductible glass in some states.", source: src("geico.com", "https://www.geico.com/auto-insurance/type-of-car-insurance-coverage/") },
      progressive: { category: "varies", confidence: "high", note: "Repairable cracks no-deductible; $0 replacement where required.", source: src("progressive.com", "https://www.progressive.com/answers/free-windshield-replacement-states/") },
    } },
    { id: "custom-parts", name: "Custom parts & equipment", description: "Covers aftermarket add-ons (stereo, wheels, paint)", cells: {
      allstate: { category: "available", confidence: "high", note: '"CPE endorsement" — limit higher of $1,000 or Declarations; + Sound System Coverage.', source: src("allstate.com", "https://www.allstate.com/resources/car-insurance/insuring-modified-classic-cars") },
      statefarm: { category: "available", confidence: "low", note: "Custom items must be declared/endorsed. No State Farm built-in limit confirmed.", source: src("freeadvice.com", "https://www.freeadvice.com/insurance/does-state-farm-offer-custom-parts-and-equipment-coverage/") },
      geico: { category: "available", confidence: "high", note: "Aftermarket wheels/stereo/paint; you set a limit. $1,000 built-in in some states.", source: src("geico.com", "https://www.geico.com/information/aboutinsurance/auto/") },
      progressive: { category: "available", confidence: "high", note: '"CPE" — stereo, wheels, nav, paint; typical limit ~$5,000.', source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/") },
    } },
    { id: "emergency-travel", name: "Emergency travel expense", description: "Lodging / meals if stranded far from home after a loss", cells: {
      allstate: { category: "available", confidence: "high", note: 'Via Roadside membership "Trip Interruption": >100 mi, up to $1,000/$1,500.', source: src("allstate.com", "https://www.allstate.com/roadside") },
      statefarm: { category: "available", confidence: "high", note: 'Built into "Car Rental & Travel Expenses" — up to $500, >50 mi from home.', source: src("statefarm.com", "https://www.statefarm.com/insurance/auto/coverage-options/car-rental-and-travel-expenses-coverage") },
      geico: { category: "none", confidence: "high", note: "GEICO's $1,000 emergency-expense benefit is RV-policy only; not on auto.", source: src("geico.com (RV)", "https://www.geico.com/information/aboutinsurance/rv/") },
      progressive: { category: "varies", confidence: "high", note: '"Trip Interruption" (Roadside add-on) — 100+ mi, up to $500. Where available.', source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/") },
    } },
    { id: "mechanical-breakdown", name: "Mechanical breakdown", description: "Covers major mechanical failures beyond warranty", cells: {
      allstate: { category: "available", confidence: "high", note: 'Separate "Extended Vehicle Care" service contract (from ~$19/mo).', source: src("allstate.com", "https://www.allstate.com/auto-insurance/allstate-extras") },
      statefarm: { category: "none", confidence: "high", note: "No mechanical breakdown insurance.", source: src("statefarm.com", "https://www.statefarm.com/insurance/auto/coverage-options/emergency-road-service-coverage") },
      geico: { category: "varies", confidence: "high", note: '"MBI" — new/leased <15 mo & <15k mi; $250 deductible. Not all states.', source: src("geico.com", "https://www.geico.com/auto-insurance/mechanical-breakdown-insurance/") },
      progressive: { category: "varies", confidence: "high", note: '"Vehicle Protection" — car ≤6 model yrs; ~$12/mo. Not all states.', source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/vehicle-protection-plan/") },
    } },
  ],
};

// --- HOME -----------------------------------------------------------------
const HOME_SRC: Record<string, { label: string; url: string }> = {
  statefarm: src("statefarm.com", "https://www.statefarm.com/insurance/home-and-property/homeowners/coverage"),
  allstate: src("allstate.com", "https://www.allstate.com/homeowners-insurance/coverage"),
  farmers: src("farmers.com", "https://www.farmers.com/home/homeowners/coverage/"),
  liberty: src("libertymutual.com", "https://www.libertymutual.com/property/homeowners-insurance/coverage"),
};

const HOME: Line = {
  key: "home",
  label: "Home",
  legend: ["included", "endorsement", "varies", "none", "dnpa"],
  carriers: [
    { id: "statefarm", name: "State Farm", color: "#C42127" },
    { id: "allstate", name: "Allstate", color: "#1B6CA8" },
    { id: "farmers", name: "Farmers", color: "#8A5A10" },
    { id: "liberty", name: "Liberty Mutual", color: "#1B7F4B" },
  ],
  glossary: [
    ["Extended replacement cost", "Pays a set % above your dwelling limit if rebuild costs run over. 'Guaranteed' = no cap."],
    ["Other Structures (Cov B)", "Detached structures — garage, fence, shed — usually a % of the dwelling limit."],
    ["Personal Property (Cov C)", "Your belongings; a % of dwelling, paid at replacement cost or depreciated value."],
    ["Loss settlement (ACV vs RCV)", "ACV = depreciated; RCV = full replacement cost. RCV on contents is often an add-on."],
    ["Loss of Use / ALE", "Extra living costs while the home is uninhabitable; capped by amount and/or time."],
    ["Ordinance or law", "The added cost of rebuilding to current codes, which a base policy largely excludes."],
    ["Wind/hail & hurricane deductible", "A separate (often %) deductible for wind, hail, or named-storm losses."],
    ["Roof settlement", "Whether a roof loss is paid at full replacement cost or depreciated by the roof's age."],
    ["Data not publicly available", "The exact limit is on the declarations page or in a state-filed form. Confirm on a quote."],
    ["Safeco-derived", "Comes from Safeco's filed forms (Liberty's independent-agent brand); may differ from Liberty-direct."],
  ],
  footnote:
    "Current (2025–2026) US homeowners (HO-3) offerings. High-confidence values trace to filed forms (State Farm HW-2136 via the OK DOI; Allstate AP1 via the NV DOI; Allstate's own state extended-cost table) or carrier sites; Farmers/Liberty lean on carrier copy, Insurify, and — for Liberty — Safeco's filed forms (tagged). Most HO limits are declarations-level and don't vary cleanly by state on public data.",
  features: [
    { id: "dwelling-erc", name: "Dwelling — extended replacement cost", description: "Pays above the dwelling limit to rebuild after a total loss", cells: {
      statefarm: { category: "endorsement", value: "+20% buffer", confidence: "high", note: "Option ID; ~20%. Guaranteed/unlimited RC not offered." },
      allstate: { category: "endorsement", value: "+120% buffer", confidence: "high", note: "BSREL; 120% std (125% AR/NC/NY, 150% CA/CT). Not on 'Select' packages in some states." },
      farmers: { category: "endorsement", value: "+25% / Guaranteed", confidence: "high", note: "Extended RC up to +25%; Guaranteed RC (no cap) also available." },
      liberty: { category: "endorsement", value: "Offered · buffer DNPA", confidence: "medium", safecoDerived: true, note: "Extended + Guaranteed RC offered; Liberty-direct buffer not published (Safeco deluxe ~50%)." },
    } },
    { id: "other-structures", name: "Other Structures (Cov B)", description: "Detached garage, fence, shed — % of dwelling", cells: {
      statefarm: { category: "included", value: "10% of Cov A", confidence: "high", note: "Minimum 10%, increasable (nested under Coverage A)." },
      allstate: { category: "included", value: "10% of Cov A", confidence: "high", note: "Standard 10%; increasable." },
      farmers: { category: "included", value: "~10% of Cov A", confidence: "high", note: "Standard HO-3 default; increasable." },
      liberty: { category: "included", value: "10% of Cov A", confidence: "high", safecoDerived: true, note: "Standard 10%; increasable (Safeco form)." },
    } },
    { id: "personal-property", name: "Personal Property (Cov C)", description: "Contents coverage — % of dwelling", cells: {
      statefarm: { category: "included", value: "~75% of Cov A", confidence: "medium", note: "Higher than the ~50% norm; adjustable (declarations value)." },
      allstate: { category: "included", value: "~50% of Cov A", confidence: "medium", note: "Typical ~50%, customizable." },
      farmers: { category: "included", value: "~50–70% of Cov A", confidence: "medium", note: "Common default ~50%, adjustable up." },
      liberty: { category: "included", value: "~50% of Cov A", confidence: "medium", safecoDerived: true, note: "Liberty ~50%; Safeco commonly 50–70%." },
    } },
    { id: "pp-loss", name: "Personal Property loss settlement", description: "Replacement cost vs. depreciated (ACV)", cells: {
      statefarm: { category: "included", value: "RCV available", confidence: "high", note: "RCV via Option B1; default ACV (B2)." },
      allstate: { category: "endorsement", value: "ACV base · RCV optional", confidence: "high", note: "Customer chooses ACV or RCV." },
      farmers: { category: "endorsement", value: "ACV base · RCV optional", confidence: "medium", note: "RCV available; included at higher Smart Plan tiers." },
      liberty: { category: "endorsement", value: "ACV base · RCV optional", confidence: "high", note: "RCV via 'Personal Property Replacement Cost' endorsement." },
    } },
    { id: "loss-of-use", name: "Loss of Use / ALE (Cov D)", description: "Living expenses while the home is unlivable", cells: {
      statefarm: { category: "included", value: "Up to 24 months", confidence: "high", note: "ALE capped at 24 months; % of Cov A is a declarations value." },
      allstate: { category: "included", value: "Up to 12 months", confidence: "high", note: "Base ALE capped at 12 months (some states extend); ~20–30% of Cov A." },
      farmers: { category: "included", value: "~20% of Cov A", confidence: "medium", note: "Amount ~20%; time cap not published." },
      liberty: { category: "included", value: "Up to 24 months", confidence: "high", safecoDerived: true, note: "Safeco form caps ALE at 24 months; exact % not published." },
    } },
    { id: "liability", name: "Personal Liability (Cov E/L)", description: "Lawsuits for injury or damage you're liable for", cells: {
      statefarm: { category: "included", value: "$100k–$500k", confidence: "medium", note: "Commonly $100k / $300k / $500k." },
      allstate: { category: "included", value: "$100k–$500k", confidence: "medium", note: "$100k / $200k / $300k / $500k; umbrella above." },
      farmers: { category: "included", value: "$100k–$500k", confidence: "high", note: "Umbrella above to $10M in $1M increments." },
      liberty: { category: "included", value: "$100k / $300k / $500k", confidence: "medium", note: "Higher via umbrella tie-in." },
    } },
    { id: "medpay", name: "Medical Payments (Cov F/M)", description: "Minor guest injuries, no-fault", cells: {
      statefarm: { category: "included", value: "$1k–$5k", confidence: "medium", note: "Typical $1,000–$5,000 options." },
      allstate: { category: "included", value: "$1k–$5k", confidence: "medium", note: "Pays expenses incurred within 3 years of the accident." },
      farmers: { category: "included", value: "$1k–$5k", confidence: "high", note: "Standard $1,000–$5,000 options." },
      liberty: { category: "dnpa", confidence: "low", note: "Limit menu not published; industry norm $1k–$5k." },
    } },
    { id: "windhail", name: "Wind / hail deductible", description: "Separate deductible for wind & hail losses", cells: {
      statefarm: { category: "varies", value: "Via storm endorsements", confidence: "high", note: "Generally not a standalone endorsement on the standard Homeowners form; Texas is the exception." },
      allstate: { category: "varies", value: "~1–5% of Cov A", confidence: "medium", note: "Separate wind/hail deductible in wind-exposed states; may be mandatory coastal." },
      farmers: { category: "varies", value: "1–5% of insured value", confidence: "high", note: "Separate % deductible; flat-dollar option in low-risk areas." },
      liberty: { category: "varies", value: "1–10% of insured value", confidence: "high", note: "Percentage deductibles typically 1–10%; state schedules vary." },
    } },
    { id: "hurricane", name: "Hurricane deductible", description: "Separate named-storm deductible (coastal)", cells: {
      statefarm: { category: "varies", value: "Offered (coastal)", confidence: "high", note: "Separate % deductible via state-specific endorsements; HI requires it on every policy." },
      allstate: { category: "varies", value: "Offered (coastal)", confidence: "medium", note: "% deductible (1–5%, up to 10%). Constrained in FL/CA (Allstate reduced writing)." },
      farmers: { category: "varies", value: "Offered (coastal)", confidence: "medium", note: "% deductible in ~19 Atlantic/Gulf states; exact bands not published." },
      liberty: { category: "varies", value: "Offered (coastal)", confidence: "high", note: "% within the 1–10% framework; exact trigger % not published." },
    } },
    { id: "multipolicy", name: "Home + Auto discount", description: "Multi-policy bundling discount", cells: {
      statefarm: { category: "included", value: "~20–25%", confidence: "medium", note: "Aggregator average on combined premium; no single published figure." },
      allstate: { category: "included", value: "Up to 25%", confidence: "high", note: "Allstate's published figure; ~20% typically realized." },
      farmers: { category: "included", value: "Up to ~20%", confidence: "medium", note: "Sources span 10–25%; varies by state." },
      liberty: { category: "included", value: "Up to ~15%", confidence: "medium", note: "Some cite up to 10%; where state law allows." },
    } },
    { id: "water-backup", name: "Water / sewer backup", description: "Backup through drains and sewers", cells: {
      statefarm: { category: "endorsement", value: "Up to ~$30k", confidence: "medium", note: "Optional endorsement; $10k–$30k tiers. Doesn't cover the sewer line itself." },
      allstate: { category: "endorsement", value: "$5k–$25k tiers", confidence: "medium", note: "Optional endorsement; selectable tiers." },
      farmers: { category: "endorsement", value: "Limit DNPA", confidence: "medium", note: "Optional endorsement; limit menu not published (industry $5k–$25k)." },
      liberty: { category: "endorsement", value: "Up to $50k", confidence: "high", safecoDerived: true, note: "Optional endorsement; Safeco up to $50,000 in most states." },
    } },
    { id: "service-line", name: "Service line coverage", description: "Buried utility lines to the home", cells: {
      statefarm: { category: "endorsement", value: "Limit DNPA", confidence: "medium", note: "Optional endorsement; State Farm-specific limit not published." },
      allstate: { category: "endorsement", value: "Up to ~$10k", confidence: "medium", note: "Optional endorsement; separate deductible. Not in every state." },
      farmers: { category: "endorsement", value: "Limit DNPA", confidence: "medium", note: "Available as endorsement; limit not published." },
      liberty: { category: "endorsement", value: "Up to $12k", confidence: "high", safecoDerived: true, note: "Optional endorsement; Safeco up to $12,000." },
    } },
    { id: "equip-breakdown", name: "Equipment breakdown", description: "HVAC, appliances, home systems failure", cells: {
      statefarm: { category: "endorsement", value: "~$50k · $500 ded", confidence: "medium", note: "'Home Systems Protection' endorsement; ~$50,000, ~$500 deductible." },
      allstate: { category: "endorsement", value: "Limit DNPA", confidence: "medium", note: "Add-on endorsement; per-occurrence limit not published (industry $50k–$100k)." },
      farmers: { category: "endorsement", value: "Limit DNPA", confidence: "medium", note: "Available as endorsement; limit not published." },
      liberty: { category: "endorsement", value: "Up to $50k · $500 ded", confidence: "medium", note: "'Home Systems & Appliance Breakdown' endorsement; up to $50,000, $500 deductible." },
    } },
    { id: "ordinance", name: "Ordinance or law", description: "Extra cost to rebuild to current codes", cells: {
      statefarm: { category: "endorsement", value: "OL% of Cov A", confidence: "high", note: "Option OL — additional amount = the OL % on declarations; base % not published (~10%)." },
      allstate: { category: "included", value: "Up to 10% of Cov A", confidence: "high", note: "'Building Codes' (Coverage BC) up to 10%; increasable in some states." },
      farmers: { category: "endorsement", value: "~10% + buy-up", confidence: "medium", note: "Base % typically ~10% with buy-up; exact % not published." },
      liberty: { category: "included", value: "% on dec + buy-up", confidence: "high", safecoDerived: true, note: "Included as a % of Cov A with buy-up; top tier auto-includes at 100%." },
    } },
    { id: "roof", name: "Roof settlement", description: "Replacement cost vs. depreciated by roof age", cells: {
      statefarm: { category: "varies", value: "RCV; ACV on older roofs", confidence: "medium", note: "Default RCV; a roof-ACV endorsement attaches in hail/coastal states & for older roofs." },
      allstate: { category: "varies", value: "RCV <16 yrs; schedule after", confidence: "medium", note: "Roof surfaces on a payment schedule — RCV under ~16 yrs, depreciation at 16+." },
      farmers: { category: "varies", value: "RCV; schedule on older roofs", confidence: "medium", note: "RCV standard; ACV/payment schedule on older roofs. Exact table not published." },
      liberty: { category: "varies", value: "RCV/ACV by roof age", confidence: "high", safecoDerived: true, note: "'Roof Surfaces Payment Schedule' endorsement; exact table not published." },
    } },
  ],
};

export const LINES: Record<LineKey, Line> = { auto: AUTO, home: HOME };

// --- resolve logic --------------------------------------------------------
export type ResolvedCell = {
  category: Category;
  value?: string;
  note?: string;
  stateFlag?: string;
};

// Apply a selected state (2-letter code, or "" for national baseline) to a cell.
export function resolveCell(line: Line, feature: Feature, carrier: Carrier, cell: Cell, state: string): ResolvedCell {
  const out: ResolvedCell = { category: cell.category, value: cell.value, note: cell.note };
  if (!state) return out;
  const sn = stateName(state);

  if (line.key === "auto") {
    if (carrier.unavailableStates?.includes(state)) {
      return { category: "none", note: undefined, stateFlag: `${carrier.name} doesn't write auto in ${sn}.` };
    }
    if (cell.excludeStates?.includes(state)) {
      return { category: "none", value: undefined, note: cell.note, stateFlag: `Not available in ${sn}.` };
    }
    if (feature.mandate) {
      if (feature.mandate.mandatory.includes(state)) out.stateFlag = `$0-deductible glass — state-mandated in ${sn}.`;
      else if (feature.mandate.mustOffer.includes(state)) out.stateFlag = `A $0-deductible glass option must be offered in ${sn}.`;
    }
    return out;
  }

  // home
  if (feature.id === "dwelling-erc" && carrier.id === "allstate") {
    out.value = `+${ALLSTATE_ERC_BUFFER[state] ?? "120%"} buffer`;
    if (ALLSTATE_ERC_SELECT_EXCL.includes(state)) out.stateFlag = `Excluded on 'Select' packages in ${sn}.`;
  } else if (feature.id === "hurricane") {
    if (!COASTAL_STATES.includes(state)) {
      return { category: "none", value: undefined, note: `Named-storm deductibles apply in coastal states; ${sn} is inland.` };
    }
    out.stateFlag = `Applies in ${sn} (coastal).`;
  } else if (feature.id === "windhail" && carrier.id === "statefarm" && state === "TX") {
    out.value = "Separate wind/hail % (HOW)";
    out.note = "Texas — a separate wind/hail deductible applies on the standard Homeowners (HOW) policy, as a % of Coverage A.";
  }
  return out;
}

// Reorder a line's carriers so the agent's own brand(s) sit first (the anchor).
// `brands` are profile brand strings (captive_brand, or authorized_brands).
export function anchorCarriers(line: Line, brands: string[]): { carrier: Carrier; anchor: boolean }[] {
  const mine = new Set(brands);
  const tagged = line.carriers.map((c) => ({ carrier: c, anchor: mine.has(c.name) }));
  return [...tagged].sort((a, b) => Number(b.anchor) - Number(a.anchor));
}

// Minimal state-name map (2-letter -> full). Kept local so this module stays
// client-safe and dependency-free.
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
export function stateName(code: string): string {
  return STATE_NAMES[code] ?? code;
}
