// Minimal config for Tailwind v4
// Most configuration is now in CSS using @theme directive
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./tests/**/*.{ts,tsx}",
    "./server.ts",
    "./worker.ts",
    // Explicitly include all route files to ensure they're scanned
    "./app/routes/**/*.{ts,tsx}",
    "./app/components/**/*.{ts,tsx}",
    "./app/features/**/*.{ts,tsx}",
  ],
  // Safelist for dynamic classes (critical for dynamic color generation)
  // Also includes Plans page classes to ensure they're generated in Docker builds
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
    // Plans page classes - ensure these are always generated
    "container",
    "mx-auto",
    "px-4",
    "py-16",
    "lg:px-8",
    "lg:py-32",
    "xl:max-w-7xl",
    "mb-16",
    "text-center",
    "mb-2",
    "inline-flex",
    "rounded",
    "border",
    "px-2",
    "py-1",
    "text-sm",
    "leading-4",
    "font-medium",
    "mb-4",
    "text-4xl",
    "font-black",
    "mx-auto",
    "max-w-2xl",
    "text-xl",
    "leading-relaxed",
    "font-medium",
    "grid",
    "grid-cols-1",
    "gap-8",
    "md:grid-cols-2",
    "lg:grid-cols-4",
    // Color classes used on Plans page
    "bg-white",
    "dark:bg-gray-900",
    "dark:text-gray-100",
    "bg-amber-200",
    "bg-amber-300",
    "text-amber-700",
    "dark:border-amber-800",
    "dark:bg-amber-950",
    "dark:text-amber-200",
    "text-black",
    "dark:text-white",
    "text-gray-700",
    "dark:text-gray-300",
  ],
  // Note: tailwindcss-animate plugin generates CSS with nesting syntax
  // This may cause harmless CSS syntax warnings from esbuild about `:where(& > ...)`
  // These warnings can be safely ignored - the CSS works correctly in browsers
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
