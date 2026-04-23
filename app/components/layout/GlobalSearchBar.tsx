import {
  useFetcher,
  useLocation,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
import { Loader2, Search, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  startTransition,
} from "react";

import { Badge } from "~/components/ui/badge";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "~/components/ui/popover";
import { detectNostrPasteKind } from "~/features/search/utils/detect-nostr-paste-kind";
import { extractNostrIdentifier } from "~/lib/extract-nostr-identifier";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import {
  GlobalSearchResults,
  type GlobalSearchResult,
} from "./GlobalSearchResults";

interface GlobalSearchBarProps {
  className?: string;
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
  const navigation = useNavigation();
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

    const extracted = extractNostrIdentifier(trimmedQuery);
    if (extracted !== null) {
      // Redirect straight to post viewer with clean identifier (handles Primal/Coracle URLs)
      navigate(`/dashboard/search/posts?q=${encodeURIComponent(extracted)}`);
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

  const navLoc = navigation.location;
  const lookupNavigating =
    navigation.state === "loading" &&
    navLoc?.pathname === "/dashboard/search/posts" &&
    (new URLSearchParams(navLoc.search).get("q") ?? "").length > 0;

  const pasteKind = detectNostrPasteKind(query);

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
          <div className="tap-target relative h-9">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
              <Search className="text-text-secondary h-4 w-4" />
            </div>
            <input
              ref={inputRef}
              id="global-search"
              name="global-search"
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder="Inspect a Nostr note, profile, or URL"
              title="Paste a Nostr note, profile, or URL — ⌘K to focus"
              className={cn(
                "border-border bg-surface text-text placeholder:text-text-tertiary focus:border-brand focus-visible:ring-focus-ring/50 block h-full w-full appearance-none rounded-lg border py-0 pl-8 text-sm focus-visible:ring-2 focus-visible:outline-none sm:pl-10",
                lookupNavigating || query ? "pr-16 sm:pr-20" : "pr-8 sm:pr-10"
              )}
            />
            <div className="cluster-tight absolute inset-y-0 right-0 pr-1.5 sm:pr-2">
              {lookupNavigating ? (
                <Loader2
                  className="text-text-secondary h-4 w-4 shrink-0 animate-spin"
                  aria-label="Resolving lookup"
                />
              ) : null}
              {query ? (
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-text-secondary hover:text-text flex items-center p-1"
                  aria-label="Clear search"
                >
                  <X className={INLINE_ICON_SIZE_CLASS} />
                </button>
              ) : null}
            </div>
          </div>
          {pasteKind ? (
            <div className="cluster mt-1.5 px-0.5">
              <Badge variant="secondary" className="font-mono text-[10px]">
                {pasteKind}
              </Badge>
              <span className="text-text-secondary text-[11px]">
                Detected format
              </span>
            </div>
          ) : null}
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
