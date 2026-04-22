import type { ReactNode } from "react";

import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export function ProofEntitySelector({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  emptyMessage,
  className,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <Input
        type="search"
        value={search}
        onChange={(e) => {
          onSearchChange(e.target.value);
        }}
        placeholder={searchPlaceholder}
        className="h-9"
      />
      <div className="max-h-[min(60vh,520px)] space-y-1 overflow-y-auto pr-1">
        {emptyMessage != null && children == null ? (
          <p className="text-text-secondary text-sm">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
