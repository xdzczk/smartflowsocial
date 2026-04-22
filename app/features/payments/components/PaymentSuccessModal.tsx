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
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="bg-surface-overlay shadow-3 mx-4 max-w-md rounded-xl p-6">
        <div className="text-center">
          <Check className="text-success mx-auto mb-4 h-12 w-12" />
          <h3 className="text-text mb-2 text-lg font-semibold">
            Payment Successful!
          </h3>
          <p className="text-text">
            {message ?? "Your plan has been activated successfully!"}
          </p>
          <p className="text-text-secondary mt-2 text-sm">Redirecting...</p>
        </div>
      </div>
    </div>
  );
}
