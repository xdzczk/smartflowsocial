import { Link } from "@remix-run/react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { PlanType } from "../types";

export function PlanStatusBanner({
  planType,
  label,
  headline,
  body,
  chips,
  ctaLabel,
  ctaTo,
  variant = "neutral",
}: {
  planType: PlanType;
  label?: string;
  headline: string;
  body: string;
  chips?: string[];
  ctaLabel: string;
  ctaTo: string;
  variant?: "neutral" | "muted";
}) {
  const surface =
    variant === "muted"
      ? "border-border bg-surface-hover/30 text-text-secondary"
      : "border-border bg-surface text-text";

  return (
    <div className="max-w-page mx-auto w-full px-4 pt-4 sm:px-6 lg:px-8">
      <section
        data-plan-type={planType}
        className={cn(
          "mb-4 rounded-lg border p-4",
          "flex flex-col items-stretch gap-3",
          "sm:flex-row sm:items-start sm:justify-between sm:gap-4",
          surface
        )}
      >
        <div className="min-w-0">
          {label ? (
            <p className="text-text-secondary text-xs font-medium tracking-wide">
              {label}
            </p>
          ) : null}
          <p className="mt-0.5 text-sm font-semibold">{headline}</p>
          <p className="text-text-secondary mt-1 text-sm leading-relaxed">
            {body}
          </p>
          {chips && chips.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <Badge
                  key={chip}
                  variant="default"
                  className="bg-surface-hover text-text-secondary hover:bg-surface-hover/80"
                >
                  {chip}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 sm:pt-0.5">
          <Button asChild className="w-full sm:w-auto">
            <Link to={ctaTo} prefetch="intent">
              {ctaLabel}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
