import { cn } from "~/lib/utils";

/** Main-column form fields aligned with rail field grammar, slightly larger type. */
export const campaignFieldClassNames = cn(
  "border-border bg-canvas text-text placeholder:text-text-tertiary",
  "h-10 w-full rounded-md border px-3 text-sm shadow-none",
  "transition-colors",
  "focus-visible:ring-focus-ring focus-visible:outline-none focus-visible:ring-1",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

export const campaignSelectClassNames = cn(campaignFieldClassNames, "py-0");
