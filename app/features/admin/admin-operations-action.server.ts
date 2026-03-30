import { json, type ActionFunctionArgs } from "@remix-run/node";

import {
  cleanFailedJobsInAllQueues,
  purgePublishRelayAcksAdmin,
} from "~/features/admin/repositories/admin-operations-cleanup.server";
import { requireUser } from "~/features/auth";
import { isReferralAdmin } from "~/features/referral/referral-admin.server";
import { retryDeadLetterJob } from "~/infra/queue/dead-letter-queue.server";
import { withCSRFProtection } from "~/lib/csrf";

export const adminOperationsAction = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    const user = await requireUser(request);
    if (!isReferralAdmin(user.npub)) {
      return json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const op = formData.get("_action");

    if (op === "replay_dead_letter") {
      const entryId = String(formData.get("entry_id") ?? "").trim();
      const confirmPhrase = String(formData.get("confirm_phrase") ?? "").trim();
      if (!entryId) {
        return json(
          { error: "Missing dead-letter entry id." },
          { status: 400 }
        );
      }
      if (confirmPhrase !== "REPLAY") {
        return json(
          { error: "Type REPLAY in the confirmation field to proceed." },
          { status: 400 }
        );
      }

      const result = await retryDeadLetterJob(entryId);
      if (!result.success) {
        return json(
          { error: result.error ?? "Could not re-enqueue job." },
          { status: 422 }
        );
      }

      return json({ ok: true as const });
    }

    if (op === "clean_failed_jobs") {
      const confirmPhrase = String(formData.get("confirm_phrase") ?? "").trim();
      if (confirmPhrase !== "CLEAN") {
        return json(
          { error: "Type CLEAN in the confirmation field to proceed." },
          { status: 400 }
        );
      }
      const cleaned = await cleanFailedJobsInAllQueues({
        operatorNpub: user.npub,
      });
      if (!cleaned.ok) {
        return json({ error: cleaned.error }, { status: 422 });
      }
      return json({
        ok: true as const,
        cleanFailed: {
          total: cleaned.total,
          byQueue: cleaned.byQueue,
        },
      });
    }

    if (op === "purge_relay_acks") {
      const confirmPhrase = String(formData.get("confirm_phrase") ?? "").trim();
      if (confirmPhrase !== "PURGE") {
        return json(
          { error: "Type PURGE in the confirmation field to proceed." },
          { status: 400 }
        );
      }
      const daysRaw = String(formData.get("older_than_days") ?? "30").trim();
      const olderThanDays = parseInt(daysRaw, 10);
      if (!Number.isFinite(olderThanDays)) {
        return json({ error: "Invalid older_than_days." }, { status: 400 });
      }

      const purged = await purgePublishRelayAcksAdmin({
        olderThanDays,
        operatorNpub: user.npub,
      });
      if (!purged.ok) {
        return json({ error: purged.error }, { status: 422 });
      }
      return json({
        ok: true as const,
        purgeRelayAcks: {
          deletedCount: purged.deletedCount,
          cutoffIso: purged.cutoffIso,
          olderThanDays: purged.olderThanDays,
        },
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  }
);
