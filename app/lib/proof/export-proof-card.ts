import { toPng } from "html-to-image";

import {
  PROOF_EXPORT_PIXEL_RATIO,
  PROOF_EXPORT_PX,
  proofPreviewExportFallbackPx,
} from "./ratios";
import type { ProofRatio } from "./types";

/** Applied on the export root during capture. */
export const PROOF_EXPORT_SNAPSHOT_CLASS = "proof-export-snapshot";

const PROOF_CARD_ROOT_SELECTOR = "[data-proof-card-root]";
const PROOF_CARD_SURFACE_SELECTOR = "[data-proof-card-surface]";

const PROOF_EXPORT_THEME_TOKENS = [
  "--bg-surface-2",
  "--bg-surface-3",
  "--surface",
  "--surface-hover",
  "--text",
  "--text-secondary",
  "--text-tertiary",
  "--border",
  "--border-subtle",
  "--link",
  "--brand",
  "--brand-strong",
  "--success",
  "--success-text",
  "--warning",
  "--warning-text",
  "--elevation-2",
] as const;

type ExportThemeTokenName = (typeof PROOF_EXPORT_THEME_TOKENS)[number];
type SavedExportThemeTokens = Array<[ExportThemeTokenName, string]>;

function findProofCardRoot(el: HTMLElement): HTMLElement {
  const root = el.querySelector<HTMLElement>(PROOF_CARD_ROOT_SELECTOR);
  return root ?? el;
}

function findProofCardSurface(el: HTMLElement): HTMLElement {
  const surface = el.querySelector<HTMLElement>(PROOF_CARD_SURFACE_SELECTOR);
  return surface ?? el;
}

function pinCurrentProofExportThemeTokens(
  el: HTMLElement
): SavedExportThemeTokens {
  const computed = window.getComputedStyle(el);
  const saved: SavedExportThemeTokens = [];
  for (const name of PROOF_EXPORT_THEME_TOKENS) {
    saved.push([name, el.style.getPropertyValue(name)]);
    const value = computed.getPropertyValue(name).trim();
    if (value) el.style.setProperty(name, value);
  }
  return saved;
}

function restoreProofExportThemeTokens(
  el: HTMLElement,
  saved: SavedExportThemeTokens
): void {
  for (const [name, value] of saved) {
    if (value) el.style.setProperty(name, value);
    else el.style.removeProperty(name);
  }
}

/** Capture size matches on-screen preview (not upscaled). */
export function measureProofCardRoot(
  cardRoot: HTMLElement,
  ratio: ProofRatio
): { w: number; h: number } {
  const rect = cardRoot.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w > 0 && h > 0) return { w, h };
  return proofPreviewExportFallbackPx(ratio);
}

/** Let layout settle before capture (e.g. after snapshot class toggled). */
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

export function resolveProofExportScale(input: {
  source: { w: number; h: number };
  target: { w: number; h: number };
}): number {
  return Math.min(
    input.target.w / input.source.w,
    input.target.h / input.source.h
  );
}

export async function exportProofCardPng(input: {
  element: HTMLElement;
  ratio: ProofRatio;
  filename: string;
}): Promise<void> {
  const { element } = input;
  const cardRoot = findProofCardRoot(element);
  const source = measureProofCardRoot(cardRoot, input.ratio);
  const target = PROOF_EXPORT_PX[input.ratio];
  const scale = resolveProofExportScale({ source, target });

  element.classList.add(PROOF_EXPORT_SNAPSHOT_CLASS);
  cardRoot.classList.add(PROOF_EXPORT_SNAPSHOT_CLASS);
  const savedThemeTokens = pinCurrentProofExportThemeTokens(cardRoot);
  try {
    await waitForExportLayout();
    const dataUrl = await toPng(cardRoot, {
      width: target.w,
      height: target.h,
      pixelRatio: PROOF_EXPORT_PIXEL_RATIO,
      cacheBust: true,
      style: {
        width: `${source.w}px`,
        height: `${source.h}px`,
        maxWidth: "none",
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = input.filename;
    a.click();
  } finally {
    restoreProofExportThemeTokens(cardRoot, savedThemeTokens);
    cardRoot.classList.remove(PROOF_EXPORT_SNAPSHOT_CLASS);
    element.classList.remove(PROOF_EXPORT_SNAPSHOT_CLASS);
  }
}
