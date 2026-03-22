/**
 * Action tests for app/routes/dashboard.admin.operations (dead-letter replay).
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireUser = vi.fn();
const mockIsReferralAdmin = vi.fn();
const mockRetryDeadLetterJob = vi.fn();
const mockCleanFailedJobsInAllQueues = vi.fn();
const mockPurgePublishRelayAcksAdmin = vi.fn();

vi.mock("~/features/auth", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
}));

vi.mock("~/features/referral/referral-admin.server", () => ({
  isReferralAdmin: (...args: unknown[]) => mockIsReferralAdmin(...args),
}));

vi.mock("~/infra/queue/dead-letter-queue.server", () => ({
  retryDeadLetterJob: (...args: unknown[]) => mockRetryDeadLetterJob(...args),
}));

vi.mock(
  "~/features/admin/repositories/admin-operations-cleanup.server",
  () => ({
    cleanFailedJobsInAllQueues: (...args: unknown[]) =>
      mockCleanFailedJobsInAllQueues(...args),
    purgePublishRelayAcksAdmin: (...args: unknown[]) =>
      mockPurgePublishRelayAcksAdmin(...args),
  })
);

vi.mock("~/lib/csrf", () => ({
  withCSRFProtection: (fn: (args: ActionFunctionArgs) => Promise<unknown>) =>
    fn,
}));

import { action } from "~/routes/dashboard.admin.operations";

function postForm(body: FormData): ActionFunctionArgs {
  return {
    request: new Request("http://localhost/dashboard/admin/operations", {
      method: "POST",
      body,
    }),
    params: {},
    context: {},
  };
}

describe("dashboard.admin.operations action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ npub: "npub_admin" });
    mockIsReferralAdmin.mockReturnValue(true);
    mockRetryDeadLetterJob.mockResolvedValue({ success: true });
    mockCleanFailedJobsInAllQueues.mockResolvedValue({
      ok: true,
      total: 2,
      byQueue: { "scheduled-posts": 2 },
    });
    mockPurgePublishRelayAcksAdmin.mockImplementation(
      async (input: { olderThanDays: number; operatorNpub: string }) => ({
        ok: true as const,
        deletedCount: 5,
        cutoffIso: "2026-01-01T00:00:00.000Z",
        olderThanDays: Math.min(
          365,
          Math.max(7, Math.floor(input.olderThanDays))
        ),
      })
    );
  });

  it("returns 403 when user is not referral admin", async () => {
    mockIsReferralAdmin.mockReturnValue(false);
    const body = new FormData();
    body.set("_action", "replay_dead_letter");
    body.set("entry_id", "dl_1");
    body.set("confirm_phrase", "REPLAY");
    const res = await action(postForm(body));
    expect(res.status).toBe(403);
  });

  it("returns 400 when confirmation phrase is not REPLAY", async () => {
    const body = new FormData();
    body.set("_action", "replay_dead_letter");
    body.set("entry_id", "dl_1");
    body.set("confirm_phrase", "no");
    const res = await action(postForm(body));
    expect(res.status).toBe(400);
    expect(mockRetryDeadLetterJob).not.toHaveBeenCalled();
  });

  it("replays dead letter and returns ok", async () => {
    const body = new FormData();
    body.set("_action", "replay_dead_letter");
    body.set("entry_id", "dl_abc");
    body.set("confirm_phrase", "REPLAY");
    const res = await action(postForm(body));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockRetryDeadLetterJob).toHaveBeenCalledWith("dl_abc");
  });

  it("returns 422 when retry fails", async () => {
    mockRetryDeadLetterJob.mockResolvedValue({
      success: false,
      error: "Dead letter entry not found",
    });
    const body = new FormData();
    body.set("_action", "replay_dead_letter");
    body.set("entry_id", "missing");
    body.set("confirm_phrase", "REPLAY");
    const res = await action(postForm(body));
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({
      error: "Dead letter entry not found",
    });
  });

  it("cleans failed jobs when CLEAN is confirmed", async () => {
    const body = new FormData();
    body.set("_action", "clean_failed_jobs");
    body.set("confirm_phrase", "CLEAN");
    const res = await action(postForm(body));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      cleanFailed: { total: 2, byQueue: { "scheduled-posts": 2 } },
    });
    expect(mockCleanFailedJobsInAllQueues).toHaveBeenCalledWith({
      operatorNpub: "npub_admin",
    });
  });

  it("returns 400 when CLEAN phrase wrong", async () => {
    const body = new FormData();
    body.set("_action", "clean_failed_jobs");
    body.set("confirm_phrase", "no");
    const res = await action(postForm(body));
    expect(res.status).toBe(400);
    expect(mockCleanFailedJobsInAllQueues).not.toHaveBeenCalled();
  });

  it("purges relay acks when PURGE is confirmed", async () => {
    const body = new FormData();
    body.set("_action", "purge_relay_acks");
    body.set("confirm_phrase", "PURGE");
    body.set("older_than_days", "14");
    const res = await action(postForm(body));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      purgeRelayAcks: {
        deletedCount: 5,
        cutoffIso: "2026-01-01T00:00:00.000Z",
        olderThanDays: 14,
      },
    });
    expect(mockPurgePublishRelayAcksAdmin).toHaveBeenCalledWith({
      olderThanDays: 14,
      operatorNpub: "npub_admin",
    });
  });
});
