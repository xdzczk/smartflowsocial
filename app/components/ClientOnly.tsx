/**
 * ClientOnly - A wrapper component that only renders its children on the client
 * This is useful for components that use client-only hooks or APIs
 *
 * During SSR, this renders the fallback (or null). On the client, it renders children immediately.
 */

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  // Check if we're on the client immediately (not in useEffect to avoid hydration mismatch)
  if (typeof window === "undefined") {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
