"use client";

import { stateName } from "@/lib/briefing";
import {
  MANDATE_STATUS_LABEL,
  MandateStatus,
  retirementMandateInfo,
  retirementSizeLine,
} from "@/lib/retirementMandates";

// Office-briefing accordion row for the state retirement-plan mandate
// (auto-IRA / Secure Choice). Renders ONLY inside the primary office state's
// briefing (product decision 2026-09-16). Same header/toggle anatomy as the
// grounded sections so it reads as one of them, but its content is verified
// product copy (retirementMandates.ts), not a generated summary — so it
// carries a "Verified" date instead of an AI-summary "as of".
//
// Content order answers the four questions in turn: what the rule is,
// whether it reaches an office this size (relevance-pointing, never a
// determination), when it takes effect / deadlines, and the penalties.

const PILL_CLASS: Record<MandateStatus, string> = {
  "mandate-live": "bg-red-fill text-red-text",
  "mandate-pending": "bg-amber-fill text-amber-text",
  voluntary: "bg-blue-fill text-blue-text",
  none: "bg-gray-fill text-gray-text",
};

const PILL_SHORT: Record<MandateStatus, string> = {
  "mandate-live": "in effect",
  "mandate-pending": "scheduled",
  voluntary: "voluntary",
  none: "no mandate",
};

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

function Block({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div data-testid={testId}>
      <div className="text-11 uppercase tracking-wider04 font-semibold text-ink-2 mb-1">{label}</div>
      <div className="text-[13.5px] text-ink-mid leading-[1.6]">{children}</div>
    </div>
  );
}

export const RETIREMENT_SECTION_KEY = "retirement";

