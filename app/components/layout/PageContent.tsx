import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "~/lib/utils";

import {
  PAGE_INNER_FLUID_CLASS,
  PAGE_MAX_WIDTH_CLASS,
  PAGE_PAD_X_CLASS,
} from "./page-layout-constants";

export type PageContentProps = {
  children: ReactNode;
  className?: string;
  /**
   * Calendar, composer, and other full-bleed surfaces: no max-width or horizontal
   * padding from this wrapper (parent shell owns the canvas).
   */
  fullBleed?: boolean;
  /**
   * Child of `DashboardLayoutPage` where the outer main band already applies
   * `DASHBOARD_MAIN_BAND_CLASS` — avoids double max-width / horizontal padding.
   */
  fluid?: boolean;
  /** Default bottom rhythm for constrained pages; merged after layout classes. */
  paddedBottom?: boolean;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className">;

/**
 * Canonical product page wrapper: `max-w-page`, horizontal padding, optional
 * vertical rhythm. Prefer `fluid` under the dashboard shell band.
 */
export function PageContent({
  children,
  className,
  fullBleed,
  fluid,
  paddedBottom = true,
  ...rest
}: PageContentProps) {
  return (
    <div
      className={cn(
        fullBleed
          ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
          : fluid
            ? PAGE_INNER_FLUID_CLASS
            : cn(
                "mx-auto flex w-full min-w-0 flex-col",
                PAGE_MAX_WIDTH_CLASS,
                PAGE_PAD_X_CLASS,
                paddedBottom && "pb-8"
              ),
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export { DASHBOARD_MAIN_BAND_CLASS } from "./page-layout-constants";
