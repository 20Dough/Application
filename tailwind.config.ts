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
        // HiveMind dark workspace palette
        hive: {
          bg: "#0d1117",
          surface: "#161b22",
          panel: "#1c2128",
          border: "#30363d",
          muted: "#8b949e",
          text: "#e6edf3",
          accent: "#f5a623",
          "accent-soft": "#3b2f14",
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
