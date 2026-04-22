/**
 * Skeleton — placeholder shapes that mirror the real design tokens.
 *
 * Phase 1i. Before this set, page skeletons composed raw atomic classes
 * (`<Skeleton className="h-8 w-40" />`) which drifted from the typography,
 * button, input, and radius ladders defined in tailwind.css. This module
 * exposes a small atom family whose dimensions and radii are tied to the
 * same tokens the real components use, so:
 *
 *   1. A skeleton text bar at variant "h1" is exactly as tall as a real
 *      `text-h1` heading. No layout shift on hydration.
 *   2. A skeleton button at size "default" is exactly h-9 with the same
 *      rounded-md radius the Button primitive renders.
 *   3. When tokens change (e.g. text-h1 grows from 28 → 30px), every
 *      skeleton that references "h1" updates with the system.
 *
 * Page skeletons should compose these atoms instead of writing raw heights.
 *
 * Usage:
 *
 *   <Skeleton.Text variant="h1" w="lg" />
 *   <Skeleton.Text variant="body" />              // full width by default
 *   <Skeleton.Avatar size="md" />
 *   <Skeleton.Button size="default" w="md" />
 *   <Skeleton.Input />
 *   <Skeleton.Card>...</Skeleton.Card>            // wraps its children in a card-shaped container
 *   <Skeleton.Pill w="sm" />
 *   <Skeleton.Block w="full" h="h-24" />          // generic block, dimensions explicit
 *
 * Width helper (`w` prop) accepts a token name OR a raw Tailwind class:
 *
 *   xs   → w-16   (64px)    badge-width
 *   sm   → w-24   (96px)    short label
 *   md   → w-40   (160px)   single line
 *   lg   → w-64   (256px)   long heading
 *   xl   → w-96   (384px)   extra-long
 *   full → w-full           full width (default for Text)
 *
 *   Or pass a raw class for arbitrary widths:
 *
 *     <Skeleton.Text w="max-w-2xl" />
 *     <Skeleton.Text w="w-[160px]" />
 *
 * Wrap a group of skeletons in a parent with `animate-pulse` so they all
 * shimmer in sync. The atoms intentionally do NOT carry their own pulse —
 * a single parent pulse reads as a unified loading state, not a bag of
 * individually-shimmering parts. The legacy default export `<Skeleton />`
 * keeps its own `animate-pulse` for backward compatibility.
 */
import * as React from "react";

import { cn } from "~/lib/utils";

const WIDTH_MAP: Record<string, string> = {
  xs: "w-16",
  sm: "w-24",
  md: "w-40",
  lg: "w-64",
  xl: "w-96",
  full: "w-full",
};

function widthClass(w: string | undefined, fallback: string): string {
  if (!w) return fallback;
  return WIDTH_MAP[w] ?? w;
}

/** Legacy primitive — keep the self-pulse for back-compat with existing call sites. */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-surface-hover animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

/* ---------- Text ----------
 * Heights are derived from the typography ladder in tailwind.css. The
 * skeleton bar is a solid rectangle that matches the real glyph height
 * for the named variant, with bottom margin so multi-line stacks read
 * with the same line-height rhythm.
 *
 *   variant       real font-size / line-height        skeleton height
 *   display       36 / 1.05                           h-9      (36px)
 *   h1            28 / 1.15                           h-7      (28px)
 *   h2            22 / 1.20                           h-[22px]
 *   h3            18 / 1.30                           h-[18px]
 *   h4            15 / 1.40                           h-[15px]
 *   body          14 / 1.50                           h-3.5    (14px)
 *   body-sm       13 / 1.45                           h-[13px]
 *   caption       12 / 1.40                           h-3      (12px)
 *   overline      11 / 1.40                           h-[11px]
 */
type TextVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body"
  | "body-sm"
  | "caption"
  | "overline";

const TEXT_HEIGHT: Record<TextVariant, string> = {
  display: "h-9",
  h1: "h-7",
  h2: "h-[22px]",
  h3: "h-[18px]",
  h4: "h-[15px]",
  body: "h-3.5",
  "body-sm": "h-[13px]",
  caption: "h-3",
  overline: "h-[11px]",
};

interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: TextVariant;
  /** Width: token (xs|sm|md|lg|xl|full) or raw Tailwind class. Defaults to "full". */
  w?: string;
}

