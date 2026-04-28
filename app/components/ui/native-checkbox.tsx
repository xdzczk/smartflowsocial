/**
 * Styled native checkbox for Remix `<Form>` posts where real `name`/`value`
 * fields are required. Prefer `checkbox.tsx` (Radix) for app-controlled UI.
 *
 * Control taxonomy: see `control-primitives.ts`.
 */
import * as React from "react";

import { cn } from "~/lib/utils";

export type NativeCheckboxProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type"
>;

const NativeCheckbox = React.forwardRef<HTMLInputElement, NativeCheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "accent-action-primary focus-ring border-input bg-surface shadow-1 h-4 w-4 shrink-0 rounded-sm border",
        "disabled:border-border disabled:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
);
NativeCheckbox.displayName = "NativeCheckbox";

export { NativeCheckbox };
