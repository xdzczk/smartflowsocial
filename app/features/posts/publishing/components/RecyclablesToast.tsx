import { X } from "lucide-react";

import { StatusIcon } from "~/components/ui/status-icon";
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
        className={`shadow-2 rounded-lg px-4 py-3 ${
          toast.type === "success"
            ? "bg-success text-success-foreground"
            : "bg-danger text-danger-foreground"
        }`}
      >
        <div className="cluster">
          <StatusIcon
            tone={toast.type === "success" ? "success" : "danger"}
            size="lg"
            className="text-current"
          />
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
            className="ml-2 text-current/80 hover:text-current"
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