function SkeletonText({
  variant = "body",
  w,
  className,
  ...props
}: SkeletonTextProps) {
  return (
    <div
      className={cn(
        "bg-surface-hover rounded-xs",
        TEXT_HEIGHT[variant],
        widthClass(w, "w-full"),
        className
      )}
      {...props}
    />
  );
}

/* ---------- Avatar ----------
 * Circle with sizes that match the avatar ladder used elsewhere
 * (Lucide-icon containers, profile pics).
 */
type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const AVATAR_SIZE: Record<AvatarSize, string> = {
  xs: "size-6", // 24px
  sm: "size-8", // 32px
  md: "size-10", // 40px — default
  lg: "size-12", // 48px
  xl: "size-16", // 64px
};

interface SkeletonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: AvatarSize;
}

function SkeletonAvatar({
  size = "md",
  className,
  ...props
}: SkeletonAvatarProps) {
  return (
    <div
      className={cn(
        "bg-surface-hover shrink-0 rounded-full",
        AVATAR_SIZE[size],
        className
      )}
      {...props}
    />
  );
}

/* ---------- Button ----------
 * Heights match the Button primitive's size ladder (h-7/h-8/h-9/h-11)
 * with rounded-md to match the canonical control radius. Default width
 * "md" (w-40) reads as a typical labelled button; pass `w` for icon
 * buttons (w="xs") or block buttons (w="full").
 */
type ButtonSize = "xs" | "sm" | "default" | "lg";

const BUTTON_HEIGHT: Record<ButtonSize, string> = {
  xs: "h-7",
  sm: "h-8",
  default: "h-9",
  lg: "h-11",
};

interface SkeletonButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: ButtonSize;
  w?: string;
}

function SkeletonButton({
  size = "default",
  w,
  className,
  ...props
}: SkeletonButtonProps) {
  return (
    <div
      className={cn(
        "bg-surface-hover rounded-md",
        BUTTON_HEIGHT[size],
        widthClass(w, "w-32"),
        className
      )}
      {...props}
    />
  );
}

/* ---------- Input ---------- */
function SkeletonInput({
  className,
  w,
  ...props
}: { w?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface-hover h-9 rounded-md",
        widthClass(w, "w-full"),
        className
      )}
      {...props}
    />
  );
}

/* ---------- Card ----------
 * A card-shaped surface (rounded-lg + border + shadow-1) that wraps its
 * children. Used when a real <Card> rests at this position; the skeleton's
 * wrapper carries the same chrome so the perceived "panel" is identical.
 */
function SkeletonCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border bg-surface shadow-1 inset-card rounded-lg border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ---------- Pill ----------
 * Rounded-full bar for badges / status pills.
 */
function SkeletonPill({
  className,
  w,
  ...props
}: { w?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface-hover h-5 rounded-full",
        widthClass(w, "w-16"),
        className
      )}
      {...props}
    />
  );
}

/* ---------- Block ----------
 * Generic skeleton block — explicit width and height. Use for charts,
 * thumbnails, irregular shapes that don't fit a semantic atom. Default
 * radius is rounded-md (control tier); pass `r="lg"` for panel tier or
 * `r="xl"` for modal tier.
 */
type BlockRadius = "xs" | "sm" | "md" | "lg" | "xl" | "full" | "none";

const RADIUS_MAP: Record<BlockRadius, string> = {
  none: "rounded-none",
  xs: "rounded-xs",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

interface SkeletonBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width: token or raw class. */
  w?: string;
  /** Height: raw Tailwind class (e.g. "h-24", "h-[420px]"). */
  h?: string;
  /** Radius tier. Defaults to "md". */
  r?: BlockRadius;
}

function SkeletonBlock({
  w,
  h = "h-12",
  r = "md",
  className,
  ...props
}: SkeletonBlockProps) {
  return (
    <div
      className={cn(
        "bg-surface-hover",
        widthClass(w, "w-full"),
        h,
        RADIUS_MAP[r],
        className
      )}
      {...props}
    />
  );
}

const SkeletonNamespace = Object.assign(Skeleton, {
  Text: SkeletonText,
  Avatar: SkeletonAvatar,
  Button: SkeletonButton,
  Input: SkeletonInput,
  Card: SkeletonCard,
  Pill: SkeletonPill,
  Block: SkeletonBlock,
});

export { SkeletonNamespace as Skeleton };
