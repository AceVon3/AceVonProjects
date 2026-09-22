import type { Config } from "tailwindcss";

// Design tokens for the SPEED Training site, "Operations Binder" world.
// Source of truth is src/app/globals.css (:root variables); these names
// let components use Tailwind classes (bg-paper, text-ink-2, border-rule).
const config: Config = {
  content: ["./src/components/**/*.{ts,tsx}", "./src/app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        binder: "var(--binder)",
        "binder-deep": "var(--binder-deep)",
        "binder-edge": "var(--binder-edge)",
        paper: "var(--paper)",
        "paper-2": "var(--paper-2)",
        "paper-3": "var(--paper-3)",
        rule: "var(--rule)",
        "rule-2": "var(--rule-2)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        saffron: "var(--saffron)",
        "saffron-deep": "var(--saffron-deep)",
        tabred: "var(--red)",
        tabgreen: "var(--green)",
        tabblue: "var(--blue)",
        "on-binder": "var(--on-binder)",
        "on-binder-2": "var(--on-binder-2)",
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "Arial", "sans-serif"],
        mono: ["var(--font-courier)", "Courier New", "monospace"],
      },
      maxWidth: {
        measure: "68ch",
      },
    },
  },
  plugins: [],
};

export default config;
