import { useFetcher } from "@remix-run/react";
import { Search, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  startTransition,
} from "react";

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
      startTransition(() => {
        setResults([]);
        setIsSearching(false);
      });
      return;
    }

    startTransition(() => {
      setIsSearching(true);
    });
    const timeoutId = setTimeout(() => {
      fetcher.load(`/api/global-search?q=${encodeURIComponent(query)}`);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query, fetcher]);

  // Update results when fetcher data changes
  useEffect(() => {
    if (fetcher.data) {
      startTransition(() => {
        setResults(fetcher.data.results);
      });
    }
    // Update searching state based on fetcher state
    startTransition(() => {
      setIsSearching(
        fetcher.state === "loading" || fetcher.state === "submitting"
      );
    });
  }, [fetcher.data, fetcher.state]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        // Use requestAnimationFrame for smoother focus
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
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
    const newQuery = e.target.value;
    setQuery(newQuery);
    // Keep dropdown open when typing
    if (newQuery.trim() && !isOpen) {
      setIsOpen(true);
    }
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

  // Determine if we should show results dropdown
  // Show when open and either has query text or is currently searching
  const showResults = isOpen && (query.trim() !== "" || isSearching);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="text-muted-foreground h-4 w-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder="Search posts, drafts, templates... (⌘K)"
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/50 block w-full rounded-lg border py-2 pr-10 pl-10 text-sm focus:ring focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-3"
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
