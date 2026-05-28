"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BRANDS, Brand } from "@/lib/constants";
import {
  AgentProfile,
  AgentType,
  ValidationError,
  loadProfile,
  saveProfile,
  validateProfile,
} from "@/lib/profile";
import { STATES } from "@/lib/states";

// Visual tokens cribbed from ui-reference.html — using inline arbitrary
// classes here so the design system can be lifted into tailwind.config in
// the step-12 polish pass without rewriting components.
const C = {
  bg: "#fafaf9",
  surface: "#ffffff",
  surface2: "#F4F2EC",
  text: "#1c1c1b",
  text2: "#5F5E5A",
  text3: "#888780",
  line: "rgba(0,0,0,0.08)",
  line2: "rgba(0,0,0,0.15)",
  blueFill: "#E6F1FB",
  blueText: "#0C447C",
  blueBorder: "#185FA5",
  redText: "#A32D2D",
};

type FormState = {
  agent_type: AgentType | "";
  authorized_brands: Brand[];
  licensed_states: string[];
  full_name: string;
  zip_code: string;
  home_state: string;
  employee_count_str: string; // keep as string for input control
  employee_states: string[];
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
  };
}

function toProfile(s: FormState): Partial<AgentProfile> {
  const n = Number(s.employee_count_str);
  return {
    agent_type: (s.agent_type || undefined) as AgentType | undefined,
    authorized_brands: s.authorized_brands,
    licensed_states: s.licensed_states,
    full_name: s.full_name,
    zip_code: s.zip_code,
    home_state: s.home_state,
    employee_count: Number.isFinite(n) && s.employee_count_str !== "" ? n : undefined,
    employee_states: s.employee_states,
  };
}

function errorsByField(errs: ValidationError[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const e of errs) m[e.field] = e.message;
  return m;
}

