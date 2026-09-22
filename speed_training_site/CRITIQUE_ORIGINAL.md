# Critique of the original SPEED Training landing page (Kartra, as of 2026-09-22)

Scored against Persuade-mode heuristics: does a first-time State Farm agent know what this is, why it matters, and what to do, within seconds, and does the page earn belief?

Overall: **4.5 / 10**. The offer and proof are strong; the presentation buries them under builder scaffolding, mixed type systems, and a dozen competing calls to action.

## P0 (blocks conversion or trust)

1. **Four different CTAs pointing at three destinations.** "View Plans & Pricing" (twice), "See How Other Agents Use SPEED", "Get Instant Access to SPEED", plus a contact form and a popup form. A visitor cannot tell which one is the buy path. Fix: one primary action, repeated; everything else secondary.
2. **The hero headline is set at 1.4rem inside a 2.33rem container with `line-height: 0.6em`.** The page's most important sentence renders smaller than the body copy under it, and the nested line-height risks overlapping lines. This is a paste artifact from the page builder, not a design decision.
3. **The FAQ answer about State Farm approval is highlighted red-on-yellow.** The most compliance-sensitive answer on the site looks like a warning label. It reads as "danger" to exactly the reader who is checking whether SPEED is safe to use.
4. **Pasted rich-text carries foreign class names and inline styles** (`font-claude-response-body`, `[li_&]:mb-0`, `-webkit-text-stroke-width`, `data-start`/`data-end`). They do nothing on Kartra, bloat the page, and prove the copy was pasted from a chat window. Fragile and unmaintainable.

## P1 (hurts belief or comprehension)

5. **Type has no system.** Roboto Condensed, Lato, Montserrat, Asap, Roboto, Didact Gothic, Dosis, and Ubuntu all load (with 10 weights each). Headings switch family section to section, so nothing reads as one voice.
6. **Twelve identical icon-circle cards for "What's Included."** Same blue circle, bold title, gray text, three rows deep. The eye cannot rank 125 templates against a newsletter. The items that matter most (templates, scripts, follow-up plans) get the same weight as "Google Reviews!".
7. **Stats are disconnected from proof.** 4,000+ / 125+ / 60+ / 10+ sit as a generic metric row on a black hero; nothing ties them to the items below or to the testimonials.
8. **Testimonials use emoji stars and "--" attributions** with inconsistent spacing ("⭐ ⭐ ⭐⭐ ⭐"). Star ratings drawn with emoji vary by platform and undercut the Chairman's Circle credibility the quotes carry.
9. **Two lead-capture forms** (page section plus popup) both with a server-side captcha the visitor must retype. Heavy for a "contact us" ask, and the textarea placeholder is a paragraph about Zoom webinars, which is not what a placeholder is for.
10. **Section rhythm is flat.** Every section is centered text over a full-width container; density never changes, so the page reads as one long scroll with no destination until the FAQ.

## P2 (polish)

11. Stray empty paragraphs (`<p> </p>`) create uneven vertical gaps before headings.
12. Nav item "Cloud" links to the pricing page while "Login" goes to the cloud app, so the two "cloud" words point at different things.
13. Duplicate `id` attributes (`wQnM76p93v`, `Q8jtUEhXLI`, `pagesInternalCSS`) and an empty `<h4 class="panel-title">` before every FAQ question hurt accessibility and screen readers.
14. Hero background photo at 50% opacity under white text: contrast depends on which part of the photo sits under the words.
15. "We hate SPAM and promise to keep your email address safe" appears under a pricing button, not a form.

## What was worth keeping (and was kept)

- The headline "Stop building from scratch. Start running a system." It is the whole argument in nine words.
- The specific numbers and the two testimonials.
- The State-Farm-native vocabulary (ECRM, SFConnect, TICA, Chairman's Circle).
- The full FAQ, which answers the objections a buyer actually has (spouse agencies, discounts, recording, approval).
- The footer disclaimer and Non-State Farm Vendor statement.

The rebuild in this folder keeps every fact and quote above verbatim and replaces everything else. See PRODUCT.md for the product record and the direction contract in `src/app/layout.tsx` for the chosen world.
