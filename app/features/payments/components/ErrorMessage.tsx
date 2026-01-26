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
    <div className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive fixed right-4 bottom-4 z-50 max-w-sm rounded-lg p-4 shadow-lg">
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
