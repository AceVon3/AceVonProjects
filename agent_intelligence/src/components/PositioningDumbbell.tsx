"use client";

// You-vs-market dumbbell — the Positioning page's headline chart, ported
// from the 2026-08 design handback (scratch/handback/positioning_dumbbell_*).
// Data comes precomputed from computeMarketDumbbell so the numbers reconcile
// with the comparison cards below by construction.
//
// Handback behaviors carried over: thin rows draw hollow dots with no
// connector and no gap; direct value labels on the headline row only;
// per-row tooltips that also fire on keyboard focus; a stacked-row narrow
// layout on ONE shared scale; and a full table fallback. The headline
// sentence is computed ("all N" vs "X of N") — never a fixed string.

import { useCallback, useEffect, useRef, useState } from "react";

import { formatRateImpact } from "@/lib/format";
import type { DumbbellData, DumbbellRow } from "@/lib/marketDumbbell";

const RED = "#C42127";
const BLUE = "#1B6CA8";
const SURFACE = "#ffffff";
const INK2 = "#6B7080";
const INK3 = "#9AA0B0";
const INKMID = "#4A4E63";
const LINE = "#EDEFF4";
const LINE2 = "#DDE1EA";

const fmt = formatRateImpact;
// Signed pts (you − market), U+2212 minus for visual parity with fmt.
function pts(v: number): string {
  if (v === 0) return "0.0";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
}

// Data-derived domain: pad, always include 0, and snap ticks to a step that
// keeps labels sparse enough not to collide at narrow widths.
function domainAndTicks(rows: DumbbellRow[]): { min: number; max: number; ticks: number[] } {
  const vals = rows.flatMap(r => [r.you, r.market, 0]);
  let min = Math.min(...vals) - 1.2;
  let max = Math.max(...vals) + 1.2;
  const step = [1, 2, 4, 5, 10, 20].find(s => (max - min) / s <= 6) ?? 20;
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max; t += step) ticks.push(t);
  return { min, max, ticks };
}

type Tip = { html: string; x: number; y: number };

function tipText(r: DumbbellRow, agentLabel: string, line: string): { title: string; body: string } {
  const title = `${r.state} — ${line}`;
  if (r.thin) {
    return {
      title,
      body:
        `${agentLabel} filed ${fmt(r.you)} in ${r.youN === 1 ? "a single filing" : `${r.youN} filings`}, ` +
        `so it is not shown as an average and no gap is computed. ` +
        `Market average ${fmt(r.market)} across ${r.marketN} filings.`,
    };
  }
  return {
    title,
    body:
      `${agentLabel} average ${fmt(r.you)} across ${r.youN} filings. ` +
      `Market average ${fmt(r.market)} across ${r.marketN} filings from ${r.brandsN} competitors. ` +
      `Your change vs market: ${pts(r.gap!)} pts.`,
  };
}

function rowAria(r: DumbbellRow, agentLabel: string): string {
  return (
    `${r.state}: ${agentLabel} ${fmt(r.you)} from ${r.youN} ${r.youN === 1 ? "filing" : "filings"}, ` +
    `market average ${fmt(r.market)} from ${r.marketN} filings` +
    (r.thin
      ? ", single filing so no gap is computed"
      : `, your change vs market ${pts(r.gap!)} points`)
  );
}

