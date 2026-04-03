import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "~/lib/utils";
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer group inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 shadow-sm transition-[background-color,border-color] duration-200 ease-out outline-none",
      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none",
      "data-[state=unchecked]:border-[hsl(var(--switch-border-off))] data-[state=unchecked]:bg-[hsl(var(--switch-track-off))]",
      "hover:data-[state=unchecked]:border-[hsl(var(--switch-border-off-hover))] hover:data-[state=unchecked]:bg-[hsl(var(--switch-track-off-hover))]",
      "data-[state=checked]:border-[hsl(var(--switch-border-on))] data-[state=checked]:bg-[hsl(var(--switch-track-on))]",
      "hover:data-[state=checked]:border-[hsl(var(--switch-border-on-hover))] hover:data-[state=checked]:bg-[hsl(var(--switch-track-on-hover))]",
      "disabled:pointer-events-none disabled:cursor-not-allowed",
      "disabled:data-[state=unchecked]:border-[hsl(var(--switch-border-off-disabled))] disabled:data-[state=unchecked]:bg-[hsl(var(--switch-track-off-disabled))]",
      "disabled:data-[state=checked]:border-[hsl(var(--switch-border-on-disabled))] disabled:data-[state=checked]:bg-[hsl(var(--switch-track-on-disabled))]",
      "disabled:hover:data-[state=unchecked]:border-[hsl(var(--switch-border-off-disabled))] disabled:hover:data-[state=unchecked]:bg-[hsl(var(--switch-track-off-disabled))]",
      "disabled:hover:data-[state=checked]:border-[hsl(var(--switch-border-on-disabled))] disabled:hover:data-[state=checked]:bg-[hsl(var(--switch-track-on-disabled))]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-sm transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        "data-[state=unchecked]:bg-[hsl(var(--switch-thumb-off))] data-[state=unchecked]:shadow-[0_1px_2px_hsl(0_0%_0%/0.14)]",
        "dark:data-[state=unchecked]:shadow-[0_1px_3px_hsl(0_0%_0%/0.4)]",
        "data-[state=checked]:bg-[hsl(var(--switch-thumb-on))] data-[state=checked]:shadow-[0_1px_2px_hsl(255_97%_20%/0.35)]",
        "group-disabled:data-[state=unchecked]:bg-[hsl(var(--switch-thumb-off-disabled))] group-disabled:data-[state=unchecked]:shadow-none",
        "group-disabled:data-[state=checked]:bg-[hsl(var(--switch-thumb-on-disabled))] group-disabled:data-[state=checked]:shadow-none"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
