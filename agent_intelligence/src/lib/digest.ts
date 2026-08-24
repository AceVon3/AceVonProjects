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
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M policies`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k policies`;
  return `${v} policies`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- rendering --------------------------------------------------------------
//
// Faithful port of the user's Claude Design handoff (2026-08-12,
// design_handoff_digest_email): typographic hierarchy on a 600px white
// sheet — 4px brand rule, AGENCYMAN masthead, 34px headline, #f4f6f9
// office panel, bulletproof CTA, sections opened by 2px ink rules with
// muted counts, filing rows as name/detail vs number/label columns
// (raises #c02617, cuts #1b6ca8), HR with letterspaced state subheads.
// Every text style carries mso-line-height-rule:exactly per the handoff.
// REVIEW items keep the README's defined label color (#9aa1ad) even though
// the sample showed only UPDATED/SCHEDULED — dropping them would empty the
// HR section on first sends (no prior snapshot => no UPDATED items).

const F = "Helvetica Neue,Helvetica,Arial,sans-serif";
const INK = "#14171a";
const BODY = "#3f4854";
const DETAIL = "#6b7280";
const MUTED = "#8a919c";
const LABEL = "#9aa1ad";
const HAIR = "#e6e9ef";
const RED = "#c02617";
const RED_DEEP = "#b3261a";
const BLUE = "#1b6ca8";
const AMBER = "#b45309";

function t(size: number, lh: number, extra = ""): string {
  return `font-family:${F};font-size:${size}px;line-height:${lh}px;mso-line-height-rule:exactly;${extra}`;
}

type Kind = { label: string; labelColor: string };
const KIND_RAISED: Kind = { label: "RAISED", labelColor: RED_DEEP };
const KIND_CUT: Kind = { label: "CUT", labelColor: BLUE };
const KIND_PROSPECT: Kind = { label: "PROSPECT", labelColor: RED_DEEP };
const KIND_DEFEND: Kind = { label: "DEFEND", labelColor: BLUE };

