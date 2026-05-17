import { toPng } from "html-to-image";

import { PROOF_EXPORT_PIXEL_RATIO, PROOF_EXPORT_PX } from "./ratios";
import type { ProofRatio } from "./types";

/** Applied on the export root during capture so PNGs use light receipt colors in dark mode. */
export const PROOF_EXPORT_SNAPSHOT_CLASS = "proof-export-snapshot";

const PROOF_CARD_ROOT_SELECTOR = "[data-proof-card-root]";
const PROOF_CARD_SURFACE_SELECTOR = "[data-proof-card-surface]";

const BOX_STYLE_KEYS = ["width", "height", "maxWidth", "aspectRatio"] as const;

type BoxStyleKey = (typeof BOX_STYLE_KEYS)[number];

function findProofCardRoot(el: HTMLElement): HTMLElement {
  const root = el.querySelector<HTMLElement>(PROOF_CARD_ROOT_SELECTOR);
  return root ?? el;
}

function findProofCardSurface(el: HTMLElement): HTMLElement {
  const surface = el.querySelector<HTMLElement>(PROOF_CARD_SURFACE_SELECTOR);
  return surface ?? el;
}

function readInlineBoxStyle(el: HTMLElement): Record<BoxStyleKey, string> {
  return Object.fromEntries(
    BOX_STYLE_KEYS.map((key) => [key, el.style[key]])
  ) as Record<BoxStyleKey, string>;
}

function applyExportBox(el: HTMLElement, w: number, h: number): void {
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.maxWidth = "none";
  el.style.aspectRatio = "auto";
}

function restoreInlineBoxStyle(
  el: HTMLElement,
  saved: Record<BoxStyleKey, string>
): void {
  for (const key of BOX_STYLE_KEYS) {
    el.style[key] = saved[key];
  }
}

/** Let layout settle after resizing the card for export. */
async function waitForExportLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
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
  const savedBox = readInlineBoxStyle(cardRoot);

  element.classList.add(PROOF_EXPORT_SNAPSHOT_CLASS);
  applyExportBox(cardRoot, w, h);
  try {
    await waitForExportLayout();
    const dataUrl = await toPng(cardRoot, {
      pixelRatio: PROOF_EXPORT_PIXEL_RATIO,
      cacheBust: true,
      backgroundColor: resolveProofPngBackground(element),
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = input.filename;
    a.click();
  } finally {
    restoreInlineBoxStyle(cardRoot, savedBox);
    element.classList.remove(PROOF_EXPORT_SNAPSHOT_CLASS);
  }
}
