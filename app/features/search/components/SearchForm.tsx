/**
 * Search form component
 */

import { useFetcher } from "@remix-run/react";

interface SearchFormProps {
  eventInput: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSearching: boolean;
}

export function SearchForm({
  eventInput,
  onInputChange,
  onSubmit,
  isSearching,
}: SearchFormProps) {
  const fetcher = useFetcher();

  return (
    <div className="mb-6">
      <fetcher.Form onSubmit={onSubmit} className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={eventInput}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Enter event ID (hex), note1, or nevent1..."
            className="block w-full rounded-lg border border-gray-200 px-4 py-3 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
            disabled={isSearching}
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !eventInput.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-700 px-6 py-3 text-sm font-semibold leading-5 text-white hover:border-blue-600 hover:bg-blue-600 hover:text-white focus:ring focus:ring-blue-400/50 active:border-blue-700 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Searching...
            </>
          ) : (
            <>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Search
            </>
          )}
        </button>
      </fetcher.Form>

      {/* Format hints */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        <p className="mb-1">Supported formats:</p>
        <ul className="ml-4 list-disc space-y-0.5">
          <li>Hex event ID: 64-character hex string</li>
          <li>note1: Bech32-encoded note ID</li>
          <li>nevent1: Bech32-encoded event with relay hints</li>
        </ul>
      </div>
    </div>
  );
}

