import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export interface AuthActionRowProps {
  children: ReactNode;
  className?: string;
}

export function AuthActionRow({ children, className }: AuthActionRowProps) {
  return (
    <div
      className={cn(
        "stack-tight pt-1 sm:flex-row sm:flex-wrap sm:items-center",
        className
      )}
    >
      {children}
    </div>
  );
}
