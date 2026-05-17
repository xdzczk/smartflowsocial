import { toPng } from "html-to-image";

import { PROOF_EXPORT_PIXEL_RATIO, PROOF_EXPORT_PX } from "./ratios";
import type { ProofRatio } from "./types";

/** Applied on the export root during capture so PNGs use light receipt colors in dark mode. */
export const PROOF_EXPORT_SNAPSHOT_CLASS = "proof-export-snapshot";

const PROOF_CARD_ROOT_SELECTOR = "[data-proof-card-root]";
const PROOF_CARD_SURFACE_SELECTOR = "[data-proof-card-surface]";

function findProofCardRoot(el: HTMLElement): HTMLElement {
  const root = el.querySelector<HTMLElement>(PROOF_CARD_ROOT_SELECTOR);
  return root ?? el;
}

function findProofCardSurface(el: HTMLElement): HTMLElement {
  const surface = el.querySelector<HTMLElement>(PROOF_CARD_SURFACE_SELECTOR);
  return surface ?? el;
}

export function resolveProofPngBackground(el: HTMLElement): string {
  const target = findProofCardSurface(el);
  const bg = window.getComputedStyle(target).backgroundColor;
  if (
    bg &&
    bg !== "transparent" &&
    bg !== "rgba(0, 0, 0, 0)" &&
    !/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(bg)
  ) {
    return bg;
  }
  const surfaceRaw = window
    .getComputedStyle(target)
    .getPropertyValue("--surface")
    .trim();
  if (surfaceRaw) return `hsl(${surfaceRaw})`;
  const cardRaw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--card")
    .trim();
  if (cardRaw) return `hsl(${cardRaw})`;
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
  const { element } = input;
  const cardRoot = findProofCardRoot(element);
  element.classList.add(PROOF_EXPORT_SNAPSHOT_CLASS);
  element.style.setProperty("--proof-export-w", `${w}px`);
  element.style.setProperty("--proof-export-h", `${h}px`);
  try {
    const dataUrl = await toPng(cardRoot, {
      pixelRatio: PROOF_EXPORT_PIXEL_RATIO,
      cacheBust: true,
      width: w,
      height: h,
      backgroundColor: resolveProofPngBackground(element),
      style: {
        margin: "0",
        transform: "none",
        width: `${w}px`,
        height: `${h}px`,
        maxWidth: "none",
        aspectRatio: "auto",
        boxSizing: "border-box",
      },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = input.filename;
    a.click();
  } finally {
    element.classList.remove(PROOF_EXPORT_SNAPSHOT_CLASS);
    element.style.removeProperty("--proof-export-w");
    element.style.removeProperty("--proof-export-h");
  }
}
