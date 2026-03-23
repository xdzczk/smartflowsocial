import { Check } from "lucide-react";

import { cn } from "~/lib/utils";

export type AudienceMode = "mutuals" | "selected";

export interface AudienceSourceCardsProps {
  value: AudienceMode;
  onChange: (v: AudienceMode) => void;
  disabled?: boolean;
  allowMutuals: boolean;
}

export function AudienceSourceCards({
  value,
  onChange,
  disabled,
  allowMutuals,
}: AudienceSourceCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {allowMutuals ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange("mutuals");
          }}
          className={cn(
            "border-border relative rounded-xl border p-4 text-left text-sm transition-all",
            value === "mutuals"
              ? "border-primary bg-primary/5 ring-primary ring-2"
              : "hover:border-primary/40 hover:bg-muted/30",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          {value === "mutuals" ? (
            <span
              className="bg-primary text-primary-foreground absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full"
              aria-hidden
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pr-8 font-medium">
            Mutuals
            <span className="bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
              Recommended
            </span>
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Accounts you follow that follow you back.
          </p>
          <span className="mt-3 inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:text-emerald-100">
            Lower spam risk
          </span>
        </button>
      ) : null}

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onChange("selected");
        }}
        className={cn(
          "border-border relative rounded-xl border p-4 text-left text-sm transition-all",
          value === "selected"
            ? "border-primary bg-primary/5 ring-primary ring-2"
            : "hover:border-primary/40 hover:bg-muted/30",
          disabled && "pointer-events-none opacity-50",
          !allowMutuals && "sm:col-span-2"
        )}
      >
        {value === "selected" ? (
          <span
            className="bg-primary text-primary-foreground absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full"
            aria-hidden
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        ) : null}
        <div className="pr-8 font-medium">Selected recipients</div>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Choose specific eligible recipients from followers, mutuals, or saved
          audiences.
        </p>
        <span className="mt-3 inline-block rounded-md bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-950 dark:text-blue-100">
          User-curated
        </span>
      </button>
    </div>
  );
}
