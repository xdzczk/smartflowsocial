/**
 * Integration tests for payment status API route
 *
 * Tests the API endpoint in app/routes/api.payment-status.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const TEST_USER_ID = "test-user-123";

vi.mock("~/models/payment.server", () => ({
  checkPaymentStatus: vi.fn(),
}));

vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(() => Promise.resolve(TEST_USER_ID)),
}));

vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    payment: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "~/lib/prisma.server";
import { checkPaymentStatus } from "~/models/payment.server";
import { action, loader } from "~/routes/api.payment-status";

describe("API: Payment Status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: TEST_USER_ID,
    });
  });

  describe("Action Handler", () => {
    describe("Successful Requests", () => {
      it("should return paid status for completed payment", async () => {
        const paidAt = new Date("2024-01-15T10:00:00Z");
        (checkPaymentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
          paid: true,
          paidAt,
          status: "COMPLETED",
        });

        const formData = new FormData();
        formData.append("paymentId", "payment-123");

        const request = new Request(
          "http://localhost:3000/api/payment-status",
          {
            method: "POST",
            body: formData,
          }
        );

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                paid?: unknown;
                paidAt?: unknown;
                message?: unknown;
                status?: unknown;
                error?: unknown;
              })
            : {};

        expect(checkPaymentStatus).toHaveBeenCalledWith("payment-123");
        // paidAt is serialized to ISO string in JSON response
        expect(data).toEqual({
          success: true,
          paid: true,
          paidAt: paidAt.toISOString(),
          message: "Payment completed successfully!",
        });
        expect(response.status).toBe(200);
      });

      it("should return unpaid status for pending payment", async () => {
        (checkPaymentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
          paid: false,
          paidAt: null,
          status: "PENDING",
        });

        const formData = new FormData();
        formData.append("paymentId", "payment-123");

        const request = new Request(
          "http://localhost:3000/api/payment-status",
          {
            method: "POST",
            body: formData,
          }
        );

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                paid?: unknown;
                paidAt?: unknown;
                message?: unknown;
                status?: unknown;
                error?: unknown;
              })
            : {};

        expect(data).toEqual({
          success: true,
          paid: false,
          status: "PENDING",
        });
        expect(response.status).toBe(200);
      });

      it("should return unpaid status for failed payment", async () => {
        (checkPaymentStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
          paid: false,
          paidAt: null,
          status: "FAILED",
        });

        const formData = new FormData();
        formData.append("paymentId", "payment-123");

        const request = new Request(
          "http://localhost:3000/api/payment-status",
          {
            method: "POST",
            body: formData,
          }
        );

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                paid?: unknown;
                paidAt?: unknown;
                message?: unknown;
                status?: unknown;
                error?: unknown;
              })
            : {};

        expect(data).toEqual({
          success: true,
          paid: false,
          status: "FAILED",
        });
      });
    });

    describe("Error Handling", () => {
      it("should reject non-POST methods", async () => {
        const request = new Request(
          "http://localhost:3000/api/payment-status",
          {
            method: "GET",
          }
        );

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                paid?: unknown;
                paidAt?: unknown;
                message?: unknown;
                status?: unknown;
                error?: unknown;
              })
            : {};

        expect(response.status).toBe(400);
        const success =
          typeof data.success === "boolean"
            ? data.success
            : data.success === 0 || data.success === false;
        expect(success).toBe(false);
        expect(data.error).toBeDefined();
      });

      it("should return validation error when paymentId is missing", async () => {
        const formData = new FormData();

        const request = new Request(
          "http://localhost:3000/api/payment-status",
          {
            method: "POST",
            body: formData,
          }
        );

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                paid?: unknown;
                paidAt?: unknown;
                message?: unknown;
                status?: unknown;
                error?: unknown;
              })
            : {};

        expect(response.status).toBe(400);
        const success =
          typeof data.success === "boolean"
            ? data.success
            : data.success === 0 || data.success === false;
        expect(success).toBe(false);
        expect(data.error).toBeDefined();
      });

      it("should return validation error when paymentId is empty string", async () => {
        const formData = new FormData();
        formData.append("paymentId", "");

        const request = new Request(
          "http://localhost:3000/api/payment-status",
          {
            method: "POST",
            body: formData,
          }
        );

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                paid?: unknown;
                paidAt?: unknown;
                message?: unknown;
                status?: unknown;
                error?: unknown;
              })
            : {};

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });

      it("should handle database errors", async () => {
        (checkPaymentStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error("Database error")
        );

        const formData = new FormData();
        formData.append("paymentId", "payment-123");

        const request = new Request(
          "http://localhost:3000/api/payment-status",
          {
            method: "POST",
            body: formData,
          }
        );

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as {
                success?: unknown;
                paid?: unknown;
                paidAt?: unknown;
                message?: unknown;
                status?: unknown;
                error?: unknown;
              })
            : {};

        expect(response.status).toBeGreaterThanOrEqual(400);
        const success =
          typeof data.success === "boolean"
            ? data.success
            : data.success === 0 || data.success === false;
        expect(success).toBe(false);
        expect(data.error).toBeDefined();
      });

      it("should return 404 when payment does not exist", async () => {
        (
          prisma.payment.findUnique as ReturnType<typeof vi.fn>
        ).mockResolvedValue(null);

        const formData = new FormData();
        formData.append("paymentId", "unknown-payment-id");

        const request = new Request(
          "http://localhost:3000/api/payment-status",
          {
            method: "POST",
            body: formData,
          }
        );

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as { success?: unknown; error?: unknown })
            : {};

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Payment not found");
      });

      it("should return 403 when payment belongs to another user", async () => {
        (
          prisma.payment.findUnique as ReturnType<typeof vi.fn>
        ).mockResolvedValue({ userId: "other-user-id" });

        const formData = new FormData();
        formData.append("paymentId", "payment-123");

        const request = new Request(
          "http://localhost:3000/api/payment-status",
          {
            method: "POST",
            body: formData,
          }
        );

        const actionParams: {
          request: Request;
          params: Record<string, string>;
          context: Record<string, unknown>;
        } = { request, params: {}, context: {} };
        const response = await action(actionParams);
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as { success?: unknown; error?: unknown })
            : {};

        expect(response.status).toBe(403);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Forbidden");
      });
    });
  });

  describe("Loader Handler", () => {
    it("should return method not allowed for GET requests", async () => {
      const loaderFn = loader as () => Promise<Response>;
      const response = await loaderFn();
      const dataRaw: unknown = await response.json();
      const data =
        dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
          ? (dataRaw as {
              success?: unknown;
              paid?: unknown;
              paidAt?: unknown;
              message?: unknown;
              status?: unknown;
              error?: unknown;
            })
          : {};

      const status = typeof response.status === "number" ? response.status : 0;
      expect(status).toBe(405);
      expect(data).toEqual({
        success: false,
        error: "GET method not allowed. Use POST.",
      });
    });
  });
});
