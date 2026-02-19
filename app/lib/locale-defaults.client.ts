/**
 * Browser/OS locale detection for time and date format preferences.
 * Used to apply locale defaults for new users who have not yet changed settings.
 * Client-only: guards for SSR (no navigator).
 */

export type LocaleTimeFormat = "12h" | "24h";
export type LocaleDateFormat = "ddmmyyyy" | "mmddyyyy" | "yyyymmdd";

const APP_DEFAULT_TIME_FORMAT: LocaleTimeFormat = "24h";
const APP_DEFAULT_DATE_FORMAT: LocaleDateFormat = "ddmmyyyy";

/** Locales that use MM/DD/YYYY (US-style). */
const MMDDYYYY_LOCALES = new Set([
  "en-US",
  "en-PH",
  "en-ZW",
  "fil",
  "fo",
  "gd",
  "gu",
  "ha",
  "haw",
  "hi",
  "id",
  "kn",
  "kok",
  "lkt",
  "lo",
  "mh",
  "ml",
  "mr",
  "pa",
  "ps",
  "pt-BR",
  "sd",
  "si",
  "sm",
  "sq",
  "sw",
  "ta",
  "te",
  "to",
  "ur",
  "yi",
  "zu",
]);

/** Locales that use YYYY-MM-DD (ISO / Asian). */
const YYYYMMDD_LOCALES = new Set([
  "ja",
  "ja-JP",
  "ko",
  "ko-KR",
  "zh",
  "zh-CN",
  "zh-Hans",
  "zh-Hans-CN",
  "zh-Hant",
  "zh-Hant-TW",
  "zh-TW",
  "sv",
  "sv-SE",
  "fi",
  "fi-FI",
  "hu",
  "hu-HU",
  "lt",
  "lv",
  "no",
  "nb",
  "nn",
]);

/**
 * Infer date format order from Intl.formatToParts for a given locale.
 * Returns "ddmmyyyy" | "mmddyyyy" | "yyyymmdd" or null if detection fails.
 */
function inferDateFormatFromParts(locale: string): LocaleDateFormat | null {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const parts = formatter.formatToParts(new Date(2025, 0, 19)); // 19 Jan 2025
    const order: string[] = [];
    for (const part of parts) {
      if (part.type === "day") order.push("d");
      else if (part.type === "month") order.push("m");
      else if (part.type === "year") order.push("y");
    }
    const key = order.join("");
    if (key === "dmy") return "ddmmyyyy";
    if (key === "mdy") return "mmddyyyy";
    if (key === "ymd") return "yyyymmdd";
    return null;
  } catch {
    return null;
  }
}

/**
 * Map locale string to date format using lookup and fallback to formatToParts.
 */
function localeToDateFormat(locale: string): LocaleDateFormat {
  const normalized = locale.trim();
  if (!normalized) return APP_DEFAULT_DATE_FORMAT;

  const base = normalized.split("-")[0] ?? normalized;
  const full = normalized;

  if (MMDDYYYY_LOCALES.has(full) || MMDDYYYY_LOCALES.has(base)) {
    return "mmddyyyy";
  }
  if (YYYYMMDD_LOCALES.has(full) || YYYYMMDD_LOCALES.has(base)) {
    return "yyyymmdd";
  }

  // en-GB, en-AU, de-DE, fr-FR, etc. -> ddmmyyyy (default)
  const inferred = inferDateFormatFromParts(normalized);
  return inferred ?? APP_DEFAULT_DATE_FORMAT;
}

/**
 * Get time and date format preferences from the browser/OS locale.
 * Safe for SSR: returns app defaults when navigator is not available or detection fails.
 */
export function getLocaleTimeAndDateFormat(): {
  timeFormat: LocaleTimeFormat;
  dateFormat: LocaleDateFormat;
} {
  if (typeof navigator === "undefined" || !navigator.language) {
    return {
      timeFormat: APP_DEFAULT_TIME_FORMAT,
      dateFormat: APP_DEFAULT_DATE_FORMAT,
    };
  }

  try {
    const lang = navigator.language;

    const timeFormat: LocaleTimeFormat = (() => {
      const opts = new Intl.DateTimeFormat(lang, {
        hour: "numeric",
      }).resolvedOptions();
      return opts.hour12 ? "12h" : "24h";
    })();

    const dateFormat = localeToDateFormat(lang);

    return { timeFormat, dateFormat };
  } catch {
    return {
      timeFormat: APP_DEFAULT_TIME_FORMAT,
      dateFormat: APP_DEFAULT_DATE_FORMAT,
    };
  }
}
