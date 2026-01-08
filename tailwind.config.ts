// Minimal config for Tailwind v4
// Most configuration is now in CSS using @theme directive
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./tests/**/*.{ts,tsx}",
    "./server.ts",
    "./worker.ts",
  ],
  // Safelist for dynamic classes (critical for dynamic color generation)
  safelist: [
    // Dynamic color classes from getDynamicQueueStyle
    {
      pattern: /^(bg|text|border)-\[#[0-9A-Fa-f]{6}\]$/,
      variants: ["dark", "hover", "dark:hover"],
    },
    // Dynamic opacity classes
    {
      pattern: /^(bg-opacity|text-opacity|border-opacity)-(20|30|50|70|100)$/,
      variants: ["dark", "hover", "dark:hover"],
    },
    // Scale transforms used in queue styles
    "scale-105",
    "transform",
  ],
  // Note: tailwindcss-animate plugin generates CSS with nesting syntax
  // This may cause harmless CSS syntax warnings from esbuild about `:where(& > ...)`
  // These warnings can be safely ignored - the CSS works correctly in browsers
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
