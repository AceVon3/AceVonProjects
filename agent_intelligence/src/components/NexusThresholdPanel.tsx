"use client";

import { stateName } from "@/lib/briefing";
import { nexusInfo } from "@/lib/economicNexus";

// Setup-side panel: as the agent selects licensed/selling states, show each
// state's income-tax economic-nexus revenue line for out-of-state service
// businesses (insurance-agency commissions). Relevance-pointing only — the
// panel states the line and the agent's source, never whether the agent's
// own book crosses it.
export default function NexusThresholdPanel({
  states,
}: {
  states: string[];
}): React.JSX.Element | null {
  if (states.length === 0) return null;
  return (
    <div
      data-testid="nexus-threshold-panel"
      className="mt-3 rounded-tile border border-line bg-surface-2 px-4 py-3"
    >
      <div className="text-11 uppercase tracking-wider04 text-ink-2 mb-1.5">
        Selling into these states — income-tax revenue lines worth knowing
      </div>
      <p className="text-12 text-ink-3 m-0 mb-2 leading-[1.5]">
        Selling to another state&rsquo;s residents can eventually create an
        income/business-tax filing obligation there (&ldquo;nexus&rdquo;) —
        many states draw the line at a revenue level, others use a
        facts-and-circumstances standard. The lines for your selected states:
      </p>
      <ul className="m-0 pl-0 list-none flex flex-col gap-1">
        {[...states].sort().map(s => {
          const info = nexusInfo(s);
          return (
            <li
              key={s}
              data-testid="nexus-threshold-row"
              data-state={s}
              className="text-12 leading-[1.5] text-ink-2"
            >
              <span className="font-semibold text-ink">{stateName(s)} ({s})</span>
              {" — "}
              {info ? (
                <>
                  {info.label}
                  {info.indexed && " (figure adjusts annually)"}
                  {" "}
                  <a
                    href={info.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="nexus-source-link"
                    className="text-brand-red font-semibold hover:underline"
                  >
                    source ↗
                  </a>
                  {info.note && (
                    <span className="text-ink-3"> · {info.note}</span>
                  )}
                </>
              ) : (
                "see the state revenue department for its nexus standard"
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-11 text-ink-3 m-0 mt-2">
        Whether your agency&rsquo;s sales actually cross a state&rsquo;s line
        depends on sourcing rules and your situation — these figures change,
        so confirm with a tax professional before relying on them.
      </p>
    </div>
  );
}
