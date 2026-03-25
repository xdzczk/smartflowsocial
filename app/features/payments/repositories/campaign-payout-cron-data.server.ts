import { prisma } from "~/lib/prisma.server";

export function listEligibleContestsForAutorun(now: Date) {
  return prisma.contest.findMany({
    where: {
      payoutAutoRunEnabled: true,
      payoutWalletMode: "nwc_creator",
      status: { in: ["LOCKED", "PAYOUT_IN_PROGRESS"] },
      contestEndAt: { lt: now },
      cancelledAt: null,
    },
    select: {
      id: true,
      userId: true,
      payoutAutoRunSpendCapSats: true,
      contestEndAt: true,
    },
    orderBy: { contestEndAt: "asc" },
    take: 25,
  });
}

export function listEligibleGiveawaysForAutorun() {
  return prisma.giveaway.findMany({
    where: {
      payoutAutoRunEnabled: true,
      payoutWalletMode: "nwc_creator",
      status: "LOCKED",
    },
    select: {
      id: true,
      userId: true,
      payoutAutoRunSpendCapSats: true,
      lockedAt: true,
    },
    orderBy: { lockedAt: "asc" },
    take: 25,
  });
}
