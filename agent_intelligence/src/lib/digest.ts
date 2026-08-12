// Monthly email digest — per-profile data assembly + email-safe HTML.
//
// Reuses the SAME query builders the app pages use (getMyCarriersFilings /
// getProspectFilings / getDefendFilings) so the email's numbers always
// reconcile with what the user sees when they click through. Scope rules
// mirror the app: rate sections use licensed_states via the profile passed
// to the query builders; the HR section uses employee_states via the same
// stateReviewLines() the compliance office summary renders.
//
// Window (user decision 2026-08-11): "both" — filings that took effect in
// the ~month before the send date PLUS filings with future effective dates
// ("coming up"), bucketed separately. Anchored to the send-run date, not
// the data as-of, so a monthly cron naturally rolls the window.
//
// Email HTML constraints: table layout, inline styles only, no external
// assets, 600px column, light theme (email clients ignore prefers-color).

import {
  getDefendFilings,
  getMyCarriersFilings,
  getProspectFilings,
  type AgentProfile,
} from "./filings";
import { stateReviewLines } from "./briefing";
import { stateName } from "./briefing";
import { cleanSubtypeLabel } from "./subtypes";
import { COMPLIANCE_SUMMARIES, type ComplianceSummary } from "./complianceData";
import { getDataAsOf } from "./db";

export type DigestProfile = {
  agent: AgentProfile;
  employee_count: number;
  employee_states: string[];
  first_name?: string;
  // Office-at-a-glance fields (all optional — the summary strip renders
  // whatever is present; matches src/lib/profile.ts field names).
  office_state?: string;   // offices[0].state — the agency's home state
  remote_count?: number;   // 0..employee_count
  pay_type?: "hourly" | "salary" | "both";
};

type Row = {
  brand: string;
  state: string;
  line_of_business: string;
  sub_type: string | null;
  overall_rate_impact: number;
  effective_date: string;
  total_policyholders: number | null;
};

// --- compliance change surfacing --------------------------------------------
//
// Two honest signals, no law-change detection required:
//  - SCHEDULED: the generated summaries frequently state future-dated steps
//    verbatim ("minimum wage rises to $14.00 per hour on July 1, 2026").
//    We extract sentences containing a date AFTER the run anchor.
//  - UPDATED: the monthly cron persists a snapshot of the summaries at each
//    send; entries whose text changed since the prior snapshot are called
//    out. First send has no prior snapshot -> section simply absent.

export type ComplianceSnapshot = Record<string, { summary: string | null; last_checked: string }>;

export function complianceSnapshot(states: string[]): ComplianceSnapshot {
  const out: ComplianceSnapshot = {};
  for (const c of COMPLIANCE_SUMMARIES) {
    if (!states.includes(c.state)) continue;
    out[`${c.state}|${c.topic}`] = { summary: c.summary, last_checked: c.last_checked };
  }
  return out;
}

const MONTHS: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7,
  August: 8, September: 9, October: 10, November: 11, December: 12,
};
const DATE_RE = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})/g;

