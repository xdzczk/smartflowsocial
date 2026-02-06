interface ContentTableHeaderProps {
  type: "scheduled" | "draft" | "posted";
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
    type === "posted"
      ? "postedAt"
      : type === "scheduled"
        ? "scheduledAtUtc"
        : "createdAt";

  return (
    <thead>
      <tr>
        {showBulkActions ? (
          <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
            <input
              id="content-select-all"
              name="content-select-all"
              type="checkbox"
              checked={
                filteredContentLength > 0
                  ? selectedItemsSize === filteredContentLength
                  : false
              }
              onChange={onToggleSelectAll}
              className="border-border accent-checkbox focus:ring-ring h-4 w-4 rounded"
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
          Title/Caption{" "}
          {sortConfig.key === "caption"
            ? sortConfig.direction === "asc"
              ? "↑"
              : "↓"
            : null}
        </th>
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-left font-semibold">
          Preview
        </th>
        <th
          className="bg-card border-border text-foreground cursor-pointer border-b px-3 py-4 text-left font-semibold"
          onClick={() => onRequestSort(dateSortKey)}
        >
          {type === "posted"
            ? "Posted At"
            : type === "scheduled"
              ? "Scheduled For"
              : "Created At"}{" "}
          {sortConfig.key === dateSortKey
            ? sortConfig.direction === "asc"
              ? "↑"
              : "↓"
            : null}
        </th>
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
          Queue
        </th>
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
          Status
        </th>
        <th className="bg-card border-border text-foreground border-b px-3 py-4 text-center font-semibold">
          Actions
        </th>
      </tr>
    </thead>
  );
}
