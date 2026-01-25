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
      <div className="dark:bg-card mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="text-center">
          <Check className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h3 className="text-foreground mb-2 text-lg font-semibold dark:text-white">
            Payment Successful!
          </h3>
          <p className="text-foreground dark:text-foreground">
            {message ?? "Your plan has been activated successfully!"}
          </p>
          <p className="text-muted-foreground dark:text-foreground mt-2 text-sm">
            Redirecting...
          </p>
        </div>
      </div>
    </div>
  );
}
