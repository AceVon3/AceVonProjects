"use client";

// Scenario-first view for the "Who's Covered" line: pick a driver/vehicle
// situation, then read each carrier's full answer (status + which coverages
// extend, limits, deductible, primary/excess, endorsements, state exceptions,
// confidence). The rich per-cell detail that doesn't fit the grid lives here.

import { useMemo, useState } from "react";

import { type Carrier, type Category, type Confidence, type Line, resolveCell } from "@/lib/coverageCompare";

const CHIP: Record<Category, { cls: string; label: string }> = {
  included: { cls: "bg-green-fill text-green-text", label: "Covered" },
  available: { cls: "bg-blue-fill text-blue-text", label: "Available" },
  endorsement: { cls: "bg-blue-fill text-blue-text", label: "Endorsement" },
  varies: { cls: "bg-amber-fill text-amber-text", label: "Varies by state" },
  stepdown: { cls: "bg-amber-fill text-amber-text", label: "Reduced limits" },
  none: { cls: "bg-gray-fill text-gray-text", label: "Not covered" },
  dnpa: { cls: "border border-dashed border-line-2 text-ink-3", label: "Unknown" },
};
const CONF_DOT: Record<Confidence, string> = { high: "bg-green-text", medium: "bg-amber-dot", low: "border border-red-text" };
const CONF_LABEL: Record<Confidence, string> = {
  high: "Carrier-verified",
  medium: "Standard-policy baseline — confirm per carrier",
  low: "Unverified — needs research",
};
const EXT_LABEL: Record<string, string> = {
  BI: "Bodily injury",
  PD: "Property damage",
  MedPIP: "Med / PIP",
  UMUIM: "UM / UIM",
  collision: "Collision",
  comprehensive: "Comprehensive",
};
const SEEALSO_LABEL: Record<string, string> = { rental: "Rental Reimbursement", rideshare: "Rideshare coverage" };

export default function ScenarioExplorer({
  line,
  carriers,
}: {
  line: Line;
  carriers: { carrier: Carrier; anchor: boolean }[];
}): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string>(line.features[0]?.id ?? "");
  const feature = useMemo(() => line.features.find((f) => f.id === selectedId) ?? line.features[0], [line, selectedId]);

  return (
    <div className="rounded-2xl border border-card-line bg-surface p-4 shadow-sm">
      <div className="mb-1 text-11 font-bold uppercase tracking-wider text-ink-2">Find your situation</div>
      <p className="mb-3 text-12 text-ink-2">
        Pick what&rsquo;s happening, then read each carrier&rsquo;s answer. An amber dot means the standard-policy baseline (not
        carrier-verified); a red-ring dot means unverified.
      </p>

      {/* Scenario selector — the scenario-first entry point */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {line.features.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setSelectedId(f.id)}
            aria-pressed={f.id === feature.id}
            className={`rounded-lg border px-2.5 py-1.5 text-12 font-semibold ${
              f.id === feature.id ? "border-brand-red bg-red-fill text-brand-red" : "border-line-2 bg-surface text-ink-mid hover:bg-soft"
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <div className="text-16 font-extrabold tracking-tight text-ink">{feature.name}</div>
        <p className="mt-0.5 text-12 text-ink-2">{feature.description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {carriers.map(({ carrier, anchor }) => {
          const cell = feature.cells[carrier.id];
          const r = cell ? resolveCell(line, feature, carrier, cell, "") : null;
          const chip = r ? CHIP[r.category] : CHIP.dnpa;
          const sc = cell?.scenario;
          return (
            <div
              key={carrier.id}
              className={`rounded-xl border p-3 ${anchor ? "border-red-border bg-red-fill/40" : "border-card-line bg-canvas"}`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: carrier.color }} />
                <span className="text-13 font-extrabold text-ink">{carrier.name}</span>
                {anchor ? (
                  <span className="rounded-md border border-red-border bg-red-fill px-1.5 py-px text-10 font-extrabold uppercase tracking-wide text-brand-red">
                    You
                  </span>
                ) : null}
                <span className={`ml-auto inline-flex rounded-md px-1.5 py-px text-11 font-bold ${chip.cls}`}>{chip.label}</span>
              </div>

              {!cell ? (
                <p className="text-12 italic text-ink-3">Data not publicly available.</p>
              ) : (
                <>
                  {r?.value ? <div className="mb-1 text-12 font-semibold text-ink">{r.value}</div> : null}

                  {sc?.extends && sc.extends.length ? (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {sc.extends.map((e) => (
                        <span key={e} className="rounded bg-soft px-1.5 py-px text-10 font-semibold text-ink-2">
                          {EXT_LABEL[e] ?? e}
                        </span>
                      ))}
                    </div>
                  ) : sc?.extends && sc.extends.length === 0 ? (
                    <div className="mb-1.5 text-11 font-semibold text-ink-3">No coverage extends.</div>
                  ) : null}

                  <dl className="mb-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-11">
                    {sc?.limits ? (
                      <>
                        <dt className="font-semibold text-ink-3">Limits</dt>
                        <dd className="text-ink-mid">{sc.limits}</dd>
                      </>
                    ) : null}
                    {sc?.deductible ? (
                      <>
                        <dt className="font-semibold text-ink-3">Deductible</dt>
                        <dd className="text-ink-mid">{sc.deductible}</dd>
                      </>
                    ) : null}
                    {sc?.primacy && sc.primacy !== "n/a" ? (
                      <>
                        <dt className="font-semibold text-ink-3">Pays</dt>
                        <dd className="text-ink-mid">{sc.primacy === "primary" ? "Primary (first)" : "Excess (after another policy)"}</dd>
                      </>
                    ) : null}
                    {sc?.endorsement ? (
                      <>
                        <dt className="font-semibold text-ink-3">Endorsement</dt>
                        <dd className="text-ink-mid">{sc.endorsement}</dd>
                      </>
                    ) : null}
                    {sc?.stateExceptions ? (
                      <>
                        <dt className="font-semibold text-ink-3">By state</dt>
                        <dd className="text-ink-mid">{sc.stateExceptions}</dd>
                      </>
                    ) : null}
                  </dl>

                  {r?.note ? <p className="mb-1.5 text-11 leading-snug text-ink-mid">{r.note}</p> : null}

                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${CONF_DOT[cell.confidence]}`} />
                    <span className="text-10 text-ink-3">{CONF_LABEL[cell.confidence]}</span>
                    {sc?.seeAlso ? (
                      <span className="ml-auto text-10 font-semibold text-blue-text">See also: {SEEALSO_LABEL[sc.seeAlso]}</span>
                    ) : cell.source ? (
                      <a
                        href={cell.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-10 font-semibold text-ink-2 hover:text-blue-text"
                      >
                        {cell.source.label} ↗
                      </a>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-11 text-ink-3">{line.footnote}</p>
    </div>
  );
}
