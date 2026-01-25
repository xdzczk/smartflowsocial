import { useFetcher } from "@remix-run/react";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

import {
  GlobalSearchResults,
  type GlobalSearchResult,
} from "./GlobalSearchResults";

interface GlobalSearchBarProps {
  className?: string;
}

export function GlobalSearchBar({ className = "" }: GlobalSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetcher = useFetcher<{
    results: GlobalSearchResult[];
    total: number;
  }>();

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      // Use setTimeout to avoid calling setState synchronously in effect
      const timeoutId = setTimeout(() => {
        setResults([]);
        setIsSearching(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    // Use setTimeout to avoid calling setState synchronously in effect
    const timeoutId1 = setTimeout(() => {
      setIsSearching(true);
    }, 0);
    const timeoutId2 = setTimeout(() => {
      fetcher.load(`/api/global-search?q=${encodeURIComponent(query)}`);
    }, 300);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [query, fetcher]);

  // Update results when fetcher data changes
  useEffect(() => {
    if (fetcher.data) {
      // Use setTimeout to avoid calling setState synchronously in effect
      const timeoutId = setTimeout(() => {
        setResults(fetcher.data?.results ?? []);
        setIsSearching(fetcher.state !== "idle");
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [fetcher.data, fetcher.state]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }

      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        setResults([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery("");
        setResults([]);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  const handleResultClick = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  // Determine if we should show results
  const showResults = isOpen && query.trim() !== "";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder="Search posts, drafts, templates... (⌘K)"
          className="block w-full rounded-lg border border-gray-200 bg-white py-2 pr-10 pl-10 text-sm placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClose}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Results Dropdown */}
      {showResults ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-2">
          <GlobalSearchResults
            results={results}
            isLoading={isSearching}
            onResultClick={handleResultClick}
          />
        </div>
      ) : null}
    </div>
  );
}
