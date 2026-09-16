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
  | "stepdown" // covered, but at reduced (step-down) limits — Who's-Covered scenarios
  | "none" // not offered
  | "dnpa"; // data not publicly available

export type Confidence = "high" | "medium" | "low";
export type LineKey = "auto" | "home" | "scenarios";

// Rich per-carrier detail for the "Who's Covered" driver/vehicle scenarios.
// Optional — only scenario cells populate it; auto/home cells never do.
export type ScenarioDetail = {
  extends?: ("BI" | "PD" | "MedPIP" | "UMUIM" | "collision" | "comprehensive")[]; // which coverages follow the driver/vehicle
  limits?: string; // "Full policy limits" | "State minimum" | "Step-down to $X"
  deductible?: string; // "Your own deductible" | "Waived" | "Applies"
  primacy?: "primary" | "excess" | "n/a"; // pays first vs. only after another policy is exhausted
  endorsement?: string; // an endorsement that changes the answer
  stateExceptions?: string; // where state law / carrier form differs
  seeAlso?: "rental" | "rideshare"; // link to an existing feature — never duplicate it
};

export type Cell = {
  category: Category;
  value?: string; // measure/term shown as the headline (home); omitted for auto status-only cells
  note?: string;
  confidence: Confidence;
  source?: { label: string; url: string };
  safecoDerived?: boolean; // Liberty Mutual figures sourced from Safeco's filed forms
  excludeStates?: string[]; // states where this feature is NOT available (resolved by the state filter)
  scenario?: ScenarioDetail; // Who's-Covered rich detail; unset on auto/home cells
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
    { id: "travelers", name: "Travelers", color: "#B4472D" },
    { id: "nationwide", name: "Nationwide", color: "#0F7B8A" },
    { id: "usaa", name: "USAA", color: "#14477A" },
    { id: "amfam", name: "American Family", color: "#6E4B9E" },
  ],
  glossary: [
    ["Available", "Offered as an optional add-on / endorsement on top of the base policy."],
    ["Not offered", "The carrier does not sell this on the personal auto policy anywhere."],
    ["Accident forgiveness", "Keeps your first at-fault accident from raising your premium."],
    ["New car replacement", "Pays for a comparable new car after a total loss on a near-new vehicle."],
    ["Gap / loan-lease payoff", "Covers the loan/lease balance above the car's value after a total loss."],
    ["Diminishing deductible", "Reduces your deductible for each claim-free period."],
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
      geico: { category: "none", confidence: "high", note: "No rideshare endorsement on the personal auto policy — GEICO routes drivers to a separate hybrid (personal + rideshare) commercial policy, and only in some states.", source: src("insurify.com", "https://insurify.com/car-insurance/companies/geico/") },
      progressive: { category: "varies", confidence: "high", note: "Optional add-on covering Period 1. Most but not all states.", source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/") },
    } },
    { id: "diminishing-deductible", name: "Diminishing deductible", description: "Deductible drops for each claim-free period", cells: {
      allstate: { category: "available", confidence: "high", note: '"Deductible Rewards" — $100 + $100/accident-free yr, up to $500.', source: src("allstate.com", "https://www.allstate.com/auto-insurance/car-coverages") },
      statefarm: { category: "none", confidence: "high", note: "No claim-free deductible-reduction program.", source: src("insurify.com", "https://insurify.com/car-insurance/companies/state-farm/") },
      geico: { category: "none", confidence: "high", note: "No diminishing/vanishing deductible program.", source: src("geico.com", "https://www.geico.com/information/aboutinsurance/auto/") },
      progressive: { category: "available", confidence: "high", note: '"Deductible Savings Bank" — −$50 per claim-free 6-month period.', source: src("progressive.com", "https://www.progressive.com/auto/insurance-coverages/") },
    } },
    { id: "telematics", name: "Telematics discount", description: "Safe-driving app / device discount program", cells: {
      allstate: { category: "available", confidence: "high", note: '"Drivewise" + "Milewise" (pay-per-mile).', excludeStates: ["CA", "AK"], source: src("allstate.com", "https://www.allstate.com/drive-wise") },
      statefarm: { category: "available", confidence: "high", note: '"Drive Safe & Save" — up to ~30% at renewal.', excludeStates: ["CA", "MA", "RI"], source: src("statefarm.com", "https://www.statefarm.com/insurance/auto/discounts/drive-safe-save") },
      geico: { category: "available", confidence: "high", note: '"DriveEasy" (app-based). Not in all states.', source: src("geico.com", "https://www.geico.com/driveeasy/") },
      progressive: { category: "available", confidence: "high", note: '"Snapshot" (app or plug-in). Impact varies by state.', source: src("progressive.com", "https://www.progressive.com/auto/discounts/snapshot/") },
    } },
    { id: "glass", name: "Full glass / windshield", description: "Low- or no-deductible glass repair & replacement", mandate: { mandatory: ["FL", "KY", "SC"], mustOffer: ["AZ", "CT", "MA", "MN", "NY"] }, cells: {
      allstate: { category: "varies", confidence: "high", note: "Glass under comp; deductible waived when repaired; claims via Safelite.", source: src("allstate.com", "https://www.allstate.com/claims/auto-motorcycle/windshield-glass") },
      statefarm: { category: "varies", confidence: "high", note: "Comp deductible waived for windshield repair; replacement keeps the deductible; $0 where state law requires.", source: src("statefarm.com", "https://www.statefarm.com/claims/auto/windshield-repair") },
      geico: { category: "varies", confidence: "high", note: "Deductible waived for repairs; optional no-deductible glass in some states.", source: src("geico.com", "https://www.geico.com/auto-insurance/type-of-car-insurance-coverage/") },
      progressive: { category: "varies", confidence: "high", note: "Repairable cracks no-deductible; $0 replacement where required.", source: src("progressive.com", "https://www.progressive.com/answers/free-windshield-replacement-states/") },
    } },
    { id: "custom-parts", name: "Custom parts & equipment", description: "Covers aftermarket add-ons (stereo, wheels, paint)", cells: {
      allstate: { category: "available", confidence: "high", note: '"CPE endorsement" — limit higher of $1,000 or Declarations; + Sound System Coverage.', source: src("allstate.com", "https://www.allstate.com/resources/car-insurance/insuring-modified-classic-cars") },
      statefarm: { category: "available", confidence: "high", note: "State Farm 'Custom parts/equipment coverage' — optional coverage for aftermarket add-ons; must be added. No published built-in limit.", source: src("statefarm.com", "https://www.statefarm.com/simple-insights/auto-and-vehicles/sports-car-insurance") },
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
    { id: "travelers", name: "Travelers", color: "#B4472D" },
    { id: "nationwide", name: "Nationwide", color: "#0F7B8A" },
    { id: "usaa", name: "USAA", color: "#14477A" },
    { id: "amfam", name: "American Family", color: "#6E4B9E" },
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
      statefarm: { category: "endorsement", value: "120% of Cov A", confidence: "high", note: "Option ID (Increased Dwelling Limit) ≈ +20% above the dwelling limit. Guaranteed/unlimited RC not offered." },
      allstate: { category: "endorsement", value: "120% of Cov A", confidence: "high", note: "BSREL — 120% of Coverage A standard (125% AR/NC/NY, 150% CA/CT). Not on 'Select' packages in some states." },
      farmers: { category: "endorsement", value: "125% of Cov A · Guaranteed", confidence: "high", note: "Extended RC ≈ +25%; Guaranteed RC (no cap) also available." },
      liberty: { category: "endorsement", value: "Offered · % DNPA", confidence: "high", note: "Extended + Guaranteed replacement cost both offered (Policygenius); the buffer % isn't published (Safeco deluxe runs ~50%).", source: src("policygenius.com", "https://www.policygenius.com/homeowners-insurance/reviews/liberty-mutual/") },
    } },
    { id: "other-structures", name: "Other Structures (Cov B)", description: "Detached garage, fence, shed — % of dwelling", cells: {
      statefarm: { category: "included", value: "10% of Cov A", confidence: "high", note: "Minimum 10%, increasable (nested under Coverage A)." },
      allstate: { category: "included", value: "10% of Cov A", confidence: "high", note: "Standard 10%; increasable." },
      farmers: { category: "included", value: "~10% of Cov A", confidence: "high", note: "Standard HO-3 default; increasable." },
      liberty: { category: "included", value: "10% of Cov A", confidence: "high", safecoDerived: true, note: "Standard 10%; increasable (Safeco form)." },
    } },
    { id: "personal-property", name: "Personal Property (Cov C)", description: "Contents coverage — % of dwelling", cells: {
      statefarm: { category: "included", value: "~75% of Cov A", confidence: "high", note: "Higher than the ~50% norm; adjustable (declarations value)." },
      allstate: { category: "included", value: "~50% of Cov A", confidence: "high", note: "Typical ~50% (industry 50–70%); set on the declarations page." },
      farmers: { category: "included", value: "~50–70% of Cov A", confidence: "high", note: "Default 50–70% of Cov A, adjustable up." },
      liberty: { category: "included", value: "~50–70% of Cov A", confidence: "high", safecoDerived: true, note: "Industry-standard contents range 50–70% of Cov A (Liberty ~50%, Safeco 50–70%); adjustable." },
    } },
    { id: "pp-loss", name: "Personal Property loss settlement", description: "Replacement cost vs. depreciated (ACV)", cells: {
      statefarm: { category: "included", value: "RCV available", confidence: "high", note: "RCV via Option B1; default ACV (B2)." },
      allstate: { category: "endorsement", value: "ACV base · RCV optional", confidence: "high", note: "Customer chooses ACV or RCV." },
      farmers: { category: "endorsement", value: "ACV base · RCV optional", confidence: "high", note: "RCV available; built into higher Smart Plan tiers." },
      liberty: { category: "endorsement", value: "ACV base · RCV optional", confidence: "high", note: "RCV via 'Personal Property Replacement Cost' endorsement." },
    } },
    { id: "loss-of-use", name: "Loss of Use / ALE (Cov D)", description: "Living expenses while the home is unlivable", cells: {
      statefarm: { category: "included", value: "Up to 24 months", confidence: "high", note: "ALE capped at 24 months; % of Cov A is a declarations value." },
      allstate: { category: "included", value: "Up to 12 months", confidence: "high", note: "Base ALE capped at 12 months (some states extend); ~20–30% of Cov A." },
      farmers: { category: "included", value: "~20% of Cov A", confidence: "high", note: "Amount ~20%; time cap not published." },
      liberty: { category: "included", value: "Up to 24 months", confidence: "high", safecoDerived: true, note: "Safeco form caps ALE at 24 months; exact % not published." },
    } },
    { id: "liability", name: "Personal Liability (Cov E/L)", description: "Lawsuits for injury or damage you're liable for", cells: {
      statefarm: { category: "included", value: "$100k–$500k", confidence: "high", note: "Commonly $100k / $300k / $500k; umbrella above." },
      allstate: { category: "included", value: "$100k–$500k", confidence: "high", note: "$100k / $200k / $300k / $500k; umbrella above." },
      farmers: { category: "included", value: "$100k–$500k", confidence: "high", note: "Umbrella above to $10M in $1M increments." },
      liberty: { category: "included", value: "$100k / $300k / $500k", confidence: "high", note: "Industry-standard selectable menu; higher via umbrella tie-in." },
    } },
    { id: "medpay", name: "Medical Payments (Cov F/M)", description: "Minor guest injuries, no-fault", cells: {
      statefarm: { category: "included", value: "$1k–$5k", confidence: "high", note: "Typical $1,000–$5,000 options." },
      allstate: { category: "included", value: "$1k–$5k", confidence: "high", note: "Pays expenses incurred within 3 years of the accident." },
      farmers: { category: "included", value: "$1k–$5k", confidence: "high", note: "Standard $1,000–$5,000 options." },
      liberty: { category: "included", value: "$1k–$5k", confidence: "high", note: "Included ('Medical Payments to Others'); industry-standard $1k–$5k menu, exact limit on the dec page." },
    } },
    { id: "windhail", name: "Wind / hail deductible", description: "Separate deductible for wind & hail losses", cells: {
      statefarm: { category: "varies", value: "Via storm endorsements", confidence: "high", note: "Generally not a standalone endorsement on the standard Homeowners form; Texas is the exception." },
      allstate: { category: "varies", value: "~1–5% of Cov A", confidence: "high", note: "Separate % wind/hail deductible in wind-exposed states; often mandatory coastal." },
      farmers: { category: "varies", value: "1–5% of insured value", confidence: "high", note: "Separate % deductible; flat-dollar option in low-risk areas." },
      liberty: { category: "varies", value: "1–10% of insured value", confidence: "high", note: "Percentage deductibles typically 1–10%; state schedules vary." },
    } },
    { id: "hurricane", name: "Hurricane deductible", description: "Separate named-storm deductible (coastal)", cells: {
      statefarm: { category: "varies", value: "Offered (coastal)", confidence: "high", note: "Separate % deductible via state-specific endorsements; HI requires it on every policy." },
      allstate: { category: "varies", value: "Offered (coastal)", confidence: "high", note: "Separate named-storm % deductible in coastal states (industry 1–10%). Constrained in FL/CA (Allstate reduced writing)." },
      farmers: { category: "varies", value: "Offered (coastal)", confidence: "high", note: "% deductible (1–10%) in ~19 Atlantic/Gulf states; exact bands not published." },
      liberty: { category: "varies", value: "Offered (coastal)", confidence: "high", note: "% within the 1–10% framework; exact trigger % not published." },
    } },
    { id: "multipolicy", name: "Home + Auto discount", description: "Multi-policy bundling discount", cells: {
      statefarm: { category: "included", value: "~17–25%", confidence: "high", note: "Bundle-discount range across independent sources (WalletHub ~17%, Insure.com ~24% avg); no single published figure. Varies by state." },
      allstate: { category: "included", value: "Up to 25%", confidence: "high", note: "Allstate's published figure; ~20% typically realized." },
      farmers: { category: "included", value: "~10–25%", confidence: "high", note: "Bundle-discount range across independent sources (10–25%); varies by state." },
      liberty: { category: "included", value: "~$950/yr avg", confidence: "high", note: "Liberty's own advertised average bundle savings (a dollar figure, not a %); actual savings vary by customer.", source: src("libertymutual.com", "https://www.libertymutual.com/home-insurance") },
    } },
    { id: "water-backup", name: "Water / sewer backup", description: "Backup through drains and sewers", cells: {
      statefarm: { category: "endorsement", value: "$10k–$20k tiers", confidence: "high", note: "Optional endorsement; limits commonly $10k–$20k with a separate deductible. Doesn't cover the sewer line itself." },
      allstate: { category: "endorsement", value: "$5k–$25k tiers", confidence: "high", note: "Optional endorsement; selectable $5k–$25k tiers with a separate deductible." },
      farmers: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: "Optional endorsement; limit menu not published (industry $5k–$25k)." },
      liberty: { category: "endorsement", value: "Up to $50k", confidence: "high", safecoDerived: true, note: "Optional endorsement; Safeco up to $50,000 in most states." },
    } },
    { id: "service-line", name: "Service line coverage", description: "Buried utility lines to the home", cells: {
      statefarm: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: "Optional endorsement (buried utility lines); State Farm-specific limit not published." },
      allstate: { category: "none", confidence: "high", note: "Not offered — service line is absent from both Policygenius's and ValuePenguin's Allstate optional-coverage lists.", source: src("valuepenguin.com", "https://www.valuepenguin.com/allstate-homeowners-insurance-review") },
      farmers: { category: "none", confidence: "high", note: "Not offered — absent from Farmers' own optional-coverages list and Policygenius's 20+-item add-on list; the earlier single-source claim didn't hold.", source: src("farmers.com", "https://www.farmers.com/home/homeowners/coverage/") },
      liberty: { category: "endorsement", value: "Up to $12k", confidence: "high", safecoDerived: true, note: "Optional endorsement; Safeco up to $12,000." },
    } },
    { id: "equip-breakdown", name: "Equipment breakdown", description: "HVAC, appliances, home systems failure", cells: {
      statefarm: { category: "endorsement", value: "~$50k · $500 ded", confidence: "high", note: "'Home Systems Protection' endorsement; ~$50,000, ~$500 deductible." },
      allstate: { category: "none", confidence: "high", note: "Not offered — equipment breakdown is absent from both Policygenius's and ValuePenguin's Allstate optional-coverage lists.", source: src("valuepenguin.com", "https://www.valuepenguin.com/allstate-homeowners-insurance-review") },
      farmers: { category: "none", confidence: "high", note: "Not offered — absent from Farmers' own optional-coverages list and Policygenius's comprehensive add-on list.", source: src("farmers.com", "https://www.farmers.com/home/homeowners/coverage/") },
      liberty: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: "'Home Systems and Appliance Breakdown' endorsement — named on Liberty's own coverage page; limit/deductible not published.", source: src("libertymutual.com", "https://www.libertymutual.com/property/homeowners-insurance/coverage") },
    } },
    { id: "ordinance", name: "Ordinance or law", description: "Extra cost to rebuild to current codes", cells: {
      statefarm: { category: "endorsement", value: "OL% of Cov A", confidence: "high", note: "Option OL — additional amount = the OL % on declarations; base % not published (~10%)." },
      allstate: { category: "included", value: "Up to 10% of Cov A", confidence: "high", note: "'Building Codes' (Coverage BC) up to 10%; increasable in some states." },
      farmers: { category: "endorsement", value: "~10% + buy-up", confidence: "high", note: "Industry-standard ordinance base ~10% of Cov A with buy-up available." },
      liberty: { category: "included", value: "% on dec + buy-up", confidence: "high", safecoDerived: true, note: "Included as a % of Cov A with buy-up; top tier auto-includes at 100%." },
    } },
    { id: "roof", name: "Roof settlement", description: "Replacement cost vs. depreciated by roof age", cells: {
      statefarm: { category: "varies", value: "RCV; ACV on older roofs", confidence: "medium", note: "Default RCV; a roof-ACV endorsement attaches in hail/coastal states & for older roofs." },
      allstate: { category: "varies", value: "RCV; schedule via state endorsement", confidence: "medium", note: "Base forms settle at replacement cost; a roof payment-schedule/depreciation applies via state endorsement (age threshold varies)." },
      farmers: { category: "varies", value: "RCV; schedule on older roofs", confidence: "medium", note: "RCV standard; ACV/payment schedule on older roofs. Exact table not published." },
      liberty: { category: "varies", value: "RCV/ACV by roof age", confidence: "high", safecoDerived: true, note: "'Roof Surfaces Payment Schedule' endorsement; exact table not published." },
    } },
  ],
};

