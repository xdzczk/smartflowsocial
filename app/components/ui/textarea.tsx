import * as React from "react";

import { cn } from "~/lib/utils";
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "focus-ring border-border placeholder:text-text-tertiary shadow-1 flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-base disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
