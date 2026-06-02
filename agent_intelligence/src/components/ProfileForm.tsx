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
import { STATES } from "@/lib/states";

type FormState = {
  agent_type: AgentType | "";
  authorized_brands: Brand[];
  licensed_states: string[];
  full_name: string;
  zip_code: string;
  home_state: string;
  employee_count_str: string; // keep as string for input control
  employee_states: string[];
  pay_type: PayType | "";
  remote_count_str: string;   // keep as string for input control
};

const EMPTY: FormState = {
  agent_type: "",
  authorized_brands: [],
  licensed_states: [],
  full_name: "",
  zip_code: "",
  home_state: "",
  employee_count_str: "",
  employee_states: [],
  pay_type: "",
  remote_count_str: "",
};

function initialState(): FormState {
  const existing = loadProfile();
  if (!existing) return EMPTY;
  return {
    agent_type: existing.agent_type,
    authorized_brands: existing.authorized_brands,
    licensed_states: existing.licensed_states,
    full_name: existing.full_name,
    zip_code: existing.zip_code,
    home_state: existing.home_state,
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
    zip_code: s.zip_code,
    home_state: s.home_state,
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

// Input + select shared class — kept here so the visual feel of every form
// field is consistent and gets updated in one place.
const INPUT_CLS =
  "w-full rounded-md px-2.5 py-2 text-13 outline-none border border-hairline border-line-2";

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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const draft = toProfile(state);
    const errs = validateProfile(draft);
    if (errs.length > 0) {
      setErrors(errorsByField(errs));
      return;
    }
    const profile: AgentProfile = {
      agent_type: draft.agent_type!,
      authorized_brands: draft.authorized_brands!,
      licensed_states: draft.licensed_states!,
      full_name: draft.full_name!.trim(),
      zip_code: draft.zip_code!,
      home_state: draft.home_state!,
      employee_count: draft.employee_count!,
      employee_states: draft.employee_states!,
      pay_type: draft.pay_type!,
      remote_count: draft.remote_count!,
      created_at: new Date().toISOString(),
    };
    const saveErrs = saveProfile(profile);
    if (saveErrs.length > 0) {
      setErrors(errorsByField(saveErrs));
      return;
    }
    setErrors({});
    router.push("/");
  }

  // ----- presentational primitives ------------------------------------------

  const ReqStar = () => (
    <span className="ml-0.5 text-red-text">*</span>
  );

  const SecLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-11 uppercase tracking-wider04 mb-2 text-ink-2">
      {children}
    </div>
  );

  const FieldErr = ({ msg }: { msg?: string }) =>
    msg ? (
      <div className="text-11 mt-1 text-red-text">
        {msg}
      </div>
    ) : null;

  // ----- render --------------------------------------------------------------

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1.7fr_1fr]" noValidate>
      {/* MAIN CARD */}
      <div className="rounded-xl p-[18px] bg-surface border border-hairline border-line">
        {/* Upgrade prompt — shown when an older saved profile is missing the
            new required fields. We don't wipe or block their data; we ask them
            to fill the two new questions (highlighted below). */}
        {needsUpgrade && (
          <div
            data-testid="profile-upgrade-banner"
            className="mb-4 rounded-md bg-amber-fill text-amber-text border border-hairline border-line px-3 py-2.5 text-12 leading-[1.45]"
          >
            <span className="font-medium">Two new questions.</span> We added{" "}
            <span className="font-medium">how you pay staff</span> and{" "}
            <span className="font-medium">how many employees work remotely</span> to
            personalize your Compliance page. Your other details are saved — just
            fill these in and save.
          </div>
        )}

        {/* Card title */}
        <div className="flex items-center gap-2 mb-4 font-medium text-sm">
          <span aria-hidden className="text-red-text text-17">⌂</span>
          <span>Agency details</span>
        </div>

        {/* Agency details: 4 fields in a 2-col grid */}
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

          {/* ZIP code */}
          <div>
            <label className="block text-11 mb-1 text-ink-2">
              ZIP code <ReqStar />
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={state.zip_code}
              onChange={e => update("zip_code", e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="99206"
              className={INPUT_CLS}
              aria-invalid={!!errors.zip_code}
            />
            <FieldErr msg={errors.zip_code} />
          </div>

          {/* Home state */}
          <div>
            <label className="block text-11 mb-1 text-ink-2">
              Home state <ReqStar />
            </label>
            <select
              value={state.home_state}
              onChange={e => update("home_state", e.target.value)}
              className={`${INPUT_CLS} bg-surface`}
              aria-invalid={!!errors.home_state}
            >
              <option value="">Select…</option>
              {STATES.map(s => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            <FieldErr msg={errors.home_state} />
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

        {/* Pay type — drives the Compliance office summary's relevance
            pointing (hourly → min wage/overtime; salary → exempt threshold). */}
        <SecLabel>
          How do you pay staff? <ReqStar />
        </SecLabel>
        <div className="flex gap-2 mb-1" role="radiogroup" aria-label="Pay type">
          {(
            [
              { value: "hourly", title: "Hourly" },
              { value: "salary", title: "Salary" },
              { value: "both",   title: "Both" },
            ] as const
          ).map(opt => {
            const sel = state.pay_type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("pay_type", opt.value)}
                data-testid={`pay-type-${opt.value}`}
                className={[
                  "flex-1 rounded-lg text-center px-[11px] py-[9px] cursor-pointer font-medium text-13",
                  sel
                    ? "border-2 border-blue-border bg-blue-fill text-blue-text"
                    : "border border-hairline border-line-2 bg-surface text-ink",
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

        <div className="my-4 border-t border-hairline border-line" />

        {/* Agent type */}
        <SecLabel>
          Agent type <ReqStar />
        </SecLabel>
        <div className="flex gap-2 mb-4">
          {(
            [
              { value: "independent", title: "Independent", sub: "I sell multiple carriers" },
              { value: "captive",     title: "Captive",     sub: "I sell one carrier" },
            ] as const
          ).map(opt => {
            const sel = state.agent_type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAgentType(opt.value)}
                className={[
                  "flex-1 rounded-lg text-left px-[11px] py-[9px] cursor-pointer",
                  sel
                    ? "border-2 border-blue-border bg-blue-fill"
                    : "border border-hairline border-line-2 bg-surface",
                ].join(" ")}
                aria-pressed={sel}
              >
                <div
                  className={[
                    "font-medium text-13",
                    sel ? "text-blue-text" : "text-ink",
                  ].join(" ")}
                >
                  {opt.title}
                </div>
                <div
                  className={[
                    "text-11",
                    sel ? "text-blue-text" : "text-ink-2",
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
                  "rounded-md px-[9px] py-[7px] text-12 text-left flex justify-between items-center cursor-pointer",
                  sel
                    ? "border border-blue-border bg-blue-fill text-blue-text font-medium"
                    : "border border-hairline border-line-2 bg-surface text-ink font-normal",
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
        <p className="text-11 mb-2 text-ink-3">
          We currently have data for 8 states, with all 50 coming soon. You can only
          select states we cover today.
        </p>
        <StateChipRow
          selected={state.licensed_states}
          onRemove={code => toggleState("licensed_states", code)}
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

        {/* Employee states */}
        <div className="mt-5">
          <SecLabel>
            Employee work / live states <ReqStar />
          </SecLabel>
          <p className="text-11 mb-2 text-ink-3">
            Used for compliance features coming soon. All states selectable.
          </p>
          <StateChipRow
            selected={state.employee_states}
            onRemove={code => toggleState("employee_states", code)}
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

        {/* Save */}
        <div className="flex justify-end mt-5">
          <button
            type="submit"
            className="rounded-md px-[18px] py-[9px] text-13 font-medium cursor-pointer bg-ink text-surface"
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

function StateChipRow({
  selected,
  onRemove,
}: {
  selected: string[];
  onRemove: (code: string) => void;
}) {
  if (selected.length === 0) return null;
  return (
    <div className="flex gap-1.5 mb-2 flex-wrap">
      {selected.map(code => (
        <button
          key={code}
          type="button"
          onClick={() => onRemove(code)}
          className="text-12 rounded-md px-2 py-[3px] bg-surface-2 text-ink"
          aria-label={`Remove ${code}`}
        >
          {code} <span aria-hidden className="text-ink-2">×</span>
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
      className="w-full rounded-md px-2.5 py-2 text-12 mb-2 outline-none border border-hairline border-line-2 text-ink"
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
      className="rounded-md overflow-hidden overflow-y-auto border border-hairline border-line"
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
                "w-full flex justify-between items-center text-12 px-2.5 py-[7px] text-left border-b border-hairline border-line bg-transparent",
                disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                isSel ? "text-blue-text font-medium" : "text-ink font-normal",
              ].join(" ")}
              aria-checked={isSel}
              role="checkbox"
            >
              <span>
                <span aria-hidden>{isSel ? "☑" : "☐"}</span> {s.name}
                {disabled && (
                  <span className="text-[9px] ml-1 rounded-full px-[5px] py-px bg-surface-2 text-ink-3">
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
