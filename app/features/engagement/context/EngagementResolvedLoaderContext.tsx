import { createContext, useContext, type ReactNode } from "react";

import type { EngagementLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";

const EngagementResolvedLoaderContext = createContext<
  EngagementLoaderData | undefined
>(undefined);

export function EngagementResolvedLoaderProvider({
  value,
  children,
}: {
  value: EngagementLoaderData;
  children: ReactNode;
}) {
  return (
    <EngagementResolvedLoaderContext.Provider value={value}>
      {children}
    </EngagementResolvedLoaderContext.Provider>
  );
}

/** Resolved engagement payload from a deferred loader (only set inside &lt;Await&gt;). */
export function useEngagementResolvedLoaderData():
  | EngagementLoaderData
  | undefined {
  return useContext(EngagementResolvedLoaderContext);
}
