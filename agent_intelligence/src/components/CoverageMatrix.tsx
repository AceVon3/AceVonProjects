"use client";

// Coverage Compare grid — auto/home toggle, state filter scoped to the agent's
// licensed states, feature search, glossary. Factual cells (value + category
// chip + confidence + source); the agent reads across the row. Data + resolve
// logic live in @/lib/coverageCompare (client-safe, no DB).

import { useEffect, useMemo, useState } from "react";

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
import { STATES } from "@/lib/states";
import ScenarioExplorer from "./ScenarioExplorer";

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
  stepdown: { cls: "bg-amber-fill text-amber-text", label: "Reduced limits" },
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
const RANK: Record<Category, number | null> = { included: 3, available: 2, endorsement: 2, varies: 1, stepdown: 1, none: 0, dnpa: null };
const VERB: Record<Category, string> = {
  included: "includes it standard",
  available: "offers it (add-on)",
  endorsement: "offers it (add-on)",
  varies: "offers it in some states",
  stepdown: "covers it at reduced limits",
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

// Materiality weight per feature — how much a win/loss on it actually moves a
// customer's decision. Big total-loss / catastrophic coverages outrank
// convenience add-ons, so the head-to-head lists the persuasive differences
// first instead of in feature order. Anything at or above KEY_COVERAGE_MIN is
// flagged "Key coverage".
const MATERIALITY: Record<string, number> = {
  // auto
  gap: 9, "new-car-replacement": 9, "accident-forgiveness": 7, rideshare: 7,
  "mechanical-breakdown": 6, "diminishing-deductible": 6, rental: 5, glass: 5,
  telematics: 5, roadside: 4, "emergency-travel": 3, "custom-parts": 3,
  // home
  "dwelling-erc": 10, roof: 9, liability: 9, hurricane: 8, windhail: 8, ordinance: 8,
  "water-backup": 7, "pp-loss": 7, "personal-property": 6, "loss-of-use": 6,
  "equip-breakdown": 5, "service-line": 5, "other-structures": 4, multipolicy: 4, medpay: 3,
};
const MATERIALITY_DEFAULT = 5;
const KEY_COVERAGE_MIN = 8;
const materiality = (id: string): number => MATERIALITY[id] ?? MATERIALITY_DEFAULT;

export default function CoverageMatrix({ profile }: { profile: AgentProfile }): React.JSX.Element {
  const [lineKey, setLineKey] = useState<LineKey>("auto");
  const [stateCode, setStateCode] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [glossOpen, setGlossOpen] = useState<boolean>(false);
  const [verifyOnly, setVerifyOnly] = useState<boolean>(false);
  const [cmpA, setCmpA] = useState<string>(""); // head-to-head company A (default: your carrier)
  const [cmpB, setCmpB] = useState<string>(""); // head-to-head company B (default: a competitor)
  const [visibleIds, setVisibleIds] = useState<string[]>([]); // carriers shown in the grid
  const [highlightId, setHighlightId] = useState<string>(""); // matrix row flashed from a head-to-head click

  const line = LINES[lineKey];
  const carriers = useMemo(() => anchorCarriers(line, profile.authorized_brands), [line, profile.authorized_brands]);

  // State dropdown spans all 50 states (the load-bearing rules — CA bans, FL/KY/SC
  // glass mandates, TX wind/hail, coastal hurricane — live outside the licensable
  // set), with the agent's own licensed states pulled to the top for quick reach.
  const licensedSet = useMemo(() => new Set(profile.licensed_states), [profile.licensed_states]);
  const yourStates = useMemo(() => STATES.filter((s) => licensedSet.has(s.code)), [licensedSet]);
  const otherStates = useMemo(() => STATES.filter((s) => !licensedSet.has(s.code)), [licensedSet]);

  // Grid shows a manageable subset (your carrier + a few); reset to that on a
  // line switch. The head-to-head below can still pick any two carriers.
  const anchorIds = useMemo(() => carriers.filter((c) => c.anchor).map((c) => c.carrier.id), [carriers]);
  useEffect(() => {
    setVisibleIds(carriers.slice(0, 5).map((c) => c.carrier.id));
  }, [carriers]);
  const effectiveVisibleIds = visibleIds.length ? visibleIds : carriers.slice(0, 5).map((c) => c.carrier.id);
  const visibleCarriers = carriers.filter((c) => effectiveVisibleIds.includes(c.carrier.id));
  const toggleCarrier = (id: string) => {
    if (anchorIds.includes(id)) return; // your carrier stays pinned
    setVisibleIds((prev) => {
      const base = prev.length ? prev : carriers.slice(0, 5).map((c) => c.carrier.id);
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

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
    const ids = visibleCarriers.map((c) => c.carrier.id);
    let fs = q ? line.features.filter((f) => `${f.name} ${f.description}`.toLowerCase().includes(q)) : line.features;
    if (verifyOnly) fs = fs.filter((f) => ids.some((id) => isUncertain(f.cells[id])));
    return fs;
  }, [line, query, verifyOnly, visibleCarriers]);

  // Head-to-head: pick company A (default = your carrier) vs B (default = a
  // competitor). Advantages are read factually from category strength.
  const aId = carriers.find((c) => c.carrier.id === cmpA)?.carrier.id ?? carriers.find((c) => c.anchor)?.carrier.id ?? carriers[0].carrier.id;
  const bId = carriers.find((c) => c.carrier.id === cmpB && c.carrier.id !== aId)?.carrier.id ?? carriers.find((c) => c.carrier.id !== aId)?.carrier.id ?? carriers[0].carrier.id;
  const A = carriers.find((c) => c.carrier.id === aId)!.carrier;
  const B = carriers.find((c) => c.carrier.id === bId)!.carrier;

  const h2h = useMemo(() => {
    if (A.id === B.id) return null;
    type Item = { id: string; name: string; reason: string; weight: number; major: boolean };
    const adv: Item[] = [];
    const dis: Item[] = [];
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
      const w = materiality(f.id);
      const item = (reason: string): Item => ({ id: f.id, name: f.name, reason, weight: w, major: w >= KEY_COVERAGE_MIN });
      if (na > nb) {
        adv.push(item(`${A.name} ${VERB[rA.category]}; ${B.name} ${VERB[rB.category]}`));
        continue;
      }
      if (na < nb) {
        dis.push(item(`${B.name} ${VERB[rB.category]}; ${A.name} ${VERB[rA.category]}`));
        continue;
      }
      // Categories equal — break the tie on amount where it's comparable.
      if (AMOUNT_FEATURES.has(f.id)) {
        const pa = parseAmount(rA.value);
        const pb = parseAmount(rB.value);
        if (pa && pb && pa.unit === pb.unit && pa.n !== pb.n) {
          if (pa.n > pb.n) adv.push(item(`${A.name} ${rA.value} vs ${B.name} ${rB.value}`));
          else dis.push(item(`${B.name} ${rB.value} vs ${A.name} ${rA.value}`));
          continue;
        }
      }
      comparable++;
    }
    // Most-material first; .sort is stable so equal weights keep feature order.
    const byWeight = (a: Item, b: Item) => b.weight - a.weight;
    adv.sort(byWeight);
    dis.sort(byWeight);
    return { adv, dis, comparable, unknown };
  }, [line, A, B, stateCode]);

  // State story: when a state is picked, call out where its rules actually swing
  // the A-vs-B matchup (a coverage banned/added in-state) or add a local rule.
  // Reads national vs in-state resolution and reports only real changes.
  const stateNotes = useMemo(() => {
    if (!stateCode || A.id === B.id) return [];
    const sn = stateName(stateCode);
    const strip = (s?: string) => (s ? s.replace(/\.$/, "") : "");
    const rankOf = (c: Category) => RANK[c];
    const edges: string[] = [];
    const risks: string[] = [];
    const rules: string[] = [];
    const tweaks: string[] = [];
    const seen = new Set<string>();
    const add = (bucket: string[], text: string) => {
      if (!seen.has(text)) { seen.add(text); bucket.push(text); }
    };
    for (const f of line.features) {
      const ac = f.cells[A.id];
      const bc = f.cells[B.id];
      const label = f.name.toLowerCase();
      const aNat = ac ? resolveCell(line, f, A, ac, "") : null;
      const aSt = ac ? resolveCell(line, f, A, ac, stateCode) : null;
      const bNat = bc ? resolveCell(line, f, B, bc, "") : null;
      const bSt = bc ? resolveCell(line, f, B, bc, stateCode) : null;
      const lost = (nat: typeof aNat, st: typeof aSt) =>
        !!nat && !!st && rankOf(nat.category) != null && rankOf(st.category) != null && rankOf(st.category)! < rankOf(nat.category)!;
      const aLost = lost(aNat, aSt);
      const bLost = lost(bNat, bSt);
      const aFlag = aSt?.stateFlag;
      const bFlag = bSt?.stateFlag;
      if (aLost && !bLost && aFlag) {
        add(risks, `In ${sn}, ${A.name} can't offer ${label} (${strip(aFlag)}) — ${B.name} still does.`);
      } else if (bLost && !aLost && bFlag) {
        add(edges, `In ${sn}, ${A.name} gains an edge on ${label} — ${B.name} can't offer it (${strip(bFlag)}).`);
      } else if (aLost && bLost && (aFlag || bFlag)) {
        add(rules, `In ${sn}, neither ${A.name} nor ${B.name} offers ${label} (${strip(aFlag || bFlag)}).`);
      } else if (aFlag || bFlag) {
        add(rules, `${f.name}: ${strip(aFlag || bFlag)}.`);
      } else {
        const aTweak = aNat && aSt && (aSt.value !== aNat.value || aSt.note !== aNat.note);
        const bTweak = bNat && bSt && (bSt.value !== bNat.value || bSt.note !== bNat.note);
        if (aTweak) add(tweaks, `In ${sn}, ${A.name}'s ${label}: ${strip(aSt!.note || aSt!.value)}.`);
        else if (bTweak) add(tweaks, `In ${sn}, ${B.name}'s ${label}: ${strip(bSt!.note || bSt!.value)}.`);
      }
    }
    return [...edges, ...risks, ...rules, ...tweaks].slice(0, 6);
  }, [line, A, B, stateCode]);

  // Click a head-to-head advantage → make sure both compared carriers are in the
  // grid, then flash their row. The effect scrolls after the row has rendered.
  const focusFeature = (id: string): void => {
    setVisibleIds((prev) => {
      const base = prev.length ? prev : carriers.slice(0, 5).map((c) => c.carrier.id);
      const add = [A.id, B.id].filter((x) => !base.includes(x));
      return add.length ? [...base, ...add] : base;
    });
    setHighlightId(id);
  };
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`cov-row-${highlightId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightId(""), 1900);
    return () => clearTimeout(t);
  }, [highlightId]);

  return (
    <div className="space-y-4">
      {/* Line toggle */}
      <div className="inline-flex gap-0.5 rounded-xl border border-card-line bg-soft p-1" role="tablist" aria-label="Insurance line">
        {(["auto", "home", "scenarios"] as LineKey[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={lineKey === k}
            onClick={() => setLineKey(k)}
            className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-14 font-bold ${
              lineKey === k ? "bg-surface text-ink shadow-sm" : "text-ink-mid"
            }`}
          >
            <span aria-hidden>{k === "auto" ? "🚗" : k === "home" ? "🏠" : "🧑‍🤝‍🧑"}</span>
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
            {yourStates.length ? (
              <optgroup label="Your licensed states">
                {yourStates.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="All states">
              {otherStates.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </optgroup>
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

      {/* Scenario-first explorer — "I'm in situation X, show me carriers". Only
          on the Who's Covered line, where the rich per-carrier detail lives. */}
      {lineKey === "scenarios" ? <ScenarioExplorer line={line} carriers={carriers} /> : null}

      {/* Head-to-head advantage summary — not shown for the scenarios line
          (its "who's covered" statuses aren't a better/worse ranking). */}
      {lineKey !== "scenarios" && (
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
            {(() => {
              const a = h2h.adv.length;
              const b = h2h.dis.length;
              const tie = h2h.comparable;
              const total = a + b + tie || 1;
              const headline =
                a > b ? `${A.name} leads ${a}–${b}` : b > a ? `${B.name} leads ${b}–${a}` : `${A.name} & ${B.name} even ${a}–${b}`;
              return (
                <div className="mb-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-16 font-extrabold tracking-tight text-ink">{headline}</span>
                    <span className="text-12 text-ink-3">across {total} compared coverage{total === 1 ? "" : "s"}{h2h.unknown ? ` · ${h2h.unknown} without public data` : ""}</span>
                  </div>
                  <div className="mt-2 flex h-2 w-full max-w-[420px] overflow-hidden rounded-full bg-soft" role="img" aria-label={`${A.name} wins ${a}, ties ${tie}, ${B.name} wins ${b}`}>
                    <div className="bg-green-text" style={{ width: `${(a / total) * 100}%` }} />
                    <div className="bg-gray-fill" style={{ width: `${(tie / total) * 100}%` }} />
                    <div className="bg-brand-red" style={{ width: `${(b / total) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-11 text-ink-2">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-text" />{A.name} {a}</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-fill" />Comparable {tie}</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-red" />{B.name} {b}</span>
                  </div>
                </div>
              );
            })()}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-11 font-bold uppercase tracking-wide text-green-text">{A.name} advantages</div>
                {h2h.adv.length ? (
                  <ul className="space-y-1.5">
                    {h2h.adv.map((x) => (
                      <li key={x.name} className="flex gap-2 text-12 leading-snug text-ink-mid">
                        <span className="font-bold text-green-text">+</span>
                        <span>
                          <button
                            type="button"
                            onClick={() => focusFeature(x.id)}
                            className="cursor-pointer border-0 bg-transparent p-0 text-12 font-semibold text-ink underline decoration-dotted decoration-line-2 underline-offset-2 hover:decoration-ink-2"
                            title="Show this coverage in the grid"
                          >
                            {x.name}
                          </button>
                          {x.major ? (
                            <span className="ml-1.5 rounded bg-gray-fill px-1 py-px text-10 font-bold uppercase tracking-wide text-gray-text">
                              Key coverage
                            </span>
                          ) : null}{" "}
                          — {x.reason}.
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
                          <button
                            type="button"
                            onClick={() => focusFeature(x.id)}
                            className="cursor-pointer border-0 bg-transparent p-0 text-12 font-semibold text-ink underline decoration-dotted decoration-line-2 underline-offset-2 hover:decoration-ink-2"
                            title="Show this coverage in the grid"
                          >
                            {x.name}
                          </button>
                          {x.major ? (
                            <span className="ml-1.5 rounded bg-gray-fill px-1 py-px text-10 font-bold uppercase tracking-wide text-gray-text">
                              Key coverage
                            </span>
                          ) : null}{" "}
                          — {x.reason}.
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-12 text-ink-3">No clear edge on these coverages.</p>
                )}
              </div>
            </div>
            {stateNotes.length ? (
              <div className="mt-4 rounded-xl border border-amber-border bg-amber-fill/40 p-3">
                <div className="mb-1.5 text-11 font-bold uppercase tracking-wide text-amber-text">
                  What changes in {stateName(stateCode)}
                </div>
                <ul className="space-y-1">
                  {stateNotes.map((n) => (
                    <li key={n} className="flex gap-2 text-12 leading-snug text-ink-mid">
                      <span aria-hidden className="text-amber-text">→</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-3 text-11 text-ink-3">
              Ordered by coverage impact — the differences that move a customer decision first. Advantages compare whether a
              coverage is included, an add-on, or not offered — and, where amounts are directly comparable (limits, durations,
              percentages), which carrier offers more. Cells with no public data or different units are left out. Verify against
              the policy before quoting.
            </p>
          </>
        ) : (
          <p className="text-12 text-ink-2">Pick two different carriers to compare.</p>
        )}
      </div>
      )}

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

      {/* Carrier picker — which columns show in the grid. Your carrier is
          pinned; toggle competitors on/off to keep the row readable. */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-card-line bg-surface px-4 py-3 shadow-sm">
        <span className="mr-1 text-11 font-bold uppercase tracking-wider text-ink-2">Carriers in grid</span>
        {carriers.map(({ carrier, anchor }) => {
          const on = effectiveVisibleIds.includes(carrier.id);
          return (
            <button
              key={carrier.id}
              onClick={() => toggleCarrier(carrier.id)}
              disabled={anchor}
              aria-pressed={on}
              title={anchor ? "Your carrier — always shown" : on ? "Hide from grid" : "Show in grid"}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-12 font-semibold ${
                on ? "border-line-2 bg-soft text-ink" : "border-line-2 bg-surface text-ink-3"
              } ${anchor ? "cursor-default" : "cursor-pointer"}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? carrier.color : "transparent", border: on ? "none" : `1px solid ${carrier.color}` }} />
              {carrier.name}
              {anchor ? <span className="text-10 font-bold uppercase tracking-wide text-brand-red">You</span> : null}
            </button>
          );
        })}
        <span className="ml-auto text-11 text-ink-3">{visibleCarriers.length} of {carriers.length} shown</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-card-line bg-surface shadow-sm">
        <table className="w-full min-w-[960px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-[22%] min-w-[210px] border-b border-card-line p-0 text-left align-top">
                <div className="h-1" />
                <div className="p-3.5 text-12 font-bold text-ink">Coverage</div>
              </th>
              {visibleCarriers.map(({ carrier, anchor }) => (
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
              <tr
                key={feat.id}
                id={`cov-row-${feat.id}`}
                className={`group scroll-mt-24 ${highlightId === feat.id ? "[&>*]:!bg-amber-fill [&>*]:transition-colors" : "[&>*]:transition-colors"}`}
              >
                <th className="border-b border-line p-3.5 text-left align-top">
                  <div className="text-13 font-bold text-ink">{feat.name}</div>
                  <div className="mt-0.5 text-12 leading-snug text-ink-2">{feat.description}</div>
                </th>
                {visibleCarriers.map(({ carrier, anchor }) => {
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
        Coverage set: {carriers.length} of 13 carriers.
      </p>
    </div>
  );
}
