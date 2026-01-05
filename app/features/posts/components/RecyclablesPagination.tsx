import { Link, useParams } from "@remix-run/react";
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

  const basePath = params.queueType
    ? `/dashboard/recyclables/${params.queueType}`
    : "/dashboard/recyclables";

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-gray-500">
        Showing {(pagination.currentPage - 1) * pagination.limit + 1} to{" "}
        {Math.min(pagination.currentPage * pagination.limit, pagination.total)}{" "}
        of {pagination.total} posts
      </div>
      <div className="flex gap-2">
        <Link
          to={`${basePath}?page=${pagination.currentPage - 1}`}
          className={`rounded-lg border px-3 py-1 ${
            pagination.currentPage === 1
              ? "pointer-events-none opacity-50"
              : "hover:bg-gray-100"
          }`}
        >
          Previous
        </Link>
        <Link
          to={`${basePath}?page=${pagination.currentPage + 1}`}
          className={`rounded-lg border px-3 py-1 ${
            pagination.currentPage === pagination.pages
              ? "pointer-events-none opacity-50"
              : "hover:bg-gray-100"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}





