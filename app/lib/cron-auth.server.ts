import { secretsMatch } from "~/lib/secret-match.server";

/**
 * Cron routes are fail-closed. A missing or blank `CRON_SECRET` rejects the
 * request. Callers send the secret as `X-Cron-Secret` or `Authorization: Bearer`.
 */
export function cronRequestAuthorized(
  request: Request | undefined,
  secret: string | undefined
): boolean {
  if (!secret?.trim()) return false;
  if (!request) return false;

  const header = request.headers.get("x-cron-secret")?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(\S+)$/i)?.[1]?.trim() ?? "";
  const provided = header.length > 0 ? header : bearer;
  return secretsMatch(provided, secret);
}
