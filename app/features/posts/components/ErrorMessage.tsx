/**
 * Error message display component
 */

interface ErrorMessageProps {
  error?: string;
  success?: boolean;
}

export function ErrorMessage({ error, success }: ErrorMessageProps) {
  if (!error || success) return null;

  return (
    <div className="border-danger/30 bg-danger/10 text-danger mb-4 rounded-xs border p-3">
      {error}
    </div>
  );
}
