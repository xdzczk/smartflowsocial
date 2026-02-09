/**
 * Toast Component
 * Reusable notification component for success/error messages
 */
import { Check, CircleX, X } from "lucide-react";

import { type ToastMessage } from "~/components/types";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
interface ToastProps {
  toast: ToastMessage;
  onClose: () => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  return (
    <div className="fixed right-4 bottom-4 z-50">
      <div
        className={`rounded-lg px-4 py-3 text-white shadow-lg ${
          toast.type === "success" ? "bg-success" : "bg-destructive"
        }`}
      >
        <div className="flex items-start gap-2">
          {toast.type === "success" ? (
            <Check
              className="mt-0.5 h-5 w-5 flex-shrink-0"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          ) : (
            <CircleX
              className="mt-0.5 h-5 w-5 flex-shrink-0"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          )}
          <div className="flex-1">
            <pre className="text-sm font-medium whitespace-pre-wrap">
              {toast.message}
            </pre>
            {toast.link ? (
              <a
                href={toast.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm underline hover:no-underline"
              >
                {toast.linkText ?? "View"}
              </a>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 text-white/80 hover:text-white"
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
