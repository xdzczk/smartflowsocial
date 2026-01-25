/**
 * Search form component
 */

import { useFetcher } from "@remix-run/react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import type { searchFormClientSchema } from "~/lib/validation";

interface SearchFormProps {
  form: UseFormReturn<z.infer<typeof searchFormClientSchema>>;
  onSubmit: (e: React.FormEvent) => void;
  isSearching: boolean;
}

export function SearchForm({ form, onSubmit, isSearching }: SearchFormProps) {
  const fetcher = useFetcher();

  return (
    <div className="mb-6">
      <fetcher.Form onSubmit={onSubmit} className="flex gap-2">
        <div className="flex-1">
          <input
            id="eventInput"
            type="text"
            {...form.register("eventInput")}
            placeholder="Enter event ID (hex), note1, or nevent1..."
            className="dark:border-border dark:bg-card dark:focus:border-primary border-border placeholder-muted-foreground block w-full rounded-lg border px-4 py-3 text-sm leading-6 focus:border-blue-500 focus:ring focus:ring-blue-500/50"
            disabled={isSearching}
          />
          {form.formState.errors.eventInput ? (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {form.formState.errors.eventInput.message}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={isSearching || !form.formState.isValid}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-700 bg-blue-700 px-6 py-3 text-sm leading-5 font-semibold text-white hover:border-blue-600 hover:bg-blue-600 hover:text-white focus:ring focus:ring-blue-400/50 active:border-blue-700 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
      <div className="dark:text-muted-foreground text-muted-foreground mt-2 text-xs">
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