// Timing pill (Ryan, 2026-08-24): every row states its clock loudly —
// amber = the change is APPROACHING (act before it lands), blue = it is
// already IN EFFECT. Bulletproof inline-block span, no images, colors from
// the app's amber/blue convention. Same-day renders as "TAKES EFFECT TODAY".
function timingPill(effective: string, anchor: string): string {
  const days = Math.round(
    (Date.parse(`${effective}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 86_400_000,
  );
  const pill = (bg: string, fg: string, text: string) =>
    `<span style="display:inline-block;border-radius:6px;padding:2px 8px;background:${bg};` +
    `font-family:${F};font-size:10px;line-height:16px;font-weight:700;letter-spacing:.08em;color:${fg};">${text}</span>`;
  if (days > 0) {
    const when = days === 1 ? "TOMORROW" : days === 0 ? "TODAY" : `IN ${days} DAYS`;
    return pill("#FCF1E3", "#8A5A10", `TAKES EFFECT ${esc(fmtDate(effective)).toUpperCase()} &middot; ${when}`);
  }
  if (days === 0) return pill("#FCF1E3", "#8A5A10", "TAKES EFFECT TODAY");
  return pill("#E5F0FA", "#1B6CA8", `IN EFFECT &middot; SINCE ${esc(fmtDate(effective)).toUpperCase()}`);
}

function filingRow(f: Row, kind: Kind, first: boolean, anchor: string): string {
  const numColor = f.overall_rate_impact >= 0 ? RED : BLUE;
  const ph = fmtPh(f.total_policyholders);
  const sub = f.sub_type ? cleanSubtypeLabel(f.sub_type) : "";
  const product = sub || f.line_of_business;
  return `
      <tr><td style="padding:${first ? "16px 0 14px" : "14px 0"};border-bottom:1px solid ${HAIR};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td class="lbl" width="392" style="width:392px;font-family:${F};">
              <div style="${t(17, 22, `font-weight:700;color:${INK};`)}">${esc(f.brand)}</div>
              <div style="${t(13, 20, `color:${DETAIL};padding-top:2px;`)}">${esc(product)} &middot; ${esc(f.state)}${ph ? ` &middot; ${ph}` : ""}</div>
              <div style="padding-top:5px;">${timingPill(f.effective_date, anchor)}</div>
            </td>
            <td width="136" align="right" valign="top" style="width:136px;font-family:${F};">
              <div class="num" style="${t(21, 24, `font-weight:700;letter-spacing:-.015em;color:${numColor};`)}">${fmtImpact(f.overall_rate_impact)}</div>
              <div style="${t(10, 16, `font-weight:700;letter-spacing:.12em;color:${kind.labelColor};padding-top:3px;`)}">${kind.label}</div>
            </td>
          </tr>
        </table>
      </td></tr>`;
}

function sectionHeaderRow(title: string, count: number | null): string {
  const countSpan = count != null
    ? ` <span style="font-weight:400;color:${LABEL};">&nbsp;${count} filing${count === 1 ? "" : "s"}</span>`
    : "";
  return `
      <tr><td style="border-top:2px solid ${INK};padding-top:10px;${t(17, 22, `font-weight:700;letter-spacing:-.01em;color:${INK};`)}">${title}${countSpan}</td></tr>`;
}

function sectionHtml(title: string, takeaway: string, rows: Row[], cap: number, appPath: string, kind: Kind, first: boolean, anchor: string): string {
  if (rows.length === 0) return "";
  const shown = rows.slice(0, cap);
  const more = rows.length - shown.length;
  const moreLink = more > 0
    ? ` +&nbsp;${more} more in the app: <a href="${APP_URL}${appPath}" style="color:${BLUE};text-decoration:none;font-weight:700;">${APP_URL.replace("https://", "")}${appPath}</a>`
    : "";
  return `
  <tr><td class="sheet" style="padding:${first ? 44 : 36}px 36px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${sectionHeaderRow(esc(title), rows.length)}
      ${shown.map((f, i) => filingRow(f, kind, i === 0, anchor)).join("")}
      <tr><td style="padding:10px 0 0;${t(13, 20, `color:${MUTED};`)}">${esc(takeaway)}${moreLink}</td></tr>
    </table>
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
        // REVIEW lines are standing reminders and repeat verbatim month to
        // month — so they only ride along when the state has actual news
        // (an UPDATED or SCHEDULED item) that month (Ryan, 2026-08-24).
        // A state with no news drops out entirely; a month with no news in
        // any state renders no HR section at all.
        lines: updated.length > 0 || scheduled.length > 0
          ? stateReviewLines(s, p.employee_count)
          : [],
      };
    })
    .filter(x => x.updated.length > 0 || x.scheduled.length > 0);

  const competitorsN = prospect.length + defend.length;
  const mineN = mineRaises.length + mineCuts.length;

  const hi = p.first_name ? `Hi ${esc(p.first_name)} —` : "Hi —";

  // "Your office at a glance" strip — the same facts the compliance page
  // leads with, so the email opens grounded in THEIR office, not generic.
  // Office panel facts (design: 2 rows x 3 columns; SELLS IN + TEAM WORKS IN
  // on the second row, the latter spanning two columns).
  const officeVal = p.office_state ? stateName(p.office_state) : "";
  const carriersLabel = p.agent.agent_type === "captive" ? "BRAND" : "CARRIERS";
  const carriersVal = p.agent.agent_type === "captive"
    ? p.agent.authorized_brands[0]
    : String(p.agent.authorized_brands.length);
  const teamVal = `${p.employee_count} employee${p.employee_count === 1 ? "" : "s"}`
    + (p.remote_count ? `, ${p.remote_count} remote` : "");
  const cell = (label: string, value: string, style: string, attrs = "") => `
        <td${attrs} valign="top" style="${style}font-family:${F};">
          <div style="${t(10, 14, `font-weight:700;letter-spacing:.12em;color:${LABEL};`)}">${esc(label)}</div>
          <div style="${t(14, 20, `font-weight:700;color:${INK};padding-top:3px;`)}">${esc(value)}</div>
        </td>`;

  // Preheader — regenerated per send from the actual counts (handoff spec).
  const preheaderBits: string[] = [];
  if (mineN) preheaderBits.push(`${mineN} of your carriers moved`);
  if (competitorsN) preheaderBits.push(`${competitorsN} competitor change${competitorsN === 1 ? "" : "s"}`);
  const preheader = (preheaderBits.length ? preheaderBits.join(", ") + ". " : "A quiet month. ")
    // Names only the states that actually render an HR block (post-gating),
    // not the whole employee-state list.
    + (hr.length ? `Plus HR items for ${hr.map(x => x.state).join(", ")}.` : "");

  const buckets = (rows: Row[]) => {
    const hit = rows.filter(justHit).length;
    const up = rows.filter(upcoming).length;
    const parts: string[] = [];
    if (hit) parts.push(`${hit} took effect in the last month`);
    if (up) parts.push(`${up} coming up`);
    return parts.join(", ") + ".";
  };

  // HR items per state in design order: UPDATED, SCHEDULED, REVIEW.
  type HrItem = { labelHtml: string; text: string };
  const hrBlocks = hr.map(x => {
    const items: HrItem[] = [
      ...x.updated.map(u => ({
        labelHtml: `<span style="color:${BLUE};">UPDATED <span style="font-weight:400;letter-spacing:0;color:${LABEL};">&middot; refreshed ${esc(u.checked)}</span></span>`,
        text: u.title,
      })),
      ...x.scheduled.map(sc => ({
        labelHtml: `<span style="color:${AMBER};">SCHEDULED &middot; ${esc(sc.topic.toUpperCase())}</span>`,
        text: sc.sent,
      })),
      ...x.lines.map(l => ({
        labelHtml: `<span style="color:${LABEL};">REVIEW</span>`,
        text: l.text,
      })),
    ];
    return { ...x, items };
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Agencyman Monthly Digest</title>
<style>
  @media only screen and (max-width:620px){
    .sheet{padding-left:22px !important;padding-right:22px !important;}
    .h1{font-size:26px !important;line-height:1.2 !important;}
    .lbl{width:auto !important;}
    .num{font-size:19px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#eceef2;">

<span style="display:none;font-size:1px;color:#eceef2;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</span>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eceef2;">
<tr><td align="center" style="padding:32px 12px 48px;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:#ffffff;">
  <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:${RED};">&nbsp;</td></tr>

  <tr><td class="sheet" style="padding:26px 36px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="left" style="${t(12, 14, `font-weight:700;letter-spacing:.16em;color:${INK};`)}">AGENCYMAN</td>
        <td align="right" style="${t(11, 14, `font-weight:700;letter-spacing:.14em;color:${LABEL};`)}">MONTHLY DIGEST</td>
      </tr>
    </table>
  </td></tr>

  <tr><td class="sheet" style="padding:30px 36px 0;">
    <div class="h1" style="${t(34, 38, `font-weight:700;letter-spacing:-.02em;color:${INK};`)}">Your ${esc(monthLabel(anchor))} rate radar</div>
    <div style="${t(15, 24, `color:#4b5563;padding-top:12px;`)}">${hi} here&rsquo;s what moved for your carriers and competitors, plus HR items for the states your team works in.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;background:#f4f6f9;">
      <tr>
        ${cell("OFFICE", officeVal || "—", 'width:176px;padding:14px 12px 8px 16px;', ' width="176"')}
        ${cell(carriersLabel, carriersVal, 'width:176px;padding:14px 12px 8px 0;', ' width="176"')}
        ${cell("TEAM", teamVal, 'width:176px;padding:14px 16px 8px 0;', ' width="176"')}
      </tr>
      <tr>
        ${cell("SELLS IN", p.agent.licensed_states.join(", "), 'padding:8px 12px 14px 16px;')}
        ${cell("TEAM WORKS IN", p.employee_states.join(", ") || "—", 'padding:8px 16px 14px 0;', ' colspan="2"')}
      </tr>
    </table>
  </td></tr>

  <tr><td class="sheet" style="padding:22px 36px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${RED}" style="background:${RED};border-radius:4px;">
        <a href="${APP_URL}/overview" style="display:block;${t(14, 16, `font-weight:700;color:#ffffff;text-decoration:none;padding:14px 22px;`)}">Log in to review your dashboard &rarr;</a>
      </td></tr>
    </table>
  </td></tr>

  ${sectionHtml("Your carriers raised rates",
    mineRaises.length ? `Retention risk — your book may shop. ${buckets(mineRaises)}` : "",
    mineRaises, 6, "/my-carriers", KIND_RAISED, true, anchor)}
  ${sectionHtml("Your carriers cut rates",
    mineCuts.length ? `A price advantage you can sell. ${buckets(mineCuts)}` : "",
    mineCuts, 6, "/my-carriers", KIND_CUT, mineRaises.length === 0, anchor)}
  ${mineNeutral > 0 ? `
  <tr><td class="sheet" style="padding:12px 36px 0;">
    <div style="${t(13, 20, `color:${MUTED};`)}">Your carriers also filed ${mineNeutral} rate-neutral change${mineNeutral === 1 ? "" : "s"} (0.0%) in your states this month.</div>
  </td></tr>` : ""}
  ${sectionHtml("Competitors raised rates",
    prospect.length ? `Their customers are likely to shop. ${buckets(prospect)}` : "",
    prospect, 8, "/prospect", KIND_PROSPECT, mineRaises.length === 0 && mineCuts.length === 0, anchor)}
  ${sectionHtml("Competitors cut rates",
    defend.length ? `Your customers may see cheaper quotes. ${buckets(defend)}` : "",
    defend, 6, "/defend", KIND_DEFEND, false, anchor)}

  ${hrBlocks.length ? `
  <tr><td class="sheet" style="padding:44px 36px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${sectionHeaderRow("HR &mdash; worth reviewing for your office", null)}
      ${hrBlocks.map((x, xi) => `
      <tr><td style="padding:${xi === 0 ? 20 : 22}px 0 0;${t(12, 16, `font-weight:700;letter-spacing:.14em;color:${LABEL};`)}">${esc(x.name.toUpperCase())} (${esc(x.state)})</td></tr>
      ${x.items.map((it, i) => `
      <tr><td style="padding:${i === 0 ? "10px 0 12px" : "12px 0"};border-bottom:1px solid ${HAIR};font-family:${F};">
        <div style="${t(10, 16, `font-weight:700;letter-spacing:.12em;`)}">${it.labelHtml}</div>
        <div style="${t(14, 22, `color:${BODY};padding-top:3px;`)}">${esc(it.text)}</div>
      </td></tr>`).join("")}`).join("")}
      <tr><td style="padding:12px 0 0;${t(13, 20, `color:${MUTED};`)}"><a href="${APP_URL}/compliance" style="color:${BLUE};text-decoration:none;font-weight:700;">View the rest of your HR AI summaries that apply to your office &rarr;</a></td></tr>
    </table>
  </td></tr>` : `
  <!-- HR summaries regenerate ~twice a year (Ryan, 2026-08-24), so most
       months have no HR news items — this standing pointer to the full
       summaries renders INSTEAD of the section so the HR hub stays one
       click away every month. -->
  <tr><td class="sheet" style="padding:44px 36px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6f9;">
      <tr><td style="padding:16px 18px;font-family:${F};">
        <div style="${t(10, 14, `font-weight:700;letter-spacing:.12em;color:${LABEL};`)}">HR &amp; COMPLIANCE</div>
        <div style="${t(14, 22, `padding-top:4px;`)}"><a href="${APP_URL}/compliance" style="color:${BLUE};text-decoration:none;font-weight:700;">View your HR AI summaries that apply to your office &rarr;</a></div>
      </td></tr>
    </table>
  </td></tr>`}

  <tr><td class="sheet" style="padding:40px 36px 34px;">
    <div style="border-top:1px solid ${HAIR};padding-top:18px;${t(12, 20, `color:${MUTED};`)}">
      Data as of ${esc(asOf)}, from public rate filings with state insurance regulators. Not legal or financial advice &mdash; verify against the official filing before acting.<br>
      You&rsquo;re receiving this monthly digest as an Agencyman user.
      <a href="${APP_URL}/setup" style="color:${MUTED};text-decoration:underline;">Manage your profile</a> &middot;
      <a href="{{{unsubscribe_url}}}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>
    </div>
  </td></tr>
</table>

</td></tr>
</table>
</body>
</html>`;

  const subjBits: string[] = [];
  if (mineN) subjBits.push(`${mineN} of your carriers moved`);
  if (competitorsN) subjBits.push(`${competitorsN} competitor ${competitorsN === 1 ? "change" : "changes"}`);
  const subject = subjBits.length
    ? `${monthLabel(anchor)}: ${subjBits.join(", ")} in ${p.agent.licensed_states.join("/")}`
    : `${monthLabel(anchor)} rate radar — quiet month in ${p.agent.licensed_states.join("/")}`;

  return { subject, html, counts: { mine: mineN, competitors: competitorsN, hrStates: hr.length } };
}
