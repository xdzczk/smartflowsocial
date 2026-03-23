import { MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type {
  ParsedRecipientRow,
  RecipientParseStatus,
} from "~/features/broadcast/broadcast-recipient-parse";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

const STATUS_LABEL: Record<RecipientParseStatus, string> = {
  valid: "Valid",
  duplicate: "Duplicate",
  invalid_format: "Invalid",
  invalid_length: "Invalid length",
  unsupported_link: "Unsupported link",
  empty: "Empty",
};

export type ReviewFilter = "all" | "valid" | "invalid" | "duplicate";

export interface RecipientReviewTableProps {
  rows: ParsedRecipientRow[];
  filter: ReviewFilter;
  onFilterChange: (f: ReviewFilter) => void;
  onRemoveRow: (index: number) => void;
  onRemoveInvalid: () => void;
  onRemoveDuplicates: () => void;
  onExportInvalid: () => void;
}

function shortPubkey(hex: string | null): string {
  if (!hex || hex.length < 16) return "—";
  return `${hex.slice(0, 8)}…${hex.slice(-6)}`;
}

function matchesFilter(r: ParsedRecipientRow, filter: ReviewFilter): boolean {
  if (filter === "all") return true;
  if (filter === "valid") return r.status === "valid";
  if (filter === "invalid")
    return (
      r.status === "invalid_format" ||
      r.status === "invalid_length" ||
      r.status === "unsupported_link"
    );
  return r.status === "duplicate";
}

export function RecipientReviewTable({
  rows,
  filter,
  onFilterChange,
  onRemoveRow,
  onRemoveInvalid,
  onRemoveDuplicates,
  onExportInvalid,
}: RecipientReviewTableProps) {
  const counts = {
    all: rows.length,
    valid: rows.filter((r) => r.status === "valid").length,
    invalid: rows.filter(
      (r) =>
        r.status === "invalid_format" ||
        r.status === "invalid_length" ||
        r.status === "unsupported_link"
    ).length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All", counts.all],
            ["valid", "Valid", counts.valid],
            ["invalid", "Invalid", counts.invalid],
            ["duplicate", "Duplicates", counts.duplicate],
          ] as const
        ).map(([k, label, n]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              onFilterChange(k);
            }}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium",
              filter === k
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {label} ({String(n)})
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRemoveInvalid}
        >
          Remove invalid
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRemoveDuplicates}
        >
          Remove duplicates
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExportInvalid}
        >
          Export invalid
        </Button>
      </div>
      <div className="border-border max-h-64 overflow-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Recipient</th>
              <th className="px-2 py-1.5">Raw</th>
              <th className="w-8 px-1" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.every((r) => !matchesFilter(r, filter)) ? (
              <tr>
                <td
                  colSpan={4}
                  className="text-muted-foreground px-2 py-4 text-center"
                >
                  No rows match this filter.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                if (!matchesFilter(r, filter)) return null;
                return (
                  <tr key={`row-${String(i)}-${r.raw.slice(0, 24)}`}>
                    <td className="px-2 py-1">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5",
                          r.status === "valid"
                            ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                            : r.status === "duplicate"
                              ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
                              : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-2 py-1 font-mono">
                      {shortPubkey(r.normalizedHex)}
                    </td>
                    <td className="text-muted-foreground max-w-[140px] truncate px-2 py-1">
                      {r.raw}
                    </td>
                    <td className="px-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Row actions"
                          >
                            <MoreHorizontal
                              className="h-4 w-4"
                              strokeWidth={INLINE_ICON_STROKE}
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              onRemoveRow(i);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                          {r.normalizedHex ? (
                            <DropdownMenuItem
                              onClick={() => {
                                void navigator.clipboard.writeText(
                                  r.normalizedHex!
                                );
                              }}
                            >
                              Copy pubkey
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
