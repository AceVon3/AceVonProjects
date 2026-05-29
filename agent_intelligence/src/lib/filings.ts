import { getDataAsOf, getDb } from "./db";
import {
  ACTIVE_RATE_ACTIVITIES,
  Brand,
  DEFAULT_WINDOW,
  DEFEND_THRESHOLD,
  PROSPECT_THRESHOLD,
  WINDOW_MODIFIERS,
  WindowKey,
} from "./constants";

export interface Filing {
  id: number;
  serff_tracking_number: string;
  state: string;
  brand: Brand;
  line_of_business: "Personal Auto" | "Homeowners";
  overall_rate_impact: number;
  rate_activity: string;
  effective_date: string | null;
  filing_date: string | null;
  entity_count: number;
  total_policyholders: number | null;
  total_written_premium: number | null;
  min_entity_impact: number;
  max_entity_impact: number;
  entity_names: string; // JSON-encoded string[]
  disposition_status: string | null;
}

export type CaptiveProfile = {
  agent_type: "captive";
  captive_brand: Brand;
  authorized_brands: Brand[]; // exactly 1, equal to captive_brand
  licensed_states: string[];
};

export type IndependentProfile = {
  agent_type: "independent";
  authorized_brands: Brand[]; // 1+
  licensed_states: string[];
};

export type AgentProfile = CaptiveProfile | IndependentProfile;

export type QueryOpts = {
  window?: WindowKey;
  // Override the "as of" date that the window anchors to. Defaults to
  // getDataAsOf() (i.e., data/last_updated.txt). Format: 'YYYY-MM-DD'.
  // Set this only for testing or for "as of <past snapshot>" features.
  asOf?: string;
};

// --- internal helpers -------------------------------------------------------

function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ");
}

const ACTIVITY_PLACEHOLDERS = placeholders(ACTIVE_RATE_ACTIVITIES.length);
const ACTIVITY_VALUES = [...ACTIVE_RATE_ACTIVITIES];

const SELECT_COLS = `
  id, serff_tracking_number, state, brand, line_of_business,
  overall_rate_impact, rate_activity, effective_date, filing_date,
  entity_count, total_policyholders, total_written_premium,
  min_entity_impact, max_entity_impact, entity_names, disposition_status
`;

function windowModifier(opts?: QueryOpts): string {
  return WINDOW_MODIFIERS[opts?.window ?? DEFAULT_WINDOW];
}

function asOf(opts?: QueryOpts): string {
  return opts?.asOf ?? getDataAsOf();
}

// --- queries ----------------------------------------------------------------

// Prospect: filings with overall_rate_impact >= +5% in the active window.
// Captives exclude their own brand; independents include all 8.
// effective_date NULLs are excluded automatically (NULL >= date(...) is NULL).
export function getProspectFilings(
  profile: AgentProfile,
  opts?: QueryOpts,
): Filing[] {
  const states = profile.licensed_states;
  if (states.length === 0) return [];
  const mod = windowModifier(opts);
  const ref = asOf(opts);

  if (profile.agent_type === "captive") {
    const sql = `
      SELECT ${SELECT_COLS}
      FROM filings
      WHERE state IN (${placeholders(states.length)})
        AND brand != ?
        AND overall_rate_impact >= ?
        AND rate_activity IN (${ACTIVITY_PLACEHOLDERS})
        AND effective_date >= date(?, ?)
    `;
    return getDb()
      .prepare(sql)
      .all(
        ...states,
        profile.captive_brand,
        PROSPECT_THRESHOLD,
        ...ACTIVITY_VALUES,
        ref,
        mod,
      ) as Filing[];
  }

  // Independent: all brands (no exclusion). All rows are already one of the
  // 8 brands by construction, so no need for an IN (...) brand filter.
  const sql = `
    SELECT ${SELECT_COLS}
    FROM filings
    WHERE state IN (${placeholders(states.length)})
      AND overall_rate_impact >= ?
      AND rate_activity IN (${ACTIVITY_PLACEHOLDERS})
      AND effective_date >= date(?, ?)
  `;
  return getDb()
    .prepare(sql)
    .all(...states, PROSPECT_THRESHOLD, ...ACTIVITY_VALUES, ref, mod) as Filing[];
}

// Defend: overall_rate_impact <= -2% in the active window. Same captive/
// independent branching as Prospect.
export function getDefendFilings(
  profile: AgentProfile,
  opts?: QueryOpts,
): Filing[] {
  const states = profile.licensed_states;
  if (states.length === 0) return [];
  const mod = windowModifier(opts);
  const ref = asOf(opts);

  if (profile.agent_type === "captive") {
    const sql = `
      SELECT ${SELECT_COLS}
      FROM filings
      WHERE state IN (${placeholders(states.length)})
        AND brand != ?
        AND overall_rate_impact <= ?
        AND rate_activity IN (${ACTIVITY_PLACEHOLDERS})
        AND effective_date >= date(?, ?)
    `;
    return getDb()
      .prepare(sql)
      .all(
        ...states,
        profile.captive_brand,
        DEFEND_THRESHOLD,
        ...ACTIVITY_VALUES,
        ref,
        mod,
      ) as Filing[];
  }

  const sql = `
    SELECT ${SELECT_COLS}
    FROM filings
    WHERE state IN (${placeholders(states.length)})
      AND overall_rate_impact <= ?
      AND rate_activity IN (${ACTIVITY_PLACEHOLDERS})
      AND effective_date >= date(?, ?)
  `;
  return getDb()
    .prepare(sql)
    .all(...states, DEFEND_THRESHOLD, ...ACTIVITY_VALUES, ref, mod) as Filing[];
}

// My Carriers: every recent filing involving the agent's authorized brands
// in their licensed states, in the active window. No impact threshold.
// Available to both agent types — only reads licensed_states +
// authorized_brands, so for a captive it returns their single brand's filings.
export function getMyCarriersFilings(
  profile: AgentProfile,
  opts?: QueryOpts,
): Filing[] {
  const states = profile.licensed_states;
  const brands = profile.authorized_brands;
  if (states.length === 0 || brands.length === 0) return [];
  const mod = windowModifier(opts);
  const ref = asOf(opts);

  const sql = `
    SELECT ${SELECT_COLS}
    FROM filings
    WHERE state IN (${placeholders(states.length)})
      AND brand IN (${placeholders(brands.length)})
      AND rate_activity IN (${ACTIVITY_PLACEHOLDERS})
      AND effective_date >= date(?, ?)
  `;
  return getDb()
    .prepare(sql)
    .all(...states, ...brands, ...ACTIVITY_VALUES, ref, mod) as Filing[];
}
