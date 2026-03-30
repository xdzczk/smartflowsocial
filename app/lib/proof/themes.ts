import { cn } from "~/lib/utils";

import type { ProofRatio } from "./types";

/** Outer card shell — calmer than legacy admin gradient; trust-first */
export function proofCardShellClass(
  ratio: ProofRatio,
  variant: "campaign" | "admin"
): string {
  const base =
    "bg-card text-card-foreground box-border shrink-0 overflow-hidden rounded-2xl border border-l-4 border-l-primary shadow-lg";
  const campaignTint =
    variant === "campaign"
      ? "bg-gradient-to-br from-primary/[0.04] to-transparent"
      : "";

  const size =
    ratio === "portrait"
      ? cn("flex w-full max-w-[min(100%,380px)] flex-col", "aspect-[4/5]")
      : ratio === "square"
        ? cn("flex aspect-square w-full max-w-[min(100%,380px)] flex-col")
        : cn("flex w-full max-w-[min(100%,720px)] flex-col", "aspect-video");

  return cn(base, campaignTint, size);
}

export function proofCardInnerPadClass(ratio: ProofRatio): string {
  if (ratio === "portrait") return "flex min-h-0 flex-1 flex-col p-5 sm:p-6";
  return "flex min-h-0 flex-1 flex-col p-4 sm:p-5";
}

export function proofEyebrowClass(ratio: ProofRatio): string {
  return cn(
    "font-medium uppercase tracking-widest text-muted-foreground",
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
    ratio === "landscape" && "text-4xl sm:text-5xl"
  );
}

export function proofSubClass(ratio: ProofRatio): string {
  return cn(
    "leading-snug text-muted-foreground",
    ratio === "portrait" && "mt-2 text-sm sm:text-base",
    ratio === "square" && "mt-1.5 line-clamp-3 text-xs sm:text-sm",
    ratio === "landscape" && "mt-2 max-w-[20rem] text-sm"
  );
}

export function proofFooterTextClass(ratio: ProofRatio): string {
  if (ratio === "square")
    return "text-[10px] leading-snug text-muted-foreground";
  if (ratio === "landscape")
    return "text-[10px] leading-snug text-muted-foreground sm:text-[11px]";
  return "text-[11px] leading-relaxed text-muted-foreground sm:text-xs";
}

export function statusBadgeClass(
  tone: "neutral" | "success" | "warning"
): string {
  switch (tone) {
    case "success":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "warning":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}
