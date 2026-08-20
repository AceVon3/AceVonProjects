"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BRANDS, Brand } from "@/lib/constants";
import {
  AgentProfile,
  AgentType,
  PayType,
  ValidationError,
  loadProfile,
  needsProfileUpgrade,
  saveProfile,
  validateProfile,
} from "@/lib/profile";
import { pushProfile } from "@/lib/profileSync";
import { STATES } from "@/lib/states";

// Each office is held as all-string fields for controlled inputs.
type OfficeDraft = { label: string; street: string; city: string; state: string; zip: string };

type FormState = {
  agent_type: AgentType | "";
  authorized_brands: Brand[];
  licensed_states: string[];
  full_name: string;
  offices: OfficeDraft[];     // >= 1; offices[0] is the primary (home state/ZIP)
  employee_count_str: string; // keep as string for input control
  employee_states: string[];
  pay_type: PayType | "";
  remote_count_str: string;   // keep as string for input control
};

const EMPTY_OFFICE: OfficeDraft = { label: "", street: "", city: "", state: "", zip: "" };

const EMPTY: FormState = {
  agent_type: "",
  authorized_brands: [],
  licensed_states: [],
  full_name: "",
  offices: [{ ...EMPTY_OFFICE }],
  employee_count_str: "",
  employee_states: [],
  pay_type: "",
  remote_count_str: "",
};

function initialState(): FormState {
  const existing = loadProfile(); // loadProfile migrates legacy home_state/zip → offices[0]
  if (!existing) return EMPTY;
  const offices =
    existing.offices && existing.offices.length > 0
      ? existing.offices.map(o => ({
          label: o.label ?? "",
          street: o.street ?? "",
          city: o.city ?? "",
          state: o.state ?? "",
          zip: o.zip ?? "",
        }))
      : [{ ...EMPTY_OFFICE }];
  return {
    agent_type: existing.agent_type,
    authorized_brands: existing.authorized_brands,
    licensed_states: existing.licensed_states,
    full_name: existing.full_name,
    offices,
    employee_count_str: String(existing.employee_count),
    employee_states: existing.employee_states,
    // Old profiles predate these fields — leave blank so they read as the
    // required, unfilled inputs they now are (handled by the upgrade banner).
    pay_type: (["hourly", "salary", "both"] as const).includes(existing.pay_type as PayType)
      ? (existing.pay_type as PayType)
      : "",
    remote_count_str:
      typeof existing.remote_count === "number" && Number.isInteger(existing.remote_count)
        ? String(existing.remote_count)
        : "",
  };
}

function toProfile(s: FormState): Partial<AgentProfile> {
  const n = Number(s.employee_count_str);
  const r = Number(s.remote_count_str);
  return {
    agent_type: (s.agent_type || undefined) as AgentType | undefined,
    authorized_brands: s.authorized_brands,
    licensed_states: s.licensed_states,
    full_name: s.full_name,
    offices: s.offices.map(o => ({
      label: o.label.trim() || undefined,
      street: o.street.trim(),
      city: o.city.trim(),
      state: o.state,
      zip: o.zip,
    })),
    employee_count: Number.isFinite(n) && s.employee_count_str !== "" ? n : undefined,
    employee_states: s.employee_states,
    pay_type: (s.pay_type || undefined) as PayType | undefined,
    remote_count: Number.isFinite(r) && s.remote_count_str !== "" ? r : undefined,
  };
}

function errorsByField(errs: ValidationError[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const e of errs) m[e.field] = e.message;
  return m;
}

// Field key -> the section name a person would use, for the summary next to
// the Save button ("nothing happened" fix, 2026-08-20: on a form this tall,
// per-field messages can all sit above the fold when Save is clicked).
const SECTION_LABELS: [RegExp, string][] = [
  [/^full_name$/, "Your name"],
  [/^employee_count$/, "Number of employees"],
  [/^remote_count$/, "Remote employees"],
  [/^offices/, "Office locations"],
  [/^pay_type$/, "Pay type"],
  [/^agent_type$/, "Agent type"],
  [/^authorized_brands$/, "Carriers you sell"],
  [/^licensed_states$/, "Licensed states"],
  [/^employee_states$/, "States your team works in"],
];

