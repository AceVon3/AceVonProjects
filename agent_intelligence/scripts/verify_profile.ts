// Exercises the Agency Profile data layer: validateProfile rejects every
// bad-input case in spec.md, saveProfile + loadProfile round-trip a good
// profile through localStorage, and the licensed_states tamper guard fires.
//
// Runs in Node with a minimal localStorage shim — no browser required.
// The client-side routing/redirect behavior must still be verified manually
// in a browser (see comment at the bottom of this file).
//
// Usage:  npx tsx scripts/verify_profile.ts

// --- localStorage shim ------------------------------------------------------
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string): void { this.store.set(k, String(v)); }
  removeItem(k: string): void { this.store.delete(k); }
  clear(): void { this.store.clear(); }
  get length(): number { return this.store.size; }
  key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null; }
}
(globalThis as any).window = { localStorage: new MemoryStorage() };

// Imports must come AFTER the window shim above, so profile.ts sees window.
import {
  AgentProfile,
  PROFILE_KEY,
  clearProfile,
  loadProfile,
  needsProfileUpgrade,
  saveProfile,
  validateProfile,
} from "../src/lib/profile";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

function group(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

const VALID_INDEPENDENT: AgentProfile = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["WA", "OR", "ID"],
  full_name: "Ryan Christy",
  zip_code: "99206",
  home_state: "WA",
  employee_count: 20,
  employee_states: ["WA", "OR", "AZ"],
  pay_type: "both",
  remote_count: 4,
  created_at: "2026-05-28T00:00:00.000Z",
};

const VALID_CAPTIVE: AgentProfile = {
  ...VALID_INDEPENDENT,
  agent_type: "captive",
  authorized_brands: ["State Farm"],
};

console.log("=".repeat(72));
console.log("VERIFY: Agency Profile validation + localStorage round-trip");
console.log("=".repeat(72));

group("validateProfile: rejects each missing/invalid field", () => {
  const cases: Array<[string, Partial<AgentProfile>, string]> = [
    ["empty profile",                                       {},                                               "full_name"],
    ["missing full_name",                                   { ...VALID_INDEPENDENT, full_name: "" },          "full_name"],
    ["zip with non-digits",                                 { ...VALID_INDEPENDENT, zip_code: "9920a" },      "zip_code"],
    ["zip too short",                                       { ...VALID_INDEPENDENT, zip_code: "9920" },       "zip_code"],
    ["zip too long",                                        { ...VALID_INDEPENDENT, zip_code: "992066" },     "zip_code"],
    ["missing home_state",                                  { ...VALID_INDEPENDENT, home_state: "" },         "home_state"],
    ["employee_count = 0",                                  { ...VALID_INDEPENDENT, employee_count: 0 },      "employee_count"],
    ["employee_count not integer",                          { ...VALID_INDEPENDENT, employee_count: 3.5 },    "employee_count"],
    ["missing agent_type",                                  { ...VALID_INDEPENDENT, agent_type: undefined as any }, "agent_type"],
    ["no authorized_brands",                                { ...VALID_INDEPENDENT, authorized_brands: [] },  "authorized_brands"],
    ["unknown carrier",                                     { ...VALID_INDEPENDENT, authorized_brands: ["__not_a_real_brand__" as any] }, "authorized_brands"],
    ["captive with 2 brands",                               { ...VALID_INDEPENDENT, agent_type: "captive", authorized_brands: ["State Farm", "GEICO"] }, "authorized_brands"],
    ["no licensed_states",                                  { ...VALID_INDEPENDENT, licensed_states: [] },    "licensed_states"],
    ["licensed_states contains non-data_coverage (tamper)", { ...VALID_INDEPENDENT, licensed_states: ["WA", "WY"] }, "licensed_states"],
    ["no employee_states",                                  { ...VALID_INDEPENDENT, employee_states: [] },    "employee_states"],
    ["missing pay_type",                                    { ...VALID_INDEPENDENT, pay_type: undefined as any }, "pay_type"],
    ["invalid pay_type",                                    { ...VALID_INDEPENDENT, pay_type: "weekly" as any }, "pay_type"],
    ["missing remote_count",                                { ...VALID_INDEPENDENT, remote_count: undefined as any }, "remote_count"],
    ["negative remote_count",                               { ...VALID_INDEPENDENT, remote_count: -1 },       "remote_count"],
    ["non-integer remote_count",                            { ...VALID_INDEPENDENT, remote_count: 2.5 },      "remote_count"],
    ["remote_count exceeds headcount",                      { ...VALID_INDEPENDENT, employee_count: 5, remote_count: 6 }, "remote_count"],
  ];
  for (const [label, p, expectedField] of cases) {
    const errs = validateProfile(p);
    const hit = errs.some(e => e.field === expectedField);
    check(`${label} -> error on ${expectedField}`, hit, errs.map(e => `${e.field}:${e.message}`));
  }
});

