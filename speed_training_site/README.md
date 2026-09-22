# SPEED Training site

Redesign of the SPEED Training Workshop landing page as a standalone Next.js 14 app (app router, TypeScript, Tailwind 3), built to the same conventions as `agent_intelligence/` so it can be deployed to Vercel on its own.

## Run

```bash
npm install
npm run dev      # http://localhost:3021
npm run build && npm start
```

## Layout

- `src/content.ts` — every fact, link, quote, and FAQ answer from the original Kartra page. Edit copy here.
- `src/app/page.tsx` — the page, organized as binder pages: cover, Workshop, Included, Results, FAQ, Contact, back cover.
- `src/app/globals.css` — tokens and the binder world (spine, rings, tabs, tape, sleeves, checklist).
- `src/components/` — `TabNav` (divider tabs = navigation), `Checklist` (ink checks draw in on scroll), `KartraVideo` (third-party player embed with fallback), `Icons`.
- `PRODUCT.md` — product record. `DESIGN.md` — the visual system as built.
- `CRITIQUE_ORIGINAL.md` — the judgment of the old page.
- `scripts/shoot.mjs` — desktop/mobile screenshots into `.impeccable/review/` (uses the playwright installed in `../agent_intelligence`).

## Things to verify before going live

1. The Kartra video script (`OLQzXWC5byZa`) is injected client-side; confirm it renders when served from the production domain. A fallback link to the On Demand page appears if it does not.
2. The Kartra opt-in form was not reproduced (it depends on a server captcha). Contact is by email and links; add a native form if lead capture on this page matters.
3. All destinations are the original Kartra redirect URLs; swap them if the pages move.
