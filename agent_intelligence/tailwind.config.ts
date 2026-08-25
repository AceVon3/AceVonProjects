import type { Config } from "tailwindcss";

// Design tokens for AgencyMan.ai (UI refresh, "Command Rail" direction).
//
// These values are pulled VERBATIM from the design handoff
// (design_handoff_ui_refresh/README.md §Design Tokens) — the de facto
// design system. Every component reads from this one source of truth so
// the rendered app continues to match the handoff frames.
//
// Naming convention:
//   - canvas      = page background
//   - surface     = cards / white containers
//   - surface-2   = table header bands / card footers
//   - soft        = neutral chip/pill fill
//   - ink / ink-2 / ink-3 = primary / secondary / tertiary text
//   - ink-mid     = mid-tone icon/neutral text
//   - card-line / line / line-2 = card border / row hairline / input+chip border
//   - {color}-fill, {color}-text, {color}-border = badge / chip palettes
//
// Color-coding convention (uniform across the app):
//   PROSPECT / retention risk = brand red · DEFEND = blue ·
//   opportunity = green · neutral = navy ink.

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // AgencyMan.ai brand — extracted from public/brand/*.svg (the logo
        // is the source of truth). The landing page's themed CSS variables
        // in src/app/(marketing)/landing.css must stay in sync.
        //   brand-red      = mark + ".ai" on light backgrounds
        //   brand-red-soft = the red the logo uses on dark navy
        //   brand-navy     = wordmark color / rail + dark-lockup background
        "brand-red":      "#C42127",
        "brand-red-soft": "#E8555B",
        "brand-navy":     "#14142B",

        // Surfaces
        canvas: "#F7F8FB",
        surface: "#ffffff",
        "surface-2": "#FAFBFD",
        soft: "#F1F2F7",

        // Text
        ink: "#14142B",
        "ink-2": "#6B7080",
        "ink-3": "#9AA0B0",
        "ink-mid": "#4A4E63",

        // Borders
        "card-line": "#E5E8F0",
        line: "#EDEFF4",
        "line-2": "#DDE1EA",

        // Badge / chip palettes — fill + text for every color family.
        // red = PROSPECT / retention risk; blue = DEFEND; green =
        // opportunity / approved; amber = pending / warnings.
        "blue-fill":   "#E5F0FA",
        "blue-text":   "#1B6CA8",
        "blue-border": "#1B6CA8",
        "blue-soft":   "#7EB3DC",
        "green-fill":  "#E7F3EC",
        "green-text":  "#1B7F4B",
        "amber-fill":  "#FCF1E3",
        "amber-text":  "#8A5A10",
        "amber-dot":   "#B07818",
        "amber-band":  "#6B4A10",
        "amber-border": "#EBD8B8",
        "red-fill":    "#FBEAEB",
        "red-text":    "#8A1B1F",
        "red-border":  "#F0C8CA",
        "gray-fill":   "#F1F2F7",
        "gray-text":   "#4A4E63",

        // Special-purpose
        "mine-bg":         "rgba(196,33,39,0.03)",
        skeleton:          "#E9EBF2",
        "skeleton-strong": "#DDE1EA",
      },
      borderRadius: {
        // Named radii from the handoff: cards/popovers 14px, rail active
        // tile 10px, inner badges/window pills 7px.
        card:  "14px",
        tile:  "10px",
        badge: "7px",
      },
      boxShadow: {
        // Two-part card shadow (contact edge + soft drop) — the landing's
        // shadow language adopted app-wide per the DESIGN.md elevation
        // doctrine (firmer shadows everywhere, decided 2026-08-24).
        card:    "0 1px 3px rgba(20,20,43,0.05), 0 14px 32px -18px rgba(20,20,43,0.22)",
        popover: "0 8px 28px rgba(20,20,43,0.14)",
      },
      borderWidth: {
        // Hairline border used throughout the design.
        hairline: "0.5px",
      },
      fontSize: {
        // Pixel-precise sizes used across the design (in addition to
        // Tailwind defaults). Allows `text-13` instead of `text-[13px]`.
        "10": "10px",
        "11": "11px",
        "12": "12px",
        "13": "13px",
        "14": "14px",
        "15": "15px",
        "16": "16px",
        "17": "17px",
        "18": "18px",
        "19": "19px",
        "20": "20px",
        "22": "22px",
        "26": "26px",
        "28": "28px",
        "30": "30px",
      },
      letterSpacing: {
        wider04: "0.4px",
        wider06: "0.6px",
        wider08: "0.8px",
        tight02: "-0.2px",
      },
    },
  },
  plugins: [],
};
export default config;
