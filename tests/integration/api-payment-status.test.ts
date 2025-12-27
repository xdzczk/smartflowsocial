/**
 * Integration tests for payment status API route
 * 
 * Tests the API endpoint in app/routes/api.payment-status.ts
 */

import { json } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock dependencies
vi.mock("~/models/payment.server", () => ({
  checkPaymentStatus: vi.fn(),
}));

import { checkPaymentStatus } from "~/models/payment.server";
import { action, loader } from "~/routes/api.payment-status";

describe("API: Payment Status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

        const request = new Request("http://localhost:3000/api/payment-status", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} } as { request: Request; params: Record<string, string>; context: Record<string, unknown> });
        const dataRaw: unknown = await response.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; paid?: unknown; paidAt?: unknown; message?: unknown; status?: unknown; error?: unknown } : {};

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

        const request = new Request("http://localhost:3000/api/payment-status", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} } as { request: Request; params: Record<string, string>; context: Record<string, unknown> });
        const dataRaw: unknown = await response.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; paid?: unknown; paidAt?: unknown; message?: unknown; status?: unknown; error?: unknown } : {};

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

        const request = new Request("http://localhost:3000/api/payment-status", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} } as { request: Request; params: Record<string, string>; context: Record<string, unknown> });
        const dataRaw: unknown = await response.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; paid?: unknown; paidAt?: unknown; message?: unknown; status?: unknown; error?: unknown } : {};

        expect(data).toEqual({
          success: true,
          paid: false,
          status: "FAILED",
        });
      });
    });

    describe("Error Handling", () => {
      it("should reject non-POST methods", async () => {
        const request = new Request("http://localhost:3000/api/payment-status", {
          method: "GET",
        });

        const response = await action({ request, params: {}, context: {} } as { request: Request; params: Record<string, string>; context: Record<string, unknown> });
        const dataRaw: unknown = await response.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; paid?: unknown; paidAt?: unknown; message?: unknown; status?: unknown; error?: unknown } : {};

        expect(response.status).toBe(400);
        const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
        expect(success).toBe(false);
        expect(data.error).toBeDefined();
      });

      it("should return validation error when paymentId is missing", async () => {
        const formData = new FormData();

        const request = new Request("http://localhost:3000/api/payment-status", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} } as { request: Request; params: Record<string, string>; context: Record<string, unknown> });
        const dataRaw: unknown = await response.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; paid?: unknown; paidAt?: unknown; message?: unknown; status?: unknown; error?: unknown } : {};

        expect(response.status).toBe(400);
        const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
        expect(success).toBe(false);
        expect(data.error).toBeDefined();
      });

      it("should return validation error when paymentId is empty string", async () => {
        const formData = new FormData();
        formData.append("paymentId", "");

        const request = new Request("http://localhost:3000/api/payment-status", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} } as { request: Request; params: Record<string, string>; context: Record<string, unknown> });
        const dataRaw: unknown = await response.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; paid?: unknown; paidAt?: unknown; message?: unknown; status?: unknown; error?: unknown } : {};

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
      });

      it("should handle database errors", async () => {
        (checkPaymentStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error("Database error"),
        );

        const formData = new FormData();
        formData.append("paymentId", "payment-123");

        const request = new Request("http://localhost:3000/api/payment-status", {
          method: "POST",
          body: formData,
        });

        const response = await action({ request, params: {}, context: {} } as { request: Request; params: Record<string, string>; context: Record<string, unknown> });
        const dataRaw: unknown = await response.json();
        const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; paid?: unknown; paidAt?: unknown; message?: unknown; status?: unknown; error?: unknown } : {};

        expect(response.status).toBeGreaterThanOrEqual(400);
        const success = typeof data.success === "boolean" ? data.success : data.success === 0 || data.success === false;
        expect(success).toBe(false);
        expect(data.error).toBeDefined();
      });
    });
  });

  describe("Loader Handler", () => {
    it("should return method not allowed for GET requests", async () => {
      const request = new Request("http://localhost:3000/api/payment-status", {
        method: "GET",
      });

      const loaderFn = loader as () => Promise<Response>;
      const response = await loaderFn();
      const dataRaw: unknown = await response.json();
      const data = dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw) ? dataRaw as { success?: unknown; paid?: unknown; paidAt?: unknown; message?: unknown; status?: unknown; error?: unknown } : {};

      const status = typeof response.status === "number" ? response.status : 0;
      expect(status).toBe(405);
      expect(data).toEqual({
        success: false,
        error: "GET method not allowed. Use POST.",
      });
    });
  });
});

