/**
 * Queue color token system: 12 design-approved colors.
 * All queue color UI uses these tokens; no raw hex stored.
 */

export const QUEUE_COLOR_TOKENS = [
  "slate",
  "blue",
  "cyan",
  "teal",
  "green",
  "lime",
  "amber",
  "orange",
  "red",
  "pink",
  "violet",
  "indigo",
] as const;

export type QueueColorToken = (typeof QUEUE_COLOR_TOKENS)[number];

export const QUEUE_COLOR_ACCENTS: Record<QueueColorToken, string> = {
  slate: "#94A3B8",
  blue: "#2563EB",
  cyan: "#0891B2",
  teal: "#0D9488",
  green: "#16A34A",
  lime: "#65A30D",
  amber: "#D97706",
  orange: "#EA580C",
  red: "#DC2626",
  pink: "#DB2777",
  violet: "#7C3AED",
  indigo: "#4338CA",
};

/**
 * Queue color bundle: base, surface tint, and text/accent for calendar and other UI.
 * Queue color base, surface tint, text color, border logic — locked system-wide for calendar.
 * Surface is luminance-safe (light mode: tinted surface; dark: slightly elevated). Use accent for text on surface.
 */
export interface QueueColorBundle {
  accent: string;
  surface: string;
  soft: string;
  /** Readable text on surface; defaults to accent. Use for labels to ensure contrast (WCAG AA). */
  text?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result?.[1] || !result[2] || !result[3]) {
    return null;
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

const SLATE_BUNDLE: QueueColorBundle = (() => {
  const accent = QUEUE_COLOR_ACCENTS.slate;
  const rgb = hexToRgb(accent)!;
  return {
    accent,
    surface: `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`,
    soft: `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`,
    text: accent,
  };
})();

/** Get accent, surface (~12%), and soft (~6%) for a token. Null/invalid → slate bundle. */
export function getQueueColorBundle(token: string | null): QueueColorBundle {
  const key = token as QueueColorToken;
  if (!token || !QUEUE_COLOR_ACCENTS[key]) {
    return SLATE_BUNDLE;
  }
  const accent = QUEUE_COLOR_ACCENTS[key];
  const rgb = hexToRgb(accent);
  if (!rgb) {
    return SLATE_BUNDLE;
  }
  return {
    accent,
    surface: `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`,
    soft: `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`,
    text: accent,
  };
}

/** Convert hex to HSL (h in [0,360), s and l in [0,1]). Returns null if invalid. */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }
  h *= 360;
  return { h, s, l };
}

const TOKEN_HUES = ((): number[] => {
  return QUEUE_COLOR_TOKENS.map((t) => {
    const hsl = hexToHsl(QUEUE_COLOR_ACCENTS[t]);
    return hsl ? hsl.h : 0;
  });
})();

/** Map existing hex color to nearest queue color token by hue. Grayscale/invalid → slate. */
export function hexToNearestQueueColorToken(
  hex: string | null
): QueueColorToken {
  if (!hex || typeof hex !== "string") return "slate";
  const normalized = hex.startsWith("#") ? hex : `#${hex}`;
  const hsl = hexToHsl(normalized);
  if (!hsl || hsl.s < 0.05) return "slate"; // grayscale
  const h = hsl.h;
  let bestToken: QueueColorToken = "slate";
  let bestDist = 360;
  for (let i = 0; i < QUEUE_COLOR_TOKENS.length; i++) {
    const th = TOKEN_HUES[i] ?? 0;
    let d = Math.abs(h - th);
    if (d > 180) d = 360 - d;
    if (d < bestDist) {
      bestDist = d;
      const token = QUEUE_COLOR_TOKENS[i];
      if (token) bestToken = token;
    }
  }
  return bestToken;
}

// Name-based fallback for unassigned / legacy display
const UNASSIGNED_MAP = {
  bg: "bg-surface-hover",
  text: "text-text-secondary",
  hover: "hover:bg-surface-hover/80",
  border: "border-border",
} as const;

