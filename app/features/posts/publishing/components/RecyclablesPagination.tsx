import { Link, useParams, useSearchParams } from "@remix-run/react";
interface Pagination {
  currentPage: number;
  limit: number;
  total: number;
  pages: number;
}

interface RecyclablesPaginationProps {
  pagination: Pagination;
}

/**
 * Pagination controls for recyclables posts
 */
export function RecyclablesPagination({
  pagination,
}: RecyclablesPaginationProps) {
  const params = useParams();
  const [searchParams] = useSearchParams();

  const basePath = params["queueType"]
    ? `/dashboard/recyclables/${params["queueType"]}`
    : "/dashboard/recyclables";

  const searchWithPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    return next.toString();
  };

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-text-secondary text-sm">
        Showing {(pagination.currentPage - 1) * pagination.limit + 1} to{" "}
        {Math.min(pagination.currentPage * pagination.limit, pagination.total)}{" "}
        of {pagination.total} posts
      </div>
      <div className="flex gap-2">
        <Link
          to={`${basePath}?${searchWithPage(pagination.currentPage - 1)}`}
          className={`rounded-lg border px-3 py-1 ${
            pagination.currentPage === 1
              ? "pointer-events-none opacity-50"
              : "hover:bg-surface-hover"
          }`}
        >
          Previous
        </Link>
        <Link
          to={`${basePath}?${searchWithPage(pagination.currentPage + 1)}`}
          className={`rounded-lg border px-3 py-1 ${
            pagination.currentPage === pagination.pages
              ? "pointer-events-none opacity-50"
              : "hover:bg-surface-hover"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