// --- expansion carriers (Travelers, Nationwide, USAA, American Family) -----
// Layered onto AUTO/HOME below so the original verified cells stay untouched.
// Only cells with real public data are listed; anything omitted renders as
// "Data not publicly available" (very common for these carriers' home limits).
const uA = src("usaa.com", "https://www.usaa.com/insurance/vehicles/auto/coverage/");
const tA = src("travelers.com", "https://www.travelers.com/car-insurance/coverage");
const nA = src("nationwide.com", "https://www.nationwide.com/personal/insurance/auto/coverages/");
const aA = src("amfam.com", "https://www.amfam.com/insurance/car/coverages");
const uH = src("usaa.com", "https://www.usaa.com/insurance/property/homeowners/coverage/");
const tH = src("travelers.com", "https://www.travelers.com/home-insurance/coverage");
const nH = src("nationwide.com", "https://www.nationwide.com/personal/insurance/homeowners/pages/coverage");
const aH = src("amfam.com", "https://www.amfam.com/insurance/home/coverages");
const usnewsUsaa = src("usnews.com", "https://www.usnews.com/insurance/homeowners-insurance/usaa");
const nerdAmfam = src("nerdwallet.com", "https://www.nerdwallet.com/insurance/homeowners/american-family-home-insurance-review");

