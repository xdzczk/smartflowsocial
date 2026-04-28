import { useSearchParams } from "@remix-run/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { UNDERLINE_FILTER_FOCUS_CLASS } from "./constants";

const OLDER_THAN_OPTIONS = [
  { value: "", label: "Any age" },
  { value: "1m", label: "Older than 1 month" },
  { value: "2m", label: "Older than 2 months" },
  { value: "3m", label: "Older than 3 months" },
  { value: "4m", label: "Older than 4 months" },
  { value: "5m", label: "Older than 5 months" },
  { value: "6m", label: "Older than 6 months" },
  { value: "7m", label: "Older than 7 months" },
  { value: "8m", label: "Older than 8 months" },
  { value: "9m", label: "Older than 9 months" },
  { value: "10m", label: "Older than 10 months" },
  { value: "11m", label: "Older than 11 months" },
  { value: "12m", label: "Older than 12 months" },
  { value: "1y", label: "Older than 1 year" },
  { value: "2y", label: "Older than 2 years" },
  { value: "3y", label: "Older than 3 years" },
] as const;

export function OlderThanFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get("olderThan") ?? "";

  const handleChange = (newValue: string) => {
    const next = new URLSearchParams(searchParams);
    if (newValue) {
      next.set("olderThan", newValue);
    } else {
      next.delete("olderThan");
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="border-border w-full max-w-[12rem] min-w-0 flex-shrink-0 border-b-0 sm:max-w-[14rem]">
      <Select
        value={value || "any"}
        onValueChange={(v) => handleChange(v === "any" ? "" : v)}
      >
        <SelectTrigger
          className={cn(
            "h-9 border-0 border-b-2 border-transparent bg-transparent px-1 py-1.5 text-sm font-medium shadow-none [&>svg]:ml-0",
            UNDERLINE_FILTER_FOCUS_CLASS
          )}
          aria-label="Filter by age (older than)"
        >
          <SelectValue placeholder="Older than" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any age</SelectItem>
          {OLDER_THAN_OPTIONS.filter((o) => o.value).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
