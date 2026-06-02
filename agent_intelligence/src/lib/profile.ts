import { BRANDS, Brand } from "./constants";
import { isCoveredState } from "./states";

export const PROFILE_KEY = "agent_profile";

export type AgentType = "captive" | "independent";

// How the office pays its staff. Drives which compliance topics the office
// summary points at (hourly → min wage/overtime; salary → exempt threshold).
export type PayType = "hourly" | "salary" | "both";

export type AgentProfile = {
  agent_type: AgentType;
  authorized_brands: Brand[]; // exactly 1 if captive, 1+ if independent
  licensed_states: string[];  // every entry must be data_coverage:true
  full_name: string;
  zip_code: string;           // 5 digits
  home_state: string;         // any of the 50
  employee_count: number;     // integer >= 1
  employee_states: string[];  // any of the 50, no data gating
  pay_type: PayType;          // hourly | salary | both
  remote_count: number;       // integer 0..employee_count
  created_at: string;         // ISO
};

const PAY_TYPES: ReadonlySet<string> = new Set<PayType>(["hourly", "salary", "both"]);

// Detect a profile saved by an older version that predates pay_type /
// remote_count. loadProfile stays tolerant (it won't wipe the profile), so the
// UI uses this to PROMPT the agent to fill the new required fields rather than
// erroring. A null profile is "no profile", handled by the /setup redirect —
// not an upgrade case.
export function needsProfileUpgrade(p: AgentProfile | null): boolean {
  if (!p) return false;
  return !PAY_TYPES.has(p.pay_type as string)
    || typeof p.remote_count !== "number"
    || !Number.isInteger(p.remote_count);
}

const BRAND_SET: ReadonlySet<string> = new Set(BRANDS);

// One validation error per offending field. Empty array = profile is valid.
export type ValidationError = {
  field: keyof AgentProfile | "form";
  message: string;
};

// Validate a candidate profile object. Used by ProfileForm before save AND
// as a tamper guard inside saveProfile, so it runs the same checks on both
// paths (defense in depth — saveProfile rejects junk even if a future caller
// skips the form).
export function validateProfile(
  p: Partial<AgentProfile>,
): ValidationError[] {
  const errs: ValidationError[] = [];

  if (!p.full_name || p.full_name.trim() === "") {
    errs.push({ field: "full_name", message: "Full name is required." });
  }

  if (!p.zip_code || !/^\d{5}$/.test(p.zip_code)) {
    errs.push({ field: "zip_code", message: "ZIP code must be exactly 5 digits." });
  }

  if (!p.home_state) {
    errs.push({ field: "home_state", message: "Home state is required." });
  }

  if (
    p.employee_count === undefined ||
    p.employee_count === null ||
    !Number.isInteger(p.employee_count) ||
    p.employee_count < 1
  ) {
    errs.push({ field: "employee_count", message: "Employees must be a whole number ≥ 1." });
  }

  if (p.agent_type !== "captive" && p.agent_type !== "independent") {
    errs.push({ field: "agent_type", message: "Choose Captive or Independent." });
  }

  const brands = p.authorized_brands ?? [];
  if (brands.length === 0) {
    errs.push({ field: "authorized_brands", message: "Select at least one carrier." });
  } else if (brands.some(b => !BRAND_SET.has(b))) {
    errs.push({ field: "authorized_brands", message: "Unknown carrier selected." });
  } else if (p.agent_type === "captive" && brands.length !== 1) {
    errs.push({
      field: "authorized_brands",
      message: "Captive agents must select exactly one carrier.",
    });
  }

  const licensed = p.licensed_states ?? [];
  if (licensed.length === 0) {
    errs.push({ field: "licensed_states", message: "Select at least one licensed state." });
  } else {
    const bad = licensed.filter(s => !isCoveredState(s));
    if (bad.length > 0) {
      errs.push({
        field: "licensed_states",
        message: `These states aren't in our data coverage: ${bad.join(", ")}`,
      });
    }
  }

  const empStates = p.employee_states ?? [];
  if (empStates.length === 0) {
    errs.push({ field: "employee_states", message: "Select at least one employee state." });
  }

  if (!PAY_TYPES.has(p.pay_type as string)) {
    errs.push({ field: "pay_type", message: "Choose how you pay staff: Hourly, Salary, or Both." });
  }

  // Remote count: a non-negative integer that can't exceed total headcount.
  // The headcount cap is the same kind of "nonsensical input" guard as the
  // licensed-states coverage check — reject it rather than store a profile
  // claiming more remote workers than employees.
  if (
    p.remote_count === undefined ||
    p.remote_count === null ||
    !Number.isInteger(p.remote_count) ||
    p.remote_count < 0
  ) {
    errs.push({ field: "remote_count", message: "Remote employees must be a whole number ≥ 0." });
  } else if (
    Number.isInteger(p.employee_count) &&
    (p.employee_count as number) >= 1 &&
    p.remote_count > (p.employee_count as number)
  ) {
    errs.push({
      field: "remote_count",
      message: `Remote employees (${p.remote_count}) can't exceed your total of ${p.employee_count}.`,
    });
  }

  return errs;
}

// localStorage round-trip. Both functions tolerate SSR (return null / no-op
// when window is undefined) so they're safe to call from any component.
export function loadProfile(): AgentProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Don't strict-validate on load — a profile saved by an older version
    // should still load. Validation is for save and for query-time guards.
    return parsed as AgentProfile;
  } catch {
    return null;
  }
}

export function saveProfile(p: AgentProfile): ValidationError[] {
  const errs = validateProfile(p);
  if (errs.length > 0) return errs;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  }
  return [];
}

export function clearProfile(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(PROFILE_KEY);
  }
}
