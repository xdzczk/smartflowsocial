import { Checkbox } from "~/components/ui/checkbox";

interface DraftsHybridTableHeaderProps {
  showBulkActions: boolean;
  sortConfig: {
    key: string;
    direction: "asc" | "desc";
  };
  filteredContentLength: number;
  selectedItemsSize: number;
  onToggleSelectAll?: () => void;
  onRequestSort: (key: string) => void;
}

export function DraftsHybridTableHeader({
  showBulkActions,
  sortConfig,
  filteredContentLength,
  selectedItemsSize,
  onToggleSelectAll,
  onRequestSort,
}: DraftsHybridTableHeaderProps) {
  const dateSortKey = "updatedAt";

  return (
    <thead>
      <tr>
        {showBulkActions ? (
          <th className="bg-card border-border text-foreground w-12 border-b px-3 py-4 text-center font-semibold">
            <Checkbox
              id="drafts-hybrid-select-all"
              checked={
                filteredContentLength > 0
                  ? selectedItemsSize === filteredContentLength
                  : false
              }
              onCheckedChange={() => onToggleSelectAll?.()}
            />
          </th>
        ) : null}
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left text-sm font-semibold">
          Type
        </th>
        <th
          className="bg-card border-border text-foreground cursor-pointer border-b px-3 py-4 text-left text-sm font-semibold"
          onClick={() => onRequestSort("caption")}
        >
          Title{" "}
          {sortConfig.key === "caption"
            ? sortConfig.direction === "asc"
              ? "↑"
              : "↓"
            : null}
        </th>
        <th
          className="bg-card border-border text-foreground cursor-pointer border-b px-3 py-4 text-left text-sm font-semibold whitespace-nowrap"
          onClick={() => onRequestSort(dateSortKey)}
        >
          Updated{" "}
          {sortConfig.key === dateSortKey
            ? sortConfig.direction === "asc"
              ? "↑"
              : "↓"
            : null}
        </th>
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center text-sm font-semibold">
          Queue
        </th>
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center text-sm font-semibold">
          Actions
        </th>
      </tr>
    </thead>
  );
}
