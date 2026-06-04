import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware workspace palette (CSS variables defined in globals.css;
        // RGB channels so opacity modifiers like `text-hive-text/80` work).
        hive: {
          bg: "rgb(var(--hive-bg) / <alpha-value>)",
          surface: "rgb(var(--hive-surface) / <alpha-value>)",
          panel: "rgb(var(--hive-panel) / <alpha-value>)",
          border: "rgb(var(--hive-border) / <alpha-value>)",
          muted: "rgb(var(--hive-muted) / <alpha-value>)",
          text: "rgb(var(--hive-text) / <alpha-value>)",
          accent: "rgb(var(--hive-accent) / <alpha-value>)",
          "accent-soft": "rgb(var(--hive-accent-soft) / <alpha-value>)",
        },
        agent: {
          ari: "#10a37f",
          cloudy: "#d97757",
          gemini: "#4285f4",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
