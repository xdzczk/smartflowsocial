import { createContext, useContext, type ReactNode } from "react";

const DeferredRouteLoaderContext = createContext<unknown>(undefined);

export function DeferredRouteLoaderProvider({
  value,
  children,
}: {
  value: unknown;
  children: ReactNode;
}) {
  return (
    <DeferredRouteLoaderContext.Provider value={value}>
      {children}
    </DeferredRouteLoaderContext.Provider>
  );
}

/** Resolved loader payload from a deferred route (set only inside &lt;Await&gt;). */
export function useDeferredRouteLoaderData(): unknown {
  return useContext(DeferredRouteLoaderContext);
}