const AUTO_EXT: Record<string, Record<string, Cell>> = {
  "accident-forgiveness": {
    usaa: { category: "available", confidence: "high", note: "Earned free after ~5 claim-free yrs, or purchased; one at-fault. Not all states.", source: uA },
    travelers: { category: "available", confidence: "high", note: "Via the Responsible Driver Plan (Premier tier adds a decreasing deductible). Not all states.", source: tA },
    nationwide: { category: "available", confidence: "high", note: '"Accident Forgiveness" waives the surcharge after a first at-fault. Select states.', source: nA },
    amfam: { category: "available", confidence: "high", note: "Earned or purchased; shields premium after a first at-fault. Eligibility varies by state.", source: aA },
  },
  "new-car-replacement": {
    usaa: { category: "none", confidence: "high", note: "No new-car replacement; \"Car Replacement Assistance\" pays ACV + 20% instead.", source: src("wallethub.com", "https://wallethub.com/answers/ci/usaa-new-car-replacement-2140759458/") },
    travelers: { category: "available", confidence: "high", note: '"Premier New Car Replacement" — same make/model within the first 5 model years.', source: tA },
    nationwide: { category: "available", confidence: "high", note: '"New Car Replacement Plus" (up to 110% MSRP, ~0–2 yr) + "Vehicle Value Upgrade" (100% MSRP); varies by state, not leases.', source: nA },
    amfam: { category: "available", confidence: "high", note: "Brand-new vehicles only; replaces a totaled car within the first year (~12 months).", source: aA },
  },
  gap: {
    usaa: { category: "available", confidence: "high", note: '"Car Replacement Assistance" (ACV + 20%, not leased) + "Total Loss Protection" (USAA-financed, up to $50k).', source: uA },
    travelers: { category: "available", confidence: "high", note: '"Loan/Lease Gap" — ACV vs balance; original owner, dealer-purchased; needs coll + comp.', source: tA },
    nationwide: { category: "available", confidence: "high", note: "Gap on collision; vehicles ≤6 yrs; select states. Deductible not covered.", source: nA },
    amfam: { category: "available", confidence: "high", note: '"Lease or Loan" (gap) — ACV vs balance on a total loss.', source: aA },
  },
  roadside: {
    usaa: { category: "available", confidence: "high", note: "24/7 tow, tire, jump, fuel, winch, lockout.", source: uA },
    travelers: { category: "available", confidence: "high", note: "Basic (15-mi tow) or Premier (100-mi tow + trip interruption + $500 PP).", source: src("travelers.com", "https://www.travelers.com/car-insurance/coverage/roadside-assistance") },
    nationwide: { category: "available", confidence: "high", note: "Basic or Plus (adds trip-interruption/lodging). 24/7.", source: nA },
    amfam: { category: "available", confidence: "high", note: '"24/7 Emergency Roadside Service"; also bundled in "Travel Peace of Mind".', source: aA },
  },
  rental: {
    usaa: { category: "available", confidence: "high", note: "Rental while your car is unusable after a covered loss.", source: uA },
    travelers: { category: "available", confidence: "high", note: "Reimburses rental after a covered loss (24+ hrs out of service).", source: tA },
    nationwide: { category: "available", confidence: "high", note: "Rental/transportation while repaired after a covered loss.", source: nA },
    amfam: { category: "available", confidence: "high", note: "Rental during repair or after a total loss.", source: aA },
  },
  rideshare: {
    usaa: { category: "available", confidence: "high", note: '"Rideshare gap protection" — covers the gap while waiting for a request. Not all states.', source: uA },
    travelers: { category: "available", confidence: "high", note: '"Limited Ridesharing" endorsement — app-on/pre-passenger period. Not all states.', source: tA },
    nationwide: { category: "none", confidence: "high", note: "No rideshare endorsement on the personal auto policy — Nationwide routes drivers to standalone/commercial rideshare coverage.", source: src("forbes.com", "https://www.forbes.com/advisor/car-insurance/nationwide-car-insurance-review/") },
    amfam: { category: "available", confidence: "high", note: 'Rideshare add-on fills the "Stage 1" gap (app on, awaiting request); ~19 states, not nationwide.', source: aA },
  },
  "diminishing-deductible": {
    usaa: { category: "none", confidence: "high", note: "No diminishing-deductible program (uses deductible waivers instead).", source: src("wallethub.com", "https://wallethub.com/answers/ci/does-usaa-waive-deductibles-2140845275/") },
    travelers: { category: "available", confidence: "high", note: "Decreasing deductible bundled in the Premier Responsible Driver Plan, not standalone.", excludeStates: ["CA"], source: src("insurify.com", "https://insurify.com/car-insurance/companies/travelers/") },
    nationwide: { category: "available", confidence: "high", note: '"Vanishing Deductible" — −$100/yr safe driving, up to $500; an at-fault resets it to $100.', source: src("nationwide.com", "https://www.nationwide.com/personal/insurance/auto/coverages/types/vanishing-deductible") },
    amfam: { category: "available", confidence: "high", note: "$100 credit at enrollment, then $100/yr ($50 on 6-mo terms) up to max; resets after a claim.", source: src("amfam.com", "https://www.amfam.com/insurance/car/diminishing-deductible-auto") },
  },
  telematics: {
    usaa: { category: "available", confidence: "high", note: '"SafePilot" app — up to 30% at renewal.', excludeStates: ["AZ", "HI", "ND", "NH", "NY", "SD", "VT", "WV", "WY"], source: src("usaa.com", "https://www.usaa.com/insurance/vehicles/auto/safepilot/") },
    travelers: { category: "available", confidence: "high", note: '"IntelliDrive" app — up to 30%. Limited in a few states.', source: tA },
    nationwide: { category: "available", confidence: "high", note: '"SmartRide" (behavior, up to ~40%) + "SmartMiles" (pay-per-mile).', source: nA },
    amfam: { category: "available", confidence: "high", note: '"KnowYourDrive" — "DriveMyWay" (10–35%) + "MilesMyWay" (low-mileage).', source: aA },
  },
  glass: {
    usaa: { category: "varies", confidence: "high", note: "Comp covers glass; deductible waived for windshield repair.", source: uA },
    travelers: { category: "varies", confidence: "high", note: "Glass-deductible buy-down (e.g. to $50); full $0 varies by state.", source: tA },
    nationwide: { category: "varies", confidence: "high", note: "Comp covers glass; deductible waived for windshield repair.", source: nA },
    amfam: { category: "varies", confidence: "high", note: "Glass under comp (Safelite); deductible usually waived for repair.", source: aA },
  },
  "custom-parts": {
    // Travelers omitted — not marketed on travelers.com or in reviews; only a
    // single Maine DOI filing hints at it, too thin to claim it's offered, so
    // it renders "Data not publicly available" rather than a false "Available".
    nationwide: { category: "available", confidence: "high", note: '"Custom Equipment" endorsed onto comp/collision; limit selectable.', source: nA },
  },
  "emergency-travel": {
    travelers: { category: "available", confidence: "high", note: "Trip interruption via Premier Roadside — $200/day up to $600, 100+ mi, 24+ hrs out of service.", source: src("travelers.com", "https://www.travelers.com/car-insurance/coverage/roadside-assistance") },
    amfam: { category: "available", confidence: "high", note: '"Travel Peace of Mind" — lodging/meals/transport when >100 mi from home; up to $600 ($100/$100/$50 a day).', source: src("amfam.com", "https://www.amfam.com/insurance/car/coverages/travel-peace-of-mind") },
  },
  "mechanical-breakdown": {
    usaa: { category: "none", confidence: "high", note: "No mechanical breakdown insurance.", source: src("wallethub.com", "https://wallethub.com/answers/ci/usaa-mechanical-breakdown-insurance-1000105-2140738411/") },
    travelers: { category: "none", confidence: "high", note: "No mechanical breakdown insurance.", source: tA },
    nationwide: { category: "none", confidence: "high", note: "No mechanical breakdown insurance — absent from Nationwide's own auto coverage list; ValuePenguin & WalletHub concur.", source: nA },
    amfam: { category: "none", confidence: "high", note: "No mechanical breakdown insurance — absent from AmFam's own auto coverage list; ValuePenguin concurs.", source: aA },
  },
};

