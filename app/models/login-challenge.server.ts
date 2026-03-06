import { bindReferralIfEligible } from "~/features/referral/referral-binding.server";
import type { ReferralContext } from "~/features/referral/referral-context.server";
import { ValidationError } from "~/lib/errors";
import { prisma } from "~/lib/prisma.server";

export async function createLoginChallenge(input: {
  nonce: string;
  purpose: string;
  expiresAt: Date;
}) {
  return prisma.loginChallenge.create({
    data: {
      nonce: input.nonce,
      purpose: input.purpose,
      expiresAt: input.expiresAt,
    },
    select: {
      id: true,
      nonce: true,
      purpose: true,
      expiresAt: true,
    },
  });
}

export async function findLoginChallengeForVerify(input: { id: string }) {
  return prisma.loginChallenge.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      nonce: true,
      purpose: true,
      expiresAt: true,
      consumedAt: true,
    },
  });
}

export async function consumeChallengeAndCreateSession(input: {
  challengeId: string;
  pubkey: string;
  profileJson: string;
  sessionTtlMs: number;
  profileRefreshTtlMs: number;
  referralContext?: ReferralContext | null;
}): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const consume = await tx.loginChallenge.updateMany({
      where: { id: input.challengeId, consumedAt: null },
      data: { consumedAt: new Date(), pubkey: input.pubkey },
    });

    if (consume.count !== 1) {
      throw new ValidationError("Challenge already consumed");
    }

    // Upsert user + refresh profile at most every N hours
    const existingUser = await tx.user.findUnique({
      where: { npub: input.pubkey },
      select: { id: true, updatedAt: true },
    });

    const user = existingUser
      ? await (async () => {
          const shouldRefresh =
            existingUser.updatedAt.getTime() <=
            Date.now() - input.profileRefreshTtlMs;
          if (shouldRefresh) {
            await tx.user.update({
              where: { npub: input.pubkey },
              data: { nostrProfile: input.profileJson },
            });
          }
          return { id: existingUser.id };
        })()
      : await (async () => {
          const created = await tx.user.create({
            data: { npub: input.pubkey, nostrProfile: input.profileJson },
            select: { id: true },
          });
          const freePlan = await tx.plan.findUnique({
            where: { id: "free" },
            select: { id: true, price: true },
          });
          if (freePlan) {
            const now = new Date();
            await tx.subscription.create({
              data: {
                id: `sub_${created.id}_free_${Date.now()}`,
                userId: created.id,
                planId: "free",
                status: "ACTIVE",
                startDate: now,
                currentPeriodStart: now,
                currentPeriodEnd: new Date(
                  now.getTime() + 30 * 24 * 60 * 60 * 1000
                ),
                lastPaymentDate: now,
                plan: "free",
                amountSats: BigInt(0),
                amountUsd: freePlan.price,
              },
            });
            await tx.user.update({
              where: { id: created.id },
              data: { isEnabled: true },
            });
          }
          return created;
        })();

    // Referral binding: at first auth, persist referral if context exists and not self-referral
    await bindReferralIfEligible(
      tx,
      input.pubkey,
      input.referralContext ?? null
    );

    const expiresAt = new Date(Date.now() + input.sessionTtlMs);
    const created = await tx.session.create({
      data: {
        userId: user.id,
        pubkey: input.pubkey,
        expiresAt,
      },
      select: { id: true },
    });

    return created.id;
  });
}
