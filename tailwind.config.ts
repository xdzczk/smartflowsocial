// Minimal config for Tailwind v4.
// Most of the design system lives in CSS via the `@theme` directive
// (see app/tailwind.css). This config only exists to scope content
// scanning and to safelist the few classes that the scanner cannot
// see  -  primarily the per-queue hex color utilities built from the
// `QUEUE_COLOR_ACCENTS` map at runtime (see app/features/posts/queue-colors.ts).
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./tests/**/*.{ts,tsx}",
    "./server.ts",
    "./worker.ts",
  ],
  // Keep this list short. Anything added here ships in every build  -
  // prefer literal class strings in source over adding here. We only safelist
  // classes whose *full string* is assembled at runtime from data we control
  // (hex color palette, percentage opacities). Everything else  -  including the
  // PlansPage, PricingCard, and FeatureComparisonTable  -  now uses design tokens
  // (`bg-surface`, `text-text`, `border-border`…) and is picked up by content
  // scanning automatically.
  safelist: [
    // Queue color utilities: `bg-[#2563EB]`, `text-[#2563EB]`, `border-[#2563EB]`
    // with optional `/NN` or `/[0.NN]` opacity suffix, plus hover/dark variants.
    // Produced by getQueueColor() from the 12-token palette in queue-colors.ts.
    {
      pattern:
        /^(bg|text|border)-\[#[0-9A-Fa-f]{6}\](\/(?:\d{1,3}|\[0\.\d+\]))?$/,
      variants: ["dark", "hover", "dark:hover"],
    },
    // Legacy arbitrary opacity helpers used by a few media-player overlays
    // (MediaModal, MediaPlayer, MediaThumbnail). These are literal in source
    // but the regex shape keeps us covered if we add more of the same family.
    {
      pattern: /^(bg-opacity|text-opacity|border-opacity)-(20|30|50|70|100)$/,
      variants: ["dark", "hover", "dark:hover", "group-hover"],
    },
  ],
  // Note: tailwindcss-animate plugin generates CSS with nesting syntax
  // This may cause harmless CSS syntax warnings from esbuild about `:where(& > ...)`
  // These warnings can be safely ignored - the CSS works correctly in browsers.
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
