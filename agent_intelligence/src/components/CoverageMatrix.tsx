"use client";

// Coverage Compare grid — auto/home toggle, state filter scoped to the agent's
// licensed states, feature search, glossary. Factual cells (value + category
// chip + confidence + source); the agent reads across the row. Data + resolve
// logic live in @/lib/coverageCompare (client-safe, no DB).

import { useMemo, useState } from "react";

import {
  LINES,
  type Category,
  type Cell,
  type Confidence,
  type LineKey,
  anchorCarriers,
  resolveCell,
  stateName,
} from "@/lib/coverageCompare";
import type { AgentProfile } from "@/lib/profile";

type Counts = { high: number; medium: number; low: number; dnpa: number; safeco: number; total: number };
const emptyCounts = (): Counts => ({ high: 0, medium: 0, low: 0, dnpa: 0, safeco: 0, total: 0 });
// "Uncertain" = anything an agent shouldn't quote without a check: medium/low
// confidence, or no public data. High-confidence non-DNPA cells are trusted.
const isUncertain = (cell: Cell | undefined): boolean => !cell || cell.confidence !== "high" || cell.category === "dnpa";

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

// Feature "strength" for the head-to-head summary — based on coverage CATEGORY
// only (reliable), never fuzzy numeric-value comparison. dnpa = unknown, skipped.
const RANK: Record<Category, number | null> = { included: 3, available: 2, endorsement: 2, varies: 1, none: 0, dnpa: null };
const VERB: Record<Category, string> = {
  included: "includes it standard",
  available: "offers it (add-on)",
  endorsement: "offers it (add-on)",
  varies: "offers it in some states",
  none: "doesn't offer it",
  dnpa: "has no public data",
};

// Amount comparison (home value cells): only when both sides share a unit and
// higher = more coverage. Excludes deductibles (higher is worse) and text-only
// cells. Used only to break ties when the coverage CATEGORY is equal.
type Amount = { n: number; unit: "dollars" | "months" | "percent" };
function parseAmount(v?: string): Amount | null {
  if (!v) return null;
  if (/guaranteed/i.test(v)) return { n: Infinity, unit: "percent" };
  const unit: Amount["unit"] | null = /\$/.test(v) ? "dollars" : /month/i.test(v) ? "months" : /%/.test(v) ? "percent" : null;
  if (!unit) return null;
  const nums = Array.from(v.matchAll(/(\d+(?:\.\d+)?)\s*([kKmM])?/g), (m) => {
    let n = parseFloat(m[1]);
    const s = (m[2] || "").toLowerCase();
    if (s === "k") n *= 1e3;
    if (s === "m") n *= 1e6;
    return n;
  });
  return nums.length ? { n: Math.max(...nums), unit } : null;
}
const AMOUNT_FEATURES = new Set<string>([
  "dwelling-erc", "other-structures", "personal-property", "loss-of-use",
  "liability", "medpay", "multipolicy", "water-backup", "service-line", "equip-breakdown",
]);

