import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSendNotification,
  mockFindMany,
  mockDeleteMany,
  mockLogError,
  mockLogInfo,
} = vi.hoisted(() => ({
  mockSendNotification: vi.fn(),
  mockFindMany: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockLogError: vi.fn(),
  mockLogInfo: vi.fn(),
}));

vi.mock("web-push", () => ({
  sendNotification: mockSendNotification,
  setVapidDetails: vi.fn(),
}));

vi.mock("~/infra/notifications/web-push-config.server", () => ({
  initWebPush: vi.fn(),
}));

vi.mock("~/lib/env.server", () => ({
  env: { NODE_ENV: "test", APP_URL: "https://app.example.com" },
}));

vi.mock("~/lib/error-logger.server", () => ({
  logError: mockLogError,
  logInfo: mockLogInfo,
}));

vi.mock("~/features/user/services/user-settings.server", () => ({
  getRunwaySettings: vi.fn(),
}));

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    pushSubscription: {
      findMany: mockFindMany,
      deleteMany: mockDeleteMany,
    },
  },
}));

import {
  classifyWebPushError,
  sendPushNotification,
  sendPushNotificationToUser,
  type NotificationPayload,
} from "~/infra/notifications/push-notification.server";

/**
 * Mirrors the real `WebPushError` from the `web-push` package: the message is
 * always the generic "Received unexpected response code" and the HTTP status
 * lives on `statusCode`.
 */
function webPushError(statusCode: number, body = ""): Error {
  const err = new Error("Received unexpected response code") as Error & {
    statusCode: number;
    body: string;
    endpoint: string;
  };
  err.name = "WebPushError";
  err.statusCode = statusCode;
  err.body = body;
  err.endpoint = "https://push.example/sub";
  return err;
}

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  p256dh: "p256dh-key",
  auth: "auth-key",
};

const payload: NotificationPayload = {
  title: "Hello",
  body: "World",
  data: { action: "publish_failure" },
};

describe("classifyWebPushError", () => {
  it("treats 410 Gone as expired using statusCode, not the message", () => {
    const result = classifyWebPushError(webPushError(410));
    expect(result).toEqual({ statusCode: 410, body: null, expired: true });
  });

  it("treats 404 Not Found as expired", () => {
    expect(classifyWebPushError(webPushError(404)).expired).toBe(true);
  });

  it("does not treat 5xx / 429 as expired", () => {
    expect(classifyWebPushError(webPushError(500)).expired).toBe(false);
    expect(classifyWebPushError(webPushError(429)).expired).toBe(false);
  });

  it("captures and truncates the response body", () => {
    const result = classifyWebPushError(webPushError(500, "x".repeat(1000)));
    expect(result.statusCode).toBe(500);
    expect(result.body).toHaveLength(500);
  });

  it("falls back to message heuristics for non-WebPushError shapes", () => {
    expect(
      classifyWebPushError(new Error("subscription expired")).expired
    ).toBe(true);
    expect(classifyWebPushError(new Error("ECONNRESET")).expired).toBe(false);
    expect(classifyWebPushError("boom")).toEqual({
      statusCode: null,
      body: null,
      expired: false,
    });
  });
});

describe("sendPushNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns sent on success", async () => {
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
    await expect(sendPushNotification(subscription, payload)).resolves.toEqual({
      sent: true,
    });
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("flags 410 as expired and logs at info level, not error", async () => {
    mockSendNotification.mockRejectedValue(webPushError(410));
    await expect(sendPushNotification(subscription, payload)).resolves.toEqual({
      sent: false,
      expired: true,
    });
    expect(mockLogError).not.toHaveBeenCalled();
    expect(mockLogInfo).toHaveBeenCalledWith(
      "Push subscription expired, pruning",
      expect.objectContaining({
        statusCode: 410,
        endpointHost: "fcm.googleapis.com",
      })
    );
  });

  it("flags 404 as expired", async () => {
    mockSendNotification.mockRejectedValue(webPushError(404));
    await expect(sendPushNotification(subscription, payload)).resolves.toEqual({
      sent: false,
      expired: true,
    });
  });

  it("treats 500 as transient and logs the real push-service status", async () => {
    mockSendNotification.mockRejectedValue(
      webPushError(500, "internal push error")
    );
    await expect(sendPushNotification(subscription, payload)).resolves.toEqual({
      sent: false,
      expired: false,
    });
    expect(mockLogError).toHaveBeenCalledTimes(1);
    const [loggedError, context] = mockLogError.mock.calls[0] as [
      Error,
      Record<string, unknown>,
    ];
    expect(loggedError.message).toContain("push service status 500");
    expect(loggedError.message).toContain("internal push error");
    expect(context).toMatchObject({
      statusCode: 500,
      action: "publish_failure",
    });
    // Full endpoint (which embeds a per-device secret token) must not be logged
    expect(JSON.stringify(context)).not.toContain("/fcm/send/abc");
  });
});

describe("sendPushNotificationToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("prunes 410 and 404 subscriptions but keeps transient failures", async () => {
    mockFindMany.mockResolvedValue([
      { id: "sub-ok", endpoint: "https://p/1", p256dh: "k", auth: "a" },
      { id: "sub-gone", endpoint: "https://p/2", p256dh: "k", auth: "a" },
      { id: "sub-404", endpoint: "https://p/3", p256dh: "k", auth: "a" },
      { id: "sub-5xx", endpoint: "https://p/4", p256dh: "k", auth: "a" },
    ]);
    mockSendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(webPushError(410))
      .mockRejectedValueOnce(webPushError(404))
      .mockRejectedValueOnce(webPushError(503));

    const result = await sendPushNotificationToUser("user-1", payload);

    expect(result).toEqual({ sent: 1, failed: 3 });
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sub-gone", "sub-404"] } },
    });
  });

  it("does not touch the database when nothing expired", async () => {
    mockFindMany.mockResolvedValue([
      { id: "sub-1", endpoint: "https://p/1", p256dh: "k", auth: "a" },
    ]);
    mockSendNotification.mockRejectedValue(webPushError(500));

    await sendPushNotificationToUser("user-1", payload);

    expect(mockDeleteMany).not.toHaveBeenCalled();
  });
});
