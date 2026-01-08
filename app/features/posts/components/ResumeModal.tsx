/**
 * Resume draft confirmation modal
 */

interface ResumeModalProps {
  isOpen: boolean;
  selectedQueue: string;
  scheduledFor: string;
  content: string;
  caption: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResumeModal({
  isOpen,
  selectedQueue,
  scheduledFor,
  content,
  caption,
  isSubmitting,
  onClose,
  onConfirm,
}: ResumeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Resume Draft</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Signing Required
                </h3>
                <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <p>
                    This draft needs to be signed before it can be scheduled.
                    The signing process will create a cryptographic signature
                    required for posting.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p>
              <strong>Queue:</strong> {selectedQueue}
            </p>
            <p>
              <strong>Scheduled for:</strong>{" "}
              {new Date(scheduledFor).toLocaleString()}
            </p>
            <p>
              <strong>Content:</strong> {(content || caption).substring(0, 100)}
              ...
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isSubmitting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? "Signing & Scheduling..." : "Sign & Schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
