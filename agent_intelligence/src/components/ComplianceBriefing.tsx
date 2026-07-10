"use client";

import {
  BriefingSectionDef,
  deriveAnnualFromWeekly,
  isBriefingReady,
  orderedBriefingStates,
  salaryWarningForState,
  sectionSummary,
  sectionsForState,
  stateName,
} from "@/lib/briefing";

type Props = {
  employeeStates: string[];
  homeState: string;
  employeeCount: number;
  // Controlled accordion state (lifted to the page so the office-summary
  // "Worth reviewing" links can expand a section before scrolling to it).
  // Keyed by section element id (`briefing-{state}-{key}`).
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
};

// Distinguishing source label: domain + the final path segment, so multiple
// links on the same domain (e.g. three dor.wa.gov pages) read as clearly
// different pages instead of three identical "dor.wa.gov" labels. The full URL
// is on the anchor's href + title.
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

// Salary box (Tier-2 disclaimer): the derived annual + the strong inline
// misclassification warning. The annual is computed from the weekly figure in
// the grounded summary (× 52), so it ties exactly and never prints a yearly
// number that doesn't reconcile to the weekly.
function SalaryWarningBox({
  summary,
  warning,
}: {
  summary: string | null;
  warning: string;
}): React.JSX.Element {
  const d = deriveAnnualFromWeekly(summary);
  return (
    <div
      data-testid="salary-warning"
      className="mt-2 rounded-md bg-amber-fill text-amber-text border border-hairline border-line px-3 py-2.5 text-12 leading-[1.45]"
    >
      {d && (
        <div
          data-testid="salary-annual"
          data-weekly={d.weekly}
          data-annual={d.annual}
          className="mb-1.5"
        >
          <span className="font-medium">Annual equivalent ≈ {d.annual}/year</span>{" "}
          — derived as {d.weekly} × 52 weeks (a convenience figure, not a separately published number).
        </div>
      )}
      <div>
        <span className="font-medium">⚠ </span>
        {warning}
      </div>
    </div>
  );
}

