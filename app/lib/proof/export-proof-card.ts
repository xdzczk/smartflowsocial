import { toPng } from "html-to-image";

import { beginProofExport } from "./proof-export-guard.client";
import {
  PROOF_EXPORT_PIXEL_RATIO,
  proofPreviewExportFallbackPx,
} from "./ratios";
import type { ProofRatio } from "./types";

/** Applied on the export root during capture. */
export const PROOF_EXPORT_SNAPSHOT_CLASS = "proof-export-snapshot";

const PROOF_CARD_ROOT_SELECTOR = "[data-proof-card-root]";
const PROOF_CARD_SURFACE_SELECTOR = "[data-proof-card-surface]";

const PROOF_CARD_SURFACE_PAINT_KEYS = [
  "backgroundColor",
  "backgroundImage",
] as const;

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
type SurfacePaintKey = (typeof PROOF_CARD_SURFACE_PAINT_KEYS)[number];
type SavedSurfacePaint = Array<[SurfacePaintKey, string]>;

function querySelectorWithin(
  root: HTMLElement,
  selector: string
): HTMLElement | null {
  if (typeof root.querySelector !== "function") return null;
  return root.querySelector<HTMLElement>(selector);
}

function findProofCardRoot(el: HTMLElement): HTMLElement {
  return querySelectorWithin(el, PROOF_CARD_ROOT_SELECTOR) ?? el;
}

function findProofCardSurface(el: HTMLElement): HTMLElement {
  return querySelectorWithin(el, PROOF_CARD_SURFACE_SELECTOR) ?? el;
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

export function resolveProofPngBackground(surface: HTMLElement): string {
  const bg = window.getComputedStyle(surface).backgroundColor;
  if (
    bg &&
    bg !== "transparent" &&
    bg !== "rgba(0, 0, 0, 0)" &&
    !/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(bg)
  ) {
    return bg;
  }
  const surfaceRaw = window
    .getComputedStyle(surface)
    .getPropertyValue("--surface")
    .trim();
  if (surfaceRaw) return `hsl(${surfaceRaw})`;
  return "#ffffff";
}

function pinProofCardSurfacePaint(surface: HTMLElement): SavedSurfacePaint {
  const saved: SavedSurfacePaint = PROOF_CARD_SURFACE_PAINT_KEYS.map((key) => [
    key,
    surface.style[key],
  ]);

  // Keep the PNG canvas transparent, but flatten the rounded card surface itself.
  surface.style.backgroundColor = resolveProofPngBackground(surface);
  surface.style.backgroundImage = "none";

  return saved;
}

function restoreProofCardSurfacePaint(
  surface: HTMLElement,
  saved: SavedSurfacePaint
): void {
  for (const [key, value] of saved) {
    surface.style[key] = value;
  }
}

/** Measured layout size of the card root in the preview. */
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

/**
 * Scale up to design preview max (380px portrait/square, 720px landscape) when the
 * on-screen card is narrower (e.g. mobile column). Never downscales.
 */
export function resolveProofExportScale(input: {
  source: { w: number; h: number };
  target: { w: number; h: number };
}): number {
  const { source, target } = input;
  if (source.w <= 0 || source.h <= 0) return 1;
  const scale = Math.min(target.w / source.w, target.h / source.h);
  return scale > 1 ? scale : 1;
}

export function resolveProofExportCapture(
  cardRoot: HTMLElement,
  ratio: ProofRatio
): {
  source: { w: number; h: number };
  exportW: number;
  exportH: number;
  scale: number;
} {
  const source = measureProofCardRoot(cardRoot, ratio);
  const target = proofPreviewExportFallbackPx(ratio);
  const scale = resolveProofExportScale({ source, target });
  return {
    source,
    exportW: Math.round(source.w * scale),
    exportH: Math.round(source.h * scale),
    scale,
  };
}

/** Let layout settle before capture (e.g. after snapshot class toggled). */
async function waitForExportLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function triggerProofPngDownload(
  dataUrl: string,
  filename: string
): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
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
  const endProofExport = beginProofExport();
  const { element } = input;
  const cardRoot = findProofCardRoot(element);
  const cardSurface = findProofCardSurface(element);
  const { source, exportW, exportH, scale } = resolveProofExportCapture(
    cardRoot,
    input.ratio
  );

  element.classList.add(PROOF_EXPORT_SNAPSHOT_CLASS);
  cardRoot.classList.add(PROOF_EXPORT_SNAPSHOT_CLASS);
  const savedThemeTokens = pinCurrentProofExportThemeTokens(cardRoot);
  const savedSurfacePaint = pinProofCardSurfacePaint(cardSurface);
  try {
    await waitForExportLayout();
    const dataUrl = await toPng(cardRoot, {
      width: exportW,
      height: exportH,
      pixelRatio: PROOF_EXPORT_PIXEL_RATIO,
      cacheBust: false,
      style: {
        width: `${source.w}px`,
        height: `${source.h}px`,
        maxWidth: "none",
        aspectRatio: "auto",
        ...(scale > 1
          ? {
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }
          : {}),
      },
    });
    triggerProofPngDownload(dataUrl, input.filename);
  } finally {
    restoreProofCardSurfacePaint(cardSurface, savedSurfacePaint);
    restoreProofExportThemeTokens(cardRoot, savedThemeTokens);
    cardRoot.classList.remove(PROOF_EXPORT_SNAPSHOT_CLASS);
    element.classList.remove(PROOF_EXPORT_SNAPSHOT_CLASS);
    endProofExport();
  }
}
