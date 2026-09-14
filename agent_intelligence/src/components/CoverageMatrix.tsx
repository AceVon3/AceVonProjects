"use client";

// Coverage Compare grid — auto/home toggle, state filter scoped to the agent's
// licensed states, feature search, glossary. Factual cells (value + category
// chip + confidence + source); the agent reads across the row. Data + resolve
// logic live in @/lib/coverageCompare (client-safe, no DB).

import { useMemo, useState } from "react";

import {
  LINES,
  type Category,
  type Confidence,
  type LineKey,
  anchorCarriers,
  resolveCell,
  stateName,
} from "@/lib/coverageCompare";
import type { AgentProfile } from "@/lib/profile";

const CHIP: Record<Category, { cls: string; label: string }> = {
  included: { cls: "bg-green-fill text-green-text", label: "Included" },
  available: { cls: "bg-blue-fill text-blue-text", label: "Available" },
  endorsement: { cls: "bg-blue-fill text-blue-text", label: "Endorsement" },
  varies: { cls: "bg-amber-fill text-amber-text", label: "Varies by state" },
  none: { cls: "bg-gray-fill text-gray-text", label: "Not offered" },
  dnpa: { cls: "border border-dashed border-line-2 text-ink-3", label: "Data not public" },
};

const CONF_DOT: Record<Confidence, string> = {
  high: "bg-green-text",
  medium: "bg-amber-dot",
  low: "border border-red-text",
};
const CONF_LABEL: Record<Confidence, string> = { high: "High — carrier / filed form", medium: "Medium", low: "Low — verify" };

