import { timingSafeEqual } from "node:crypto";

/**
 * Cron routes stay open when the secret is unset so existing installs keep
 * working. When `CRON_SECRET` is set, the caller must send it as
 * `X-Cron-Secret` or `Authorization: Bearer`.
 */
export function cronRequestAuthorized(
  request: Request | undefined,
  secret: string | undefined
): boolean {
  if (!secret) return true;
  if (!request) return false;

  const header = request.headers.get("x-cron-secret")?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const provided = header.length > 0 ? header : bearer;
  return secretsMatch(provided, secret);
}

function secretsMatch(provided: string, secret: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(secret);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
