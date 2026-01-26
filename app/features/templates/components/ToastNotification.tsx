/**
 * Toast notification component
 */

interface ToastNotificationProps {
  message: string;
  onClose: () => void;
}

export function ToastNotification({
  message,
  onClose: _onClose,
}: ToastNotificationProps) {
  return (
    <div className="bg-success fixed right-4 bottom-4 rounded-lg px-4 py-3 text-white shadow-lg">
      {message}
    </div>
  );
}
