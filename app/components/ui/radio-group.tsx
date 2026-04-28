/**
 * Exclusive-choice controls: use `RadioGroup` + `RadioGroupItem`. For Remix POST
 * forms that require real `input[name]` fields, use `native-radio.tsx` instead.
 *
 * Control taxonomy: see `control-primitives.ts`.
 */
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as React from "react";

import { cn } from "~/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn("grid gap-2", className)}
    {...props}
  />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "focus-ring border-input bg-surface text-action-primary shadow-1 aspect-square h-4 w-4 shrink-0 rounded-full border outline-none",
      "data-[state=checked]:border-action-primary",
      "disabled:border-border disabled:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-70",
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <span className="bg-action-primary block h-2 w-2 rounded-full" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
