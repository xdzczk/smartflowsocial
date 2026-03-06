/**
 * Referral settings actions: save payout destination.
 */

import { json } from "@remix-run/node";

import { getUserById } from "~/features/user";
import { prisma } from "~/lib/prisma.server";

const REFERRAL_SAVE_PAYOUT = "referral_save_payout";

export async function handleReferralAction(
  userId: string,
  _action: string,
  formData: FormData
): Promise<ReturnType<typeof json> | null> {
  if (_action !== REFERRAL_SAVE_PAYOUT) return null;

  const user = await getUserById(userId);
  if (!user?.npub) {
    return json({ error: "User not found" }, { status: 400 });
  }

  const payoutDestination = formData.get("payout_destination");
  const payoutDestinationType = formData.get("payout_destination_type");

  const dest =
    typeof payoutDestination === "string" ? payoutDestination.trim() : "";
  const type =
    typeof payoutDestinationType === "string"
      ? payoutDestinationType.trim() || null
      : null;

  if (!dest) {
    return json(
      {
        error: "Payout destination is required",
        _action: REFERRAL_SAVE_PAYOUT,
      },
      { status: 400 }
    );
  }

  await prisma.referrerPayoutConfig.upsert({
    where: { referrerNpub: user.npub },
    create: {
      referrerNpub: user.npub,
      payoutDestination: dest,
      payoutDestinationType: type,
    },
    update: {
      payoutDestination: dest,
      payoutDestinationType: type,
    },
  });

  return json({ success: true, _action: REFERRAL_SAVE_PAYOUT });
}
