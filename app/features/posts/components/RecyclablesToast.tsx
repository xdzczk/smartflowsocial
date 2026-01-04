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
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`rounded-lg px-4 py-3 text-white shadow-lg ${
          toast.type === "success" ? "bg-green-500" : "bg-red-500"
        }`}
      >
        <div className="flex items-center gap-2">
          {toast.type === "success" ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
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
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}