/** Queue color styles: use token when provided, else name-based map (unassigned). */
export const getQueueColor = (
  queueTypeName: string,
  colorToken?: string | null
) => {
  const token =
    colorToken && QUEUE_COLOR_ACCENTS[colorToken as QueueColorToken]
      ? (colorToken as QueueColorToken)
      : null;
  if (token) {
    const bundle = getQueueColorBundle(token);
    const accent = bundle.accent;
    return {
      bg: `bg-[${accent}]/10 dark:bg-[${accent}]/[0.14]`,
      text: `text-[${accent}] dark:text-[${accent}]`,
      hover: `hover:bg-[${accent}]/15 dark:hover:bg-[${accent}]/[0.18]`,
      border: `border-[${accent}] dark:border-[${accent}]`,
    };
  }
  const colorMap: Record<
    string,
    { bg: string; text: string; hover: string; border: string }
  > = {
    main: {
      bg: "bg-brand/[0.06]",
      text: "text-brand",
      hover: "hover:bg-brand/15",
      border: "border-brand/20",
    },
    memes: {
      bg: "bg-success/[0.06]",
      text: "text-success dark:text-success",
      hover: "hover:bg-success/[0.10]",
      border: "border-success/20",
    },
    quotes: {
      bg: "bg-brand/[0.06]",
      text: "text-text",
      hover: "hover:bg-surface-hover",
      border: "border-accent/20",
    },
    unassigned: UNASSIGNED_MAP,
  };
  return colorMap[queueTypeName.toLowerCase()] ?? UNASSIGNED_MAP;
};

export const getSelectedQueueStyle = (
  colorTokenOrQueueName: string | null,
  isSelected: boolean
) => {
  const token =
    colorTokenOrQueueName &&
    QUEUE_COLOR_ACCENTS[colorTokenOrQueueName as QueueColorToken]
      ? (colorTokenOrQueueName as QueueColorToken)
      : null;
  const colors = token
    ? getQueueColor("", token)
    : getQueueColor(
        typeof colorTokenOrQueueName === "string"
          ? colorTokenOrQueueName
          : "unassigned"
      );

  if (isSelected) {
    return `${colors.bg} ${colors.text} ${colors.border} border-2 ring-2 ring-brand font-medium`;
  }
  return `${colors.bg} ${colors.text} ${colors.hover} ${colors.border} border opacity-70 hover:opacity-100 hover:shadow-1`;
};

/** Dynamic queue style: token → bundle accent for inline styles; null → unassigned. */
export const getDynamicQueueStyle = (
  colorToken: string | null,
  isSelected: boolean
) => {
  const token =
    colorToken && QUEUE_COLOR_ACCENTS[colorToken as QueueColorToken]
      ? (colorToken as QueueColorToken)
      : null;
  if (!token) {
    return getSelectedQueueStyle("unassigned", isSelected);
  }
  const baseStyle = "transition-all duration-200";
  if (isSelected) {
    return `${baseStyle} border-2 ring-2 ring-brand font-medium`;
  }
  return `${baseStyle} border opacity-70 hover:opacity-100 hover:shadow-1`;
};

/** Rectangle pill with minimal rounded-xs corners for queue labels (use across app). */
export const QUEUE_PILL_SHAPE_CLASS =
  "inline-flex rounded-md border-2 px-3 py-1 text-xs font-semibold leading-4 shadow-1";

/** Opacity for queue pills in tables/lists: lower by default, full on hover/focus/touch (match Queue Health). */
export const QUEUE_PILL_OPACITY_CLASS =
  "opacity-70 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100";

/** Get accent hex for a token (for inline styles). Null/unknown → slate accent. */
export function getQueueAccentHex(colorToken: string | null): string {
  const token =
    colorToken && QUEUE_COLOR_ACCENTS[colorToken as QueueColorToken]
      ? (colorToken as QueueColorToken)
      : null;
  return getQueueColorBundle(token).accent;
}
