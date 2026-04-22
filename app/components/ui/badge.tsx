import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "~/lib/utils";

const badgeVariants = cva(
  // Pill shape via --radius-full (ladder), tighter padding for premium density.
  "focus-ring inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium motion-fast",
  {
    variants: {
      variant: {
        // Neutral chip — surface-hover + border, no fill saturation.
        default: "border-border bg-surface-hover text-text",
        // Secondary now reads as neutral elevated (lavender retired in tokens).
        secondary: "border-transparent bg-surface-active text-text",
        // Status intents — tinted wash + saturated dark/light text token for AA.
        success: "border-success/30 bg-success/15 text-success-text",
        warning: "border-warning/40 bg-warning/15 text-warning-text",
        destructive: "border-danger/30 bg-danger/15 text-danger-text",
        // Brand emphasis — used sparingly (recommended for "new", "beta", etc.)
        brand: "border-brand/30 bg-brand/12 text-brand-text",
        // Outline — hairline only, transparent fill.
        outline: "border-border text-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
