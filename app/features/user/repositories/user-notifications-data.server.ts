/**
 * User notification preferences data access. Prisma confined to feature repositories/ per architecture.
 */

import { prisma } from "~/lib/prisma.server";

/**
 * Returns user ids that have runway-low push notification enabled.
 * Used by the runway-low cron to decide whom to evaluate.
 */
export async function getUserIdWithRunwayLowNotificationEnabled(): Promise<
  string[]
> {
  const users = await prisma.user.findMany({
    where: {
      pushNotificationsEnabled: true,
      pushNotifyRunwayLow: true,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