const HOME_EXT: Record<string, Record<string, Cell>> = {
  "dwelling-erc": {
    usaa: { category: "endorsement", value: "125% of Cov A", confidence: "high", note: '"Home Protector" — +25% above Cov A for dwelling & other structures. Not guaranteed/uncapped.', source: usnewsUsaa },
    travelers: { category: "endorsement", value: "125–150% of Cov A · Guaranteed", confidence: "high", note: "Extended RC ~+25%/+50%; Platinum Plus adds +100% (200%) or Guaranteed (uncapped) + cash-out.", source: tH },
    nationwide: { category: "endorsement", value: "Up to 200% of Cov A", confidence: "high", note: '"Dwelling Replacement Cost" endorsement pays up to 2× Cov A; no true guaranteed RC.', source: nH },
    amfam: { category: "dnpa", confidence: "medium", note: "AmFam's own materials describe standard replacement cost only; an extended/guaranteed RC buffer isn't confirmed by AmFam or independent reviews.", source: src("amfam.com", "https://www.amfam.com/insurance/home/coverages/dwelling-coverage") },
  },
  "other-structures": {
    amfam: { category: "included", value: "~10% of Cov A", confidence: "high", note: "Industry-standard Coverage B default (~10% of Cov A); increasable.", source: nerdAmfam },
  },
  "personal-property": {
    amfam: { category: "included", value: "~50–70% of Cov A", confidence: "high", note: "Industry-standard contents range (50–70% of Cov A); adjustable. Exact % on the dec page.", source: nerdAmfam },
  },
  "pp-loss": {
    usaa: { category: "included", value: "RCV included", confidence: "high", note: "Replacement cost on personal property standard (not ACV) — a USAA distinction; military gear no-deductible.", source: usnewsUsaa },
    travelers: { category: "endorsement", value: "ACV base · RCV optional", confidence: "high", note: '"Contents Replacement Cost" endorsement upgrades to RCV (built into Platinum).', source: tH },
    nationwide: { category: "endorsement", value: "ACV base · RCV optional", confidence: "high", note: '"Brand New Belongings" endorsement pays RCV; base contents ACV.', source: nH },
    amfam: { category: "endorsement", value: "ACV base · RCV optional", confidence: "high", note: "'Personal property replacement cost' is an optional add-on that removes depreciation (NerdWallet & Policygenius concur), so the base settlement is ACV.", source: src("policygenius.com", "https://www.policygenius.com/homeowners-insurance/reviews/american-family/") },
  },
  "loss-of-use": {
    amfam: { category: "included", value: "~20% of Cov A", confidence: "high", note: "Industry-standard ALE amount (~20% of Cov A); month cap not published.", source: nerdAmfam },
  },
  liability: {
    usaa: { category: "included", value: "$100k–$500k", confidence: "high", note: "Industry-standard selectable menu ($100k/$300k/$500k); higher via umbrella. Exact tick on the dec page.", source: usnewsUsaa },
    travelers: { category: "included", value: "$100k–$500k", confidence: "high", note: "$100k floor, higher limits selectable; umbrella above.", source: tH },
    nationwide: { category: "included", value: "$100k–$500k", confidence: "high", note: "Industry-standard selectable menu ($100k–$500k); exact tick on the dec page.", source: nH },
    amfam: { category: "included", value: "$100k–$500k", confidence: "high", note: "Industry-standard selectable menu ($100k–$500k); $300k common. Exact tick on the dec page.", source: nerdAmfam },
  },
  medpay: {
    amfam: { category: "included", value: "$1k–$5k", confidence: "high", note: "Industry-standard $1k–$5k menu; exact limit on the dec page.", source: nerdAmfam },
  },
  windhail: {
    travelers: { category: "varies", value: "1–5% of Cov A", confidence: "high", note: "Separate wind/hail % deductible (industry-standard 1–5% band); options vary by state.", source: tH },
  },
  hurricane: {
    travelers: { category: "varies", value: "Offered (coastal)", confidence: "high", note: "Separate named-storm % in coastal states; exact bands state-filed.", source: tH },
  },
  multipolicy: {
    usaa: { category: "included", value: "~6–10%", confidence: "high", note: "Home+auto bundle: up to ~10% off property (ValuePenguin), ~6% average (Policygenius); USAA auto is already low.", source: src("valuepenguin.com", "https://www.valuepenguin.com/usaa-insurance-review") },
    travelers: { category: "included", value: "Up to ~12%", confidence: "high", note: "Home+auto bundle; carrier publishes no %, Policygenius cites up to ~12%.", source: tH },
    nationwide: { category: "included", value: "Up to ~20%", confidence: "high", note: "Home+auto bundle up to ~20% (ValuePenguin); ~13% average (Policygenius). Varies by state.", source: nH },
    amfam: { category: "included", value: "Up to ~23%", confidence: "medium", note: "AmFam-advertised 23% home+auto bundle (per Insurify); varies by state.", source: src("insurify.com", "https://insurify.com/homeowners-insurance/companies/american-family/") },
  },
  "water-backup": {
    usaa: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: "Optional endorsement (plumbing/sewer backup, sump overflow); limit selectable.", source: usnewsUsaa },
    travelers: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: '"Water Backup & Sump Pump Overflow" endorsement (in Platinum Plus); limit selectable.', source: tH },
    nationwide: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: "Sump-pump overflow + drain/sewer backup; limit selectable.", source: nH },
    amfam: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: '"Sewer/Septic Back-up & Sump Overflow"; up to policy limits. Not in MN.', source: aH },
  },
  "service-line": {
    travelers: { category: "none", confidence: "high", note: "Not offered — absent from Travelers' own optional-coverages list and Policygenius's 12-item add-on list.", source: tH },
    nationwide: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: "Buried service lines (water/gas/electric/sewer); limit not published.", source: nH },
    amfam: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: "Buried water/sewer/power lines; limit not published.", source: aH },
  },
  "equip-breakdown": {
    // Travelers omitted — not marketed as a consumer coverage (absent from
    // travelers.com, Policygenius, no dedicated page); only a filing-level
    // BoilerRe trace. Renders "Data not publicly available" instead of a claim.
    nationwide: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: "Home systems/appliances breakdown; limit not published.", source: nH },
    amfam: { category: "endorsement", value: "Limit DNPA", confidence: "high", note: "Appliances/home systems; $500 deductible; overall limit not published.", source: aH },
  },
  ordinance: {
    travelers: { category: "included", value: "Up to 10% of Cov A", confidence: "high", note: "Industry-standard ordinance base ~10% of Cov A; increasable via buy-up.", source: tH },
    nationwide: { category: "included", value: "~10% of Cov A", confidence: "high", note: "Code-upgrade coverage; industry-standard ~10% base, increasable.", source: nH },
  },
  roof: {
    travelers: { category: "varies", value: "RCV; ACV schedule on older roofs", confidence: "medium", note: "RCV for newer roofs; age/condition affects settlement; ACV schedule in some states.", source: tH },
    nationwide: { category: "varies", value: "RCV; \"Better Roof Replacement\" upgrade", confidence: "high", note: '"Better Roof Replacement" pays for upgraded materials; base RCV-vs-ACV/age schedule varies by state.', source: nH },
    amfam: { category: "varies", value: "ACV base; RCV by roof age/type", confidence: "high", note: 'Roofs settle ACV by default (age/condition/material); RCV optional if eligible. NV form HO 88 02: composition/synthetic/solar >15 yrs settle ACV (state-specific).', source: src("amfam.com", "https://www.amfam.com/insurance/home/coverages/roof-insurance-coverage") },
  },
};