export default function ProfileForm(): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [licSearch, setLicSearch] = useState("");
  const [empSearch, setEmpSearch] = useState("");

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
    <span className="ml-0.5" style={{ color: C.redText }}>*</span>
  );

  const SecLabel = ({ children }: { children: React.ReactNode }) => (
    <div
      className="text-[11px] uppercase tracking-[0.4px] mb-2"
      style={{ color: C.text2 }}
    >
      {children}
    </div>
  );

  const FieldErr = ({ msg }: { msg?: string }) =>
    msg ? (
      <div className="text-[11px] mt-1" style={{ color: C.redText }}>
        {msg}
      </div>
    ) : null;

  // ----- render --------------------------------------------------------------

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1.7fr_1fr]" noValidate>
      {/* MAIN CARD */}
      <div
        className="rounded-xl p-[18px]"
        style={{ background: C.surface, border: `0.5px solid ${C.line}` }}
      >
        {/* Card title */}
        <div className="flex items-center gap-2 mb-4 font-medium text-sm">
          <span aria-hidden style={{ color: C.redText, fontSize: 17 }}>⌂</span>
          <span>Agency details</span>
        </div>

        {/* Agency details: 4 fields in a 2-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {/* Full name */}
          <div>
            <label className="block text-[11px] mb-1" style={{ color: C.text2 }}>
              Full name <ReqStar />
            </label>
            <input
              type="text"
              value={state.full_name}
              onChange={e => update("full_name", e.target.value)}
              placeholder="Ryan Christy"
              className="w-full rounded-md px-[10px] py-2 text-[13px] outline-none"
              style={{ border: `0.5px solid ${C.line2}` }}
              aria-invalid={!!errors.full_name}
            />
            <FieldErr msg={errors.full_name} />
          </div>

          {/* ZIP code */}
          <div>
            <label className="block text-[11px] mb-1" style={{ color: C.text2 }}>
              ZIP code <ReqStar />
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={state.zip_code}
              onChange={e => update("zip_code", e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="99206"
              className="w-full rounded-md px-[10px] py-2 text-[13px] outline-none"
              style={{ border: `0.5px solid ${C.line2}` }}
              aria-invalid={!!errors.zip_code}
            />
            <FieldErr msg={errors.zip_code} />
          </div>

          {/* Home state */}
          <div>
            <label className="block text-[11px] mb-1" style={{ color: C.text2 }}>
              Home state <ReqStar />
            </label>
            <select
              value={state.home_state}
              onChange={e => update("home_state", e.target.value)}
              className="w-full rounded-md px-[10px] py-2 text-[13px] outline-none bg-white"
              style={{ border: `0.5px solid ${C.line2}` }}
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
            <label className="block text-[11px] mb-1" style={{ color: C.text2 }}>
              Employees <ReqStar />
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={state.employee_count_str}
              onChange={e => update("employee_count_str", e.target.value)}
              placeholder="20"
              className="w-full rounded-md px-[10px] py-2 text-[13px] outline-none"
              style={{ border: `0.5px solid ${C.line2}` }}
              aria-invalid={!!errors.employee_count}
            />
            <FieldErr msg={errors.employee_count} />
          </div>
        </div>

        <div className="my-4" style={{ borderTop: `0.5px solid ${C.line}` }} />

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
                className="flex-1 rounded-lg text-left px-[11px] py-[9px] cursor-pointer"
                style={{
                  border: sel
                    ? `2px solid ${C.blueBorder}`
                    : `0.5px solid ${C.line2}`,
                  background: sel ? C.blueFill : C.surface,
                }}
                aria-pressed={sel}
              >
                <div
                  className="font-medium text-[13px]"
                  style={{ color: sel ? C.blueText : C.text }}
                >
                  {opt.title}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: sel ? C.blueText : C.text2 }}
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
                className="rounded-md px-[9px] py-[7px] text-[12px] text-left flex justify-between items-center cursor-pointer"
                style={{
                  border: sel
                    ? `1px solid ${C.blueBorder}`
                    : `0.5px solid ${C.line2}`,
                  background: sel ? C.blueFill : C.surface,
                  color: sel ? C.blueText : C.text,
                  fontWeight: sel ? 500 : 400,
                }}
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
        <p className="text-[11px] mb-2" style={{ color: C.text3 }}>
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
          <p className="text-[11px] mb-2" style={{ color: C.text3 }}>
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
            className="rounded-md px-[18px] py-[9px] text-[13px] font-medium cursor-pointer"
            style={{ background: C.text, color: C.surface }}
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
          className="text-[12px] rounded-md px-2 py-[3px]"
          style={{ background: C.surface2, color: C.text }}
          aria-label={`Remove ${code}`}
        >
          {code} <span aria-hidden style={{ color: C.text2 }}>×</span>
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
      className="w-full rounded-md px-[10px] py-2 text-[12px] mb-2 outline-none"
      style={{ border: `0.5px solid ${C.line2}`, color: C.text }}
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
      className="rounded-md overflow-hidden overflow-y-auto"
      style={{ border: `0.5px solid ${C.line}`, maxHeight: 220 }}
    >
      {items.length === 0 ? (
        <div className="text-[12px] px-[10px] py-2" style={{ color: C.text3 }}>
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
              className="w-full flex justify-between items-center text-[12px] px-[10px] py-[7px] text-left"
              style={{
                borderBottom: `0.5px solid ${C.line}`,
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
                color: isSel ? C.blueText : C.text,
                fontWeight: isSel ? 500 : 400,
                background: "transparent",
              }}
              aria-checked={isSel}
              role="checkbox"
            >
              <span>
                <span aria-hidden>{isSel ? "☑" : "☐"}</span> {s.name}
                {disabled && (
                  <span
                    className="text-[9px] ml-1 rounded-full px-[5px] py-px"
                    style={{ background: C.surface2, color: C.text3 }}
                  >
                    Soon
                  </span>
                )}
              </span>
              <span style={{ color: disabled ? C.text3 : C.text2 }}>{s.code}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