export default function CoverageMatrix({ profile }: { profile: AgentProfile }): React.JSX.Element {
  const [lineKey, setLineKey] = useState<LineKey>("auto");
  const [stateCode, setStateCode] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [glossOpen, setGlossOpen] = useState<boolean>(false);
  const [verifyOnly, setVerifyOnly] = useState<boolean>(false);
  const [cmpA, setCmpA] = useState<string>(""); // head-to-head company A (default: your carrier)
  const [cmpB, setCmpB] = useState<string>(""); // head-to-head company B (default: a competitor)

  const line = LINES[lineKey];
  const carriers = useMemo(() => anchorCarriers(line, profile.authorized_brands), [line, profile.authorized_brands]);

  // Confidence counts for the current line, overall and per displayed carrier.
  const stats = useMemo(() => {
    const ids = carriers.map((c) => c.carrier.id);
    const per: Record<string, Counts> = {};
    ids.forEach((id) => (per[id] = emptyCounts()));
    const total = emptyCounts();
    for (const f of line.features) {
      for (const id of ids) {
        const cell = f.cells[id];
        per[id].total++;
        total.total++;
        if (!cell || cell.category === "dnpa") {
          per[id].dnpa++;
          total.dnpa++;
        } else {
          per[id][cell.confidence]++;
          total[cell.confidence]++;
        }
        if (cell?.safecoDerived) {
          per[id].safeco++;
          total.safeco++;
        }
      }
    }
    return { per, total };
  }, [line, carriers]);
  const uncertainCount = stats.total.medium + stats.total.low + stats.total.dnpa;

  const features = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ids = carriers.map((c) => c.carrier.id);
    let fs = q ? line.features.filter((f) => `${f.name} ${f.description}`.toLowerCase().includes(q)) : line.features;
    if (verifyOnly) fs = fs.filter((f) => ids.some((id) => isUncertain(f.cells[id])));
    return fs;
  }, [line, query, verifyOnly, carriers]);

  // Head-to-head: pick company A (default = your carrier) vs B (default = a
  // competitor). Advantages are read factually from category strength.
  const aId = carriers.find((c) => c.carrier.id === cmpA)?.carrier.id ?? carriers.find((c) => c.anchor)?.carrier.id ?? carriers[0].carrier.id;
  const bId = carriers.find((c) => c.carrier.id === cmpB && c.carrier.id !== aId)?.carrier.id ?? carriers.find((c) => c.carrier.id !== aId)?.carrier.id ?? carriers[0].carrier.id;
  const A = carriers.find((c) => c.carrier.id === aId)!.carrier;
  const B = carriers.find((c) => c.carrier.id === bId)!.carrier;

  const h2h = useMemo(() => {
    if (A.id === B.id) return null;
    const adv: { name: string; reason: string }[] = [];
    const dis: { name: string; reason: string }[] = [];
    let comparable = 0;
    let unknown = 0;
    for (const f of line.features) {
      const ac = f.cells[A.id];
      const bc = f.cells[B.id];
      if (!ac || !bc) {
        unknown++;
        continue;
      }
      const rA = resolveCell(line, f, A, ac, stateCode);
      const rB = resolveCell(line, f, B, bc, stateCode);
      const na = RANK[rA.category];
      const nb = RANK[rB.category];
      if (na === null || nb === null) {
        unknown++;
        continue;
      }
      if (na > nb) {
        adv.push({ name: f.name, reason: `${A.name} ${VERB[rA.category]}; ${B.name} ${VERB[rB.category]}` });
        continue;
      }
      if (na < nb) {
        dis.push({ name: f.name, reason: `${B.name} ${VERB[rB.category]}; ${A.name} ${VERB[rA.category]}` });
        continue;
      }
      // Categories equal — break the tie on amount where it's comparable.
      if (AMOUNT_FEATURES.has(f.id)) {
        const pa = parseAmount(rA.value);
        const pb = parseAmount(rB.value);
        if (pa && pb && pa.unit === pb.unit && pa.n !== pb.n) {
          if (pa.n > pb.n) adv.push({ name: f.name, reason: `${A.name} ${rA.value} vs ${B.name} ${rB.value}` });
          else dis.push({ name: f.name, reason: `${B.name} ${rB.value} vs ${A.name} ${rA.value}` });
          continue;
        }
      }
      comparable++;
    }
    return { adv, dis, comparable, unknown };
  }, [line, A, B, stateCode]);

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

      {/* Head-to-head advantage summary */}
      <div className="rounded-2xl border border-card-line bg-surface p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-11 font-bold uppercase tracking-wider text-ink-2">Head-to-head</span>
          <select
            value={A.id}
            onChange={(e) => setCmpA(e.target.value)}
            aria-label="Compare company A"
            className="min-h-9 cursor-pointer rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 text-12 font-semibold text-ink"
          >
            {carriers.map(({ carrier }) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
          <span className="text-12 text-ink-2">vs</span>
          <select
            value={B.id}
            onChange={(e) => setCmpB(e.target.value)}
            aria-label="Compare company B"
            className="min-h-9 cursor-pointer rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 text-12 font-semibold text-ink"
          >
            {carriers.map(({ carrier }) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
        </div>
        {h2h ? (
          <>
            <p className="mb-3 text-12 text-ink-mid">
              <b className="text-ink">{A.name}</b> leads on {h2h.adv.length} · <b className="text-ink">{B.name}</b> leads on{" "}
              {h2h.dis.length} · comparable on {h2h.comparable}
              {h2h.unknown ? ` · ${h2h.unknown} without public data to compare` : ""}.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-11 font-bold uppercase tracking-wide text-green-text">{A.name} advantages</div>
                {h2h.adv.length ? (
                  <ul className="space-y-1.5">
                    {h2h.adv.map((x) => (
                      <li key={x.name} className="flex gap-2 text-12 leading-snug text-ink-mid">
                        <span className="font-bold text-green-text">+</span>
                        <span>
                          <span className="font-semibold text-ink">{x.name}</span> — {x.reason}.
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-12 text-ink-3">No clear edge on these coverages.</p>
                )}
              </div>
              <div>
                <div className="mb-2 text-11 font-bold uppercase tracking-wide text-red-text">{B.name} advantages</div>
                {h2h.dis.length ? (
                  <ul className="space-y-1.5">
                    {h2h.dis.map((x) => (
                      <li key={x.name} className="flex gap-2 text-12 leading-snug text-ink-mid">
                        <span className="font-bold text-red-text">–</span>
                        <span>
                          <span className="font-semibold text-ink">{x.name}</span> — {x.reason}.
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-12 text-ink-3">No clear edge on these coverages.</p>
                )}
              </div>
            </div>
            <p className="mt-3 text-11 text-ink-3">
              Advantages compare whether a coverage is included, an add-on, or not offered — and, where amounts are directly
              comparable (limits, durations, percentages), which carrier offers more. Cells with no public data or different units
              are left out. Verify against the policy before quoting.
            </p>
          </>
        ) : (
          <p className="text-12 text-ink-2">Pick two different carriers to compare.</p>
        )}
      </div>

      {/* Confidence summary + "needs verification" filter */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-card-line bg-surface px-4 py-3 text-12 shadow-sm">
        <span className="font-bold text-ink">{stats.total.total} cells</span>
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <span className="h-2 w-2 rounded-full bg-green-text" />
          {stats.total.high} high
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <span className="h-2 w-2 rounded-full bg-amber-dot" />
          {stats.total.medium} medium
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <span className="h-2 w-2 rounded-full border border-red-text" />
          {stats.total.low} low
        </span>
        <span className="text-ink-2">{stats.total.dnpa} not public</span>
        {stats.total.safeco ? <span className="text-amber-text">{stats.total.safeco} Safeco-derived</span> : null}
        <div className="grow" />
        <button
          onClick={() => setVerifyOnly((v) => !v)}
          aria-pressed={verifyOnly}
          className={`min-h-9 rounded-lg border px-3 py-1.5 text-12 font-bold ${
            verifyOnly ? "border-amber-border bg-amber-fill text-amber-text" : "border-line-2 bg-surface text-ink-mid"
          }`}
        >
          {verifyOnly ? "Showing cells to verify" : `Needs verification (${uncertainCount})`}
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
                    <div className="mt-0.5 text-11 font-semibold text-ink-2">
                      {anchor ? "Your carrier" : "Competitor"} · {stats.per[carrier.id].high}/{stats.per[carrier.id].total} verified
                    </div>
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
                  // When the verify filter is on, fade the trusted cells so the
                  // ones that need a check stand out within each shown row.
                  const dim = verifyOnly && !isUncertain(cell);
                  return (
                    <td key={carrier.id} className={`border-b border-line p-3 align-top ${anchor ? "bg-red-fill/50" : ""} ${dim ? "opacity-40" : ""}`}>
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
