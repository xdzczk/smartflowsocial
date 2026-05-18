import { toPng } from "html-to-image";

import {
  PROOF_EXPORT_PIXEL_RATIO,
  PROOF_EXPORT_PX,
  proofPreviewExportFallbackPx,
} from "./ratios";
import type { ProofRatio } from "./types";

/** Applied on the export root during capture so PNGs use light receipt colors in dark mode. */
export const PROOF_EXPORT_SNAPSHOT_CLASS = "proof-export-snapshot";

const PROOF_CARD_ROOT_SELECTOR = "[data-proof-card-root]";
const PROOF_CARD_SURFACE_SELECTOR = "[data-proof-card-surface]";

const PROOF_EXPORT_LIGHT_TOKENS = {
  "--bg-surface-2": "0 0% 100%",
  "--bg-surface-3": "42 10% 97%",
  "--surface": "var(--bg-surface-2)",
  "--surface-hover": "var(--bg-surface-3)",
  "--text": "38 14% 10%",
  "--text-secondary": "38 8% 34%",
  "--text-tertiary": "38 5% 46%",
  "--border": "36 9% 84%",
  "--border-subtle": "38 10% 90%",
  "--link": "221 14% 43%",
  "--brand": "222 26% 42%",
  "--brand-strong": "258 62% 55%",
  "--success": "142 70% 36%",
  "--success-text": "142 72% 20%",
  "--warning": "38 92% 45%",
  "--warning-text": "32 92% 22%",
  "--color-surface": "hsl(var(--surface))",
  "--color-surface-hover": "hsl(var(--surface-hover))",
  "--color-text": "hsl(var(--text))",
  "--color-text-secondary": "hsl(var(--text-secondary))",
  "--color-text-tertiary": "hsl(var(--text-tertiary))",
  "--color-border": "hsl(var(--border))",
  "--color-border-subtle": "hsl(var(--border-subtle))",
  "--color-link": "hsl(var(--link))",
  "--color-brand": "hsl(var(--brand))",
  "--color-brand-strong": "hsl(var(--brand-strong))",
  "--color-success": "hsl(var(--success))",
  "--color-success-text": "hsl(var(--success-text))",
  "--color-warning": "hsl(var(--warning))",
  "--color-warning-text": "hsl(var(--warning-text))",
  "--elevation-2":
    "0 12px 32px hsl(32 20% 16% / 0.095), 0 2px 10px hsl(30 14% 12% / 0.07), inset 0 1px 0 0 rgb(255 255 255 / 0.62)",
} as const;

type ExportLightTokenName = keyof typeof PROOF_EXPORT_LIGHT_TOKENS;
type SavedExportLightTokens = Array<[ExportLightTokenName, string]>;

function findProofCardRoot(el: HTMLElement): HTMLElement {
  const root = el.querySelector<HTMLElement>(PROOF_CARD_ROOT_SELECTOR);
  return root ?? el;
}

function findProofCardSurface(el: HTMLElement): HTMLElement {
  const surface = el.querySelector<HTMLElement>(PROOF_CARD_SURFACE_SELECTOR);
  return surface ?? el;
}

function applyProofExportLightTokens(el: HTMLElement): SavedExportLightTokens {
  const saved: SavedExportLightTokens = [];
  for (const [name, value] of Object.entries(
    PROOF_EXPORT_LIGHT_TOKENS
  ) as Array<[ExportLightTokenName, string]>) {
    saved.push([name, el.style.getPropertyValue(name)]);
    el.style.setProperty(name, value);
  }
  return saved;
}

function restoreProofExportLightTokens(
  el: HTMLElement,
  saved: SavedExportLightTokens
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
  const savedLightTokens = applyProofExportLightTokens(cardRoot);
  try {
    await waitForExportLayout();
    const dataUrl = await toPng(cardRoot, {
      width: target.w,
      height: target.h,
      pixelRatio: PROOF_EXPORT_PIXEL_RATIO,
      cacheBust: true,
      backgroundColor: resolveProofPngBackground(element),
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
    restoreProofExportLightTokens(cardRoot, savedLightTokens);
    cardRoot.classList.remove(PROOF_EXPORT_SNAPSHOT_CLASS);
    element.classList.remove(PROOF_EXPORT_SNAPSHOT_CLASS);
  }
}
