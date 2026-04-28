/**
 * Styled native radio for Remix `<Form>` posts where real `name`/`value`
 * fields are required. Prefer `radio-group.tsx` (Radix) for client-only choice UI.
 *
 * Control taxonomy: see `control-primitives.ts`.
 */
import * as React from "react";

import { cn } from "~/lib/utils";

export type NativeRadioProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type"
>;

const NativeRadio = React.forwardRef<HTMLInputElement, NativeRadioProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="radio"
      className={cn(
        "accent-action-primary focus-ring border-input bg-surface shadow-1 h-4 w-4 shrink-0 rounded-full border",
        "disabled:border-border disabled:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
);
NativeRadio.displayName = "NativeRadio";

export { NativeRadio };
