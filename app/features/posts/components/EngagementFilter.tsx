import { useSearchParams } from "@remix-run/react";

import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { UNDERLINE_FILTER_FOCUS_CLASS } from "./constants";

/** Engagement type URL values and their stat keys (for client-side filtering). */
export const ENGAGEMENT_TYPES = [
  { value: "", label: "No minimum" },
  { value: "zaps", label: "Zaps", statKey: "zaps" as const },
  { value: "reactions", label: "Reactions", statKey: "likes" as const },
  { value: "replies", label: "Replies", statKey: "replies" as const },
  { value: "reposts", label: "Reposts", statKey: "reposts" as const },
] as const;

export type EngagementTypeValue = (typeof ENGAGEMENT_TYPES)[number]["value"];

export function EngagementFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get("engagementType") ?? "";
  const minStr = searchParams.get("engagementMin") ?? "";
  const min = minStr ? parseInt(minStr, 10) : 0;
  const isValidMin = Number.isFinite(min) && min >= 0;

  const handleTypeChange = (newValue: string) => {
    const next = new URLSearchParams(searchParams);
    if (newValue) {
      next.set("engagementType", newValue);
      if (!next.get("engagementMin") || !isValidMin) {
        next.set("engagementMin", "1");
      }
    } else {
      next.delete("engagementType");
      next.delete("engagementMin");
    }
    setSearchParams(next, { replace: true });
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const next = new URLSearchParams(searchParams);
    if (v === "") {
      next.delete("engagementMin");
    } else {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n >= 0) {
        next.set("engagementMin", String(n));
      }
    }
    setSearchParams(next, { replace: true });
  };

  const hasType = type && ENGAGEMENT_TYPES.some((t) => t.value === type);

  return (
    <div className="flex flex-row flex-nowrap items-center gap-2">
      <div className="border-border w-full max-w-[10rem] min-w-0 flex-shrink-0 border-b-0">
        <Select
          value={type || "none"}
          onValueChange={(v) => handleTypeChange(v === "none" ? "" : v)}
        >
          <SelectTrigger
            className={cn(
              "h-9 border-0 border-b-2 border-transparent bg-transparent px-1 py-1.5 text-sm font-medium shadow-none [&>svg]:ml-0",
              UNDERLINE_FILTER_FOCUS_CLASS
            )}
            aria-label="Engagement type"
          >
            <SelectValue placeholder="Engagement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No minimum</SelectItem>
            {ENGAGEMENT_TYPES.filter((t) => t.value).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasType ? (
        <div className="flex w-20 flex-shrink-0 items-center">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Min"
            value={minStr}
            onChange={handleMinChange}
            className={cn(
              "h-9 border-0 border-b-2 border-transparent bg-transparent px-1 py-1.5 text-sm shadow-none",
              UNDERLINE_FILTER_FOCUS_CLASS
            )}
            aria-label="Minimum engagement"
          />
        </div>
      ) : null}
    </div>
  );
}
