/**
 * Toast Component
 * Reusable notification component for success/error messages
 */
import { X } from "lucide-react";

import { type ToastMessage } from "~/components/types";
import { StatusIcon } from "~/components/ui/status-icon";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
interface ToastProps {
  toast: ToastMessage;
  onClose: () => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  const isSuccess = toast.type === "success";
  // Foreground travels with the surface token instead of being hard-coded white.
  const surfaceClass = isSuccess
    ? "bg-success text-success-foreground"
    : "bg-danger text-danger-foreground";
  const closeClass = isSuccess
    ? "text-success-foreground/80 hover:text-success-foreground"
    : "text-danger-foreground/80 hover:text-danger-foreground";

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <div className={`shadow-2 rounded-lg px-4 py-3 ${surfaceClass}`}>
        <div className="flex items-start gap-2">
          <StatusIcon
            tone={isSuccess ? "success" : "danger"}
            size="lg"
            className="mt-0.5 text-current"
          />
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
            className={`ml-2 flex-shrink-0 ${closeClass}`}
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