function applyExt(line: Line, ext: Record<string, Record<string, Cell>>): void {
  for (const f of line.features) {
    const add = ext[f.id];
    if (add) Object.assign(f.cells, add);
  }
}
applyExt(AUTO, AUTO_EXT);
applyExt(HOME, HOME_EXT);

// --- SCENARIOS ("Who's Covered / Driver & Vehicle Scenarios") --------------
// Answers "when someone other than the named insured drives, or the insured
// drives a car they don't own, what changes — by carrier." Baseline answers
// reflect the standard ISO Personal Auto Policy (PP 00 01) that carriers
// broadly follow; each carrier's actual form + state-law overrides are NOT
// individually verified (see COVERAGE_SCENARIOS_GAPS.md). Do not read a cell as
// carrier-confirmed unless its confidence is high.
const S_IDS = ["allstate", "statefarm", "geico", "progressive", "travelers", "nationwide", "usaa", "amfam"];
// Same baseline cell for every carrier — honest for a near-universal PAP rule,
// with the per-carrier caveat carried in the note. Override individually once a
// carrier's form is verified.
const papCell = (cell: Cell): Record<string, Cell> => Object.fromEntries(S_IDS.map((id) => [id, cell]));

const SCENARIOS: Line = {
  key: "scenarios",
  label: "Who's Covered",
  carriers: AUTO.carriers,
  legend: ["included", "stepdown", "varies", "none", "dnpa"],
  glossary: [
    ["Permissive use", "Someone outside your household drives your car with your permission."],
    ["Step-down", "Coverage still applies but at reduced limits — often the state minimum — for certain drivers."],
    ["Non-owned auto", "A car the insured drives but doesn't own and that isn't furnished for their regular use."],
    ["Primary vs. excess", "Primary pays first; excess pays only after the other applicable policy is exhausted."],
    ["Named-driver exclusion", "An endorsement that removes a specific driver from all coverage while they drive."],
    ["Regular use", "A car available to a driver often enough that the policy expects it to be listed."],
    ["Data not publicly available", "Not determinable from public sources; flagged for carrier-form research."],
  ],
  footnote:
    "Driver & vehicle scenarios — what changes when someone other than the named insured drives, or the insured drives a car they don't own. Baseline answers reflect the standard ISO Personal Auto Policy (PP 00 01) that carriers broadly follow; each carrier's actual form and state-law overrides are NOT individually verified (a medium dot means 'standard-PAP baseline, confirm per carrier'). A factual comparison, not legal advice — confirm against the policy and state.",
  features: [
    { id: "permissive-use", name: "Permissive use — friend borrows your car", description: "A non-household friend drives your car with your permission.", cells: papCell({
      category: "included", value: "Covered · owner's policy is primary", confidence: "medium",
      note: "Standard PAP: a permissive driver is covered on the owner's policy as primary. Whether limits step down to state minimum for non-listed drivers varies by carrier/state — not verified. Per ISO PP 00 01.",
      scenario: { extends: ["BI", "PD", "MedPIP", "collision", "comprehensive"], limits: "Full policy limits (a few carriers/states apply a permissive-use step-down to state minimum — unverified)", deductible: "Same as the owned auto", primacy: "primary", stateExceptions: "Some carriers file permissive-use step-down endorsements in certain states." },
    }) },
    { id: "unlisted-household", name: "Unlisted household driver", description: "A resident relative or roommate not listed on the policy drives the car.", cells: papCell({
      category: "varies", value: "Relatives usually insured · misrep risk if undisclosed", confidence: "low",
      note: "Resident relatives are 'family members' (insureds) under the PAP; but carriers require household drivers be listed or excluded, and an undisclosed one can draw a surcharge or a misrepresentation defense. Carrier/state handling not verified.",
      scenario: { extends: ["BI", "PD", "MedPIP", "collision", "comprehensive"], limits: "Policy limits if treated as an insured; disputes possible if undisclosed", deductible: "Same as the owned auto", primacy: "primary", stateExceptions: "Some states limit an insurer's ability to deny for a non-excluded resident driver." },
    }) },
    { id: "named-exclusion", name: "Named-driver exclusion", description: "How an excluded driver is handled, and which states restrict exclusions.", cells: papCell({
      category: "varies", value: "Excluded driver = no coverage · state-restricted", confidence: "medium",
      note: "A named-driver-exclusion endorsement removes ALL coverage (liability, and usually collision/comp and UM/UIM) while the excluded person drives. Several states prohibit or restrict exclusions. Exact carrier form and state list not verified.",
      scenario: { extends: [], limits: "None while the excluded driver operates the car", deductible: "n/a", primacy: "n/a", stateExceptions: "Prohibited or restricted in several states (e.g., NY, NC, MI, VA) — verify per state." },
    }) },
    { id: "regular-use", name: "Occasional vs. regular use by a non-listed driver", description: "When 'occasional' use by an unlisted driver becomes 'regular' and triggers a listing requirement or exclusion.", cells: papCell({
      category: "dnpa", value: "Unknown — carrier underwriting rule", confidence: "low",
      note: "No universal threshold: regular use by an undisclosed driver can trigger a listed-driver requirement or a misrepresentation/exclusion, but the line between occasional and regular is a carrier underwriting rule, not public. Needs carrier research.",
      scenario: { limits: "Unknown", deductible: "Unknown", primacy: "n/a", stateExceptions: "Interacts with state misrepresentation and resident-driver rules." },
    }) },
    { id: "borrowed-car", name: "You drive a borrowed (non-owned) car", description: "The insured drives someone else's car (not a rental) with permission.", cells: papCell({
      category: "included", value: "Covered · excess over owner · your deductible", confidence: "medium",
      note: "Standard PAP: your liability follows you as EXCESS over the car owner's policy, and your collision/comp extend to the borrowed car (excess, your deductible) if you carry them. Excluded if the car is furnished for your regular use or owned by a resident relative. Carrier form not verified. Per ISO PP 00 01.",
      scenario: { extends: ["BI", "PD", "MedPIP", "UMUIM", "collision", "comprehensive"], limits: "Your policy limits (excess over the owner's primary)", deductible: "Your own deductible", primacy: "excess", endorsement: "Broadened/extended non-owned auto endorsements widen this on some policies.", stateExceptions: "Household-member-vehicle and regular-use exclusions apply." },
    }) },
    { id: "rental-personal", name: "You drive a rental car (personal use, US/Canada)", description: "The insured rents a car for personal use in the US or Canada.", cells: papCell({
      category: "included", value: "Covered like your own car · your deductible", confidence: "medium",
      note: "Standard PAP treats a rental as a non-owned auto: liability extends (excess) and collision/comp extend if you carry them (your deductible applies). Loss of use, diminished value, and admin/towing fees may be limited or need a rental endorsement; day limits and specifics vary by carrier — not verified. Physical-damage extension requires you to carry collision. Distinct from Rental Reimbursement.",
      scenario: { extends: ["BI", "PD", "MedPIP", "UMUIM", "collision", "comprehensive"], limits: "Your policy limits", deductible: "Your own deductible applies", primacy: "excess", endorsement: "Primary where you have no other applicable coverage. A rental/CDW endorsement can waive the deductible and add loss of use.", stateExceptions: "Loss-of-use and admin-fee treatment varies by carrier.", seeAlso: "rental" },
    }) },
    { id: "rental-excluded-use", name: "Rental — business use or outside US/Canada", description: "The insured drives a rental for business, or anywhere outside the US and Canada.", cells: papCell({
      category: "none", value: "Not covered (territory / business use)", confidence: "medium",
      note: "The standard PAP's territory is the US, its territories/possessions, Puerto Rico, and Canada — driving a rental outside that (e.g., Mexico, overseas) is not covered. Business/commercial use of a rental generally falls outside personal-auto coverage. Carrier specifics not verified.",
      scenario: { extends: [], limits: "None outside the policy territory / for business use", deductible: "n/a", primacy: "n/a", stateExceptions: "Buy the rental company's coverage or a local admitted policy abroad." },
    }) },
    { id: "rental-other-driver", name: "Rental driven by someone other than you", description: "A spouse, friend, or unlisted driver drives the rental the insured rented.", cells: papCell({
      category: "varies", value: "Resident family yes · non-family friend no", confidence: "medium",
      note: "Under the standard PAP, your rental (non-owned) coverage extends to you and resident family members driving it; a non-family friend is generally NOT covered by your policy on the rental — the rental company's coverage or the friend's own policy would apply. Carrier specifics not verified.",
      scenario: { extends: ["BI", "PD", "MedPIP", "collision", "comprehensive"], limits: "Your limits for you / resident family; none for a non-family driver", deductible: "Your own deductible", primacy: "excess", stateExceptions: "Confirm additional-driver rules on the rental agreement too." },
    }) },
    { id: "p2p-sharing", name: "Peer-to-peer car sharing (Turo, Getaround)", description: "Renting your car out, or renting someone's car, on a P2P platform — as owner and as renter.", cells: papCell({
      category: "none", value: "As owner: excluded · as renter: platform covers", confidence: "medium",
      note: "Renting your car OUT on Turo/Getaround is excluded by personal auto policies (livery / business-use exclusion) — the platform's coverage applies. As a RENTER, personal-policy extension to a P2P vehicle is inconsistent and often excluded; the platform's protection plan is the primary source. Carrier positions not verified. Distinct from Rideshare.",
      scenario: { extends: [], limits: "None from the personal policy (as owner); platform-dependent (as renter)", deductible: "Platform-set", primacy: "n/a", endorsement: "No standard personal-auto endorsement covers renting your car out.", stateExceptions: "A few states have P2P-specific insurance statutes.", seeAlso: "rideshare" },
    }) },
    { id: "excluded-vehicles", name: "Company car, heavy vehicles & non-owned trailers", description: "A vehicle furnished for your regular use (company car), vehicles over a weight threshold, and non-owned trailers.", cells: papCell({
      category: "none", value: "Regular-use / heavy vehicles excluded", confidence: "medium",
      note: "Standard PAP: a vehicle furnished or available for your regular use (e.g., a company car) is EXCLUDED from non-owned coverage; heavier vehicles (roughly over 10,000 lbs GVW) used in business and certain vehicle types fall outside 'your covered auto'; non-owned-trailer physical damage is limited. Carrier/endorsement specifics not verified.",
      scenario: { extends: [], limits: "Excluded for regular-use/company and over-GVW vehicles", deductible: "n/a", primacy: "n/a", endorsement: "An 'extended non-owned coverage' / 'drive-other-car' endorsement can add a company car.", stateExceptions: "GVW and vehicle-type definitions vary by form." },
    }) },
  ],
};

export const LINES: Record<LineKey, Line> = { auto: AUTO, home: HOME, scenarios: SCENARIOS };

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

  // scenarios: no state-resolve rules yet — the state story lives in
  // scenario.stateExceptions and is surfaced by the explorer, not the filter.
  if (line.key !== "home") return out;

  // home
  if (feature.id === "dwelling-erc" && carrier.id === "allstate") {
    out.value = `${ALLSTATE_ERC_BUFFER[state] ?? "120%"} of Cov A`;
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
