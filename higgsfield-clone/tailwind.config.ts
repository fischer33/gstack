import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        surface2: v("surface2"),
        line: v("line"),
        fg: v("fg"),
        muted: v("muted"),
        accent: v("accent"),
        "accent-fg": v("accent-fg"),
      },
    },
  },
  plugins: [],
};
export default config;