function futureDatedSentences(c: ComplianceSummary, anchor: string): string[] {
  if (!c.summary) return [];
  const out: string[] = [];
  // crude but reliable sentence split for the generated prose
  for (const sent of c.summary.split(/(?<=\.)\s+/)) {
    let hasFuture = false;
    const re = new RegExp(DATE_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(sent)) !== null) {
      const iso = `${m[3]}-${String(MONTHS[m[1]]).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
      if (iso > anchor) { hasFuture = true; break; }
    }
    if (hasFuture) out.push(sent.trim());
  }
  return out;
}

export type Digest = {
  subject: string;
  html: string;
  counts: { mine: number; competitors: number; hrStates: number };
};

const APP_URL = "https://agencyman.ai";

// --- date helpers (all YYYY-MM-DD string math, no Date-locale traps) --------

function isoDaysAgo(anchor: string, days: number): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function monthLabel(anchor: string): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

// --- formatting -------------------------------------------------------------

function fmtImpact(v: number): string {
  const s = v > 0 ? "+" : "";
  return `${s}${v.toFixed(1)}%`;
}

function fmtPh(v: number | null): string {
  if (v == null) return "";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M policyholders`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k policyholders`;
  return `${v} policyholders`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- row rendering ----------------------------------------------------------
//
// Visual language matched to the app's "Recent signals" cards (user request
// 2026-08-12): white rounded cards floating on the gray canvas, a colored
// accent stripe per row, bold brand + muted detail line, right-aligned
// impact beside a labeled pill (PROSPECT/DEFEND for competitors, RAISED/CUT
// for own carriers). Raises read red, cuts read BLUE (the site's defend
// blue — not green), matching the site exactly.

const INK = "#1a1d21";
const INK2 = "#4b5563";
const INK3 = "#8a919c";
const LINE = "#e6e9ef";
const RED = "#c02617";
const BLUE = "#1b6ca8";
const CANVAS = "#f1f3f7";
const FONT = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

// Pill + stripe treatment per section kind, mirroring the site's signal
// chips: PROSPECT/RAISED = red family, DEFEND/CUT = blue family.
type Kind = { stripe: string; pillBg: string; pillFg: string; pill: string };
const KIND_RAISED: Kind = { stripe: RED, pillBg: "#fdecea", pillFg: "#b3261a", pill: "RAISED" };
const KIND_CUT: Kind = { stripe: BLUE, pillBg: "#e5f0fa", pillFg: BLUE, pill: "CUT" };
const KIND_PROSPECT: Kind = { ...KIND_RAISED, pill: "PROSPECT" };
const KIND_DEFEND: Kind = { ...KIND_CUT, pill: "DEFEND" };

function eyebrow(text: string): string {
  return `
      <div style="font:700 10.5px/1 ${FONT};color:${INK3};letter-spacing:.09em;text-transform:uppercase;padding:0 2px 7px;">
        ${text}
      </div>`;
}

function card(inner: string): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;">
        ${inner}
      </table>`;
}

function rowHtml(f: Row, kind: Kind, last: boolean): string {
  const color = f.overall_rate_impact > 0 ? RED : f.overall_rate_impact < 0 ? BLUE : INK;
  const ph = fmtPh(f.total_policyholders);
  const sub = f.sub_type ? cleanSubtypeLabel(f.sub_type) : "";
  const bb = last ? "" : `border-bottom:1px solid ${LINE};`;
  return `
        <tr>
          <td width="4" style="background:${kind.stripe};font-size:0;line-height:0;${last ? "border-radius:0 0 0 11px;" : ""}">&nbsp;</td>
          <td style="padding:13px 14px;${bb}">
            <div style="font:650 14px/1.4 ${FONT};color:${INK};">${esc(f.brand)}</div>
            <div style="font:400 12px/1.5 ${FONT};color:${INK2};">
              ${esc(f.line_of_business)} · ${esc(f.state)}${sub ? ` · ${esc(sub)}` : ""} · effective ${fmtDate(f.effective_date)}${ph ? ` · ${ph}` : ""}
            </div>
          </td>
          <td align="right" style="padding:13px 16px 13px 8px;${bb}vertical-align:middle;white-space:nowrap;">
            <span style="font:700 15px/1 ${FONT};color:${color};">${fmtImpact(f.overall_rate_impact)}</span>
            <span style="display:inline-block;margin-left:9px;font:700 10px/1.7 ${FONT};color:${kind.pillFg};background:${kind.pillBg};border-radius:11px;padding:1px 9px;letter-spacing:.06em;vertical-align:1px;">
              ${kind.pill}
            </span>
          </td>
        </tr>`;
}

function sectionHtml(title: string, intro: string, rows: Row[], cap: number, appPath: string, kind: Kind): string {
  if (rows.length === 0) return "";
  const shown = rows.slice(0, cap);
  const more = rows.length - shown.length;
  return `
    <tr><td style="padding:26px 0 0;">
      ${eyebrow(`${esc(title)} · ${rows.length} filing${rows.length === 1 ? "" : "s"}`)}
      ${card(shown.map((f, i) => rowHtml(f, kind, i === shown.length - 1)).join(""))}
      <div style="font:400 12px/1.6 ${FONT};color:${INK3};padding:7px 2px 0;">
        ${esc(intro)}${more > 0
          ? ` &nbsp;+ ${more} more in the app: <a href="${APP_URL}${appPath}" style="color:${BLUE};">${APP_URL.replace("https://", "")}${appPath}</a>`
          : ""}
      </div>
    </td></tr>`;
}

// --- assembly ---------------------------------------------------------------

export type DigestOpts = {
  runDate?: string;
  // Prior month's complianceSnapshot() — enables the "Updated" HR callouts.
  priorCompliance?: ComplianceSnapshot;
};

export function buildDigest(p: DigestProfile, opts: DigestOpts = {}): Digest {
  const asOf = getDataAsOf();
  const anchor = opts.runDate ?? asOf;
  const monthStart = isoDaysAgo(anchor, 31);

  const inWindow = (f: Row) => f.effective_date >= monthStart; // last month + future
  const justHit = (f: Row) => f.effective_date >= monthStart && f.effective_date <= anchor;
  const upcoming = (f: Row) => f.effective_date > anchor;

  // In the app, an independent's Prospect/Defend tables show ALL brands with
  // a "Mine" pill on their own. In the email, own-brand rows already live in
  // the "Your carriers" sections — repeating them under "Competitors" reads
  // as a duplicate — so the competitor sections exclude authorized brands.
  const notMine = (f: Row) => !p.agent.authorized_brands.includes(f.brand as never);
  const mine = (getMyCarriersFilings(p.agent) as unknown as Row[]).filter(inWindow);
  const prospect = (getProspectFilings(p.agent) as unknown as Row[]).filter(inWindow).filter(notMine);
  const defend = (getDefendFilings(p.agent) as unknown as Row[]).filter(inWindow).filter(notMine);

  // Own-carrier sections carry EVERY rate change in the window (user decision
  // 2026-08-11) — not just the app's alert thresholds. An agent wants to know
  // their carrier moved at all; the competitor sections keep the app's
  // prospect/defend thresholds. Zero-impact filings (rate-neutral refilings)
  // are counted in a footnote rather than listed as rows.
  const mineRaises = mine.filter(f => f.overall_rate_impact > 0);
  const mineCuts = mine.filter(f => f.overall_rate_impact < 0);
  const mineNeutral = mine.filter(f => f.overall_rate_impact === 0).length;

  const byMagnitude = (a: Row, b: Row) => Math.abs(b.overall_rate_impact) - Math.abs(a.overall_rate_impact);
  [mineRaises, mineCuts, prospect, defend].forEach(a => a.sort(byMagnitude));

  // HR per-state blocks: updated-since-last-send + scheduled future-dated
  // steps + the standing review lines. A state renders if it has ANY of the
  // three.
  const topicTitle = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const hr = p.employee_states
    .map(s => {
      const summaries = COMPLIANCE_SUMMARIES.filter(c => c.state === s);
      const updated = opts.priorCompliance
        ? summaries.filter(c => {
            const prior = opts.priorCompliance![`${c.state}|${c.topic}`];
            return prior && c.summary && prior.summary !== c.summary;
          }).map(c => ({ topic: topicTitle(c.topic), title: c.title ?? topicTitle(c.topic), checked: c.last_checked }))
        : [];
      const scheduled = summaries
        .flatMap(c => futureDatedSentences(c, anchor).map(sent => ({ topic: topicTitle(c.topic), sent })))
        .slice(0, 4);
      return {
        state: s,
        name: stateName(s),
        updated,
        scheduled,
        lines: stateReviewLines(s, p.employee_count),
      };
    })
    .filter(x => x.lines.length > 0 || x.updated.length > 0 || x.scheduled.length > 0);

  const competitorsN = prospect.length + defend.length;
  const mineN = mineRaises.length + mineCuts.length;

  const hi = p.first_name ? `Hi ${esc(p.first_name)} —` : "Hi —";
  const states = p.agent.licensed_states.join(", ");

  // "Your office at a glance" strip — the same facts the compliance page
  // leads with, so the email opens grounded in THEIR office, not generic.
  const glanceFacts: Array<[string, string]> = [];
  if (p.office_state) glanceFacts.push(["Office", stateName(p.office_state)]);
  glanceFacts.push([
    p.agent.agent_type === "captive" ? "Brand" : "Carriers",
    p.agent.agent_type === "captive"
      ? p.agent.authorized_brands[0]
      : `${p.agent.authorized_brands.length} — ${p.agent.authorized_brands.join(", ")}`,
  ]);
  glanceFacts.push([
    "Team",
    `${p.employee_count} employee${p.employee_count === 1 ? "" : "s"}` +
      (p.remote_count ? `, ${p.remote_count} remote` : ""),
  ]);
  glanceFacts.push(["Sells in", p.agent.licensed_states.join(", ")]);
  glanceFacts.push(["Team works in", p.employee_states.join(", ")]);
  const glanceHtml = `
  <div style="padding-top:20px;">
  <div style="font:700 10.5px/1 ${FONT};color:${INK3};letter-spacing:.09em;text-transform:uppercase;padding:0 2px 7px;">Your office at a glance</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;">
    <tr><td style="padding:13px 16px;">
      ${glanceFacts.map(([k, v]) => `
      <div style="padding:2px 0;">
        <span style="display:inline-block;min-width:112px;font:700 10px/1.8 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK3};letter-spacing:.07em;text-transform:uppercase;vertical-align:top;">${esc(k)}</span>
        <span style="font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};">${esc(v)}</span>
      </div>`).join("")}
    </td></tr>
  </table>
  </div>`;

  const buckets = (rows: Row[]) => {
    const hit = rows.filter(justHit).length;
    const up = rows.filter(upcoming).length;
    const parts: string[] = [];
    if (hit) parts.push(`${hit} took effect in the last month`);
    if (up) parts.push(`${up} coming up`);
    return parts.join(", ") + ".";
  };

  const html = `
<div style="background:${CANVAS};padding:28px 10px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">
<tr><td>

  <div style="font:700 18px/1.3 ${FONT};color:${INK};padding:0 2px 3px;">
    Agencyman &mdash; your ${esc(monthLabel(anchor))} rate radar
  </div>
  <div style="font:400 13px/1.6 ${FONT};color:${INK2};padding:0 2px;">
    ${hi} here&rsquo;s what moved in ${esc(states)} for your carriers and your competitors,
    plus what&rsquo;s worth an HR review in the states your team works in.
  </div>
  ${glanceHtml}

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${sectionHtml(
      "Your carriers raised rates",
      mineRaises.length ? `Retention risk — your book may shop. ${buckets(mineRaises)}` : "",
      mineRaises, 6, "/my-carriers", KIND_RAISED)}
    ${sectionHtml(
      "Your carriers cut rates",
      mineCuts.length ? `A price advantage you can sell. ${buckets(mineCuts)}` : "",
      mineCuts, 6, "/my-carriers", KIND_CUT)}
    ${mineNeutral > 0 ? `
    <tr><td style="padding:8px 2px 0;">
      <div style="font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK3};">
        Your carriers also filed ${mineNeutral} rate-neutral change${mineNeutral === 1 ? "" : "s"} (0.0%) in your states this month.
      </div>
    </td></tr>` : ""}
    ${sectionHtml(
      "Competitors raised rates",
      prospect.length ? `Their customers are likely to shop. ${buckets(prospect)}` : "",
      prospect, 8, "/prospect", KIND_PROSPECT)}
    ${sectionHtml(
      "Competitors cut rates",
      defend.length ? `Your customers may see cheaper quotes. ${buckets(defend)}` : "",
      defend, 6, "/defend", KIND_DEFEND)}
  </table>

  ${hr.length ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:26px 0 0;">
      ${eyebrow("HR — worth reviewing for your office")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;">
      <tr><td style="padding:15px 16px 6px;">
      ${hr.map(x => `
        <div style="padding-bottom:14px;">
          <div style="font:700 12px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK};text-transform:uppercase;letter-spacing:.04em;">
            ${esc(x.name)} (${esc(x.state)})
          </div>
          ${x.updated.map(u => `
            <div style="font:400 13px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK2};padding:2px 0 0 10px;">
              <span style="display:inline-block;font:700 10px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d4ed8;background:#e8edfb;border-radius:8px;padding:0 7px;vertical-align:1px;">UPDATED</span>
              ${esc(u.title)} <span style="color:${INK3};">(refreshed ${esc(u.checked)})</span>
            </div>`).join("")}
          ${x.scheduled.map(sc => `
            <div style="font:400 13px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK2};padding:2px 0 0 10px;">
              <span style="display:inline-block;font:700 10px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#8a5a00;background:#fdf1dc;border-radius:8px;padding:0 7px;vertical-align:1px;">SCHEDULED</span>
              ${esc(sc.sent)} <span style="color:${INK3};">(${esc(sc.topic)})</span>
            </div>`).join("")}
          ${x.lines.map(l => `
            <div style="font:400 13px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK2};padding:2px 0 0 10px;">
              &middot; ${esc(l.text)}
            </div>`).join("")}
        </div>`).join("")}
      </td></tr>
      </table>
      <div style="font:400 12px/1.6 ${FONT};color:${INK3};padding:7px 2px 0;">
        Full state briefings: <a href="${APP_URL}/compliance" style="color:${BLUE};">${APP_URL.replace("https://", "")}/compliance</a>
      </div>
    </td></tr>
  </table>` : ""}

  <div style="margin-top:26px;padding:0 2px;font:400 11px/1.6 ${FONT};color:${INK3};">
    Data as of ${esc(asOf)}, from public rate filings with state insurance regulators.
    Not legal or financial advice &mdash; verify against the official filing before acting.<br>
    You&rsquo;re receiving this monthly digest as an Agencyman user.
    <a href="${APP_URL}/setup" style="color:${INK3};">Manage your profile</a> &middot;
    <a href="{{{unsubscribe_url}}}" style="color:${INK3};">Unsubscribe</a>
  </div>

</td></tr>
</table>
</td></tr></table>
</div>`;

  const subjBits: string[] = [];
  if (mineN) subjBits.push(`${mineN} of your carriers moved`);
  if (competitorsN) subjBits.push(`${competitorsN} competitor ${competitorsN === 1 ? "change" : "changes"}`);
  const subject = subjBits.length
    ? `${monthLabel(anchor)}: ${subjBits.join(", ")} in ${p.agent.licensed_states.join("/")}`
    : `${monthLabel(anchor)} rate radar — quiet month in ${p.agent.licensed_states.join("/")}`;

  return { subject, html, counts: { mine: mineN, competitors: competitorsN, hrStates: hr.length } };
}