export default function PositioningDumbbell({
  data,
  line,
  agentLabel,
  asOf,
}: {
  data: DumbbellData;
  line: string;
  agentLabel: string;
  asOf: string;
}): React.JSX.Element | null {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(480, w));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTip(null); };
    const onScroll = () => setTip(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const showTip = useCallback((r: DumbbellRow, x: number, y: number) => {
    const t = tipText(r, agentLabel, line);
    setTip({ html: `<b>${t.title}</b>${t.body}`, x, y });
  }, [agentLabel, line]);

  if (data.rows.length === 0) return null;

  const { rows, notPlotted, comparableCount, belowCount, headline } = data;
  const anyThin = rows.some(r => r.thin);
  const { min, max, ticks } = domainAndTicks(rows);

  // Chart geometry (wide layout).
  const padTop = 22, rowH = 34, axisH = 30, gapCol = 96;
  const H = padTop + rows.length * rowH + axisH;
  const x0 = 64, x1 = width - gapCol - 14;
  const X = (v: number) => x0 + ((v - min) / (max - min)) * (x1 - x0);
  const yBot = padTop + rows.length * rowH;

  // Computed headline — "all N" / "X of N" / at-or-above, never hardcoded.
  const relation = belowCount * 2 >= comparableCount ? "below" : "above";
  const relCount = relation === "below" ? belowCount : comparableCount - belowCount;
  const scope = relCount === comparableCount
    ? `all ${comparableCount} comparable states`
    : `${relCount} of ${comparableCount} comparable states`;

  return (
    <div
      data-testid="positioning-dumbbell"
      className="mb-5 bg-surface border border-card-line rounded-card shadow-card px-5 py-4"
    >
      <style>{`
        .pdb-row{outline:none;cursor:default}
        .pdb-ring{fill:none}
        .pdb-row:focus-visible .pdb-ring{stroke:#9AA0B0;stroke-width:1.5;stroke-dasharray:3 3}
      `}</style>

      <div className="flex items-baseline gap-3.5 flex-wrap">
        <span className="text-11 uppercase tracking-wider06 text-ink-3">
          You vs the market, by state &middot; {line} &middot; Trailing 12 months
        </span>
        <span className="ml-auto flex gap-3.5 flex-wrap text-11 text-ink-2">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-[9px] h-[9px] rounded-full inline-block" style={{ background: RED }} />
            {agentLabel} (you)
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-[9px] h-[9px] rounded-full inline-block" style={{ background: BLUE }} />
            Market avg (competitors)
          </span>
          {anyThin && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-[10px] h-[10px] rounded-full inline-block bg-surface border-2" style={{ borderColor: RED }} />
              1 filing &mdash; thin
            </span>
          )}
        </span>
      </div>

      {comparableCount > 0 && headline ? (
        <p className="text-15 font-semibold text-ink mt-2.5 mb-1 max-w-[62ch] tracking-tight02">
          {agentLabel}&rsquo;s filed {line === "Personal Auto" ? "Auto" : line} changes ran {relation} the
          market average in {scope}. The widest gap is{" "}
          <span className="tabular-nums whitespace-nowrap">
            {headline.state} ({fmt(headline.you)} vs {fmt(headline.market)})
          </span>.
        </p>
      ) : (
        <p className="text-15 font-semibold text-ink mt-2.5 mb-1 max-w-[62ch] tracking-tight02">
          Not enough filings on both sides for a market comparison yet.
        </p>
      )}

      {/* Wide layout: SVG dumbbell. */}
      <div className="hidden sm:block mt-2" ref={wrapRef}>
        <svg
          role="img"
          width="100%"
          viewBox={`0 0 ${width} ${H}`}
          aria-label={`Dumbbell chart comparing ${agentLabel}'s premium-weighted average ${line} rate change against the pooled competitor average, by state, trailing 12 months. Full values are in the table below the chart.`}
          style={{ display: "block", height: "auto" }}
        >
          {ticks.map(g => (
            <g key={g}>
              <line x1={X(g)} y1={padTop - 6} x2={X(g)} y2={yBot}
                stroke={g === 0 ? LINE2 : LINE} strokeWidth={1} />
              <text x={X(g)} y={yBot + 17} textAnchor="middle" fontSize={11} fill={INK3}>
                {g > 0 ? `+${g}%` : g < 0 ? `−${Math.abs(g)}%` : "0%"}
              </text>
            </g>
          ))}
          <text x={width - 8} y={padTop - 8} textAnchor="end" fontSize={10}
            fill={INK3} letterSpacing="0.4px">
            You vs market (pts)
          </text>

          {rows.map((r, i) => {
            const y = padTop + i * rowH + rowH / 2;
            return (
              <g
                key={r.state}
                tabIndex={0}
                className="pdb-row"
                role="img"
                aria-label={rowAria(r, agentLabel)}
                onMouseMove={e => showTip(r, e.clientX, e.clientY)}
                onMouseLeave={() => setTip(null)}
                onFocus={e => {
                  const b = e.currentTarget.getBoundingClientRect();
                  showTip(r, b.left + b.width * 0.35, b.bottom - 8);
                }}
                onBlur={() => setTip(null)}
              >
                <rect className="pdb-ring" x={6} y={y - rowH / 2 + 2}
                  width={width - 12} height={rowH - 4} rx={8} />
                <text x={x0 - 16} y={y + 4} textAnchor="end" fill={INKMID}
                  fontWeight={600} fontSize={12}>{r.state}</text>

                {!r.thin && (
                  <line x1={X(r.you)} y1={y} x2={X(r.market)} y2={y}
                    stroke={LINE2} strokeWidth={2} strokeLinecap="round" />
                )}
                <circle cx={X(r.market)} cy={y} r={5.5} fill={BLUE}
                  stroke={SURFACE} strokeWidth={2} />
                {r.thin ? (
                  <circle cx={X(r.you)} cy={y} r={5} fill={SURFACE}
                    stroke={RED} strokeWidth={2} />
                ) : (
                  <circle cx={X(r.you)} cy={y} r={5.5} fill={RED}
                    stroke={SURFACE} strokeWidth={2} />
                )}

                {/* Direct labels on the headline row only. */}
                {headline && r.state === headline.state && !r.thin && (() => {
                  const left = r.you <= r.market;
                  return (
                    <>
                      <text x={left ? X(r.you) - 11 : X(r.you) + 11} y={y + 4}
                        textAnchor={left ? "end" : "start"} fontSize={11}
                        fill={INKMID} fontWeight={600}>{fmt(r.you)}</text>
                      <text x={left ? X(r.market) + 11 : X(r.market) - 11} y={y + 4}
                        textAnchor={left ? "start" : "end"} fontSize={11}
                        fill={INKMID} fontWeight={600}>{fmt(r.market)}</text>
                    </>
                  );
                })()}

                <text x={width - 8} y={y + 4} textAnchor="end" fontSize={11.5}
                  fill={r.gap === null ? INK3 : INKMID}
                  fontWeight={r.gap === null ? 400 : 600}>
                  {r.gap === null ? "—" : pts(r.gap)}
                </text>

                <rect x={6} y={y - rowH / 2} width={width - 12} height={rowH}
                  fill="transparent" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Narrow layout: stacked rows, one shared scale. */}
      <div className="sm:hidden mt-1.5" aria-hidden="true">
        <div className="flex justify-between text-[10.5px] text-ink-3 my-0.5">
          <span>{min < 0 ? `−${Math.abs(min)}%` : `${min}%`}</span>
          <span>{(min + max) / 2 === 0 ? "0%" : ""}</span>
          <span>{max > 0 ? `+${max}%` : `${max}%`}</span>
        </div>
        {rows.map(r => {
          const W = 300, x0m = 6, x1m = W - 6;
          const Xm = (v: number) => x0m + ((v - min) / (max - min)) * (x1m - x0m);
          return (
            <div key={r.state} className="py-2 border-t border-line first:border-t-0">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-ink-mid min-w-[26px]">{r.state}</span>
                <span className="text-[11.5px] text-ink-2 tabular-nums">
                  <span className="font-semibold" style={{ color: RED }}>{fmt(r.you)}</span> you &middot;{" "}
                  <span className="font-semibold" style={{ color: BLUE }}>{fmt(r.market)}</span> market
                  {r.thin ? " · 1 filing" : ""}
                </span>
                <span className="ml-auto text-11 text-ink-3 tabular-nums">
                  {r.gap === null ? "no gap" : `${pts(r.gap)} pts`}
                </span>
              </div>
              <svg viewBox={`0 0 ${W} 22`} style={{ width: "100%", height: 22, display: "block" }}>
                <line x1={Xm(0)} y1={2} x2={Xm(0)} y2={20} stroke={LINE2} strokeWidth={1} />
                {!r.thin && (
                  <line x1={Xm(r.you)} y1={11} x2={Xm(r.market)} y2={11}
                    stroke={LINE2} strokeWidth={2} strokeLinecap="round" />
                )}
                <circle cx={Xm(r.market)} cy={11} r={4.5} fill={BLUE} stroke={SURFACE} strokeWidth={1.5} />
                <circle cx={Xm(r.you)} cy={11} r={r.thin ? 4 : 4.5}
                  fill={r.thin ? SURFACE : RED} stroke={r.thin ? RED : SURFACE} strokeWidth={2} />
              </svg>
            </div>
          );
        })}
      </div>

      <p className="text-12 text-ink-2 mt-3 mb-0 max-w-[70ch]">
        Gap is your change minus the market average, in points.
        {anyThin && " Hollow dot = one filing, shown as a single filing rather than an average, with no gap computed."}
        {notPlotted.length > 0 &&
          ` ${notPlotted.join(", ")} ${notPlotted.length === 1 ? "has" : "have"} no ${agentLabel} ${line} filing in the window, so ${notPlotted.length === 1 ? "it has" : "they have"} no row.`}
        {asOf && ` Data as of ${asOf}.`}
      </p>

      <details className="mt-2">
        <summary className="text-12 text-ink-2 cursor-pointer">View as table</summary>
        <table className="mt-2.5 w-full text-12 tabular-nums border-collapse">
          <thead>
            <tr>
              {["State", "You", "Filings", "Market", "Filings", "You vs market (pts)"].map((h, i) => (
                <th key={h} scope="col"
                  className={`${i === 0 ? "text-left" : "text-right"} text-ink-3 font-semibold uppercase text-10 tracking-wider04 py-1 px-2 border-b border-line`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.state}>
                <td className="text-left py-1 px-2 border-b border-line">{r.state}</td>
                <td className="text-right py-1 px-2 border-b border-line">{fmt(r.you)}</td>
                <td className={`text-right py-1 px-2 border-b border-line ${r.thin ? "text-ink-3" : ""}`}>
                  {r.youN}{r.thin ? " (thin)" : ""}
                </td>
                <td className="text-right py-1 px-2 border-b border-line">{fmt(r.market)}</td>
                <td className="text-right py-1 px-2 border-b border-line">{r.marketN}</td>
                <td className={`text-right py-1 px-2 border-b border-line ${r.gap === null ? "text-ink-3" : ""}`}>
                  {r.gap === null ? "— (1 filing)" : pts(r.gap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {tip && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-50 max-w-[290px] bg-surface border border-card-line rounded-tile shadow-popover px-3 py-2 text-12 text-ink-2 leading-normal pointer-events-none [&>b]:block [&>b]:text-ink"
          style={{
            left: Math.max(8, Math.min(tip.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1000) - 300)),
            top: tip.y + 14,
          }}
          dangerouslySetInnerHTML={{ __html: tip.html }}
        />
      )}
    </div>
  );
}
