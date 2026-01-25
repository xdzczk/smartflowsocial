import { Link } from "@remix-run/react";
import {
  FileText,
  Calendar,
  Clock,
  FolderOpen,
  ExternalLink,
  Loader2,
  XCircle,
  Ban,
} from "lucide-react";

export interface GlobalSearchResult {
  type:
    | "draft"
    | "scheduled"
    | "publishing"
    | "posted"
    | "failed"
    | "cancelled"
    | "template"
    | "external";
  id: string;
  title?: string;
  caption?: string;
  content?: string;
  summary?: string;
  status: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  scheduledAt?: Date | string;
  postedAt?: Date | string;
  url: string;
  isLongform?: boolean;
}

interface GlobalSearchResultsProps {
  results: GlobalSearchResult[];
  isLoading?: boolean;
  onResultClick?: () => void;
}

function getTypeIcon(type: GlobalSearchResult["type"]) {
  switch (type) {
    case "draft":
      return <FileText className="h-4 w-4" />;
    case "scheduled":
      return <Calendar className="h-4 w-4" />;
    case "publishing":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "posted":
      return <Clock className="h-4 w-4" />;
    case "failed":
      return <XCircle className="h-4 w-4" />;
    case "cancelled":
      return <Ban className="h-4 w-4" />;
    case "template":
      return <FolderOpen className="h-4 w-4" />;
    case "external":
      return <ExternalLink className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getTypeLabel(type: GlobalSearchResult["type"]): string {
  switch (type) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "publishing":
      return "Publishing";
    case "posted":
      return "Posted";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "template":
      return "Template";
    case "external":
      return "External";
    default:
      return "Unknown";
  }
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return dateObj.toLocaleDateString();
}

function getPreviewText(result: GlobalSearchResult): string {
  if (result.title) return result.title;
  if (result.caption) {
    return result.caption.length > 60
      ? `${result.caption.substring(0, 60)}...`
      : result.caption;
  }
  if (result.summary) {
    return result.summary.length > 60
      ? `${result.summary.substring(0, 60)}...`
      : result.summary;
  }
  if (result.content) {
    return result.content.length > 60
      ? `${result.content.substring(0, 60)}...`
      : result.content;
  }
  return "No preview available";
}

export function GlobalSearchResults({
  results,
  isLoading = false,
  onResultClick,
}: GlobalSearchResultsProps) {
  if (isLoading) {
    return (
      <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-center p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Searching...
          </span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No results found
        </div>
      </div>
    );
  }

  // Group results by type
  const groupedResults = results.reduce<Record<string, GlobalSearchResult[]>>(
    (acc, result) => {
      const type = result.type;
      acc[type] ??= [];
      acc[type].push(result);
      return acc;
    },
    {}
  );

  return (
    <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
      {Object.entries(groupedResults).map(([type, typeResults]) => (
        <div
          key={type}
          className="border-b border-gray-200 last:border-b-0 dark:border-gray-700"
        >
          <div className="bg-gray-50 px-4 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:bg-gray-900 dark:text-gray-400">
            {getTypeLabel(type as GlobalSearchResult["type"])}
          </div>
          {typeResults.map((result) => (
            <Link
              key={result.id}
              to={result.url}
              onClick={onResultClick}
              className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="mt-0.5 flex-shrink-0 text-gray-400">
                {getTypeIcon(result.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {getPreviewText(result)}
                  </span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {getTypeLabel(result.type)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(result.createdAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
