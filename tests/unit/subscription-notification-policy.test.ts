import { describe, expect, it } from "vitest";

import { computeDueNotificationIntents } from "~/features/payments/services/subscription-notification-policy.server";

const basePlan = {
  name: "Pro",
  id: "pro",
  enableLifetimeAccess: false,
};

describe("computeDueNotificationIntents", () => {
  const periodEnd = new Date("2030-06-15T12:00:00.000Z");
  const periodStart = new Date("2030-05-15T12:00:00.000Z");

  it("emits manual top-up 24h when within window", () => {
    const now = new Date("2030-06-14T14:00:00.000Z");
    const intents = computeDueNotificationIntents({
      now,
      user: { nwcEnabled: false, encryptedNwc: null },
      subscription: {
        id: "sub_1",
        planId: "pro",
        status: "ACTIVE",
        paymentMethod: "lightning_one_time",
        renewalMode: "manual",
        cancelAtPeriodEnd: false,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null,
        Plan: basePlan,
      },
    });
    expect(intents.some((i) => i.eventType === "topup_reminder_24h")).toBe(
      true
    );
  });

  it("does not emit NWC grace events for manual payer", () => {
    const now = new Date("2030-06-10T12:00:00.000Z");
    const graceEnd = new Date("2030-06-22T12:00:00.000Z");
    const intents = computeDueNotificationIntents({
      now,
      user: { nwcEnabled: false, encryptedNwc: null },
      subscription: {
        id: "sub_1",
        planId: "pro",
        status: "UNPAID",
        paymentMethod: "lightning_one_time",
        renewalMode: "manual",
        cancelAtPeriodEnd: false,
        currentPeriodStart: periodStart,
        currentPeriodEnd: new Date("2030-06-01T12:00:00.000Z"),
        gracePeriodEndsAt: graceEnd,
        Plan: basePlan,
      },
    });
    expect(intents.some((i) => i.eventType === "grace_period_started")).toBe(
      false
    );
  });

  it("emits nwc_action_required when auto SKU but no wallet", () => {
    const now = new Date("2030-06-10T12:00:00.000Z");
    const intents = computeDueNotificationIntents({
      now,
      user: { nwcEnabled: false, encryptedNwc: null },
      subscription: {
        id: "sub_1",
        planId: "pro",
        status: "ACTIVE",
        paymentMethod: "nwc_auto_renew",
        renewalMode: "auto_renew",
        cancelAtPeriodEnd: false,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null,
        Plan: basePlan,
      },
    });
    expect(intents.some((i) => i.eventType === "nwc_action_required")).toBe(
      true
    );
  });
});
