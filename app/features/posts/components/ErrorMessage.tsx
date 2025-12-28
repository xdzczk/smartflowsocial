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
    <div className="mb-4 rounded border border-red-400 bg-red-100 p-3 text-red-700">
      {error}
    </div>
  );
}










