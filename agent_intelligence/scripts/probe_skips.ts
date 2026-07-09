// Probes the URLs behind generation skips with the SAME fetch the generator
// uses (Node fetch + browser headers), so results predict a regen exactly.
// Usage: npx tsx scripts/probe_skips.ts STATE/topic STATE/topic ...

import { RESOURCE_URLS, ResourceKey, StateCode } from "../src/lib/resourceUrls";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

async function probe(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: HEADERS });
    const text = (await resp.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    return `${resp.status} (${text.length} chars stripped)`;
  } catch (e) {
    return `ERROR ${(e as Error)?.message ?? e}`;
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  for (const arg of process.argv.slice(2)) {
    // Raw URL args are probed directly; STATE/topic args probe the mapped URLs.
    if (arg.includes("://")) {
      console.log(`${await probe(arg)}  ${arg}`);
      continue;
    }
    const [state, topic] = arg.split("/") as [StateCode, ResourceKey];
    const urls = RESOURCE_URLS[state]?.[topic] ?? [];
    for (const u of urls) {
      console.log(`${arg}  ${await probe(u)}  ${u}`);
    }
  }
}
main();