// One accordion item: a clickable title row (proper button, aria-expanded,
// keyboard-operable) with a chevron and — for the salary section — a small
// caution pill that stays visible on the COLLAPSED header. The full content
// (including the misclassification warning) lives in the collapsible region.
function BriefingAccordionItem({
  state,
  sec,
  employeeCount,
  salaryWarning,
  isOpen,
  onToggle,
}: {
  state: string;
  sec: BriefingSectionDef;
  employeeCount: number;
  salaryWarning: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
}): React.JSX.Element {
  const id = `briefing-${state}-${sec.key}`;
  const contentId = `${id}-content`;
  const headerId = `${id}-header`;
  const s = sectionSummary(state, sec.topic);
  const grounded = !!(s && s.title && s.summary);

  return (
    <div
      // Anchor target for the office-summary relevance links. Must match
      // briefingSectionAnchorId(). scroll-mt clears the sticky
      // "not legal/tax advice" band so a jump lands fully below it.
      id={id}
      data-testid="briefing-section"
      data-section={sec.key}
      data-grounded={grounded ? "true" : "false"}
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
            <span className="text-15 font-[650] text-ink">{sec.label}</span>
            {sec.salaryRisk && (
              <span
                data-testid="salary-caution-pill"
                className="inline-flex items-center gap-1 text-10 font-semibold rounded-full px-2 py-0.5 bg-amber-fill text-amber-text"
              >
                <i className="ti ti-alert-triangle text-11" aria-hidden />
                affects exempt status
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
        {grounded ? (
          <p className="text-[13.5px] text-ink-mid m-0 leading-[1.65]">{s!.summary}</p>
        ) : (
          <p className="text-12 text-ink-3 m-0">Summary coming soon for this topic.</p>
        )}

        {/* Prominent per-section "as of" so staleness is visible per number. */}
        {grounded && s!.last_checked && (
          <div data-testid="section-asof" className="mt-2 text-12 text-ink-3">
            <span className="font-bold text-ink-mid">Figures as of {s!.last_checked}</span>
            {" "}— confirm current numbers at the source.
          </div>
        )}

        {/* Salary box: the misclassification-risk figure gets a stronger
            figure-specific warning + the derived annual, instead of a generic
            size-gate. PFML keeps its size-gate; others apply regardless —
            except sections that opt out (hideSizeNote), e.g. the federal-default
            leave section whose summary already explains the FMLA size gate. The
            generic "applies regardless of size" note shows ONLY on grounded
            sections: a coming-soon section has no content, so it must not carry
            a size-applicability claim it hasn't actually grounded. */}
        {sec.salaryRisk ? (
          <SalaryWarningBox summary={grounded ? s!.summary : null} warning={salaryWarning} />
        ) : sec.sizeGate ? (
          <div
            data-testid="size-gate"
            className="mt-2 rounded-md bg-blue-fill text-blue-text text-12 px-3 py-2 leading-[1.45]"
          >
            {sec.sizeGate.framing(employeeCount)}
          </div>
        ) : grounded && !sec.hideSizeNote ? (
          <div className="mt-1.5 text-11 text-ink-3">Applies regardless of company size.</div>
        ) : null}

        {grounded && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-12 text-ink-3">
            {s!.sources.map(u => (
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
            {s!.last_checked && <span>· Last checked {s!.last_checked}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function ReadyBriefing({
  state,
  employeeCount,
  expanded,
  onToggle,
}: {
  state: string;
  employeeCount: number;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}): React.JSX.Element {
  // Only the sections that apply to THIS state, in its declared order.
  const sections = sectionsForState(state);
  const salaryWarning = salaryWarningForState(state);
  return (
    <section
      data-testid="briefing-state"
      data-state={state}
      data-ready="true"
      className="bg-surface border border-card-line rounded-card shadow-card overflow-hidden mb-4"
    >
      <div className="bg-surface-2 border-b border-line px-6 py-3">
        <h2 className="text-14 font-bold m-0 text-ink">
          {stateName(state)} <span className="text-ink-3 font-normal">· your office briefing</span>
        </h2>
      </div>

      <div className="divide-y divide-line">
        {sections.map(sec => (
          <BriefingAccordionItem
            key={sec.key}
            state={state}
            sec={sec}
            employeeCount={employeeCount}
            salaryWarning={salaryWarning}
            isOpen={!!expanded[`briefing-${state}-${sec.key}`]}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}

function ComingSoonBriefing({ state }: { state: string }): React.JSX.Element {
  return (
    <section
      data-testid="briefing-state"
      data-state={state}
      data-ready="false"
      className="bg-surface border border-card-line rounded-card shadow-card px-6 py-3.5 mb-4"
    >
      <h2 className="text-13 font-medium m-0 text-ink">{stateName(state)}</h2>
      <p className="text-12 text-ink-3 m-0 mt-1">
        Briefing for {stateName(state)} is coming soon — we&rsquo;re building state briefings,
        starting with Washington.
      </p>
    </section>
  );
}

export default function ComplianceBriefing({
  employeeStates,
  homeState,
  employeeCount,
  expanded,
  onToggle,
}: Props): React.JSX.Element {
  const ordered = orderedBriefingStates(employeeStates, homeState);

  return (
    <div data-testid="compliance-briefing" className="mb-6">
      {/* LOAD-BEARING framing — not legal/tax advice. Persistent + sticky,
          prominent like Positioning's band; never collapsible, not dismissible. */}
      <div
        data-testid="briefing-disclaimer"
        className="sticky top-0 z-10 mb-4 rounded-tile bg-amber-fill text-amber-band border border-amber-border px-[18px] py-3 text-13 leading-[1.5]"
      >
        <span className="font-bold">This summarizes what the rules say — verify with a qualified professional.</span>{" "}
        Not legal or tax advice. Figures shown are as of the last update date on each section and may be outdated — confirm current numbers on the official source pages linked below before relying on them.
      </div>

      {ordered.length === 0 ? (
        <div className="text-13 text-ink-3 px-4 py-6 text-center border border-hairline border-line rounded-lg">
          Add your employees&rsquo; work states in your profile to see an office briefing.
        </div>
      ) : (
        ordered.map(state =>
          isBriefingReady(state) ? (
            <ReadyBriefing
              key={state}
              state={state}
              employeeCount={employeeCount}
              expanded={expanded}
              onToggle={onToggle}
            />
          ) : (
            <ComingSoonBriefing key={state} state={state} />
          ),
        )
      )}
    </div>
  );
}
