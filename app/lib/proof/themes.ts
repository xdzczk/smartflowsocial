import { cn } from "~/lib/utils";

import type { ProofRatio } from "./types";

/**
 * Fixed-aspect outer box. Content must live in a child with `absolute inset-0`
 * so tall templates cannot stretch the preview (flex min-height was fighting
 * `aspect-ratio` across card types).
 */
export function proofCardAspectOuterClass(ratio: ProofRatio): string {
  switch (ratio) {
    case "portrait":
      return "relative w-full max-w-[min(100%,380px)] shrink-0 aspect-[4/5]";
    case "square":
      return "relative w-full max-w-[min(100%,380px)] shrink-0 aspect-square";
    case "landscape":
      return "relative w-full max-w-[min(100%,720px)] shrink-0 aspect-video";
  }
}

/** Visual shell; use inside `proofCardAspectOuterClass` as `absolute inset-0` */
export function proofCardShellSurfaceClass(
  variant: "campaign" | "admin"
): string {
  const base =
    "absolute inset-0 box-border flex flex-col overflow-hidden rounded-xl border border-l-4 border-l-brand bg-surface text-text shadow-2";
  const campaignTint =
    variant === "campaign"
      ? "bg-gradient-to-br from-brand/[0.04] to-transparent"
      : "";
  return cn(base, campaignTint);
}

export function proofCardInnerPadClass(ratio: ProofRatio): string {
  if (ratio === "portrait") return "flex min-h-0 flex-1 flex-col p-5 sm:p-6";
  if (ratio === "landscape")
    return "flex h-full min-h-0 flex-1 flex-col px-6 py-5";
  return "flex min-h-0 flex-1 flex-col p-4 sm:p-5";
}

export function proofEyebrowClass(ratio: ProofRatio): string {
  return cn(
    "font-medium uppercase tracking-widest text-text-secondary",
    ratio === "square" ? "text-[10px]" : "text-[11px] sm:text-xs"
  );
}

export function proofHeroClass(
  ratio: ProofRatio,
  heroReliability?: boolean
): string {
  return cn(
    "font-semibold leading-none tracking-tight tabular-nums",
    ratio === "portrait" &&
      (heroReliability ? "text-5xl sm:text-6xl" : "text-5xl sm:text-[3.25rem]"),
    ratio === "square" && "text-4xl sm:text-5xl",
    ratio === "landscape" && "text-3xl sm:text-4xl"
  );
}

export function proofSubClass(ratio: ProofRatio): string {
  return cn(
    "leading-snug text-text-secondary",
    ratio === "portrait" && "mt-2 text-sm sm:text-base",
    ratio === "square" && "mt-1.5 line-clamp-3 text-xs sm:text-sm",
    ratio === "landscape" && "mt-1 line-clamp-2 text-xs sm:text-sm"
  );
}

export function proofFooterTextClass(ratio: ProofRatio): string {
  if (ratio === "square") return "text-[10px] leading-snug text-text-secondary";
  if (ratio === "landscape")
    return "text-[10px] leading-snug text-text-secondary sm:text-[11px]";
  return "text-[11px] leading-relaxed text-text-secondary sm:text-xs";
}

export function statusBadgeClass(
  tone: "neutral" | "success" | "warning"
): string {
  switch (tone) {
    case "success":
      return "bg-success/15 text-success-text";
    case "warning":
      return "bg-warning/15 text-warning-text";
    default:
      return "bg-surface-hover text-text-secondary";
  }
}
