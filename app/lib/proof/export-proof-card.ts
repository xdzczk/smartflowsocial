import { toPng } from "html-to-image";

import { PROOF_EXPORT_PIXEL_RATIO, PROOF_EXPORT_PX } from "./ratios";
import type { ProofRatio } from "./types";

export function resolveProofPngBackground(el: HTMLElement): string {
  const bg = window.getComputedStyle(el).backgroundColor;
  if (
    bg &&
    bg !== "transparent" &&
    bg !== "rgba(0, 0, 0, 0)" &&
    !/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(bg)
  ) {
    return bg;
  }
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--card")
    .trim();
  if (raw) return `hsl(${raw})`;
  return "#ffffff";
}

export function proofExportFilename(input: {
  domain: string;
  cardType: string;
  date?: Date;
}): string {
  const d = (input.date ?? new Date()).toISOString().slice(0, 10);
  const type = input.cardType.replace(/_/g, "-");
  return `${input.domain}-${type}-${d}.png`;
}

export async function exportProofCardPng(input: {
  element: HTMLElement;
  ratio: ProofRatio;
  filename: string;
}): Promise<void> {
  const { w, h } = PROOF_EXPORT_PX[input.ratio];
  const dataUrl = await toPng(input.element, {
    pixelRatio: PROOF_EXPORT_PIXEL_RATIO,
    cacheBust: true,
    width: w,
    height: h,
    backgroundColor: resolveProofPngBackground(input.element),
    style: {
      margin: "0",
      transform: "none",
      width: `${w}px`,
      height: `${h}px`,
      boxSizing: "border-box",
    },
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = input.filename;
  a.click();
}
