// Screenshot the running site at desktop and mobile widths into
// .impeccable/review/. Uses the playwright already installed for the
// sibling agent_intelligence project. Usage: node scripts/shoot.mjs [baseUrl]
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, "../../agent_intelligence/package.json"));
const { chromium } = require("playwright");

const base = process.argv[2] || "http://127.0.0.1:3021/";
const out = path.resolve(here, "../.impeccable/review");

const shots = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, mobile: true },
];

const browser = await chromium.launch();
for (const s of shots) {
  const ctx = await browser.newContext({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 1,
    isMobile: Boolean(s.mobile),
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  // Hero only (the first viewport contract)
  await page.screenshot({ path: path.join(out, `${s.name}-hero.png`), fullPage: false });
  // Settle lazy checks: scroll through once, then back to top for the full capture.
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
    wide: [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 6).map((el) => el.tagName + "." + String(el.className).slice(0, 40)) }));
  console.log(s.name, "overflow check", JSON.stringify(overflow));
  await page.screenshot({ path: path.join(out, `${s.name}.png`), fullPage: true });
  console.log(`saved ${s.name}.png and ${s.name}-hero.png`);
  await ctx.close();
}
await browser.close();
