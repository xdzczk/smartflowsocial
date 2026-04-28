/**
 * Binary selection (list/table inclusion, multi-option forms). For native form
 * POSTs use `native-checkbox.tsx`. For on/off settings at scale use `switch.tsx`.
 *
 * Control taxonomy: see `control-primitives.ts`.
 */
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import * as React from "react";

import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "focus-ring peer group border-input bg-surface shadow-1 relative h-4 w-4 shrink-0 rounded-sm border outline-none",
      "data-[state=checked]:border-action-primary data-[state=checked]:bg-action-primary data-[state=checked]:text-action-primary-foreground",
      "data-[state=indeterminate]:border-action-primary data-[state=indeterminate]:bg-action-primary data-[state=indeterminate]:text-action-primary-foreground",
      "disabled:border-border disabled:cursor-not-allowed disabled:opacity-70",
      "disabled:data-[state=checked]:border-border disabled:data-[state=checked]:bg-surface-hover disabled:data-[state=checked]:text-text-secondary",
      "disabled:data-[state=indeterminate]:border-border disabled:data-[state=indeterminate]:bg-surface-hover disabled:data-[state=indeterminate]:text-text-secondary",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      <Check
        className={cn(
          INLINE_ICON_SIZE_CLASS,
          "hidden group-data-[state=checked]:block"
        )}
      />
      <Minus
        className={cn(
          INLINE_ICON_SIZE_CLASS,
          "hidden group-data-[state=indeterminate]:block"
        )}
      />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
