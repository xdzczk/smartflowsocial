/**
 * Toast notification component for search page
 */

import { Check, CircleX, X } from "lucide-react";

import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

interface SearchToastProps {
  toast: { type: "success" | "error"; message: string } | null;
  onClose: () => void;
}

export function SearchToast({ toast, onClose }: SearchToastProps) {
  if (!toast) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <div
        className={`shadow-2 rounded-lg px-4 py-3 text-white ${
          toast.type === "success" ? "bg-success" : "bg-danger"
        }`}
      >
        <div className="cluster">
          {toast.type === "success" ? (
            <Check
              className="h-5 w-5"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          ) : (
            <CircleX
              className="h-5 w-5"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={onClose}
            className="ml-2 text-white/80 hover:text-white"
            aria-label="Close"
          >
            <X
              className={INLINE_ICON_SIZE_CLASS}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  );
}