export default function RetirementBriefingSection({
  state,
  employeeCount,
  multiOffice = false,
  isOpen,
  onToggle,
}: {
  state: string;
  employeeCount: number;
  // Offices in more than one state → the headcount line words the total as
  // split across offices and points at the in-state count.
  multiOffice?: boolean;
  isOpen: boolean;
  onToggle: (id: string) => void;
}): React.JSX.Element {
  const id = `briefing-${state}-${RETIREMENT_SECTION_KEY}`;
  const contentId = `${id}-content`;
  const headerId = `${id}-header`;
  const info = retirementMandateInfo(state);
  const status: MandateStatus | "unknown" = info?.status ?? "unknown";
  const isMandate = status === "mandate-live" || status === "mandate-pending";
  const sizeLine = retirementSizeLine(state, employeeCount, multiOffice);
  const name = stateName(state);

  return (
    <div
      id={id}
      data-testid="briefing-section"
      data-section={RETIREMENT_SECTION_KEY}
      data-grounded={info ? "true" : "false"}
      data-status={status}
      data-expanded={isOpen ? "true" : "false"}
      className="scroll-mt-[88px]"
    >
      <h3 className="m-0">
        <button
          id={headerId}
          type="button"
          data-testid="briefing-section-toggle"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => onToggle(id)}
          className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left cursor-pointer bg-transparent border-none hover:bg-surface-2 transition-colors"
        >
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-15 font-[650] text-ink">Retirement plan mandate</span>
            {/* New-category marker (added 2026-09): stays on the COLLAPSED
                header so the row reads as new before anyone expands it. */}
            <span
              data-testid="retirement-new-pill"
              className="inline-flex items-center text-10 font-bold uppercase tracking-wider04 rounded-full px-2 py-0.5 bg-green-fill text-green-text"
            >
              New
            </span>
            {info && (
              <span
                data-testid="retirement-status-pill"
                className={`inline-flex items-center gap-1 text-10 font-semibold rounded-full px-2 py-0.5 ${PILL_CLASS[info.status]}`}
              >
                {PILL_SHORT[info.status]}
              </span>
            )}
          </span>
          <i
            aria-hidden
            className={`ti ti-chevron-down text-15 text-ink-2 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </h3>

      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        data-testid="briefing-section-content"
        hidden={!isOpen}
        className="px-6 pb-4 pt-0"
      >
        {!info ? (
          <p className="text-12 text-ink-3 m-0">
            We haven&rsquo;t verified {name}&rsquo;s retirement-mandate rules yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {/* 1. What the rule is */}
            <Block label="The rule" testId="retirement-rule">
              <span
                data-testid="retirement-status"
                className={`inline-block mr-2 mb-1 text-11 font-semibold rounded-full px-2.5 py-0.5 ${PILL_CLASS[info.status]}`}
              >
                {MANDATE_STATUS_LABEL[info.status]}
              </span>
              <p className="m-0">{info.summary}</p>
              {info.exemption && (
                <p className="m-0 mt-1.5 text-13 text-ink-2">
                  <span className="font-semibold text-ink">Exempt if:</span> {info.exemption}
                </p>
              )}
              {info.conditions && (
                <p className="m-0 mt-1 text-13 text-ink-2">
                  <span className="font-semibold text-ink">Other conditions:</span> {info.conditions}
                </p>
              )}
            </Block>

            {/* 2. Does it reach an office this size? — relevance-pointing in
                the size-gate voice (N vs the state's line), never "you must". */}
            <Block label="Your office size" testId="retirement-size">
              {sizeLine ? (
                <div
                  data-testid="retirement-size-line"
                  className="rounded-md bg-blue-fill text-blue-text text-12 px-3 py-2 leading-[1.45]"
                >
                  {sizeLine}
                  {info.counting && (
                    <span className="block mt-1 text-blue-text/80">How the state counts: {info.counting}.</span>
                  )}
                </div>
              ) : isMandate && info.counting ? (
                <div
                  data-testid="retirement-size-line"
                  className="rounded-md bg-blue-fill text-blue-text text-12 px-3 py-2 leading-[1.45]"
                >
                  {info.program} uses {info.counting}. You have{" "}
                  {employeeCount} {employeeCount === 1 ? "employee" : "employees"}
                  {multiOffice ? " across your offices" : ""}; where that sits against the hours
                  test depends on {multiOffice ? `your ${name} staff's` : "your staff's"} schedules
                  — verify your obligation.
                </div>
              ) : (
                <p className="m-0 text-13 text-ink-2">
                  {status === "voluntary"
                    ? `No employee line — ${info.program} is optional for employers of any size.`
                    : `No employee line — ${name} has no mandate, so office size does not create an obligation.`}
                </p>
              )}
            </Block>

            {/* 3. When it takes effect / deadlines */}
            <Block
              label={status === "mandate-pending" ? "When it becomes a rule" : "Timing & deadlines"}
              testId="retirement-timing"
            >
              {status === "mandate-pending" ? (
                <p className="m-0">
                  <span className="font-semibold text-ink">Scheduled, not yet in effect.</span>{" "}
                  {info.deadlines ?? "The program's launch date has not been set."}
                </p>
              ) : status === "mandate-live" ? (
                <p className="m-0">{info.deadlines ?? "See the program for the current registration schedule."}</p>
              ) : status === "voluntary" ? (
                <p className="m-0 text-13 text-ink-2">
                  Nothing is scheduled to become mandatory.{" "}
                  {info.conditions ? "" : "The program is optional."}
                </p>
              ) : (
                <p className="m-0 text-13 text-ink-2">Nothing is scheduled to take effect.</p>
              )}
            </Block>

            {/* 4. Penalties */}
            <Block label="Penalties for not complying" testId="retirement-penalties">
              <p className="m-0">{info.penalties ?? "Not published."}</p>
            </Block>

            {info.note && (
              <p className="m-0 text-12 text-ink-3">
                <span className="font-semibold">Note:</span> {info.note}
              </p>
            )}

            <div data-testid="section-asof" className="text-12 text-ink-3">
              <span className="font-bold text-ink-mid">Verified {info.verified}</span>
              {" "}— against the official sources below.{" "}
              {isMandate
                ? "These rules are still phasing in, so confirm current figures at the source."
                : "Legislatures revisit this every session, so confirm at the source."}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-12 text-ink-3">
              {info.sources.map(u => (
                <a
                  key={u}
                  href={u}
                  title={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="briefing-source"
                  className="text-brand-red font-semibold no-underline hover:underline"
                >
                  {sourceLabel(u)}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