function missedSections(errors: Record<string, string>): string[] {
  const out: string[] = [];
  for (const key of Object.keys(errors)) {
    const label = SECTION_LABELS.find(([re]) => re.test(key))?.[1] ?? "Profile details";
    if (!out.includes(label)) out.push(label);
  }
  return out;
}

// Input + select shared class — kept here so the visual feel of every form
// field is consistent and gets updated in one place.
const INPUT_CLS =
  "w-full rounded-lg px-3 py-2 text-13 outline-none border border-line-2 bg-surface text-ink focus:border-ink-3";

export default function ProfileForm(): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [licSearch, setLicSearch] = useState("");
  const [empSearch, setEmpSearch] = useState("");
  // Whether the agent arrived with an older profile missing the new required
  // fields — drives the prompt banner. Computed once.
  const [needsUpgrade] = useState(() => needsProfileUpgrade(loadProfile()));

  // Live "remote can't exceed headcount" check — surfaced AS THE AGENT TYPES,
  // the same entry-time guard the licensed-states picker uses, instead of
  // waiting for submit. Only fires once both numbers are present and valid.
  const liveRemoteError = useMemo(() => {
    if (state.remote_count_str === "" || state.employee_count_str === "") return "";
    const r = Number(state.remote_count_str);
    const n = Number(state.employee_count_str);
    if (!Number.isInteger(r) || !Number.isInteger(n)) return "";
    if (r > n) return `Remote employees (${r}) can't exceed your total of ${n}.`;
    return "";
  }, [state.remote_count_str, state.employee_count_str]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState(prev => ({ ...prev, [key]: value }));
  }

  function updateOffice<K extends keyof OfficeDraft>(i: number, key: K, value: OfficeDraft[K]) {
    setState(prev => ({
      ...prev,
      offices: prev.offices.map((o, idx) => (idx === i ? { ...o, [key]: value } : o)),
    }));
  }

  function addOffice() {
    setState(prev => ({ ...prev, offices: [...prev.offices, { ...EMPTY_OFFICE }] }));
  }

  // Can't drop below one office. Removing the primary promotes the next office
  // to offices[0] (its state/ZIP becomes the home location).
  function removeOffice(i: number) {
    setState(prev =>
      prev.offices.length <= 1
        ? prev
        : { ...prev, offices: prev.offices.filter((_, idx) => idx !== i) },
    );
  }

  function setAgentType(t: AgentType) {
    setState(prev => {
      // Switching to Captive: collapse to the first selected brand (or none).
      const brands =
        t === "captive" && prev.authorized_brands.length > 1
          ? [prev.authorized_brands[0]]
          : prev.authorized_brands;
      return { ...prev, agent_type: t, authorized_brands: brands };
    });
  }

  function toggleBrand(b: Brand) {
    setState(prev => {
      if (prev.agent_type === "captive") {
        return { ...prev, authorized_brands: [b] };
      }
      const has = prev.authorized_brands.includes(b);
      return {
        ...prev,
        authorized_brands: has
          ? prev.authorized_brands.filter(x => x !== b)
          : [...prev.authorized_brands, b],
      };
    });
  }

  function toggleState(list: "licensed_states" | "employee_states", code: string) {
    setState(prev => {
      const cur = prev[list];
      const next = cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code];
      return { ...prev, [list]: next };
    });
  }

  const licensedList = useMemo(() => {
    const q = licSearch.trim().toLowerCase();
    return STATES.filter(
      s => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [licSearch]);

  const employeeList = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return STATES.filter(
      s => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [empSearch]);

  // Set errors AND bring the first missed field into view. The messages
  // render next to their fields, which on a form this tall can all be above
  // the fold when Save is clicked — without the scroll, a failed save looks
  // like nothing happened (real users stalled here, 2026-08-20).
  function failWith(errs: ValidationError[]) {
    setErrors(errorsByField(errs));
    requestAnimationFrame(() => {
      const first = document.querySelector("[data-field-error]");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const draft = toProfile(state);
    const errs = validateProfile(draft);
    if (errs.length > 0) {
      failWith(errs);
      return;
    }
    const profile: AgentProfile = {
      agent_type: draft.agent_type!,
      authorized_brands: draft.authorized_brands!,
      licensed_states: draft.licensed_states!,
      full_name: draft.full_name!.trim(),
      offices: draft.offices!,
      employee_count: draft.employee_count!,
      employee_states: draft.employee_states!,
      pay_type: draft.pay_type!,
      remote_count: draft.remote_count!,
      created_at: new Date().toISOString(),
    };
    const saveErrs = saveProfile(profile);
    if (saveErrs.length > 0) {
      failWith(saveErrs);
      return;
    }
    // Local cache saved; now persist to the signed-in user's account.
    // Signed-out / accounts-dormant resolve with no errors (local-only
    // mode) — only a genuine server-side rejection blocks the redirect.
    const serverErrs = await pushProfile(profile);
    if (serverErrs.length > 0) {
      failWith(serverErrs);
      return;
    }
    setErrors({});
    router.push("/overview");
  }

  // ----- presentational primitives ------------------------------------------

  const ReqStar = () => (
    <span className="ml-0.5 text-brand-red">*</span>
  );

  // Field-group kicker (design 3g: 12px/600 uppercase).
  const SecLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-12 font-semibold uppercase tracking-wider04 mb-2 text-ink-2">
      {children}
    </div>
  );

  const FieldErr = ({ msg }: { msg?: string }) =>
    msg ? (
      // data-field-error is the scroll anchor failWith targets.
      <div className="text-11 mt-1 text-red-text" data-field-error>
        {msg}
      </div>
    ) : null;

  // ----- render --------------------------------------------------------------

  return (
    // Single 680px column (design 3g) — the old empty right rail is gone.
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {/* MAIN CARD */}
      <div className="rounded-card p-6 bg-surface border border-card-line shadow-card">
        {/* Upgrade prompt — shown when an older saved profile is missing the
            new required fields. We don't wipe or block their data; we ask them
            to fill the two new questions (highlighted below). */}
        {needsUpgrade && (
          <div
            data-testid="profile-upgrade-banner"
            className="mb-4 rounded-tile bg-amber-fill text-amber-band border border-amber-border px-3.5 py-2.5 text-12 leading-[1.45]"
          >
            <span className="font-medium">Two new questions.</span> We added{" "}
            <span className="font-medium">how you pay staff</span> and{" "}
            <span className="font-medium">how many employees work remotely</span> to
            personalize your Compliance page. Your other details are saved — just
            fill these in and save.
          </div>
        )}

        {/* Card title */}
        <div className="flex items-center gap-2 mb-4 font-[650] text-15 text-ink">
          <i aria-hidden className="ti ti-building text-17 text-brand-red" />
          <span>Agency details</span>
        </div>

        {/* Agency details: name + headcount in a 2-col grid. Office addresses
            (incl. the primary office that supplies the home state/ZIP) are in
            their own repeatable section below. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {/* Full name */}
          <div>
            <label className="block text-11 mb-1 text-ink-2">
              Full name <ReqStar />
            </label>
            <input
              type="text"
              value={state.full_name}
              onChange={e => update("full_name", e.target.value)}
              placeholder="Ryan Christy"
              className={INPUT_CLS}
              aria-invalid={!!errors.full_name}
            />
            <FieldErr msg={errors.full_name} />
          </div>

          {/* Employees */}
          <div>
            <label className="block text-11 mb-1 text-ink-2">
              Employees <ReqStar />
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={state.employee_count_str}
              onChange={e => update("employee_count_str", e.target.value)}
              placeholder="20"
              className={INPUT_CLS}
              aria-invalid={!!errors.employee_count}
            />
            <FieldErr msg={errors.employee_count} />
          </div>

          {/* Remote count — validated against headcount at entry time. */}
          <div>
            <label className="block text-11 mb-1 text-ink-2">
              Remote employees <ReqStar />
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={state.remote_count_str}
              onChange={e => update("remote_count_str", e.target.value)}
              placeholder="0"
              className={INPUT_CLS}
              aria-invalid={!!(errors.remote_count || liveRemoteError)}
            />
            <p className="text-11 mt-1 text-ink-3">How many of your employees work remotely.</p>
            <FieldErr msg={errors.remote_count || liveRemoteError} />
          </div>
        </div>

        {/* Office addresses — repeatable. The FIRST office is the primary; its
            state + ZIP are the agency's home location (there's no separate home
            state / ZIP field). At least one office is required. */}
        <SecLabel>
          Office addresses <ReqStar />
        </SecLabel>
        <p className="text-11 mb-2 text-ink-3">
          Your first office is your primary location — its state and ZIP are used as
          your agency&apos;s home state.
        </p>
        <div className="grid gap-3">
          {state.offices.map((o, i) => (
            <div
              key={i}
              data-testid={`office-${i}`}
              className="rounded-tile border border-line-2 bg-surface-2 p-3.5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-11 uppercase tracking-wider04 text-ink-2">
                  {i === 0 ? "Primary office" : `Office ${i + 1}`}
                </span>
                {state.offices.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOffice(i)}
                    data-testid={`office-remove-${i}`}
                    aria-label={`Remove office ${i + 1}`}
                    className="text-13 leading-none text-ink-3 hover:text-red-text cursor-pointer px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Label (optional) */}
              <input
                type="text"
                value={o.label}
                onChange={e => updateOffice(i, "label", e.target.value)}
                placeholder="Label (optional, e.g. Main Office)"
                className={`${INPUT_CLS} mb-2`}
                aria-label={`Office ${i + 1} label`}
              />

              {/* Street */}
              <input
                type="text"
                value={o.street}
                onChange={e => updateOffice(i, "street", e.target.value)}
                placeholder="Street address"
                className={INPUT_CLS}
                aria-label={`Office ${i + 1} street`}
                aria-invalid={!!errors[`offices.${i}.street`]}
              />
              <FieldErr msg={errors[`offices.${i}.street`]} />

              {/* City · State · ZIP */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mt-2">
                <div>
                  <input
                    type="text"
                    value={o.city}
                    onChange={e => updateOffice(i, "city", e.target.value)}
                    placeholder="City"
                    className={INPUT_CLS}
                    aria-label={`Office ${i + 1} city`}
                    aria-invalid={!!errors[`offices.${i}.city`]}
                  />
                  <FieldErr msg={errors[`offices.${i}.city`]} />
                </div>
                <div>
                  <select
                    value={o.state}
                    onChange={e => updateOffice(i, "state", e.target.value)}
                    className={`${INPUT_CLS} bg-surface`}
                    aria-label={`Office ${i + 1} state`}
                    aria-invalid={!!errors[`offices.${i}.state`]}
                  >
                    <option value="">State…</option>
                    {STATES.map(s => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <FieldErr msg={errors[`offices.${i}.state`]} />
                </div>
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={o.zip}
                    onChange={e => updateOffice(i, "zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
                    placeholder="ZIP"
                    className={`${INPUT_CLS} sm:w-[88px]`}
                    aria-label={`Office ${i + 1} ZIP`}
                    aria-invalid={!!errors[`offices.${i}.zip`]}
                  />
                  <FieldErr msg={errors[`offices.${i}.zip`]} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addOffice}
          data-testid="office-add"
          className="mt-2 mb-1 text-12 font-medium text-ink-2 hover:text-ink cursor-pointer bg-transparent
                     border border-dashed border-line-2 rounded-full px-3 py-1"
        >
          + Add another office
        </button>
        <FieldErr msg={errors.offices} />

        <div className="my-5 border-t border-line" />

        {/* Pay type — drives the Compliance office summary's relevance
            pointing (hourly → min wage/overtime; salary → exempt threshold). */}
        <SecLabel>
          How do you pay staff? <ReqStar />
        </SecLabel>
        {/* Segmented control (design 3g): bordered 10px-radius group, selected
            cell = navy bg + white text. */}
        <div
          className="grid grid-cols-3 border border-line-2 rounded-tile overflow-hidden mb-1"
          role="radiogroup"
          aria-label="Pay type"
        >
          {(
            [
              { value: "hourly", title: "Hourly" },
              { value: "salary", title: "Salary" },
              { value: "both",   title: "Both" },
            ] as const
          ).map((opt, i) => {
            const sel = state.pay_type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("pay_type", opt.value)}
                data-testid={`pay-type-${opt.value}`}
                className={[
                  "text-center px-[11px] py-[9px] cursor-pointer font-medium text-13 border-none transition-colors",
                  i > 0 ? "border-l border-l-line-2" : "",
                  sel
                    ? "bg-brand-navy text-white"
                    : "bg-surface text-ink hover:bg-soft",
                ].join(" ")}
                role="radio"
                aria-checked={sel}
              >
                {opt.title}
              </button>
            );
          })}
        </div>
        <FieldErr msg={errors.pay_type} />

        <div className="my-5 border-t border-line" />

        {/* Agent type */}
        <SecLabel>
          Agent type <ReqStar />
        </SecLabel>
        {/* Segmented control (design 3g): 2 cells, selected = navy/white. */}
        <div className="grid grid-cols-2 border border-line-2 rounded-tile overflow-hidden mb-4">
          {(
            [
              { value: "independent", title: "Independent", sub: "I sell multiple carriers" },
              { value: "captive",     title: "Captive",     sub: "I sell one carrier" },
            ] as const
          ).map((opt, i) => {
            const sel = state.agent_type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAgentType(opt.value)}
                className={[
                  "text-left px-3.5 py-[9px] cursor-pointer border-none transition-colors",
                  i > 0 ? "border-l border-l-line-2" : "",
                  sel ? "bg-brand-navy" : "bg-surface hover:bg-soft",
                ].join(" ")}
                aria-pressed={sel}
              >
                <div
                  className={[
                    "font-medium text-13",
                    sel ? "text-white" : "text-ink",
                  ].join(" ")}
                >
                  {opt.title}
                </div>
                <div
                  className={[
                    "text-11",
                    sel ? "text-white/70" : "text-ink-2",
                  ].join(" ")}
                >
                  {opt.sub}
                </div>
              </button>
            );
          })}
        </div>
        <FieldErr msg={errors.agent_type} />

        {/* Authorized carriers */}
        <SecLabel>
          Authorized carriers <ReqStar />
        </SecLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-4">
          {BRANDS.map(b => {
            const sel = state.authorized_brands.includes(b);
            return (
              <button
                key={b}
                type="button"
                onClick={() => toggleBrand(b)}
                className={[
                  "rounded-lg px-[9px] py-[7px] text-12 text-left flex justify-between items-center cursor-pointer transition-colors",
                  sel
                    ? "border border-line-2 bg-soft text-ink font-medium"
                    : "border border-line-2 bg-surface text-ink-2 font-normal hover:text-ink",
                ].join(" ")}
                aria-pressed={sel}
                role={state.agent_type === "captive" ? "radio" : "checkbox"}
                aria-checked={sel}
              >
                <span>{b}</span>
                {sel && <span aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
        <FieldErr msg={errors.authorized_brands} />

        {/* Licensed states */}
        <SecLabel>
          Licensed / doing business states <ReqStar />
        </SecLabel>
        {/* Coverage copy derives from states.ts so it can never go stale
            again (it sat at "8 states" long after coverage hit 45). Leads
            with the 50-state coverage (compliance spans every state); the
            filing-data note explains why some states aren't selectable in
            THIS picker, which gates on rate-filing coverage. */}
        <p className="text-11 mb-2 text-ink-3" data-testid="licensed-coverage-note">
          We cover all 50 states. Rate-change signals (Prospect &amp; Defend)
          are live in {STATES.filter(s => s.data_coverage).length} of them —{" "}
          {STATES.filter(s => !s.data_coverage).map(s => s.name).join(", ")}
          {" "}coming soon — and only those are selectable here.
        </p>
        <StateChipRow
          selected={state.licensed_states}
          onRemove={code => toggleState("licensed_states", code)}
          tone="red"
        />
        <SearchBox
          value={licSearch}
          onChange={setLicSearch}
          placeholder="Search states…"
        />
        <StateList
          items={licensedList}
          selected={state.licensed_states}
          onToggle={code => toggleState("licensed_states", code)}
          mode="licensed"
        />
        <FieldErr msg={errors.licensed_states} />
        {/* NexusThresholdPanel (income-tax nexus revenue lines per selling
            state) PARKED 2026-07-14 per user decision — not confident in the
            section yet. The component and its verified 50-state data
            (economicNexus.ts) remain in the codebase; re-render here to
            bring it back. */}

        {/* Employee states */}
        <div className="mt-5">
          <SecLabel>
            Employee work / live states <ReqStar />
          </SecLabel>
          <p className="text-11 mb-2 text-ink-3" data-testid="employee-states-note">
            Drives your Compliance briefing — HR rules, payroll registrations,
            and employee-count thresholds for every state your team works or
            lives in. All 50 states covered and selectable.
          </p>
          <StateChipRow
            selected={state.employee_states}
            onRemove={code => toggleState("employee_states", code)}
            tone="neutral"
          />
          <SearchBox
            value={empSearch}
            onChange={setEmpSearch}
            placeholder="Search states…"
          />
          <StateList
            items={employeeList}
            selected={state.employee_states}
            onToggle={code => toggleState("employee_states", code)}
            mode="employee"
          />
          <FieldErr msg={errors.employee_states} />
        </div>

        {/* Save. The summary sits WITH the button so a failed save is
            visible where the user is looking; the missed fields themselves
            are marked in red at their sections (and scrolled to). */}
        {Object.keys(errors).length > 0 && (
          <div
            data-testid="save-error-summary"
            role="alert"
            className="mt-5 rounded-tile bg-red-fill text-red-text border border-red-border px-4 py-3 text-13"
          >
            <b>Almost there —</b> please finish:{" "}
            {missedSections(errors).join(" · ")}. Each one is marked in red above.
          </div>
        )}
        <div className="flex justify-end mt-5">
          <button
            type="submit"
            className="rounded-tile px-6 py-2.5 text-13 font-semibold cursor-pointer bg-brand-red text-white
                       hover:bg-[#A81B21] transition-colors border-none"
          >
            Save changes
          </button>
        </div>
      </div>

      {/* Right placeholder column kept empty in v1 — the State Resources
          panel is deferred with HR & Compliance per spec. */}
      <div aria-hidden />
    </form>
  );
}

// --- presentational sub-components -----------------------------------------

// Selected-value pills (design 3g): licensed states wear the red chip
// variant; employee states stay neutral. ✕ removes.
function StateChipRow({
  selected,
  onRemove,
  tone,
}: {
  selected: string[];
  onRemove: (code: string) => void;
  tone: "red" | "neutral";
}) {
  if (selected.length === 0) return null;
  const chipCls =
    tone === "red"
      ? "bg-red-fill border border-red-border text-brand-red"
      : "bg-soft border border-line-2 text-ink-mid";
  const xCls = tone === "red" ? "text-brand-red/70" : "text-ink-3";
  return (
    <div className="flex gap-1.5 mb-2 flex-wrap">
      {selected.map(code => (
        <button
          key={code}
          type="button"
          onClick={() => onRemove(code)}
          className={`text-12 font-medium rounded-full px-2.5 py-[3px] cursor-pointer ${chipCls}`}
          aria-label={`Remove ${code}`}
        >
          {code} <span aria-hidden className={xCls}>✕</span>
        </button>
      ))}
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-12 mb-2 outline-none border border-line-2 bg-surface text-ink focus:border-ink-3"
    />
  );
}

function StateList({
  items,
  selected,
  onToggle,
  mode,
}: {
  items: readonly { code: string; name: string; data_coverage: boolean }[];
  selected: string[];
  onToggle: (code: string) => void;
  mode: "licensed" | "employee";
}) {
  const sel = new Set(selected);
  return (
    <div
      className="rounded-lg overflow-hidden overflow-y-auto border border-line-2"
      style={{ maxHeight: 220 }}
    >
      {items.length === 0 ? (
        <div className="text-12 px-2.5 py-2 text-ink-3">
          No states match.
        </div>
      ) : (
        items.map(s => {
          const isSel = sel.has(s.code);
          // Only the licensed-states list gates on data_coverage. Employee
          // states list lets all 50 through.
          const disabled = mode === "licensed" && !s.data_coverage;
          return (
            <button
              key={s.code}
              type="button"
              onClick={() => !disabled && onToggle(s.code)}
              disabled={disabled}
              className={[
                "w-full flex justify-between items-center text-12 px-2.5 py-[7px] text-left border-b border-line last:border-b-0 transition-colors",
                disabled ? "opacity-40 cursor-not-allowed bg-transparent" : "cursor-pointer",
                isSel
                  ? "bg-red-fill/60 text-brand-red font-medium"
                  : "bg-transparent text-ink font-normal hover:bg-soft",
              ].join(" ")}
              aria-checked={isSel}
              role="checkbox"
            >
              <span className="inline-flex items-center gap-1.5">
                <i
                  aria-hidden
                  className={`ti ti-check text-12 ${isSel ? "text-brand-red" : "invisible"}`}
                />
                {s.name}
                {disabled && (
                  <span className="text-[9px] rounded-full px-[5px] py-px bg-soft text-ink-3">
                    Soon
                  </span>
                )}
              </span>
              <span className={disabled ? "text-ink-3" : "text-ink-2"}>{s.code}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
