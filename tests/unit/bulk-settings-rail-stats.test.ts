import { describe, expect, it } from "vitest";

import {
  inferUniformScheduleIntervalHours,
  reviewBatchQueueDefaultLabel,
} from "~/features/posts/components/bulk-composer/bulk-settings-rail-stats";
import type { BulkPost } from "~/features/posts/types";

function post(partial: Partial<BulkPost> & { clientId: string }): BulkPost {
  const {
    clientId,
    files = [],
    caption = "",
    queueType = "unassigned",
    scheduledFor = "",
    isRecyclable = true,
    ...rest
  } = partial;
  return {
    clientId,
    files,
    caption,
    queueType,
    scheduledFor,
    isRecyclable,
    ...rest,
  };
}

describe("bulk-settings-rail-stats", () => {
  it("reviewBatchQueueDefaultLabel", () => {
    expect(reviewBatchQueueDefaultLabel([])).toBe("—");
    expect(
      reviewBatchQueueDefaultLabel([
        post({ clientId: "a", queueType: "Main" }),
        post({ clientId: "b", queueType: "Main" }),
      ])
    ).toBe("Main");
    expect(
      reviewBatchQueueDefaultLabel([
        post({ clientId: "a", queueType: "Main" }),
        post({ clientId: "b", queueType: "Other" }),
      ])
    ).toBe("Mixed");
    expect(
      reviewBatchQueueDefaultLabel([
        post({ clientId: "a", queueType: "unassigned" }),
        post({ clientId: "b", queueType: "unassigned" }),
      ])
    ).toBe("Unassigned");
  });

  it("inferUniformScheduleIntervalHours", () => {
    const tz = "UTC";
    expect(
      inferUniformScheduleIntervalHours(
        [
          post({
            clientId: "a",
            scheduledFor: "2026-06-01T10:00",
          }),
          post({
            clientId: "b",
            scheduledFor: "2026-06-01T11:00",
          }),
          post({
            clientId: "c",
            scheduledFor: "2026-06-01T12:00",
          }),
        ],
        tz
      )
    ).toBe(1);
    expect(
      inferUniformScheduleIntervalHours(
        [
          post({ clientId: "a", scheduledFor: "2026-06-01T10:00" }),
          post({ clientId: "b", scheduledFor: "2026-06-01T11:00" }),
          post({ clientId: "c", scheduledFor: "2026-06-01T13:00" }),
        ],
        tz
      )
    ).toBe(null);
  });
});