export default function CoverageMatrix({ profile }: { profile: AgentProfile }): React.JSX.Element {
  const [lineKey, setLineKey] = useState<LineKey>("auto");
  const [stateCode, setStateCode] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [glossOpen, setGlossOpen] = useState<boolean>(false);

  const line = LINES[lineKey];
  const carriers = useMemo(() => anchorCarriers(line, profile.authorized_brands), [line, profile.authorized_brands]);
  const features = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? line.features.filter((f) => `${f.name} ${f.description}`.toLowerCase().includes(q)) : line.features;
  }, [line, query]);

  return (
    <div className="space-y-4">
      {/* Line toggle */}
      <div className="inline-flex gap-0.5 rounded-xl border border-card-line bg-soft p-1" role="tablist" aria-label="Insurance line">
        {(["auto", "home"] as LineKey[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={lineKey === k}
            onClick={() => setLineKey(k)}
            className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-14 font-bold ${
              lineKey === k ? "bg-surface text-ink shadow-sm" : "text-ink-mid"
            }`}
          >
            <span aria-hidden>{k === "auto" ? "🚗" : "🏠"}</span>
            {LINES[k].label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-card-line bg-surface p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-11 font-bold uppercase tracking-wider text-ink-2">State</span>
          <select
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
            className="min-h-10 min-w-[210px] cursor-pointer rounded-lg border border-line-2 bg-surface px-3 py-2 text-14 text-ink"
          >
            <option value="">All states (national baseline)</option>
            {profile.licensed_states.map((s) => (
              <option key={s} value={s}>
                {stateName(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-11 font-bold uppercase tracking-wider text-ink-2">Search coverage</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lineKey === "auto" ? "e.g. gap, roadside, deductible" : "e.g. roof, water backup, liability"}
            className="min-h-10 w-[250px] rounded-lg border border-line-2 bg-surface px-3 py-2 text-14 text-ink"
          />
        </label>
        {stateCode ? (
          <span className="self-center rounded-lg border border-amber-border bg-amber-fill px-3 py-1.5 text-12 text-amber-text">
            Showing rules for {stateName(stateCode)}
          </span>
        ) : null}
        <div className="grow" />
        <button
          onClick={() => setGlossOpen((v) => !v)}
          aria-expanded={glossOpen}
          className="min-h-10 rounded-lg border border-blue-border bg-blue-fill px-3.5 py-2 text-12 font-bold text-blue-text"
        >
          Glossary of terms
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-7 gap-y-4 rounded-2xl border border-card-line bg-surface p-4 shadow-sm">
        <div>
          <div className="mb-1.5 text-11 font-bold uppercase tracking-wider text-ink-2">Coverage status</div>
          <div className="flex flex-wrap items-center gap-2">
            {line.legend.map((c) => (
              <span key={c} className={`inline-flex rounded-md px-2 py-0.5 text-12 font-bold ${CHIP[c].cls}`}>
                {CHIP[c].label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-11 font-bold uppercase tracking-wider text-ink-2">Confidence</div>
          <div className="flex flex-wrap items-center gap-3">
            {(["high", "medium", "low"] as Confidence[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 text-11 font-semibold text-ink-2">
                <span className={`h-2 w-2 rounded-full ${CONF_DOT[c]}`} />
                {CONF_LABEL[c]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Glossary */}
      {glossOpen ? (
        <div className="rounded-2xl border border-card-line bg-surface p-4 shadow-sm">
          <h2 className="mb-2.5 text-12 font-extrabold uppercase tracking-wide text-ink">Glossary of terms</h2>
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-x-6 gap-y-2.5">
            {line.glossary.map(([term, def]) => (
              <div key={term}>
                <dt className="text-12 font-bold text-ink">{term}</dt>
                <dd className="mt-0.5 text-12 leading-snug text-ink-mid">{def}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-card-line bg-surface shadow-sm">
        <table className="w-full min-w-[960px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-[22%] min-w-[210px] border-b border-card-line p-0 text-left align-top">
                <div className="h-1" />
                <div className="p-3.5 text-12 font-bold text-ink">Coverage</div>
              </th>
              {carriers.map(({ carrier, anchor }) => (
                <th
                  key={carrier.id}
                  className={`border-b border-card-line p-0 text-left align-top ${anchor ? "bg-red-fill/50" : ""}`}
                >
                  <div className="h-1 rounded-t" style={{ background: carrier.color }} />
                  <div className="px-3.5 pb-3 pt-2.5">
                    <div className="text-14 font-extrabold tracking-tight text-ink">
                      {carrier.name}
                      {anchor ? (
                        <span className="ml-1.5 rounded-md border border-red-border bg-red-fill px-1.5 py-px align-[2px] text-10 font-extrabold uppercase tracking-wide text-brand-red">
                          You
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-11 font-semibold text-ink-2">{anchor ? "Your carrier" : "Competitor"}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((feat) => (
              <tr key={feat.id} className="group">
                <th className="border-b border-line p-3.5 text-left align-top">
                  <div className="text-13 font-bold text-ink">{feat.name}</div>
                  <div className="mt-0.5 text-12 leading-snug text-ink-2">{feat.description}</div>
                </th>
                {carriers.map(({ carrier, anchor }) => {
                  const cell = feat.cells[carrier.id];
                  if (!cell) {
                    return (
                      <td key={carrier.id} className={`border-b border-line p-3 align-top ${anchor ? "bg-red-fill/50" : ""}`}>
                        <span className="text-12 italic text-ink-3">Data not publicly available</span>
                      </td>
                    );
                  }
                  const r = resolveCell(line, feat, carrier, cell, stateCode);
                  const chip = CHIP[r.category];
                  return (
                    <td key={carrier.id} className={`border-b border-line p-3 align-top ${anchor ? "bg-red-fill/50" : ""}`}>
                      <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
                        {r.category === "dnpa" ? (
                          <span className="text-12 italic text-ink-3">Data not publicly available</span>
                        ) : r.value ? (
                          <>
                            <span className="text-13 font-bold text-ink">{r.value}</span>
                            <span className={`inline-flex rounded-md px-1.5 py-px text-11 font-bold ${chip.cls}`}>{chip.label}</span>
                          </>
                        ) : (
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-12 font-bold ${chip.cls}`}>{chip.label}</span>
                        )}
                        <span className="ml-auto inline-flex items-center" title={CONF_LABEL[cell.confidence]}>
                          <span className={`h-2 w-2 rounded-full ${CONF_DOT[cell.confidence]}`} />
                        </span>
                      </div>
                      {cell.safecoDerived ? (
                        <span className="mb-1.5 mr-1 inline-block rounded border border-amber-border bg-amber-fill px-1.5 text-10 font-bold uppercase tracking-wide text-amber-text">
                          Safeco-derived
                        </span>
                      ) : null}
                      {r.stateFlag ? <div className="mb-1.5 text-12 font-bold text-amber-text">{r.stateFlag}</div> : null}
                      {r.note ? <p className="mb-1.5 text-12 leading-snug text-ink-mid">{r.note}</p> : null}
                      {cell.source ? (
                        <a
                          href={cell.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border-b border-dotted border-line-2 text-11 font-semibold text-ink-2 hover:text-blue-text"
                        >
                          {cell.source.label} ↗
                        </a>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {features.length === 0 ? <div className="p-6 text-center text-14 text-ink-2">No coverages match that search.</div> : null}
      </div>

      <p className="max-w-[94ch] text-12 leading-relaxed text-ink-2">
        <span className="font-semibold text-ink-mid">Verified pass — confirm before use.</span> {line.footnote} Framing follows a
        filing-comparison layout; the data is independently sourced, not copied from any carrier&rsquo;s internal tool. Always confirm
        against the customer&rsquo;s policy and state. A factual comparison — not a rating, recommendation, or legal/financial advice.
        Proof-slice: 4 of 13 carriers.
      </p>
    </div>
  );
}
