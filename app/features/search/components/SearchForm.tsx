/**
 * Search form component
 */

import { useFetcher } from "@remix-run/react";
import { Loader2, Search } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import {
  FormControl,
  FormField,
  FormMessage,
} from "~/components/ui/form-field";
import { Input } from "~/components/ui/input";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
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
        <FormField
          id="eventInput"
          className="flex-1"
          error={form.formState.errors.eventInput?.message}
        >
          <FormControl>
            <Input
              type="text"
              {...form.register("eventInput")}
              placeholder="Enter event ID (hex), note1, or nevent1..."
              className="rounded-lg px-4 py-3 leading-6"
              disabled={isSearching}
            />
          </FormControl>
          <FormMessage />
        </FormField>
        <button
          type="submit"
          disabled={isSearching || !form.formState.isValid}
          className="border-brand bg-brand text-brand-on hover:border-brand/90 hover:bg-brand/90 hover:text-brand-on focus-visible:ring-focus-ring/50 active:border-brand active:bg-brand inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 text-sm leading-5 font-semibold focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSearching ? (
            <>
              <Loader2
                className={`${INLINE_ICON_SIZE_CLASS} animate-spin`}
                aria-hidden
              />
              Searching...
            </>
          ) : (
            <>
              <Search
                className="h-5 w-5"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
              Search
            </>
          )}
        </button>
      </fetcher.Form>

      {/* Format hints */}
      <div className="dark:text-text-secondary text-text-secondary mt-2 text-xs">
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
