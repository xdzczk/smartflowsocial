interface AssetPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function AssetPagination({
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
}: AssetPaginationProps) {
  // Always show first, last, current, and 2 pages around current
  const getVisiblePages = () => {
    const pages: (number | "ellipsis")[] = [];
    const addPage = (page: number) => {
      if (!pages.includes(page)) pages.push(page);
    };

    // Always add first page
    addPage(1);

    // Add pages around current
    for (
      let i = Math.max(2, currentPage - 2);
      i <= Math.min(totalPages - 1, currentPage + 2);
      i++
    ) {
      if (pages[pages.length - 1] !== i - 1) {
        pages.push("ellipsis");
      }
      addPage(i);
    }

    // Always add last page
    if (totalPages > 1) {
      if (
        pages[pages.length - 1] !== totalPages - 1 &&
        pages[pages.length - 1] !== "ellipsis"
      ) {
        pages.push("ellipsis");
      }
      addPage(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Page {currentPage} of {totalPages} ({totalCount} total assets)
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          Previous
        </button>

        <div className="flex gap-1">
          {getVisiblePages().map((page, index) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 py-1 text-gray-500"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`rounded px-3 py-1 text-sm ${
                  currentPage === page
                    ? "bg-blue-600 text-white"
                    : "border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                }`}
              >
                {page}
              </button>
            ),
          )}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}
