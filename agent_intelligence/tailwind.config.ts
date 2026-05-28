import type { Config } from "tailwindcss";

// Design tokens for Agent Intelligence.
//
// These values are pulled VERBATIM from ui-reference.html's :root CSS
// variables — the de facto design system. The whole point of this file
// is that every component reads from one source of truth so the rendered
// app continues to match the reference.
//
// Naming convention:
//   - canvas      = page background
//   - surface     = cards / white containers
//   - surface-2   = tinted (warm-beige) areas
//   - soft        = light gray fill (same as gray-fill but used semantically
//                   for icon-box backgrounds)
//   - ink / ink-2 / ink-3 = primary / secondary / tertiary text
//   - line / line-2       = hairline borders (0.5px, two opacities)
//   - {color}-fill, {color}-text, {color}-border = badge / chip palettes

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: "#fafaf9",
        surface: "#ffffff",
        "surface-2": "#F4F2EC",
        soft: "#F1EFE8",

        // Text
        ink: "#1c1c1b",
        "ink-2": "#5F5E5A",
        "ink-3": "#888780",

        // Hairline borders (rgba so they sit on tinted backgrounds)
        line: "rgba(0,0,0,0.08)",
        "line-2": "rgba(0,0,0,0.15)",

        // Badge / chip palettes — fill + text for every color family
        "blue-fill":   "#E6F1FB",
        "blue-text":   "#0C447C",
        "blue-border": "#185FA5",
        "green-fill":  "#EAF3DE",
        "green-text":  "#27500A",
        "amber-fill":  "#FAEEDA",
        "amber-text":  "#633806",
        "red-fill":    "#FCEBEB",
        "red-text":    "#A32D2D",
        "gray-fill":   "#F1EFE8",
        "gray-text":   "#444441",

        // Special-purpose
        "mine-bg":         "rgba(255, 230, 200, 0.18)",
        skeleton:          "#E8E6E0",
        "skeleton-strong": "#DCD9D2",
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
        "17": "17px",
        "18": "18px",
        "22": "22px",
        "26": "26px",
      },
      letterSpacing: {
        wider04: "0.4px",
        wider06: "0.6px",
      },
    },
  },
  plugins: [],
};
export default config;
