import { cn } from "~/lib/utils";

/**
 * Native `<input>` / `<textarea>` on campaign flows  -  visual parity with
 * `~/components/ui/input` (surface, shadow-1, focus-ring), without Radix.
 */
export const campaignFieldClassNames = cn(
  "focus-ring border-border bg-surface text-text placeholder:text-text-tertiary",
  "shadow-1 motion-fast h-9 w-full rounded-md border px-3 py-1 text-sm",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

/** Native `<select>`  -  same ladder; slightly taller vertical padding for glyphs. */
export const campaignSelectClassNames = cn(
  campaignFieldClassNames,
  "block py-1.5"
);

/** Giveaways / Contests / Broadcasts layout shell (sub-nav + outlet). */
export const campaignSectionLayoutClassNames = "space-y-6";

export const campaignSectionSubNavClassNames =
  "border-border flex flex-wrap gap-1 border-b pb-2";
