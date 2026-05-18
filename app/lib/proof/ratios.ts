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

/** Share-ready PNG dimensions. These match the card ratios without changing preview layout. */
export const PROOF_EXPORT_PX: Record<ProofRatio, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  landscape: { w: 1600, h: 900 },
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

/** Export dimensions are already high-res, so avoid an extra pixel multiplier. */
export const PROOF_EXPORT_PIXEL_RATIO = 1;

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
