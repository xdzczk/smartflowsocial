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

/** Export dimensions (logical size before pixelRatio) — matches prior admin proof */
export const PROOF_EXPORT_PX: Record<ProofRatio, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
  landscape: { w: 1280, h: 720 },
};

export const PROOF_EXPORT_PIXEL_RATIO = 2;

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
