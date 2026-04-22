import * as React from "react";

import { cn } from "~/lib/utils";
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // bg-transparent intentionally retained: inputs adopt parent surface.
          // Border = --border (= --input alias). Placeholder = text-tertiary.
          // Focus = `focus-ring` (flush 2px on the input edge).
          "focus-ring border-border file:text-text placeholder:text-text-tertiary shadow-1 motion-fast flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
