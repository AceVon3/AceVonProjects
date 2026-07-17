// NAIC state average auto expenditure — CONTEXT ONLY, never a score input
// (a per-state constant cannot differentiate brands; see docs/FORMULA_GAP_V4.md).
//
// Source: NAIC "2023 Auto Insurance Database Average Premium Supplement"
// (published June 2025), "Average Expenditures" table (p.22) — the standard
// "average cost of auto insurance" figure: total written premium over all
// insured vehicles, including liability-only policies. Extracted 2026-07-17
// from https://content.naic.org/sites/default/files/aut-db_1.pdf and
// spot-checked against the report (AZ 1,343.85 -> 1344; national avg
// $1,281.60). Update when NAIC publishes the next supplement (~annually).

export const STATE_AVG_EXPENDITURE_YEAR = 2023;

export const STATE_AVG_EXPENDITURE: Record<string, number> = {
  AK: 1113,
  AL: 1081,
  AR: 1051,
  AZ: 1344,
  CA: 1223,
  CO: 1453,
  CT: 1394,
  DC: 1677,
  DE: 1462,
  FL: 1864,
  GA: 1555,
  HI: 888,
  IA: 869,
  ID: 864,
  IL: 1153,
  IN: 926,
  KS: 973,
  KY: 1046,
  LA: 1749,
  MA: 1326,
  MD: 1477,
  ME: 856,
  MI: 1443,
  MN: 1103,
  MO: 1155,
  MS: 1200,
  MT: 975,
  NC: 925,
  ND: 808,
  NE: 980,
  NH: 987,
  NJ: 1573,
  NM: 1082,
  NV: 1461,
  NY: 1753,
  OH: 947,
  OK: 1085,
  OR: 1170,
  PA: 1155,
  RI: 1539,
  SC: 1367,
  SD: 936,
  TN: 1050,
  TX: 1429,
  UT: 1169,
  VA: 1114,
  VT: 893,
  WA: 1152,
  WI: 922,
  WV: 1063,
  WY: 948,
};
