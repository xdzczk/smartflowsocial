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
    <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded border p-3">
      {error}
    </div>
  );
}
