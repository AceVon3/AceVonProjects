// Sub-type display labels + info-bubble explanations (Feature 8).
//
// Keyed by the raw `sub_type` string stored in filings (the NAIC source
// string). Definitions are the spec's reviewed source of truth — accurate
// insurance-product descriptions for an insurance-agent audience. The four
// catch-alls (Combinations ×2, Other ×2) are flagged so the column header
// "(catch-all)" framing and the bubble copy both make clear they are not a
// single specific product.

export type SubtypeInfo = {
  label: string;       // cleaned display label (NAIC code prefix stripped)
  explanation: string; // info-bubble copy
  catchAll?: boolean;  // Combinations / Other — "spans multiple / residual"
};

export const SUBTYPE_INFO: Record<string, SubtypeInfo> = {
  // --- Personal Auto (19.xxxx) ---
  "19.0001 Private Passenger Auto (PPA)": {
    label: "Private Passenger Auto",
    explanation:
      "Standard personal auto coverage for private passenger vehicles — the everyday cars, SUVs, and light trucks individuals own for personal use. This is the core personal-auto product (liability, collision, comprehensive).",
  },
  "19.0000 Personal Auto Combinations": {
    label: "Personal Auto Combinations",
    catchAll: true,
    explanation:
      "A combination filing that spans multiple personal-auto sub-types at once (for example private passenger auto together with motorcycle or RV). Not a single specific product — it means this rate filing covers several personal-auto sub-types under one filing.",
  },
  "19.0002 Motorcycle": {
    label: "Motorcycle",
    explanation:
      "Personal auto coverage written specifically for motorcycles (and often scooters and mopeds) — a distinct rating class from standard private passenger auto.",
  },
  "19.0003 Recreational Vehicle (RV)": {
    label: "Recreational Vehicle",
    explanation:
      "Personal auto coverage for recreational vehicles — motorhomes, travel trailers, and campers. Rated separately from standard autos because of their use and value profile.",
  },
  "19.0004 Other": {
    label: "Other",
    catchAll: true,
    explanation:
      "A residual category for personal-auto filings that don't fall under the named sub-types (private passenger, motorcycle, RV). Not a specific product — it groups miscellaneous personal-auto sub-types.",
  },

  // --- Homeowners (04.xxxx) ---
  "04.0003 Owner Occupied Homeowners": {
    label: "Owner-Occupied Homeowners",
    explanation:
      "Standard homeowners insurance for a home occupied by its owner — the classic owner-occupant policy (e.g. HO-3) covering the dwelling, other structures, personal property, and personal liability.",
  },
  "04.0000 Homeowners Sub-TOI Combinations": {
    label: "Homeowners Combinations",
    catchAll: true,
    explanation:
      "A combination filing that spans multiple homeowners sub-types at once (for example owner-occupied together with condo or tenant). Not a single specific product — it means this rate filing covers several homeowners sub-types under one filing.",
  },
  "04.0001 Condominium Homeowners": {
    label: "Condominium Homeowners",
    explanation:
      "Condominium unit-owner insurance (HO-6). Covers the unit's interior, personal property, and liability, sitting on top of the condo association's master policy that insures the building structure and common areas.",
  },
  "04.0005 Other Homeowners": {
    label: "Other Homeowners",
    catchAll: true,
    // NB: the umbrella/excess-liability mention is from domain knowledge
    // (a working State Farm agent), NOT from any field in the data — hence
    // the hedged "can include" / "may or may not be". See spec Feature 8.
    explanation:
      "A residual category the carrier uses for homeowners filings that don't map to a named sub-type (owner-occupied, condo, tenant, mobile). It can include things like umbrella or excess-liability policies the carrier files under the homeowners line. Not a single specific product, and the exact contents aren't broken out in the filing data — so a given filing here may or may not be umbrella.",
  },
  "04.0004 Tenant Homeowners": {
    label: "Tenant Homeowners",
    explanation:
      "Renters insurance (HO-4) for tenants. Covers personal property and personal liability for someone renting a home or apartment; it does not insure the building structure, which the landlord covers.",
  },
  "04.0002 Mobile Homeowners": {
    label: "Mobile Homeowners",
    explanation:
      "Homeowners coverage adapted for manufactured and mobile homes — written on a specialized mobile/manufactured-home form that reflects their construction and risk profile.",
  },
};

// Deterministic fallback for any future unmapped sub_type: strip the leading
// NAIC code ("19.0001 ") and a trailing abbreviation (" (PPA)") so it still
// displays cleanly even without a curated entry.
export function cleanSubtypeLabel(raw: string): string {
  return raw
    .replace(/^\s*\d+\.\d+\s+/, "")
    .replace(/\s*\([A-Z]+\)\s*$/, "")
    .trim();
}

// Resolve a raw sub_type to { label, explanation, catchAll }. Unknown values
// get a cleaned label and no explanation (bubble is hidden).
export function resolveSubtype(
  raw: string | null,
): { label: string; explanation: string | null; catchAll: boolean } {
  if (!raw) return { label: "—", explanation: null, catchAll: false };
  const info = SUBTYPE_INFO[raw];
  if (info) return { label: info.label, explanation: info.explanation, catchAll: !!info.catchAll };
  return { label: cleanSubtypeLabel(raw), explanation: null, catchAll: false };
}
