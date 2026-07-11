"use client";

import Link from "next/link";

import { sectionsForState, stateName } from "@/lib/briefing";
import {
  briefingCoverageLabel,
  briefingSectionAnchorId,
  outOfCoverageEmployeeStates,
  outOfStateEmployeeStates,
  payTypeLabel,
  relevancePointers,
  shouldFlagOutOfStateRemote,
  shouldShowRegistrationGuide,
  stateReviews,
} from "@/lib/officeSummary";
import {
  NO_WAGE_INCOME_TAX_STATES,
  registrationInfo,
} from "@/lib/stateRegistration";
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
        className="bg-surface border border-card-line rounded-card shadow-card px-5 py-4 mb-6"
      >
        <h2 className="text-14 font-[650] m-0 text-ink">Finish your office profile</h2>
        <p className="text-13 text-ink-2 m-0 mt-1 leading-[1.5]">
          We added two quick questions — how you pay staff and how many work
          remotely — to tailor this page to your office.{" "}
          <Link
            href="/setup"
            data-testid="office-summary-upgrade-link"
            className="text-brand-red hover:underline font-semibold"
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
      className="bg-surface border border-card-line rounded-card shadow-card overflow-hidden mb-6"
    >
      <div className="bg-surface-2 border-b border-line px-6 py-3">
        <h2 className="text-14 font-[650] m-0 text-ink">Your office at a glance</h2>
      </div>

      {/* Factual recap — the agent's own inputs read back. No legal claims. */}
      <div
        data-testid="office-summary-recap"
        className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3"
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
        className="border-t border-line px-6 py-4"
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
                    className="text-brand-red hover:underline"
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
                          className="text-brand-red hover:underline"
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

      {/* Out-of-state remote registration guide (2026-07): renders when the
          agent reported remote workers AND employee states beyond the office
          state. Explains the payroll-registration step software doesn't do,
          with each state's official registration links. Copy stays on the
          pointer side of the determination line ("typically", "generally"). */}
      {shouldShowRegistrationGuide(profile, primaryState) && (
        <div
          data-testid="remote-registration-guide"
          className="m-6 mt-0 rounded-tile bg-amber-fill border-2 border-amber-text px-4 py-3.5"
        >
          <h3 className="text-13 font-semibold text-amber-band m-0 mb-2">
            ⚠ Remote employees out of state — registrations to have in place
          </h3>
          <p className="text-13 text-ink-2 m-0 leading-[1.55]">
            <strong className="text-ink">What &ldquo;nexus&rdquo; means:</strong>{" "}
            nexus is the legal term for having enough presence in a state that
            its taxes and rules reach your business. An employee regularly
            working from a state is one of the strongest ways to create it —
            and <strong className="text-ink">one person is generally
            enough, no matter how small the agency</strong>. Once a state has
            nexus over your agency, it typically expects payroll registrations
            and tax withholding right away, workers&rsquo; comp coverage under
            its rules, and possibly business-tax filings and licensing down
            the line.
          </p>
          <p className="text-13 text-ink-2 mt-2 mb-0 leading-[1.55]">
            <strong className="text-ink">
              The step payroll software does not do for you:
            </strong>{" "}
            programs like QuickBooks can calculate and file another
            state&rsquo;s taxes only <em>after</em> you obtain that
            state&rsquo;s withholding account number and unemployment account
            number from its agencies. Registering is the employer&rsquo;s job,
            typically before the first paycheck from that state — the step
            small employers most often miss. Registration pages for your
            states:
          </p>
          <ul className="m-0 mt-3 pl-0 list-none flex flex-col gap-2">
            {outOfStateEmployeeStates(profile.employee_states, primaryState).map(s => {
              const info = registrationInfo(s);
              const noTax = NO_WAGE_INCOME_TAX_STATES.has(s);
              return (
                <li
                  key={s}
                  data-testid="reg-state-row"
                  data-state={s}
                  className="text-13 leading-[1.5]"
                >
                  <span className="font-semibold text-ink">{stateName(s)} ({s})</span>
                  <span className="text-ink-2">
                    {" — "}
                    {noTax ? (
                      <span data-testid="reg-no-withholding">
                        no state income tax on wages (no withholding account)
                      </span>
                    ) : info?.withholding ? (
                      <a
                        href={info.withholding}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="reg-link"
                        data-kind="withholding"
                        className="text-brand-red font-semibold hover:underline"
                      >
                        withholding account ↗
                      </a>
                    ) : (
                      "withholding account: see the state revenue department"
                    )}
                    {" · "}
                    {info?.unemployment ? (
                      <a
                        href={info.unemployment}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="reg-link"
                        data-kind="unemployment"
                        className="text-brand-red font-semibold hover:underline"
                      >
                        unemployment account ↗
                      </a>
                    ) : (
                      "unemployment account: see the state workforce agency"
                    )}
                    {info?.combined && (
                      <>
                        {" · "}
                        <a
                          href={info.combined}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="reg-link"
                          data-kind="combined"
                          className="text-brand-red font-semibold hover:underline"
                        >
                          one-stop registration portal ↗
                        </a>
                      </>
                    )}
                  </span>
                  {info?.note && (
                    <div className="text-11 text-ink-3 mt-0.5">{info.note}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-11 text-ink-3 m-0 mt-2.5">
            Whether a specific worker triggers a specific registration depends
            on the state&rsquo;s rules and your situation — confirm with your
            payroll provider or a tax professional. Workers&rsquo; comp
            coverage and any state retirement/paid-leave mandates are separate
            from these two accounts.
          </p>
        </div>
      )}

      {/* LOAD-BEARING out-of-state remote flag — the honesty safeguard. Made
          prominent (heavier amber border + ⚠ heading) so it can't read as fine
          print: the WA briefing does NOT cover other states' rules. */}
      {flag && (
        <div
          data-testid="remote-out-of-state-flag"
          className="m-6 mt-0 rounded-tile bg-amber-fill text-amber-band border-2 border-amber-text px-4 py-3 text-13 leading-[1.5]"
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
