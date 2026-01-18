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
          <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
            <input
              type="checkbox"
              checked={
                filteredContentLength > 0
                  ? selectedItemsSize === filteredContentLength
                  : false
              }
              onChange={onToggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
            />
          </th>
        ) : null}
        <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
          Type
        </th>
        <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
          Media
        </th>
        <th
          className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
          onClick={() => onRequestSort("caption")}
        >
          Title/Caption{" "}
          {sortConfig.key === "caption"
            ? sortConfig.direction === "asc"
              ? "↑"
              : "↓"
            : null}
        </th>
        <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
          Preview
        </th>
        <th
          className="cursor-pointer bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50"
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
        <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
          Queue
        </th>
        <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
          Status
        </th>
        <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
          Actions
        </th>
      </tr>
    </thead>
  );
}
