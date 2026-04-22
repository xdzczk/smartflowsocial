import { Check, CircleX, X } from "lucide-react";

import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

interface Toast {
  type: "success" | "error";
  message: string;
  link?: string;
  linkText?: string;
}

interface RecyclablesToastProps {
  toast: Toast | null;
  onClose: () => void;
}

/**
 * Toast notification component for recyclables actions
 */
export function RecyclablesToast({ toast, onClose }: RecyclablesToastProps) {
  if (!toast) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <div
        className={`shadow-2 rounded-lg px-4 py-3 text-white ${
          toast.type === "success" ? "bg-success" : "bg-danger"
        }`}
      >
        <div className="flex items-center gap-2">
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
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{toast.message}</span>
            {toast.link ? (
              <a
                href={toast.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline hover:no-underline"
              >
                {toast.linkText}
              </a>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="ml-2 text-white/80 hover:text-white"
            aria-label="Dismiss"
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
