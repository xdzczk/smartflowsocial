/**
 * Payment success modal component
 */

import { Check } from "lucide-react";
interface PaymentSuccessModalProps {
  isOpen: boolean;
  message?: string;
}

export function PaymentSuccessModal({
  isOpen,
  message,
}: PaymentSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <div className="text-center">
          <Check className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            Payment Successful!
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {message ?? "Your plan has been activated successfully!"}
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Redirecting...
          </p>
        </div>
      </div>
    </div>
  );
}










