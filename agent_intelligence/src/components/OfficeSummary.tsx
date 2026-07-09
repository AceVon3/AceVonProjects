"use client";

import Link from "next/link";

import { sectionsForState, stateName } from "@/lib/briefing";
import {
  briefingCoverageLabel,
  briefingSectionAnchorId,
  outOfCoverageEmployeeStates,
  payTypeLabel,
  relevancePointers,
  shouldFlagOutOfStateRemote,
  stateReviews,
} from "@/lib/officeSummary";
import { AgentProfile, needsProfileUpgrade, primaryOffice } from "@/lib/profile";

type Props = {
  profile: AgentProfile;
  // Expand the target briefing accordion section AND scroll to it. Provided by
  // the page (which owns the accordion's expansion state). When present, the
  // relevance links use it instead of a native hash jump — so a link never
  // scrolls to a collapsed row showing nothing.
  onJump?: (anchorId: string) => void;
};

function Fact({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <div className="text-11 uppercase tracking-wider04 text-ink-3 mb-0.5">{label}</div>
      <div className="text-13 text-ink">{value}</div>
    </div>
  );
}

export default function OfficeSummary({ profile, onJump }: Props): React.JSX.Element {
  // Graceful upgrade path: a profile saved before these fields existed lacks
  // pay_type / remote_count. Don't error, don't wipe — prompt to fill them.
  if (needsProfileUpgrade(profile)) {
    return (
      <section
        data-testid="office-summary"
        data-variant="upgrade"
        className="rounded-lg border border-hairline border-line bg-surface px-4 py-4 mb-6"
      >
        <h2 className="text-13 font-medium m-0 text-ink">Finish your office profile</h2>
        <p className="text-13 text-ink-2 m-0 mt-1 leading-[1.5]">
          We added two quick questions — how you pay staff and how many work
          remotely — to tailor this page to your office.{" "}
          <Link
            href="/setup"
            data-testid="office-summary-upgrade-link"
            className="text-blue-text hover:underline font-medium"
          >
            Add them in your profile →
          </Link>
        </p>
      </section>
    );
  }

  const works = profile.employee_states;
  const pointers = relevancePointers(profile);
  const flag = shouldFlagOutOfStateRemote(profile);
  const outStates = outOfCoverageEmployeeStates(profile.employee_states);
  // The primary office is the agency's home state — sourced from offices[0]
  // now that there is no standalone home_state field.
  const primaryState = primaryOffice(profile)?.state ?? "";

  return (
    <section
      data-testid="office-summary"
      data-variant="ready"
      className="rounded-lg border border-hairline border-line overflow-hidden mb-6"
    >
      <div className="bg-surface-2 border-b border-hairline border-line-2 px-4 py-2.5">
        <h2 className="text-13 font-medium m-0 text-ink">Your office at a glance</h2>
      </div>

      {/* Factual recap — the agent's own inputs read back. No legal claims. */}
      <div
        data-testid="office-summary-recap"
        className="px-4 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3"
      >
        <Fact label="Office location" value={stateName(primaryState)} />
        <Fact
          label="Total employees"
          value={`${profile.employee_count} ${profile.employee_count === 1 ? "employee" : "employees"}`}
        />
        <Fact
          label="Working remotely"
          value={
            profile.remote_count === 0
              ? "None"
              : `${profile.remote_count} of ${profile.employee_count}`
          }
        />
        <Fact label="Pay type" value={payTypeLabel(profile.pay_type)} />
        <div className="col-span-2 sm:col-span-4">
          <div className="text-11 uppercase tracking-wider04 text-ink-3 mb-0.5">
            Works in
          </div>
          <div className="text-13 text-ink">
            {works.map(s => `${stateName(s)} (${s})`).join(", ")}
          </div>
        </div>
      </div>

      {/* Relevance-pointing — fact + their numbers, never a determination.
          Points at the sections worth reviewing; the agent draws the
          conclusion. */}
      <div
        data-testid="office-summary-relevance"
        className="border-t border-hairline border-line px-4 py-3.5"
      >
        <h3 className="text-11 uppercase tracking-wider04 text-ink-2 m-0 mb-2">
          Worth reviewing for your office
        </h3>
        <ul className="m-0 pl-0 list-none flex flex-col gap-1.5">
          {pointers.map(pt => {
            // A pointer becomes an in-page link ONLY when its target briefing
            // section actually renders for this profile. briefingSectionAnchorId
            // returns null otherwise — so a link can never point at an absent
            // section, and a no-target pointer (e.g. remote) stays plain text.
            const anchorId = pt.targetSection
              ? briefingSectionAnchorId(profile.employee_states, primaryState, pt.targetSection)
              : null;
            return (
              <li
                key={pt.key}
                data-testid="relevance-pointer"
                data-key={pt.key}
                data-linked={anchorId ? "true" : "false"}
                className="text-13 text-ink-2 leading-[1.5] flex gap-2"
              >
                <span aria-hidden className="text-ink-3 mt-px">·</span>
                {anchorId ? (
                  <a
                    href={`#${anchorId}`}
                    data-testid="relevance-link"
                    data-target={anchorId}
                    // Primary navigation into the briefing: expand the target
                    // accordion section first, THEN scroll — never jump to a
                    // collapsed row. preventDefault stops the native hash jump
                    // (which would land on a collapsed, empty row).
                    onClick={e => {
                      if (onJump) {
                        e.preventDefault();
                        onJump(anchorId);
                      }
                    }}
                    className="text-blue-text hover:underline"
                  >
                    {pt.text}
                  </a>
                ) : (
                  <span>{pt.text}</span>
                )}
              </li>
            );
          })}
        </ul>
        {/* Per-state review blocks (50-state expansion): each employee
            state's own gates and mandates, read against the agent's
            headcount. Same derivation as the briefing sections, so the
            summary can never claim a gate the briefing doesn't render.
            Lines link into the state's own briefing section when it
            renders (expand-then-scroll via onJump, like the pointers). */}
        <div data-testid="state-reviews" className="mt-3.5 flex flex-col gap-2.5">
          {stateReviews(profile.employee_states, primaryState, profile.employee_count).map(sr => (
            <div key={sr.state} data-testid="state-review-block" data-state={sr.state}>
              <div className="text-11 uppercase tracking-wider04 text-ink-3 mb-1">
                {sr.name} ({sr.state})
              </div>
              <ul className="m-0 pl-0 list-none flex flex-col gap-1">
                {sr.lines.map(line => {
                  // Link only when the state actually renders that section.
                  const hasSection = line.targetSection
                    ? sectionsForState(sr.state).some(s => s.key === line.targetSection)
                    : false;
                  const anchorId = hasSection ? `briefing-${sr.state}-${line.targetSection}` : null;
                  return (
                    <li
                      key={line.key}
                      data-testid="state-review-pointer"
                      data-state={sr.state}
                      data-key={line.key}
                      data-linked={anchorId ? "true" : "false"}
                      className="text-13 text-ink-2 leading-[1.5] flex gap-2"
                    >
                      <span aria-hidden className="text-ink-3 mt-px">·</span>
                      {anchorId ? (
                        <a
                          href={`#${anchorId}`}
                          data-testid="state-review-link"
                          data-target={anchorId}
                          onClick={e => {
                            if (onJump) {
                              e.preventDefault();
                              onJump(anchorId);
                            }
                          }}
                          className="text-blue-text hover:underline"
                        >
                          {line.text}
                        </a>
                      ) : (
                        <span>{line.text}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-11 text-ink-3 m-0 mt-2.5">
          These flag what&rsquo;s worth a closer look given your numbers. Whether a
          given rule actually reaches your office depends on the counting rules —
          confirm with a qualified professional before acting.
        </p>
      </div>

      {/* LOAD-BEARING out-of-state remote flag — the honesty safeguard. Made
          prominent (heavier amber border + ⚠ heading) so it can't read as fine
          print: the WA briefing does NOT cover other states' rules. */}
      {flag && (
        <div
          data-testid="remote-out-of-state-flag"
          className="m-4 mt-0 rounded-md bg-amber-fill text-amber-text border-2 border-amber-text px-4 py-3 text-13 leading-[1.5]"
        >
          <div className="font-medium mb-1">⚠ Out-of-state remote workers</div>
          You have remote employees in{" "}
          <span className="font-medium" data-testid="remote-out-of-state-list">
            {outStates.map(s => `${stateName(s)} (${s})`).join(", ")}
          </span>
          {" "}— those workers may be subject to their own states&rsquo; rules,
          which this briefing (currently {briefingCoverageLabel(profile.employee_states)})
          does not cover.
        </div>
      )}
    </section>
  );
}
