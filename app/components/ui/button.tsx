import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";
const buttonVariants = cva(
  // Base: type, focus, transition. Focus uses the canonical `focus-ring-offset`
  // recipe (Phase 1j-2) — ring-2 with a 2px canvas-colored donut so the ring
  // reads as designed polish on top of a surface. Override with `focus-ring`
  // on inline / table-row buttons where the offset clips against neighbours.
  //
  // `tap-target` (Phase mobile polish): on coarse-pointer devices only, enforces
  // a 44×44 minimum hit area so `h-9`/`h-8`/`h-7` buttons don't become mistap
  // hazards on phones. Visual geometry is unchanged on desktop.
  "focus-ring-offset tap-target inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium motion-fast disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary action: brand-strong fill. shadow-1 (subtle) — premium, not loud.
        default:
          "bg-brand-strong text-brand-on shadow-1 hover:bg-brand-strong/92 active:bg-brand-strong/85",
        destructive:
          "bg-danger text-danger-foreground shadow-1 hover:bg-danger/92 active:bg-danger/85",
        // Outline: hairline border on canvas; hover lifts to surface-hover, not muted.
        outline:
          "border border-border bg-surface text-text shadow-1 hover:bg-surface-hover hover:border-border-strong",
        // Secondary: neutral elevated surface (no longer lavender in light mode).
        secondary:
          "bg-surface-hover text-text shadow-1 hover:bg-surface-active",
        // Ghost: no surface until hover. Tightest button.
        ghost: "text-text hover:bg-surface-hover",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        // Height ladder: 28 / 32 / 36 / 44. xs for table-row inline actions.
        xs: "h-7 rounded-md px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-8 rounded-md px-3 text-xs",
        default: "h-9 px-4 py-2",
        lg: "h-11 rounded-md px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
