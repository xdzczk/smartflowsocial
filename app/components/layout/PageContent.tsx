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
   * Calendar, composer, and other full-bleed surfaces: no horizontal
   * padding from this wrapper (parent shell owns the canvas).
   */
  fullBleed?: boolean;
  /**
   * Child of `DashboardLayoutPage` where the outer main band already applies
   * horizontal padding — avoids doubling horizontal padding.
   */
  fluid?: boolean;
  /**
   * Narrow readable column (`max-w-page`) for marketing-style or form-heavy
   * pages outside the fluid dashboard band. Ignored when `fluid` or `fullBleed`.
   */
  constrained?: boolean;
  /** Default bottom rhythm for pages using this wrapper; merged after layout classes. */
  paddedBottom?: boolean;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className">;

/**
 * Product page wrapper: default is fluid full width + shared horizontal padding.
 * Prefer `fluid` under the dashboard shell band. Use `constrained` sparingly for
 * readable narrow columns.
 */
export function PageContent({
  children,
  className,
  fullBleed,
  fluid,
  constrained = false,
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
                constrained ? PAGE_MAX_WIDTH_CLASS : "",
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

export {
  DASHBOARD_MAIN_BAND_CLASS,
  PAGE_SHELL_FLUID_CLASS,
} from "./page-layout-constants";
