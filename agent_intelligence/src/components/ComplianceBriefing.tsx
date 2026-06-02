"use client";

import {
  BRIEFING_SECTIONS,
  SALARY_WARNING,
  deriveAnnualFromWeekly,
  isBriefingReady,
  orderedBriefingStates,
  sectionSummary,
  stateName,
} from "@/lib/briefing";

type Props = {
  employeeStates: string[];
  homeState: string;
  employeeCount: number;
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
function SalaryWarningBox({ summary }: { summary: string | null }): React.JSX.Element {
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
        {SALARY_WARNING}
      </div>
    </div>
  );
}

function ReadyBriefing({
  state,
  employeeCount,
}: {
  state: string;
  employeeCount: number;
}): React.JSX.Element {
  return (
    <section
      data-testid="briefing-state"
      data-state={state}
      data-ready="true"
      className="rounded-lg border border-hairline border-line overflow-hidden mb-4"
    >
      <div className="bg-surface-2 border-b border-hairline border-line-2 px-4 py-2.5">
        <h2 className="text-13 font-medium m-0 text-ink">
          {stateName(state)} <span className="text-ink-3 font-normal">· your office briefing</span>
        </h2>
      </div>

      <div className="divide-y divide-line">
        {BRIEFING_SECTIONS.map(sec => {
          const s = sectionSummary(state, sec.topic);
          const grounded = !!(s && s.title && s.summary);
          return (
            <div
              key={sec.key}
              data-testid="briefing-section"
              data-section={sec.key}
              data-grounded={grounded ? "true" : "false"}
              className="px-4 py-3"
            >
              <h3 className="text-13 font-medium m-0 text-ink mb-1">{sec.label}</h3>

              {grounded ? (
                <p className="text-13 text-ink-2 m-0 leading-[1.5]">{s!.summary}</p>
              ) : (
                <p className="text-12 text-ink-3 m-0">
                  Summary coming soon for this topic.
                </p>
              )}

              {/* Prominent per-section "as of" so staleness is visible per
                  number, not just globally. */}
              {grounded && s!.last_checked && (
                <div data-testid="section-asof" className="mt-1.5 text-11 text-ink-3">
                  <span className="font-medium text-ink-2">Figures as of {s!.last_checked}</span>
                  {" "}— confirm current numbers at the source.
                </div>
              )}

              {/* Salary box: the misclassification-risk figure gets a stronger
                  figure-specific warning + the derived annual, instead of a
                  generic size-gate (small/large tiers match in 2026). PFML
                  keeps its size-gate; other sections apply regardless of size. */}
              {sec.salaryRisk ? (
                <SalaryWarningBox summary={grounded ? s!.summary : null} />
              ) : sec.sizeGate ? (
                <div
                  data-testid="size-gate"
                  className="mt-2 rounded-md bg-blue-fill text-blue-text text-12 px-3 py-2 leading-[1.45]"
                >
                  {sec.sizeGate.framing(employeeCount)}
                </div>
              ) : (
                <div className="mt-1.5 text-11 text-ink-3">Applies regardless of company size.</div>
              )}

              {grounded && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-11 text-ink-3">
                  {s!.sources.map(u => (
                    <a
                      key={u}
                      href={u}
                      title={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="briefing-source"
                      className="text-blue-text no-underline hover:underline"
                    >
                      {sourceLabel(u)}
                    </a>
                  ))}
                  {s!.last_checked && <span>· Last checked {s!.last_checked}</span>}
                </div>
              )}
            </div>
          );
        })}
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
      className="rounded-lg border border-hairline border-line px-4 py-3 mb-4"
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
}: Props): React.JSX.Element {
  const ordered = orderedBriefingStates(employeeStates, homeState);

  return (
    <div data-testid="compliance-briefing" className="mb-6">
      {/* LOAD-BEARING framing — not legal/tax advice. Persistent + sticky,
          prominent like Positioning's band; not fine print, not dismissible. */}
      <div
        data-testid="briefing-disclaimer"
        className="sticky top-0 z-10 mb-4 rounded-md bg-amber-fill text-amber-text border border-hairline border-line px-4 py-3 text-13 leading-[1.45]"
      >
        <span className="font-medium">This summarizes what the rules say — verify with a qualified professional.</span>{" "}
        Not legal or tax advice. Figures shown are as of the last update date on each section and may be outdated — confirm current numbers on the official source pages linked below before relying on them.
      </div>

      {ordered.length === 0 ? (
        <div className="text-13 text-ink-3 px-4 py-6 text-center border border-hairline border-line rounded-lg">
          Add your employees&rsquo; work states in your profile to see an office briefing.
        </div>
      ) : (
        ordered.map(state =>
          isBriefingReady(state) ? (
            <ReadyBriefing key={state} state={state} employeeCount={employeeCount} />
          ) : (
            <ComingSoonBriefing key={state} state={state} />
          ),
        )
      )}
    </div>
  );
}
