// Prints the comma-separated "STATE/topic" pair list for the given state
// codes, for use with generate_compliance.ts --only. Lets long full regens
// run in kill-safe chunks (this environment kills background shells at
// ~30 minutes; generate_compliance writes output only at the end of a run).
//
// Usage: npx tsx scripts/list_pairs.ts CO CT DE ...

import { RESOURCE_URLS, StateCode } from "../src/lib/resourceUrls";

const states = process.argv.slice(2) as StateCode[];
const pairs = states.flatMap(s =>
  Object.entries(RESOURCE_URLS[s] ?? {})
    .filter(([, urls]) => urls && urls.length > 0)
    .map(([topic]) => `${s}/${topic}`),
);
console.log(pairs.join(","));
