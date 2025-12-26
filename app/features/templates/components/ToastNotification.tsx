/**
 * Toast notification component
 */

interface ToastNotificationProps {
  message: string;
  onClose: () => void;
}

export function ToastNotification({ message, onClose }: ToastNotificationProps) {
  return (
    <div className="fixed bottom-4 right-4 rounded-lg bg-green-500 px-4 py-3 text-white shadow-lg">
      {message}
    </div>
  );
}


