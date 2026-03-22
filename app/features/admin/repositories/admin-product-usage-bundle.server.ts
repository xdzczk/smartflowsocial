/**
 * Product session aggregates (DAU / WAU / MAU style).
 */

import { prisma } from "~/lib/prisma.server";

import type { DateRangeBounds } from "../metrics/date-range";
import { confidenceForCount } from "../metrics/resolve-confidence";

export interface ProductUsageBundle {
  /** Distinct users with session activity in the selected range. */
  activeSessionUsersInRange: number;
  dauRolling: number;
  wauRolling: number;
  mauRolling: number;
  activeUsersConfidence: ReturnType<typeof confidenceForCount>;
}

async function distinctUsersSince(since: Date, to: Date): Promise<number> {
  const rows = await prisma.productSession.findMany({
    where: {
      lastActivityAt: { gte: since, lt: to },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.length;
}

export async function getProductUsageBundle(
  bounds: DateRangeBounds,
  now: Date = new Date()
): Promise<ProductUsageBundle> {
  const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const rangeUsersPromise = prisma.productSession.findMany({
    where: {
      lastActivityAt: { gte: bounds.from, lt: bounds.to },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  const [rangeUsers, dauRolling, wauRolling, mauRolling] = await Promise.all([
    rangeUsersPromise,
    distinctUsersSince(d1, now),
    distinctUsersSince(d7, now),
    distinctUsersSince(d30, now),
  ]);

  const activeSessionUsersInRange = rangeUsers.length;

  return {
    activeSessionUsersInRange,
    dauRolling,
    wauRolling,
    mauRolling,
    activeUsersConfidence: confidenceForCount(activeSessionUsersInRange),
  };
}
