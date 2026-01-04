/**
 * TanStack Query Provider component
 * Wraps the app with QueryClientProvider for React Query functionality
 */

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";

import { getQueryClient } from "./queryClient";

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * QueryProvider component
 * Provides TanStack Query context to the application
 * Includes React Query Devtools in development
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}




