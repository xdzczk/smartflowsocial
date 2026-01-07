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
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-red-100 p-4 text-red-800 shadow-lg dark:bg-red-900 dark:text-red-200">
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

