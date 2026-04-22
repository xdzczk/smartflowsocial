/**
 * Success message component for displaying success notifications
 */

import { Check, X } from "lucide-react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

interface SuccessMessageProps {
  message: string;
  onDismiss: () => void;
}

export function SuccessMessage({ message, onDismiss }: SuccessMessageProps) {
  return (
    <div className="border-success/30 bg-success/10 mb-6 rounded-lg border p-4">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <Check
            className="text-success h-5 w-5"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        </div>
        <div className="ml-3">
          <p className="text-success text-sm font-medium">
            {decodeURIComponent(message)}
          </p>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={onDismiss}
              className="focus-ring bg-success/20 text-success hover:bg-success/30 inline-flex rounded-md p-1.5"
            >
              <span className="sr-only">Dismiss</span>
              <X
                className="h-3 w-3"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
