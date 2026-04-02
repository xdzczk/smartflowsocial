import { Check, Circle, Loader2, X } from "lucide-react";

import { SMALL_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

export type AuthStepStatus = "pending" | "active" | "complete" | "failed";

export interface AuthStepItem {
  id: string;
  label: string;
  status: AuthStepStatus;
  description?: string;
}

export interface AuthStepListProps {
  steps: AuthStepItem[];
  className?: string;
}

function StepIcon({ status }: { status: AuthStepStatus }) {
  switch (status) {
    case "complete":
      return (
        <span className="bg-success/15 text-success flex size-7 shrink-0 items-center justify-center rounded-full">
          <Check className={SMALL_ICON_SIZE_CLASS} aria-hidden />
        </span>
      );
    case "failed":
      return (
        <span className="bg-destructive/15 text-destructive flex size-7 shrink-0 items-center justify-center rounded-full">
          <X className={SMALL_ICON_SIZE_CLASS} aria-hidden />
        </span>
      );
    case "active":
      return (
        <span className="bg-primary/15 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
          <Loader2
            className={cn(SMALL_ICON_SIZE_CLASS, "animate-spin")}
            aria-hidden
          />
        </span>
      );
    default:
      return (
        <span className="text-muted-foreground/50 flex size-7 shrink-0 items-center justify-center">
          <Circle className={SMALL_ICON_SIZE_CLASS} aria-hidden />
        </span>
      );
  }
}

export function AuthStepList({ steps, className }: AuthStepListProps) {
  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            "flex gap-3 py-2.5 transition-colors duration-200",
            index < steps.length - 1 &&
              "border-border/60 border-b border-dashed"
          )}
        >
          <div className="pt-0.5">
            <StepIcon status={step.status} />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div
              className={cn(
                "text-sm font-medium transition-colors duration-200",
                step.status === "pending" && "text-muted-foreground",
                step.status === "active" && "text-foreground",
                step.status === "complete" && "text-foreground",
                step.status === "failed" && "text-destructive"
              )}
            >
              {step.label}
            </div>
            {step.description ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                {step.description}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
