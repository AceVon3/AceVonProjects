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

type Props = {
  mode: Mode;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  licensedStates: string[];          // bounds the State chip
  authorizedBrands?: string[];       // bounds the Carrier chip (my-carriers only)
};

export default function FilterBar({
  mode,
  filters,
  onChange,
  licensedStates,
  authorizedBrands,
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
      className="flex gap-2 mb-3 flex-wrap items-center"
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

      {/* Sort single-select */}
      <Chip
        label={`Sort: ${
          filters.sort === "impact_desc"
            ? mode === "my-carriers"
              ? "Rate impact (largest move, abs)"
              : "Rate impact (largest)"
            : "Effective (newest)"
        }`}
        open={openPanel === "sort"}
        onToggle={() => setOpenPanel(openPanel === "sort" ? null : "sort")}
        testid="chip-sort"
      >
        <RadioList
          items={[
            { value: "effective_desc", label: SORT_LABEL.effective_desc },
            {
              value: "impact_desc",
              label:
                mode === "my-carriers"
                  ? "Rate impact (largest move, abs value)"
                  : SORT_LABEL.impact_desc,
            },
          ]}
          selected={filters.sort}
          onSelect={v => {
            update("sort", v as SortChoice);
            setOpenPanel(null);
          }}
          testidPrefix="opt-sort"
        />
      </Chip>

      {/* My Carriers: Carrier multi-select */}
      {mode === "my-carriers" && authorizedBrands && filters.carriers && (
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
    </div>
  );
}

// --- sub-components --------------------------------------------------------

function Chip({
  label,
  open,
  onToggle,
  testid,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  testid: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="relative">
      <button
        type="button"
        onClick={onToggle}
        data-testid={testid}
        data-open={open ? "true" : "false"}
        className="inline-flex items-center gap-1 border border-hairline border-line-2 rounded-lg px-2.5 py-[5px] text-12 bg-surface text-ink cursor-pointer"
      >
        {label}
        <span aria-hidden className="text-[9px] text-ink-3 ml-0.5">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div
          data-testid={`${testid}-panel`}
          className="absolute top-[calc(100%+4px)] left-0 z-10 min-w-[180px] bg-surface border border-hairline border-line-2 rounded-lg p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
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
            className="flex items-center gap-1.5 px-2 py-[5px] text-12 bg-transparent border-none cursor-pointer text-left rounded text-ink"
          >
            <span aria-hidden>{isChecked ? "☑" : "☐"}</span>
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
              "flex items-center gap-1.5 px-2 py-[5px] text-12 bg-transparent border-none cursor-pointer text-left rounded",
              isSelected ? "text-blue-text font-medium" : "text-ink font-normal",
            ].join(" ")}
          >
            <span aria-hidden>{isSelected ? "●" : "○"}</span>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
