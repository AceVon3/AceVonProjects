"use client";

import { useEffect, useRef, useState } from "react";

import {
  ALL_LINES,
  FilterState,
  LineChoice,
  SORT_LABEL,
  SortChoice,
  WINDOW_LABEL,
  WindowChoice,
} from "@/lib/filters";

type Mode = "prospect" | "defend" | "my-carriers";

// Sort options shown in the dropdown, in display order. The table headers
// drive these same values (see FilingsTable), so both controls stay in sync.
const SORT_OPTIONS: SortChoice[] = [
  "effective_desc",
  "effective_asc",
  "impact_desc",
  "impact_asc",
];

// Label for a sort value. On /my-carriers the impact sort is by absolute
// move (carriers can move either direction), so the wording calls that out.
function sortLabel(sort: SortChoice, mode: Mode): string {
  if (mode === "my-carriers") {
    if (sort === "impact_desc") return "Rate impact (largest move, abs value)";
    if (sort === "impact_asc") return "Rate impact (smallest move, abs value)";
  }
  return SORT_LABEL[sort];
}

type Props = {
  mode: Mode;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  licensedStates: string[];          // bounds the State chip
  authorizedBrands?: string[];       // bounds the Carrier chip (my-carriers only)
  // Right-aligned inline summary on the filter row (design 3a) — e.g.
  // "14 filings · largest +50.9% by GEICO in NV". Pages own the content.
  summary?: React.ReactNode;
};

export default function FilterBar({
  mode,
  filters,
  onChange,
  licensedStates,
  authorizedBrands,
  summary,
}: Props): React.JSX.Element {
  // Only one panel can be open at a time. null = all closed.
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on click-outside.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleItem<T>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  }

  const statesLabel =
    filters.states.length === licensedStates.length && licensedStates.length > 0
      ? `All ${licensedStates.length} state${licensedStates.length === 1 ? "" : "s"}`
      : filters.states.length === 0
        ? "None"
        : filters.states.join(", ");

  const linesLabel =
    filters.lines.length === ALL_LINES.length
      ? "Both"
      : filters.lines.length === 0
        ? "None"
        : filters.lines.join(", ");

  return (
    <div
      ref={wrapperRef}
      data-testid="filter-bar"
      className="flex gap-2 mb-4 flex-wrap items-center"
    >
      <span className="text-ink-3 uppercase text-11 tracking-wider04 mr-1">
        Filters
      </span>

      {/* State multi-select */}
      <Chip
        label={`States: ${statesLabel}`}
        open={openPanel === "states"}
        onToggle={() => setOpenPanel(openPanel === "states" ? null : "states")}
        testid="chip-states"
        narrowed={filters.states.length !== licensedStates.length}
      >
        <CheckboxList
          items={licensedStates.map(s => ({ value: s, label: s }))}
          checked={filters.states}
          onToggle={code => update("states", toggleItem(filters.states, code))}
          testidPrefix="opt-state"
        />
      </Chip>

      {/* Line multi-select (2 options — could be inline, but kept as chip
          for visual parity with the other filters) */}
      <Chip
        label={`Line: ${linesLabel}`}
        open={openPanel === "lines"}
        onToggle={() => setOpenPanel(openPanel === "lines" ? null : "lines")}
        testid="chip-lines"
        narrowed={filters.lines.length !== ALL_LINES.length}
      >
        <CheckboxList
          items={ALL_LINES.map(l => ({ value: l, label: l }))}
          checked={filters.lines}
          onToggle={line =>
            update("lines", toggleItem(filters.lines, line as LineChoice))
          }
          testidPrefix="opt-line"
        />
      </Chip>

      {/* Time window single-select */}
      <Chip
        label={`Time: ${WINDOW_LABEL[filters.window]}`}
        open={openPanel === "time"}
        onToggle={() => setOpenPanel(openPanel === "time" ? null : "time")}
        testid="chip-time"
        narrowed={filters.window !== "12m"}
      >
        <RadioList
          items={[
            { value: "12m", label: "Last 12 months" },
            { value: "90d", label: "Last 90 days" },
            { value: "30d", label: "Last 30 days" },
          ]}
          selected={filters.window}
          onSelect={v => {
            update("window", v as WindowChoice);
            setOpenPanel(null);
          }}
          testidPrefix="opt-window"
        />
      </Chip>

      {/* Sort single-select. These options are the same sort state the
          clickable table headers drive — selecting here or clicking a header
          both write filters.sort, so the two controls stay in sync. */}
      <Chip
        label={`Sort: ${sortLabel(filters.sort, mode)}`}
        open={openPanel === "sort"}
        onToggle={() => setOpenPanel(openPanel === "sort" ? null : "sort")}
        testid="chip-sort"
      >
        <RadioList
          items={SORT_OPTIONS.map(v => ({ value: v, label: sortLabel(v, mode) }))}
          selected={filters.sort}
          onSelect={v => {
            update("sort", v as SortChoice);
            setOpenPanel(null);
          }}
          testidPrefix="opt-sort"
        />
      </Chip>

      {/* My Carriers: Carrier multi-select. Hidden when the agent has only
          one carrier (captive) — filtering a single-option list is pointless. */}
      {mode === "my-carriers" && authorizedBrands && authorizedBrands.length > 1 && filters.carriers && (
        <Chip
          label={`Carriers: ${
            filters.carriers.length === authorizedBrands.length &&
            authorizedBrands.length > 0
              ? `All ${authorizedBrands.length}`
              : filters.carriers.length === 0
                ? "None"
                : filters.carriers.join(", ")
          }`}
          open={openPanel === "carriers"}
          onToggle={() =>
            setOpenPanel(openPanel === "carriers" ? null : "carriers")
          }
          testid="chip-carriers"
          narrowed={filters.carriers.length !== authorizedBrands.length}
        >
          <CheckboxList
            items={authorizedBrands.map(b => ({ value: b, label: b }))}
            checked={filters.carriers}
            onToggle={b =>
              update("carriers", toggleItem(filters.carriers!, b))
            }
            testidPrefix="opt-carrier"
          />
        </Chip>
      )}

      {summary && (
        <span className="w-full md:w-auto md:ml-auto text-13 text-ink-2">
          {summary}
        </span>
      )}
    </div>
  );
}

