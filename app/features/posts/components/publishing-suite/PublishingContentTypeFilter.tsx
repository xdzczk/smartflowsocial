import { useNavigate } from "@remix-run/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { PUBLISHING_FILTER_SELECT_TRIGGER_CLASS } from "./constants";

export interface PublishingContentTypeFilterItem {
  id: string;
  /** Destination URL when using navigation mode (ignored when `onValueChange` is set). */
  to: string;
  /** Shown on the closed trigger when this option is selected. */
  triggerLabel: string;
  /** Row label in the open menu (may include counts). */
  menuLabel: string;
  ariaLabel?: string;
}

interface PublishingContentTypeFilterProps {
  value: string;
  items: PublishingContentTypeFilterItem[];
  ariaLabel: string;
  "data-testid"?: string;
  /** Extra classes for the trigger (e.g. wider Templates variant). */
  triggerClassName?: string;
  /** When set, selection updates local state instead of navigating. */
  onValueChange?: (id: string) => void;
}

export function PublishingContentTypeFilter({
  value,
  items,
  ariaLabel,
  "data-testid": dataTestId,
  triggerClassName,
  onValueChange,
}: PublishingContentTypeFilterProps) {
  const navigate = useNavigate();
  const resolvedValue =
    items.find((i) => i.id === value)?.id ?? items[0]?.id ?? value;
  const active = items.find((i) => i.id === resolvedValue) ?? items[0];
  const triggerText = active?.triggerLabel ?? "All types";

  return (
    <Select
      name="contentType"
      value={resolvedValue}
      onValueChange={(next) => {
        if (onValueChange) {
          onValueChange(next);
          return;
        }
        const target = items.find((i) => i.id === next);
        if (target) navigate(target.to);
      }}
    >
      <SelectTrigger
        className={cn(PUBLISHING_FILTER_SELECT_TRIGGER_CLASS, triggerClassName)}
        aria-label={ariaLabel}
        data-testid={dataTestId}
      >
        <SelectValue>{triggerText}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.menuLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
