import { CircleHelp } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

export function AdminMetricValue({
  value,
  size = "lg",
  deltaPct,
  deltaLabel,
  className,
}: {
  value: string | number;
  size?: "lg" | "md";
  deltaPct?: number | null;
  deltaLabel?: string | null;
  className?: string;
}) {
  const deltaStr =
    deltaLabel ??
    (deltaPct === null || deltaPct === undefined
      ? null
      : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs prior`);

  return (
    <div className={cn("space-y-1", className)}>
      <p
        className={cn(
          "font-semibold tracking-tight tabular-nums",
          size === "lg" ? "text-3xl" : "text-2xl"
        )}
      >
        {value}
      </p>
      {deltaStr ? (
        <p className="text-muted-foreground text-xs tabular-nums">{deltaStr}</p>
      ) : null}
    </div>
  );
}

export function AdminMetricTitleRow({
  title,
  definition,
  className,
}: {
  title: string;
  definition?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex w-full items-start justify-between gap-2", className)}
    >
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {title}
      </p>
      {definition ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground -m-0.5 rounded p-0.5"
              aria-label="Metric definition"
            >
              <CircleHelp className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="bg-popover text-popover-foreground border-border max-w-xs text-left text-xs font-normal normal-case"
          >
            {definition}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