group("validateProfile: accepts valid profiles", () => {
  check("valid independent profile -> zero errors", validateProfile(VALID_INDEPENDENT).length === 0);
  check("valid captive profile -> zero errors",     validateProfile(VALID_CAPTIVE).length === 0);
  check("remote_count == employee_count is allowed (boundary)",
    validateProfile({ ...VALID_INDEPENDENT, employee_count: 5, remote_count: 5 }).length === 0);
  check("remote_count == 0 is allowed",
    validateProfile({ ...VALID_INDEPENDENT, remote_count: 0 }).length === 0);
  for (const pt of ["hourly", "salary", "both"] as const) {
    check(`pay_type '${pt}' is accepted`,
      validateProfile({ ...VALID_INDEPENDENT, pay_type: pt }).length === 0);
  }
});

group("needsProfileUpgrade: flags old profiles missing the new fields", () => {
  check("null profile -> false (that's the redirect case, not an upgrade)",
    needsProfileUpgrade(null) === false);
  check("complete profile -> false", needsProfileUpgrade(VALID_INDEPENDENT) === false);
  const oldProfile = { ...VALID_INDEPENDENT } as any;
  delete oldProfile.pay_type;
  delete oldProfile.remote_count;
  check("profile missing pay_type + remote_count -> true",
    needsProfileUpgrade(oldProfile as AgentProfile) === true);
  check("profile missing only remote_count -> true",
    needsProfileUpgrade({ ...VALID_INDEPENDENT, remote_count: undefined as any }) === true);
  check("profile missing only pay_type -> true",
    needsProfileUpgrade({ ...VALID_INDEPENDENT, pay_type: undefined as any }) === true);
});

group("saveProfile + loadProfile: round-trip via localStorage shim", () => {
  clearProfile();
  check("loadProfile() before any save -> null", loadProfile() === null);

  const errs = saveProfile(VALID_INDEPENDENT);
  check("saveProfile(valid) -> no errors", errs.length === 0, errs);

  const loaded = loadProfile();
  check("loadProfile() after save -> object", loaded !== null);
  if (loaded) {
    check("round-trip preserves agent_type",        loaded.agent_type === VALID_INDEPENDENT.agent_type);
    check("round-trip preserves authorized_brands", JSON.stringify(loaded.authorized_brands) === JSON.stringify(VALID_INDEPENDENT.authorized_brands));
    check("round-trip preserves licensed_states",   JSON.stringify(loaded.licensed_states) === JSON.stringify(VALID_INDEPENDENT.licensed_states));
    check("round-trip preserves full_name",         loaded.full_name === VALID_INDEPENDENT.full_name);
    check("round-trip preserves zip_code",          loaded.zip_code === VALID_INDEPENDENT.zip_code);
    check("round-trip preserves home_state",        loaded.home_state === VALID_INDEPENDENT.home_state);
    check("round-trip preserves employee_count",    loaded.employee_count === VALID_INDEPENDENT.employee_count);
    check("round-trip preserves employee_states",   JSON.stringify(loaded.employee_states) === JSON.stringify(VALID_INDEPENDENT.employee_states));
    check("round-trip preserves pay_type",          loaded.pay_type === VALID_INDEPENDENT.pay_type);
    check("round-trip preserves remote_count",      loaded.remote_count === VALID_INDEPENDENT.remote_count);
  }

  // Raw localStorage shape sanity
  const raw = (globalThis as any).window.localStorage.getItem(PROFILE_KEY) as string;
  check("localStorage key is 'agent_profile'", raw !== null);
  check("stored value is valid JSON", (() => { try { JSON.parse(raw); return true; } catch { return false; } })());
});

group("saveProfile: refuses to write invalid profiles (tamper guard)", () => {
  clearProfile();
  saveProfile(VALID_INDEPENDENT); // baseline
  const bad: AgentProfile = { ...VALID_INDEPENDENT, licensed_states: ["WY"] };
  const errs = saveProfile(bad);
  check("saveProfile(invalid licensed_states) -> errors", errs.length > 0);
  const persisted = loadProfile();
  check("baseline profile was NOT overwritten",
    persisted !== null && JSON.stringify(persisted.licensed_states) === JSON.stringify(VALID_INDEPENDENT.licensed_states));
});

group("clearProfile: empties the slot", () => {
  saveProfile(VALID_INDEPENDENT);
  clearProfile();
  check("loadProfile() after clear -> null", loadProfile() === null);
});

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
  console.log("");
  console.log("Note: client-side routing (redirect when localStorage is empty,");
  console.log("stay when profile exists) is implemented in src/app/page.tsx via");
  console.log("useEffect + useRouter.replace('/setup'). The data layer is covered");
  console.log("by this script; the actual browser click-through should be eyeballed");
  console.log("in dev (Open / -> should redirect; fill form, save, reload -> stay).");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
