/**
 * Normalize Prisma `Date` fields for React props after Remix `defer` resolves on
 * the client — JSON turns dates into ISO strings, so `.toISOString()` is not
 * always available.
 */
export function dateLikeToIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export const timeZonesList: string[] = [
  // Africa
  "Africa/Abidjan",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",

  // America
  "America/Anchorage",
  "America/Argentina/Buenos_Aires",
  "America/Chicago",
  "America/Denver",
  "America/Guatemala",
  "America/Halifax",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Vancouver",

  // Asia
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",

  // Australia
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",

  // Europe
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Rome",

  // Pacific
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Pacific/Honolulu",
  "Pacific/Port_Moresby",
  "Pacific/Tahiti",

  // UTC
  "Etc/GMT",
  "Etc/GMT+0",
  "Etc/GMT-1",
  "Etc/GMT+1",
];
