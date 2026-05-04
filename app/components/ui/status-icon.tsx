/**
 * StatusIcon  -  canonical icon + tone color + size for status communication.
 *
 * Phase 1h. Before this primitive, the codebase used a mix of `Check` /
 * `CheckCircle` / `CheckCircle2` for success, `AlertTriangle` / `TriangleAlert`
 * / `AlertCircle` for warning, `XCircle` / `CircleX` for danger, and a grab-bag
 * of `text-success / text-warning / text-danger / text-warning-text` color
 * classes paired in inconsistent ways with `h-3` / `h-3.5` / `h-4` / `h-5` /
 * `h-6` sizes.
 *
 * This primitive standardises:
 *
 *   tone "success"  → CheckCircle2  + text-success
 *   tone "warning"  → AlertTriangle + text-warning
 *   tone "danger"   → XCircle       + text-danger
 *   tone "info"     → Info          + text-info
 *   tone "neutral"  → Circle        + text-text-tertiary
 *   tone "pending"  → Loader2 (spin) + text-text-secondary
 *
 *   size "xs" → 12px (size-3)     dense table cells, badges
 *   size "sm" → 14px (size-3.5)   inline next to small text
 *   size "md" → 16px (size-4)     default  -  body text, alerts
 *   size "lg" → 20px (size-5)     section headers, larger badges
 *   size "xl" → 24px (size-6)     hero, modal headers
 *
 * Override the icon (keeping tone color + size) by passing `icon`:
 *
 *   <StatusIcon tone="danger" icon={Ban} />
 *
 * The `tone` is what carries the meaning. The `icon` override is for cases
 * where the canonical glyph doesn't fit (e.g. "blocked" feels like Ban, not
 * XCircle, but should still read in the danger color).
 */
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
  Loader2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "~/lib/utils";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "pending";

export type StatusIconSize = "xs" | "sm" | "md" | "lg" | "xl";

const TONE_ICON: Record<StatusTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  neutral: Circle,
  pending: Loader2,
};

const TONE_COLOR: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-text-tertiary",
  pending: "text-text-secondary",
};

const SIZE_CLASS: Record<StatusIconSize, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
};

export interface StatusIconProps extends Omit<
  React.SVGAttributes<SVGSVGElement>,
  "color"
> {
  /** Semantic tone  -  picks default icon + canonical color class. */
  tone: StatusTone;
  /** Size step on the design system's icon ladder. Defaults to "md" (16px). */
  size?: StatusIconSize;
  /** Override the icon glyph but keep tone color + size. */
  icon?: LucideIcon;
  /**
   * Accessible label. Omit for purely decorative icons; provide a short label
   * (e.g. "Success", "Warning") for icons conveying status alone.
   */
  label?: string;
}

const StatusIcon = React.forwardRef<SVGSVGElement, StatusIconProps>(
  ({ tone, size = "md", icon, label, className, ...props }, ref) => {
    const Icon = icon ?? TONE_ICON[tone];
    const aria = label
      ? { role: "img" as const, "aria-label": label }
      : { "aria-hidden": true as const };
    return (
      <Icon
        ref={ref}
        className={cn(
          SIZE_CLASS[size],
          TONE_COLOR[tone],
          tone === "pending" && "animate-spin",
          "shrink-0",
          className
        )}
        {...aria}
        {...props}
      />
    );
  }
);
StatusIcon.displayName = "StatusIcon";

export { StatusIcon };
