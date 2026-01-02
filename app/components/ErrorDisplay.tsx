/**
 * Client-side Error Display Component
 *
 * Displays user-friendly error messages in the UI
 */

import { showErrorToast as showErrorToastUtil } from "~/lib/error-handler.client";
import type { ErrorResponse } from "~/lib/error-handler.server";

interface ErrorDisplayProps {
  error: ErrorResponse["error"] | string;
  variant?: "toast" | "inline" | "alert";
}

/**
 * Display error as a toast notification
 * @deprecated Use showErrorToast from ~/lib/error-handler.client instead
 */
export function showErrorToast(error: ErrorResponse["error"] | string): void {
  showErrorToastUtil(error);
}

/**
 * Display error inline in the UI
 */
export function ErrorDisplay({ error, variant = "alert" }: ErrorDisplayProps) {
  const errorMessage = typeof error === "string" ? error : error.message;
  const errorCode = typeof error === "string" ? undefined : error.code;

  if (variant === "toast") {
    showErrorToast(error);
    return null;
  }

  if (variant === "alert") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              {errorCode ? `Error: ${errorCode}` : "An error occurred"}
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              <p>{errorMessage}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Inline variant
  return (
    <div className="text-sm text-red-600 dark:text-red-400">{errorMessage}</div>
  );
}