// --- sub-components --------------------------------------------------------

function Chip({
  label,
  open,
  onToggle,
  testid,
  narrowed,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  testid: string;
  // True when this filter is narrowed from its default — the chip flips to
  // the red active-filter variant (design frame 1b) so a narrowed view is
  // visible at a glance.
  narrowed?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="relative">
      <button
        type="button"
        onClick={onToggle}
        data-testid={testid}
        data-open={open ? "true" : "false"}
        data-narrowed={narrowed ? "true" : "false"}
        className={[
          "inline-flex items-center gap-[5px] rounded-full px-3 py-[5px] text-12 cursor-pointer border",
          narrowed
            ? "bg-red-fill border-red-border text-brand-red font-medium"
            : "bg-surface border-line-2 text-ink",
        ].join(" ")}
      >
        {label}
        <span
          aria-hidden
          className={`text-[9px] ${narrowed ? "text-brand-red" : "text-ink-3"}`}
        >
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div
          data-testid={`${testid}-panel`}
          className="absolute top-[calc(100%+4px)] left-0 z-10 min-w-[200px] bg-surface border border-line-2 rounded-xl p-1.5 shadow-popover"
        >
          {children}
        </div>
      )}
    </span>
  );
}

function CheckboxList({
  items,
  checked,
  onToggle,
  testidPrefix,
}: {
  items: Array<{ value: string; label: string }>;
  checked: string[];
  onToggle: (v: string) => void;
  testidPrefix: string;
}): React.JSX.Element {
  const checkedSet = new Set(checked);
  return (
    <div className="flex flex-col">
      {items.map(it => {
        const isChecked = checkedSet.has(it.value);
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onToggle(it.value)}
            data-testid={`${testidPrefix}-${it.value}`}
            data-checked={isChecked ? "true" : "false"}
            className={[
              "flex items-center gap-2 px-2.5 py-1.5 text-12 border-none cursor-pointer text-left rounded-lg transition-colors",
              isChecked
                ? "bg-red-fill text-brand-red font-medium"
                : "bg-transparent text-ink hover:bg-soft",
            ].join(" ")}
          >
            <i
              aria-hidden
              className={`ti ti-check text-13 ${isChecked ? "text-brand-red" : "invisible"}`}
            />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function RadioList({
  items,
  selected,
  onSelect,
  testidPrefix,
}: {
  items: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (v: string) => void;
  testidPrefix: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      {items.map(it => {
        const isSelected = selected === it.value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onSelect(it.value)}
            data-testid={`${testidPrefix}-${it.value}`}
            data-selected={isSelected ? "true" : "false"}
            className={[
              "flex items-center gap-2 px-2.5 py-1.5 text-12 border-none cursor-pointer text-left rounded-lg transition-colors",
              isSelected
                ? "bg-red-fill text-brand-red font-medium"
                : "bg-transparent text-ink font-normal hover:bg-soft",
            ].join(" ")}
          >
            <i
              aria-hidden
              className={`ti ti-check text-13 ${isSelected ? "text-brand-red" : "invisible"}`}
            />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
