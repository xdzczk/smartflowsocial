import { Checkbox } from "~/components/ui/checkbox";

interface ContentTableHeaderProps {
  type: "scheduled" | "draft" | "published";
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

export function ContentTableHeader({
  type,
  showBulkActions,
  sortConfig,
  filteredContentLength,
  selectedItemsSize,
  onToggleSelectAll,
  onRequestSort,
}: ContentTableHeaderProps) {
  const dateSortKey =
    type === "published"
      ? "publishedAt"
      : type === "scheduled"
        ? "scheduledAtUtc"
        : "updatedAt";

  return (
    <thead>
      <tr>
        {showBulkActions ? (
          <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
            <Checkbox
              id="content-select-all"
              checked={
                filteredContentLength > 0
                  ? selectedItemsSize === filteredContentLength
                  : false
              }
              onCheckedChange={() => onToggleSelectAll?.()}
            />
          </th>
        ) : null}
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
          Type
        </th>
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
          Media
        </th>
        <th
          className="bg-card border-border text-foreground cursor-pointer border-b px-3 py-4 text-left font-semibold"
          onClick={() => onRequestSort("caption")}
        >
          Title / caption{" "}
          {sortConfig.key === "caption"
            ? sortConfig.direction === "asc"
              ? "↑"
              : "↓"
            : null}
        </th>
        <th
          className="bg-card border-border text-foreground cursor-pointer border-b px-3 py-4 text-left font-semibold"
          onClick={() => onRequestSort(dateSortKey)}
        >
          {type === "published"
            ? "Published at"
            : type === "scheduled"
              ? "Scheduled For"
              : "Updated"}{" "}
          {sortConfig.key === dateSortKey
            ? sortConfig.direction === "asc"
              ? "↑"
              : "↓"
            : null}
        </th>
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
          Queue
        </th>
        {type === "draft" ? null : (
          <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
            Status
          </th>
        )}
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
          Actions
        </th>
      </tr>
    </thead>
  );
}
