import { createContext, useContext, type ReactNode } from "react";

import type { SettingsLoaderData } from "../settings-loader.server";

const SettingsResolvedLoaderContext = createContext<
  SettingsLoaderData | undefined
>(undefined);

export function SettingsResolvedLoaderProvider({
  value,
  children,
}: {
  value: SettingsLoaderData;
  children: ReactNode;
}) {
  return (
    <SettingsResolvedLoaderContext.Provider value={value}>
      {children}
    </SettingsResolvedLoaderContext.Provider>
  );
}

/** Resolved settings payload from a deferred loader (only set inside &lt;Await&gt;). */
export function useSettingsResolvedLoaderData():
  | SettingsLoaderData
  | undefined {
  return useContext(SettingsResolvedLoaderContext);
}
