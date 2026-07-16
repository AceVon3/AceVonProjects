// Brand Health — Search Interest pillar refresh.
//
// One DataForSEO "Google Ads search volume" live task per covered state
// (all 13 brand keywords per task, 12 months of monthly history each),
// written as a compact month-axis-aligned snapshot to
// src/lib/brandHealthSearchData.ts. Range slicing/scoring happens at request
// time in computeSearchMetrics — this script only stores raw volumes.
//
// Cost: ~$0.09 per state ≈ $4 per full run (45 states). The script prints
// the account balance before starting and the total cost after. Needs
// DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD in .env.local.
//
// Run: npx tsx scripts/brand_health/refresh_search.ts
//
// Failures are per-state: a failed state is retried once, then omitted
// (its UI falls back to the no-data path). Fewer than 35/45 states aborts
// without overwriting — a partial run must not masquerade as a full one.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { BRANDS, COVERED_STATES, type Brand } from "../../src/lib/constants";
import {
  BRAND_KEYWORDS,
  STATE_FULL_NAMES,
  type SearchSnapshot,
} from "../../src/lib/brandHealthSearch";

const ROOT = path.join(__dirname, "..", "..");
const OUT_FILE = path.join(ROOT, "src", "lib", "brandHealthSearchData.ts");
const API = "https://api.dataforseo.com/v3";
const STATE_COVERAGE_FLOOR = 35;

function loadEnvLocal(): void {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();
const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;
if (!LOGIN || !PASSWORD) {
  console.error("No DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD in .env.local or environment.");
  process.exit(1);
}
const AUTH = "Basic " + Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");

async function dfsFetch(pathname: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}${pathname}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: AUTH, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const d = (await res.json()) as any;
  if (d.tasks?.[0]?.status_code && d.tasks[0].status_code >= 40000) {
    throw new Error(`task error ${d.tasks[0].status_code}: ${d.tasks[0].status_message}`);
  }
  return d;
}

async function balance(): Promise<number> {
  const d = await dfsFetch("/appendix/user_data");
  return d.tasks[0].result[0].money.balance as number;
}

// Resolve every covered state's DataForSEO location code by exact name.
async function stateLocationCodes(): Promise<Record<string, number>> {
  const d = await dfsFetch("/keywords_data/google_ads/locations?country=US");
  const byName = new Map<string, number>();
  for (const l of d.tasks[0].result as Array<{
    location_code: number; location_name: string; location_type: string;
  }>) {
    if (l.location_type === "State") byName.set(l.location_name, l.location_code);
  }
  const codes: Record<string, number> = {};
  for (const st of COVERED_STATES) {
    const code = byName.get(`${STATE_FULL_NAMES[st]},United States`);
    if (!code) throw new Error(`no location code for ${st} (${STATE_FULL_NAMES[st]})`);
    codes[st] = code;
  }
  return codes;
}

type MonthRow = { year: number; month: number; search_volume: number | null };

async function fetchState(
  code: number,
): Promise<Partial<Record<Brand, MonthRow[]>>> {
  const keywords = BRANDS.map(b => BRAND_KEYWORDS[b]);
  const d = await dfsFetch("/keywords_data/google_ads/search_volume/live", [
    { keywords, location_code: code, language_code: "en" },
  ]);
  const byKeyword = new Map<string, MonthRow[]>();
  for (const r of (d.tasks[0].result ?? []) as Array<{
    keyword: string; monthly_searches: MonthRow[] | null;
  }>) {
    if (r.monthly_searches?.length) byKeyword.set(r.keyword, r.monthly_searches);
  }
  const out: Partial<Record<Brand, MonthRow[]>> = {};
  for (const brand of BRANDS) {
    const rows = byKeyword.get(BRAND_KEYWORDS[brand]);
    if (rows) out[brand] = rows;
  }
  return out;
}

const monthKey = (r: MonthRow) => `${r.year}-${String(r.month).padStart(2, "0")}`;

async function main(): Promise<void> {
  const startBalance = await balance();
  console.log(`balance before run: $${startBalance.toFixed(2)}`);

  const codes = await stateLocationCodes();
  console.log(`resolved ${Object.keys(codes).length} state location codes`);

  const perState: Record<string, Partial<Record<Brand, MonthRow[]>>> = {};
  const monthSet = new Set<string>();

  for (const st of COVERED_STATES) {
    let rows: Partial<Record<Brand, MonthRow[]>> | null = null;
    for (let attempt = 0; attempt < 2 && !rows; attempt++) {
      try {
        rows = await fetchState(codes[st]);
      } catch (e) {
        console.error(`  ${st} attempt ${attempt + 1} FAILED: ${(e as Error).message.slice(0, 160)}`);
        if (attempt === 0) await new Promise(r => setTimeout(r, 5_000));
      }
    }
    if (!rows || Object.keys(rows).length === 0) {
      console.error(`${st}  OMITTED (no data)`);
      continue;
    }
    perState[st] = rows;
    for (const series of Object.values(rows)) for (const r of series!) monthSet.add(monthKey(r));
    console.log(`${st}  ${Object.keys(rows).length}/13 brands`);
    await new Promise(r => setTimeout(r, 500));
  }

  const stateCount = Object.keys(perState).length;
  if (stateCount < STATE_COVERAGE_FLOOR) {
    console.error(`Only ${stateCount}/${COVERED_STATES.length} states — NOT overwriting snapshot.`);
    process.exit(1);
  }

  // Align every series to one ascending month axis (last 12 measured months).
  const months = Array.from(monthSet).sort().slice(-12);
  const states: SearchSnapshot["states"] = {};
  for (const [st, rows] of Object.entries(perState)) {
    const stateEntry: Partial<Record<Brand, Array<number | null>>> = {};
    for (const [brand, series] of Object.entries(rows) as Array<[Brand, MonthRow[]]>) {
      const byMonth = new Map(series.map(r => [monthKey(r), r.search_volume]));
      stateEntry[brand] = months.map(m => byMonth.get(m) ?? null);
    }
    states[st] = stateEntry;
  }

  const snapshot: SearchSnapshot = {
    retrievedAt: new Date().toISOString().slice(0, 10),
    months,
    states,
  };
  const body =
    `// GENERATED FILE — written by scripts/brand_health/refresh_search.ts\n` +
    `// on ${snapshot.retrievedAt}. Do not edit by hand; run the refresh script instead.\n\n` +
    `import { type SearchSnapshot } from "./brandHealthSearch";\n\n` +
    `export const SEARCH_SNAPSHOT: SearchSnapshot | null =\n` +
    `  ${JSON.stringify(snapshot).replace(/\n/g, "\n  ")};\n`;
  writeFileSync(OUT_FILE, body);

  const endBalance = await balance();
  console.log(
    `\nWrote ${stateCount}/${COVERED_STATES.length} states × ${months.length} months ` +
      `(${months[0]}..${months[months.length - 1]}) to ${path.relative(ROOT, OUT_FILE)}`,
  );
  console.log(`run cost: $${(startBalance - endBalance).toFixed(2)}, balance now $${endBalance.toFixed(2)}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
