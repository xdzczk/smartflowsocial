/**
 * Consistent number formatting for operator admin surfaces.
 * Pass `locale` from `useFormattedDate().dateLocale` so grouping matches date prefs.
 */

export function formatAdminInteger(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

export function formatAdminDeltaPercent(p: number | null | undefined): string {
  if (p === null || p === undefined) return "—";
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}
