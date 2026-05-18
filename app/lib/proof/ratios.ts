import type { ProofRatio } from "./types";

/** Tailwind aspect ratio + max preview width (px) */
export const PROOF_RATIO_PREVIEW: Record<
  ProofRatio,
  { aspectClass: string; maxPreviewPx: number }
> = {
  portrait: { aspectClass: "aspect-[4/5]", maxPreviewPx: 380 },
  square: { aspectClass: "aspect-square", maxPreviewPx: 380 },
  landscape: { aspectClass: "aspect-video", maxPreviewPx: 720 },
};

/**
 * Fallback when the card is not measurable (hidden / zero layout).
 * Matches `proofCardAspectOuterClass` max widths and aspect ratios.
 */
export function proofPreviewExportFallbackPx(ratio: ProofRatio): {
  w: number;
  h: number;
} {
  const maxW = PROOF_RATIO_PREVIEW[ratio].maxPreviewPx;
  switch (ratio) {
    case "portrait":
      return { w: maxW, h: Math.round((maxW * 5) / 4) };
    case "square":
      return { w: maxW, h: maxW };
    case "landscape":
      return { w: maxW, h: Math.round((maxW * 9) / 16) };
  }
}

/** Minimum export density so PNGs stay sharp when shared (layout still matches preview). */
export const PROOF_EXPORT_PIXEL_RATIO = 2;

/** Retina-aware export density (2×–3×); layout size comes from {@link measureProofCardRoot}. */
export function resolveProofExportPixelRatio(): number {
  if (typeof window === "undefined") return PROOF_EXPORT_PIXEL_RATIO;
  const dpr = window.devicePixelRatio;
  if (!Number.isFinite(dpr) || dpr <= 0) return PROOF_EXPORT_PIXEL_RATIO;
  return Math.min(3, Math.max(PROOF_EXPORT_PIXEL_RATIO, dpr));
}

export function proofRatioLabel(r: ProofRatio): string {
  switch (r) {
    case "portrait":
      return "4:5";
    case "square":
      return "1:1";
    case "landscape":
      return "16:9";
  }
}
