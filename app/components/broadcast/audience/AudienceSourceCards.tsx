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
              ? "border-brand bg-brand/5 ring-brand ring-2"
              : "hover:border-brand/40 hover:bg-surface-hover/30",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          {value === "mutuals" ? (
            <span
              className="bg-brand text-brand-on absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full"
              aria-hidden
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pr-8 font-medium">
            Mutuals
            <span className="bg-brand/15 text-brand rounded-xs px-1.5 py-0.5 text-[10px] font-semibold uppercase">
              Recommended
            </span>
          </div>
          <p className="text-text-secondary mt-2 text-xs leading-relaxed">
            Accounts you follow that follow you back.
          </p>
          <span className="bg-success/15 text-success-text mt-3 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium">
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
            ? "border-brand bg-brand/5 ring-brand ring-2"
            : "hover:border-brand/40 hover:bg-surface-hover/30",
          disabled && "pointer-events-none opacity-50",
          !allowMutuals && "sm:col-span-2"
        )}
      >
        {value === "selected" ? (
          <span
            className="bg-brand text-brand-on absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full"
            aria-hidden
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        ) : null}
        <div className="pr-8 font-medium">Selected recipients</div>
        <p className="text-text-secondary mt-2 text-xs leading-relaxed">
          Choose specific eligible recipients from followers, mutuals, or saved
          audiences.
        </p>
        <span className="bg-info/15 text-info-text mt-3 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium">
          User-curated
        </span>
      </button>
    </div>
  );
}
