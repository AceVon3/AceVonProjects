"use client";

import { stateName } from "@/lib/briefing";
import {
  MANDATE_STATUS_LABEL,
  MandateStatus,
  retirementMandateInfo,
  retirementSizeLine,
} from "@/lib/retirementMandates";

// /compliance section: the state retirement-plan mandate for the agency's
// PRIMARY OFFICE STATE only (product decision 2026-09-16). States the
// program, its employee-count line read against the agent's headcount, the
// qualified-plan exemption, deadlines, and the penalty schedule — all
// relevance-pointing, never a determination ("you must register").

const STATUS_CLASS: Record<MandateStatus, string> = {
  "mandate-live": "bg-red-fill text-red-text",
  "mandate-pending": "bg-amber-fill text-amber-text",
  voluntary: "bg-blue-fill text-blue-text",
  none: "bg-gray-fill text-gray-text",
};

// "https://www.calsavers.com/home/faq.html" → "calsavers.com/…/faq.html"
function sourceLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length === 0) return host;
    const last = segs[segs.length - 1];
    return segs.length > 1 ? `${host}/…/${last}` : `${host}/${last}`;
  } catch {
    return url;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-x-4 gap-y-0.5">
      <div className="text-11 uppercase tracking-wider04 text-ink-3 pt-0.5">{label}</div>
      <div className="text-13 text-ink-2 leading-[1.55]">{children}</div>
    </div>
  );
}

export default function RetirementMandatePanel({
  state,
  employeeCount,
}: {
  state: string;
  employeeCount: number;
}): React.JSX.Element | null {
  if (!state) return null;
  const info = retirementMandateInfo(state);
  const name = stateName(state);

  return (
    <section
      data-testid="retirement-mandate"
      data-state={state}
      data-status={info?.status ?? "unknown"}
      className="bg-surface border border-card-line rounded-card shadow-card overflow-hidden mb-6"
    >
      <div className="bg-surface-2 border-b border-line px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-14 font-[650] m-0 text-ink">
          State retirement plan mandate{" "}
          <span className="text-ink-3 font-normal">· {name} (your office state)</span>
        </h2>
        {info && (
          <span
            data-testid="retirement-status"
            className={`${STATUS_CLASS[info.status]} text-11 px-2.5 py-0.5 rounded-full font-semibold`}
          >
            {MANDATE_STATUS_LABEL[info.status]}
          </span>
        )}
      </div>

      <div className="px-6 py-4">
        {!info ? (
          <p className="text-13 text-ink-3 m-0">
            We haven&rsquo;t verified {name}&rsquo;s retirement-mandate rules yet —
            check with the state treasurer&rsquo;s office.
          </p>
        ) : (
          <>
            <p className="text-[13.5px] text-ink-mid m-0 leading-[1.65]">{info.summary}</p>

            {/* Size line — the agent's headcount read against the state's
                employee-count line, in the briefing's size-gate voice. */}
            {(() => {
              const line = retirementSizeLine(state, employeeCount);
              return line ? (
                <div
                  data-testid="retirement-size-line"
                  className="mt-2.5 rounded-md bg-blue-fill text-blue-text text-12 px-3 py-2 leading-[1.45]"
                >
                  {line}
                </div>
              ) : null;
            })()}

            <div className="mt-3.5 flex flex-col gap-2.5">
              {info.program && info.status !== "none" && (
                <Row label="Program">{info.program}</Row>
              )}
              {info.threshold !== null ? (
                <Row label="Employee line">
                  {info.threshold === 1
                    ? "From the first employee"
                    : `${info.threshold} or more employees`}
                  {info.counting && <span className="text-ink-3"> · {info.counting}</span>}
                </Row>
              ) : info.counting ? (
                // Non-headcount test (WA's 10,400 combined hours): the
                // counting text IS the line.
                <Row label="Employee line">{info.counting}</Row>
              ) : null}
              {info.conditions && <Row label="Other conditions">{info.conditions}</Row>}
              {info.exemption && <Row label="Exempt if">{info.exemption}</Row>}
              {info.deadlines && <Row label="Deadlines">{info.deadlines}</Row>}
              {info.penalties && (
                <Row label="Penalties">
                  <span data-testid="retirement-penalties">{info.penalties}</span>
                </Row>
              )}
              {info.note && (
                <Row label="Note">
                  <span className="text-ink-3">{info.note}</span>
                </Row>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-12 text-ink-3">
              {info.sources.map(u => (
                <a
                  key={u}
                  href={u}
                  title={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="retirement-source"
                  className="text-brand-red font-semibold no-underline hover:underline"
                >
                  {sourceLabel(u)}
                </a>
              ))}
              <span>· Verified {info.verified}</span>
            </div>
          </>
        )}

        <p className="text-11 text-ink-3 m-0 mt-3">
          Whether the mandate actually reaches your agency depends on the
          state&rsquo;s counting rules, your plan status, and timing — these
          rules are still phasing in across states, so confirm with a
          qualified professional or the program before acting.
        </p>
      </div>
    </section>
  );
}
