/**
 * Remote signer (NIP-46 profile) vs extension proxy + reconnect failure stats.
 */

import { prisma } from "~/lib/prisma.server";

import type { DateRangeBounds } from "../metrics/date-range";
import { confidenceForRate } from "../metrics/resolve-confidence";

export interface SignerConnectHealthBundle {
  enabledUsers: number;
  usersWithNip46Profile: number;
  usersExtensionOrUnset: number;
  reconnectAttemptsInRange: number;
  reconnectFailuresInRange: number;
  reconnectFailureRatePct: number | null;
  distinctUsersWithFailureInRange: number;
  failuresByBucket: Array<{ bucket: string; count: number }>;
  reconnectConfidence: ReturnType<typeof confidenceForRate>;
}

export async function getSignerConnectHealthBundle(
  bounds: DateRangeBounds
): Promise<SignerConnectHealthBundle> {
  const [enabledUsers, nip46Count, reconnectStats, failureUsers, bucketRows] =
    await Promise.all([
      prisma.user.count({ where: { isEnabled: true } }),
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*)::bigint AS c
        FROM "User"
        WHERE "isEnabled" = true
          AND ("primarySignerProfile"::jsonb ->> 'type') = 'nip46'
      `,
      prisma.signerReconnectEvent.groupBy({
        by: ["success"],
        where: {
          createdAt: { gte: bounds.from, lt: bounds.to },
        },
        _count: { _all: true },
      }),
      prisma.signerReconnectEvent.findMany({
        where: {
          success: false,
          createdAt: { gte: bounds.from, lt: bounds.to },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.signerReconnectEvent.groupBy({
        by: ["failureBucket"],
        where: {
          success: false,
          createdAt: { gte: bounds.from, lt: bounds.to },
        },
        _count: { _all: true },
      }),
    ]);

  const usersWithNip46Profile = Number(nip46Count[0]?.c ?? 0);
  const usersExtensionOrUnset = Math.max(
    0,
    enabledUsers - usersWithNip46Profile
  );

  const attempts = reconnectStats.reduce((s, r) => s + r._count._all, 0);
  const failures =
    reconnectStats.find((r) => r.success === false)?._count._all ?? 0;
  const reconnectFailureRatePct =
    attempts === 0 ? null : Math.round((failures / attempts) * 1000) / 10;

  const failuresByBucket = bucketRows
    .filter((r) => r.failureBucket !== null)
    .map((r) => ({
      bucket: String(r.failureBucket),
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    enabledUsers,
    usersWithNip46Profile,
    usersExtensionOrUnset,
    reconnectAttemptsInRange: attempts,
    reconnectFailuresInRange: failures,
    reconnectFailureRatePct,
    distinctUsersWithFailureInRange: failureUsers.length,
    failuresByBucket,
    reconnectConfidence: confidenceForRate(attempts - failures, attempts),
  };
}
