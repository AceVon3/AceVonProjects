// Shared display formatters used by all three filings tables (Prospect,
// Defend, My Carriers) and the Overview cards.

// Abbreviated policyholder count.
//   >= 1,000,000 → "1.4M" (one decimal, trailing .0 trimmed)
//   >= 1,000     → "13.3k" / "2k"
//   < 1000       → plain integer
//   null         → em dash (caller styles it secondary)
export function formatPolicyholders(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) {
    const s = (n / 1_000_000).toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) + "M" : s + "M";
  }
  if (n >= 1000) {
    const s = (n / 1000).toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) + "k" : s + "k";
  }
  return String(Math.round(n));
}

// "+8.5%", "−3.2%". Uses U+2212 minus for visual parity with the reference.
export function formatRateImpact(n: number): string {
  if (n === 0) return "0.0%";
  const sign = n > 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

// "2025-07-15" → "Jul 15, 2025". Returns "—" for null/invalid input so
// callers can render it inline without conditional logic. The year is
// included because the dataset spans 2025–2026, so a bare "Jul 15" is
// ambiguous about which year a filing takes effect.
export function formatEffectiveDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  // Use UTC so the displayed month/day match the stored ISO date regardless
  // of the viewer's timezone (an effective_date of 2025-07-15 is a calendar
  // fact, not a moment).
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

// Color tokens used by badges. Names match the CSS classes in
// ui-reference.html (b-green / b-amber / b-blue / b-red / b-gray).
export type BadgeColor = "green" | "amber" | "blue" | "red" | "gray";

export type Badge = { color: BadgeColor; text: string };

// Window badge text + color. Rules differ by mode (see spec).
//   - Prospect (opportunity framing): green/orange/blue/gray scale.
//   - Defend (risk framing): red for future cuts, orange once in effect.
//   - My Carriers (neutral surveillance): gray throughout.
//
// `asOf` anchors the rolling window. Pass the same date the query builder
// used so badges stay consistent with row inclusion.
export function computeWindowBadge(
  effectiveDate: string | null,
  asOf: string,
  mode: "prospect" | "defend" | "my-carriers",
): Badge {
  // No confirmed effective date → "Pending review" regardless of mode.
  if (!effectiveDate) return { color: "amber", text: "Pending review" };

  const e = Date.parse(`${effectiveDate}T00:00:00Z`);
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const days = Math.round((e - a) / 86_400_000);
  const weeks = Math.round(days / 7);
  const absWeeks = Math.abs(weeks);
  // "1 week" / "3 weeks" — every badge below interpolates through this.
  const wk = (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`;

  if (mode === "prospect") {
    if (days > 6 && weeks >= 1) return { color: "green", text: `In ${wk(weeks)}` };
    if (days >= 0 && days <= 6) return { color: "amber", text: "Effective this week" };
    if (days < 0 && days >= -56) return { color: "blue", text: `In effect ${wk(absWeeks)}` };
    return { color: "gray", text: "In effect (older)" };
  }
  if (mode === "defend") {
    if (days > 6 && weeks >= 1) return { color: "red", text: `Risk window opens in ${wk(weeks)}` };
    if (days >= 0 && days <= 6) return { color: "red", text: "Risk window open now" };
    // Already in effect. The "your customers may shop" framing is stated once
    // in the page header, so the per-row badge stays factual (how long ago the
    // cut landed) rather than repeating the callout on every row.
    return { color: "amber", text: `In effect ${wk(absWeeks)}` };
  }
  // my-carriers — neutral throughout
  if (days > 6 && weeks >= 1) return { color: "gray", text: `In ${wk(weeks)}` };
  if (days >= 0 && days <= 6) return { color: "gray", text: "Effective this week" };
  return { color: "gray", text: `In effect ${wk(absWeeks)}` };
}

// Status badge: derived from rate_activity. rate_change_pending → amber
// "Pending"; everything else in the active window is an approved filing.
// The color also drives the compact status dot in the table, so it reads as
// a status signal: green = approved (in force), amber = still pending review.
//
// File-and-use wrinkle (2026-08-10, user-requested after the OR Farmers
// FAIG-134959263 confusion): "pending" is the REGULATOR's review status, not
// the rate's — in file-and-use states a rate takes effect while the review is
// still open. A bare "Pending" next to a past effective date reads as a
// contradiction, so once the effective date has passed we spell it out.
// `asOf` anchors the comparison (same date the query builder used) so the
// label stays consistent with row inclusion and doesn't drift with the wall
// clock.
export function computeStatusBadge(
  rateActivity: string,
  effectiveDate: string | null,
  asOf: string,
): Badge {
  if (rateActivity === "rate_change_pending") {
    if (effectiveDate && effectiveDate <= asOf) {
      return { color: "amber", text: "Rate in effect; state review still open" };
    }
    return { color: "amber", text: "Pending" };
  }
  return { color: "green", text: "Approved" };
}

// Color of the Rate Impact value, mode-specific. Spec rules:
//   Prospect:    red >= +10, black 5–10
//   Defend:      red <= -5, black -2..-5
//   My Carriers: red >= +5, green <= -2, black otherwise
export function rateImpactColor(
  impact: number,
  mode: "prospect" | "defend" | "my-carriers",
): "red" | "green" | "black" {
  if (mode === "prospect") return impact >= 10 ? "red" : "black";
  if (mode === "defend") return impact <= -5 ? "red" : "black";
  if (impact >= 5) return "red";
  if (impact <= -2) return "green";
  return "black";
}

// Whether the Rate Impact cell should show the multi-entity info dot.
// Spec: entity_count > 1 AND (max_entity_impact - min_entity_impact) > 5.
export function shouldShowEntitySpreadDot(
  entityCount: number,
  minImpact: number,
  maxImpact: number,
): boolean {
  return entityCount > 1 && maxImpact - minImpact > 5;
}

export function entitySpreadTooltip(
  entityCount: number,
  minImpact: number,
  maxImpact: number,
): string {
  return (
    `Premium-weighted across ${entityCount} entities. ` +
    `Range: ${minImpact.toFixed(1)}% to ${maxImpact.toFixed(1)}%.`
  );
}
