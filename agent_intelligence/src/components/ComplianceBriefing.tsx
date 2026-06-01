"use client";

import {
  BRIEFING_SECTIONS,
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

function bareDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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

              {/* Team-size framing — surfaces the threshold and where N sits,
                  never a determination. Non-gated sections say so plainly. */}
              {sec.sizeGate ? (
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
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="briefing-source"
                      className="text-blue-text no-underline hover:underline"
                    >
                      {bareDomain(u)}
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
        Not legal or tax advice. Figures change; confirm current thresholds and amounts on the official source pages.
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
