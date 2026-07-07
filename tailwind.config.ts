import type { Config } from "tailwindcss";

// Design tokens for GHOps Bot.
// Direction: a dark, technical "control room" for repo activity — not the
// generic cream/terracotta or acid-green/near-black AI-default palettes.
// Signature element: the event feed is a vertical git-log-style graph
// (see components/timeline/*), so the palette leans on a graph-friendly
// indigo/emerald/amber/red set that reads clearly as connected nodes.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0B0E14", // page background
        panel: "#12161F", // card / surface background
        "panel-raised": "#171C27",
        border: {
          DEFAULT: "#1E2430",
          subtle: "#161B24",
        },
        ink: {
          DEFAULT: "#E6E9EF", // primary text
          muted: "#8A93A6", // secondary text
          faint: "#5B6472", // tertiary / disabled
        },
        signal: {
          success: "#3DD68C",
          "success-dim": "#1F5C42",
          retry: "#F5A623",
          "retry-dim": "#6B4B15",
          fail: "#F0555A",
          "fail-dim": "#5C2124",
          info: "#6C7BFF",
          "info-dim": "#2C3175",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
      keyframes: {
        "node-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "node-in": "node-in 260ms ease-out",
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
