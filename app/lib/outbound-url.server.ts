/**
 * Host checks for server-side fetches that follow a user-supplied URL.
 * Node's URL parser folds decimal and octal IPv4 forms before this runs.
 */

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const a = nums[0] ?? 0;
  const b = nums[1] ?? 0;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  if (/^\d+$/.test(host)) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.startsWith("::ffff:")) return true;
  if (host.includes(":")) {
    const bare = host.split("%")[0] ?? host;
    if (bare === "::" || bare === "::1") return true;
    const first = bare.split(":").find((part) => part.length > 0) ?? "";
    if (first.startsWith("fc") || first.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(first)) return true;
  }
  return false;
}

/**
 * True when the URL is safe to fetch from the server.
 * Private and link-local hosts are rejected unless `allowPrivate` is set.
 * Plain HTTP is rejected in production unless `allowInsecureHttp` is set.
 */
export function isAllowedOutboundUrl(
  raw: string,
  options?: { allowPrivate?: boolean; allowInsecureHttp?: boolean }
): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const https = url.protocol === "https:";
  const http = url.protocol === "http:";
  if (!https && !(http && options?.allowInsecureHttp)) return false;
  if (!options?.allowPrivate && isBlockedHostname(url.hostname)) return false;
  return true;
}
