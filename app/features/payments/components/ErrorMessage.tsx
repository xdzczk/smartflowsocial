/**
 * Error message component
 */

import { X } from "lucide-react";
interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div className="bg-danger/10 text-danger dark:bg-danger/20 dark:text-danger shadow-2 fixed right-4 bottom-4 z-50 max-w-sm rounded-lg p-4">
      <div className="flex">
        <X className="mr-2 h-5 w-5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium">Error</p>
          <p className="text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}
