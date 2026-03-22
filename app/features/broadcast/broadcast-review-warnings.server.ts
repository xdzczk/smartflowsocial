import type { PlanType } from "~/features/payments/types";
import { prisma } from "~/lib/prisma.server";

import { largeAudienceWarningThreshold } from "./broadcast-guardrails.server";

export interface BroadcastReviewWarning {
  level: "info" | "warning";
  message: string;
}

export async function getBroadcastReviewWarnings(input: {
  userId: string;
  campaignId: string;
  messageBody: string;
  audienceType: string;
  totalRecipients: number;
  suppressedCount: number;
  invalidCustomEstimate: number;
  planType: PlanType;
}): Promise<BroadcastReviewWarning[]> {
  const out: BroadcastReviewWarning[] = [];
  const threshold = largeAudienceWarningThreshold(input.planType);
  if (input.totalRecipients >= threshold) {
    out.push({
      level: "warning",
      message: `Large send (${String(input.totalRecipients)} recipients). Double-check message tone and audience.`,
    });
  }
  if (input.suppressedCount > 0) {
    out.push({
      level: "info",
      message: `${String(input.suppressedCount)} recipient(s) excluded by your suppression list or self-send rules.`,
    });
  }
  if (input.invalidCustomEstimate > 0) {
    out.push({
      level: "warning",
      message: `${String(input.invalidCustomEstimate)} custom list line(s) were invalid and skipped during resolution.`,
    });
  }

  const recent = await prisma.broadcastCampaign.findMany({
    where: {
      userId: input.userId,
      id: { not: input.campaignId },
      status: {
        in: [
          "COMPLETED",
          "COMPLETED_WITH_FAILURES",
          "SENDING",
          "QUEUED",
          "SCHEDULED",
        ],
      },
    },
    select: { messageBody: true },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const cur = norm(input.messageBody);
  if (cur.length > 20) {
    for (const r of recent) {
      if (norm(r.messageBody) === cur) {
        out.push({
          level: "warning",
          message:
            "This message matches a recent broadcast verbatim. Consider varying content to reduce fatigue.",
        });
        break;
      }
    }
  }

  return out;
}
