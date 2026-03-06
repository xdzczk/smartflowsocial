import { useFetcher, useLocation, useNavigate } from "@remix-run/react";
import { Search, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  startTransition,
} from "react";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "~/components/ui/popover";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";

import {
  GlobalSearchResults,
  type GlobalSearchResult,
} from "./GlobalSearchResults";

interface GlobalSearchBarProps {
  className?: string;
}

/** Detect if query looks like a Nostr event link (note1, nevent1, nostr:..., or 64-char hex) so we can search immediately on paste */
function isNostrEventLink(query: string): boolean {
  const t = query.trim();
  return (
    t.startsWith("note1") ||
    t.startsWith("nevent1") ||
    t.startsWith("nostr:note1") ||
    t.startsWith("nostr:nevent1") ||
    /^[0-9a-f]{64}$/i.test(t)
  );
}

/** Derive search priority context from current path so results from current page appear first */
function getSearchPriorityContext(pathname: string): string | null {
  if (pathname.startsWith("/dashboard/scheduled")) return "scheduled";
  if (pathname.startsWith("/dashboard/published")) return "published";
  if (pathname.startsWith("/dashboard/drafts")) return "draft";
  if (
    pathname.startsWith("/dashboard/templates") ||
    pathname.includes("/templates")
  )
    return "template";
  return null;
}

export function GlobalSearchBar({ className = "" }: GlobalSearchBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const priorityContext = getSearchPriorityContext(location.pathname);

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
  const searchRequestIdRef = useRef(0);
  const currentQueryRef = useRef("");
  const resultsQueryRef = useRef(""); // Track which query the current results are for

  // Debounce search with request tracking
  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery || trimmedQuery.length < 2) {
      // Require at least 2 characters to search
      startTransition(() => {
        setResults([]);
        setIsSearching(false);
      });
      currentQueryRef.current = "";
      resultsQueryRef.current = "";
      return;
    }

    // If we already have results for this exact query, don't search again
    if (resultsQueryRef.current === trimmedQuery && results.length > 0) {
      return;
    }

    // Increment request ID to track the current request
    const currentRequestId = ++searchRequestIdRef.current;
    currentQueryRef.current = trimmedQuery;

    startTransition(() => {
      setIsSearching(true);
    });

    const isNostrLink = isNostrEventLink(trimmedQuery);
    if (isNostrLink) {
      // Redirect straight to post viewer; its loader will fetch and show the post
      navigate(`/dashboard/search/posts?q=${encodeURIComponent(trimmedQuery)}`);
      startTransition(() => {
        setQuery("");
        setResults([]);
        setIsOpen(false);
      });
      return;
    }

    const timeoutId = setTimeout(() => {
      // Only proceed if this is still the current request and query hasn't changed
      if (
        currentRequestId === searchRequestIdRef.current &&
        currentQueryRef.current === trimmedQuery
      ) {
        const params = new URLSearchParams({ q: trimmedQuery });
        if (priorityContext) params.set("context", priorityContext);
        fetcher.load(`/api/global-search?${params.toString()}`);
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only depend on query, not fetcher
  }, [query]);

  // Update results when fetcher data changes
  useEffect(() => {
    // Only update if fetcher is idle (request completed) and we have data
    if (fetcher.state === "idle") {
      if (fetcher.data) {
        const data = fetcher.data;
        // Only update if this data is for the current query
        if (currentQueryRef.current === query.trim()) {
          startTransition(() => {
            setResults(data.results);
            setIsSearching(false);
            resultsQueryRef.current = query.trim(); // Remember which query these results are for
          });
        }
      } else {
        // Request completed but no data - might be empty query or error
        // Only update if this is for the current query
        if (currentQueryRef.current === query.trim()) {
          startTransition(() => {
            setIsSearching(false);
          });
        }
      }
    } else {
      // Show searching state when loading or submitting (only if we're searching for the current query)
      if (currentQueryRef.current === query.trim()) {
        startTransition(() => {
          setIsSearching(true);
        });
      }
    }
  }, [fetcher.data, fetcher.state, query]);

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

  // Close handled by Popover (onOpenChange) when clicking outside

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
    <Popover
      open={showResults}
      onOpenChange={(open) => {
        if (!open) {
          // Only close the dropdown; do not clear query. Clearing happens on X button or Escape.
          // This prevents the input from being cleared when user clicks inside it to move the cursor
          // (Radix treats that as outside the portaled content and fires onOpenChange(false)).
          setIsOpen(false);
        }
      }}
    >
      <PopoverAnchor asChild>
        <div ref={containerRef} className={`relative ${className}`}>
          {/* Search Input */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
              <Search className="text-muted-foreground h-4 w-4" />
            </div>
            <input
              ref={inputRef}
              id="global-search"
              name="global-search"
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder="Search or paste Nostr link (note1, nevent1, nostr:...) (⌘K)"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-ring/50 block w-full rounded-lg border py-1.5 pr-8 pl-8 text-sm focus:ring focus:outline-none sm:py-2 sm:pr-10 sm:pl-10"
            />
            {query ? (
              <button
                type="button"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3"
              >
                <X className={INLINE_ICON_SIZE_CLASS} />
              </button>
            ) : null}
          </div>
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <GlobalSearchResults
          results={results}
          isLoading={isSearching}
          onResultClick={handleResultClick}
        />
      </PopoverContent>
    </Popover>
  );
}
