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
    <div className="bg-success text-success-foreground shadow-2 fixed right-4 bottom-4 rounded-lg px-4 py-3">
      {message}
    </div>
  );
}
