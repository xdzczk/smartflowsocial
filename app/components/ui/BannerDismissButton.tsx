import { X } from "lucide-react";

import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

export function BannerDismissButton({
  onClick,
  ariaLabel = "Dismiss banner",
}: {
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="focus-ring-offset text-text-secondary hover:text-text hover:bg-surface-hover motion-fast tap-target inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
    >
      <X
        className={INLINE_ICON_SIZE_CLASS}
        strokeWidth={INLINE_ICON_STROKE}
        aria-hidden="true"
      />
    </button>
  );
}
