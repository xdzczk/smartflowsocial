"use client";

import { Search, ChevronDown, Check } from "lucide-react";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  getAllTimezoneOptions,
  searchTimezones,
  getTimezoneOption,
  formatTimezoneDisplay,
  type TimezoneOption,
} from "~/lib/timezones";
import { cn } from "~/lib/utils";

interface SearchableTimezoneSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function SearchableTimezoneSelector({
  value,
  onValueChange,
  disabled = false,
  id,
  "aria-label": ariaLabel = "Select timezone",
}: SearchableTimezoneSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Get all timezone options (memoized - cached in the utility function)
  const allOptions = useMemo(() => getAllTimezoneOptions(), []);

  // Get current selected option
  const selectedOption = useMemo(
    () => getTimezoneOption(value, allOptions),
    [value, allOptions]
  );

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    return searchTimezones(searchQuery, allOptions);
  }, [searchQuery, allOptions]);

  // Clamp focused index to valid range (derived state, no setState needed)
  const validFocusedIndex =
    filteredOptions.length > 0
      ? Math.min(focusedIndex, filteredOptions.length - 1)
      : 0;

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
        setFocusedIndex(0);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input when opened
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = useCallback(
    (option: TimezoneOption) => {
      onValueChange(option.value);
      setIsOpen(false);
      setSearchQuery("");
      setFocusedIndex(0);
    },
    [onValueChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          setSearchQuery("");
          setFocusedIndex(0);
          break;
        case "ArrowDown":
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter": {
          event.preventDefault();
          // Clamp focusedIndex to valid range
          const clampedIndex = Math.min(
            focusedIndex,
            filteredOptions.length - 1
          );
          if (filteredOptions[clampedIndex]) {
            handleSelect(filteredOptions[clampedIndex]);
          }
          break;
        }
        case "Home":
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          event.preventDefault();
          setFocusedIndex(filteredOptions.length - 1);
          break;
      }
    },
    [isOpen, filteredOptions, focusedIndex, handleSelect]
  );

  // Scroll focused option into view
  useEffect(() => {
    if (isOpen && validFocusedIndex >= 0) {
      const optionElement = optionRefs.current.get(validFocusedIndex);
      optionElement?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [validFocusedIndex, isOpen]);

  const displayValue = selectedOption
    ? formatTimezoneDisplay(selectedOption)
    : "Select a timezone";

  return (
    <div ref={containerRef} className="relative w-full">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-controls={isOpen && id ? `${id}-listbox` : undefined}
        id={id}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "w-full justify-between",
          !selectedOption && "text-muted-foreground"
        )}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </Button>

      {isOpen ? (
        <div
          className="bg-popover absolute z-50 mt-1 w-full rounded-md border shadow-md"
          role="presentation"
        >
          {/* Search Input */}
          <div className="border-b p-2">
            <div className="relative">
              <Search
                className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                ref={inputRef}
                id={id ? `${id}-search` : undefined}
                name={id ? `${id}-search` : undefined}
                type="text"
                placeholder="Search timezones..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFocusedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className="pl-8"
                aria-label="Search timezones"
                aria-autocomplete="list"
                aria-controls={id ? `${id}-listbox` : undefined}
              />
            </div>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            id={id ? `${id}-listbox` : undefined}
            className="max-h-[300px] overflow-auto p-1"
            role="listbox"
            aria-label="Timezone options"
          >
            {filteredOptions.length === 0 ? (
              <div
                className="text-muted-foreground py-6 text-center text-sm"
                role="status"
                aria-live="polite"
              >
                No timezones found.
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isFocused = index === validFocusedIndex;
                return (
                  <button
                    key={option.value}
                    ref={(el) => {
                      if (el) {
                        optionRefs.current.set(index, el);
                      } else {
                        optionRefs.current.delete(index);
                      }
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-focused={isFocused}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={cn(
                      "relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm transition-colors outline-none select-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:bg-accent focus-visible:text-accent-foreground",
                      isFocused && "bg-accent text-accent-foreground",
                      isSelected && "font-medium"
                    )}
                  >
                    <div className="flex flex-1 flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {option.offset} • {option.region}
                      </span>
                    </div>
                    {isSelected ? (
                      <Check
                        className="ml-2 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
