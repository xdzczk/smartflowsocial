/**
 * Unit tests for lib/errors (AppError, subclasses, normalizeError, getActionErrorMessage, getUserFriendlyMessage).
 */

import { describe, expect, it } from "vitest";

import {
  AppError,
  ValidationError,
  AuthenticationError,
  ProfileMismatchError,
  RemoteSignerTimeoutError,
  Nip07AccountMismatchError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  MediaNotReadyError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  isAppError,
  isError,
  normalizeError,
  getUserFriendlyMessage,
  getActionErrorMessage,
  ErrorCodes,
} from "~/lib/errors";

describe("errors", () => {
  describe("AppError and subclasses", () => {
    it("AppError has message, statusCode, code, isOperational, context", () => {
      const e = new AppError("msg", 500, "CODE", true, { foo: "bar" });
      expect(e.message).toBe("msg");
      expect(e.statusCode).toBe(500);
      expect(e.code).toBe("CODE");
      expect(e.isOperational).toBe(true);
      expect(e.context).toEqual({ foo: "bar" });
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(AppError);
    });

    it("ValidationError has 400 and VALIDATION_ERROR", () => {
      const e = new ValidationError("invalid");
      expect(e.statusCode).toBe(400);
      expect(e.code).toBe("VALIDATION_ERROR");
    });

    it("AuthenticationError has 401", () => {
      const e = new AuthenticationError();
      expect(e.statusCode).toBe(401);
      expect(e.code).toBe("AUTHENTICATION_ERROR");
    });

    it("ProfileMismatchError has 401 and PROFILE_MISMATCH", () => {
      const e = new ProfileMismatchError();
      expect(e.code).toBe("PROFILE_MISMATCH");
    });

    it("RemoteSignerTimeoutError has 408", () => {
      const e = new RemoteSignerTimeoutError();
      expect(e.statusCode).toBe(408);
    });

    it("Nip07AccountMismatchError has 401", () => {
      const e = new Nip07AccountMismatchError();
      expect(e.statusCode).toBe(401);
    });

    it("AuthorizationError has 403", () => {
      const e = new AuthorizationError();
      expect(e.statusCode).toBe(403);
    });

    it("NotFoundError has 404", () => {
      const e = new NotFoundError();
      expect(e.statusCode).toBe(404);
    });

    it("ConflictError has 409", () => {
      const e = new ConflictError();
      expect(e.statusCode).toBe(409);
    });

    it("MediaNotReadyError has 409 and MEDIA_NOT_READY", () => {
      const e = new MediaNotReadyError();
      expect(e.code).toBe("MEDIA_NOT_READY");
    });

    it("RateLimitError has 429", () => {
      const e = new RateLimitError();
      expect(e.statusCode).toBe(429);
    });

    it("ExternalServiceError accepts custom statusCode", () => {
      const e = new ExternalServiceError("down", 503);
      expect(e.statusCode).toBe(503);
    });

    it("DatabaseError has 500", () => {
      const e = new DatabaseError();
      expect(e.statusCode).toBe(500);
    });

    it("toJSON returns serializable shape", () => {
      const e = new AppError("msg", 500, "CODE", true, { k: "v" });
      const json = e.toJSON();
      expect(json.message).toBe("msg");
      expect(json.code).toBe("CODE");
      expect(json.context).toEqual({ k: "v" });
    });
  });

  describe("isAppError / isError", () => {
    it("isAppError returns true for AppError instance", () => {
      expect(isAppError(new AppError("x"))).toBe(true);
      expect(isAppError(new ValidationError("x"))).toBe(true);
    });
    it("isAppError returns true for object with statusCode and code", () => {
      expect(isAppError({ statusCode: 500, code: "X" })).toBe(true);
    });
    it("isAppError returns false for plain Error", () => {
      expect(isAppError(new Error("x"))).toBe(false);
    });
    it("isError returns true for Error instance", () => {
      expect(isError(new Error("x"))).toBe(true);
    });
    it("isError returns false for non-Error", () => {
      expect(isError("string")).toBe(false);
    });
  });

  describe("normalizeError", () => {
    it("returns same error when already AppError", () => {
      const e = new ValidationError("v");
      expect(normalizeError(e)).toBe(e);
    });
    it("converts Unique constraint message to ConflictError", () => {
      const e = normalizeError(new Error("Unique constraint failed"));
      expect(e).toBeInstanceOf(ConflictError);
      expect(e.message).toContain("already exists");
    });
    it("converts Record to update not found to NotFoundError", () => {
      const e = normalizeError(new Error("Record to update not found"));
      expect(e).toBeInstanceOf(NotFoundError);
    });
    it("converts authentication-like message to AuthenticationError", () => {
      const e = normalizeError(new Error("Authentication required"));
      expect(e).toBeInstanceOf(AuthenticationError);
    });
    it("converts subscription error message to AuthorizationError", () => {
      const e = normalizeError(new Error("subscription required"));
      expect(e).toBeInstanceOf(AuthorizationError);
    });
    it("converts feature access denied to AuthorizationError", () => {
      const e = normalizeError(new Error("feature access denied"));
      expect(e).toBeInstanceOf(AuthorizationError);
    });
    it("converts database error message to DatabaseError", () => {
      const e = normalizeError(new Error("database connection failed"));
      expect(e).toBeInstanceOf(DatabaseError);
    });
    it("converts generic Error with message to AppError INTERNAL_ERROR", () => {
      const e = normalizeError(new Error("something broke"));
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe("INTERNAL_ERROR");
      expect(e.message).toBe("something broke");
    });
    it("converts empty message to default message", () => {
      const e = normalizeError(new Error(""));
      expect(e.message).toBe("An unexpected error occurred");
    });
    it("converts non-Error to UNKNOWN_ERROR", () => {
      const e = normalizeError("not an error");
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe("UNKNOWN_ERROR");
    });
  });

  describe("getUserFriendlyMessage", () => {
    it("returns error.message in test env", () => {
      const e = new AppError("internal detail");
      expect(getUserFriendlyMessage(e)).toBe("internal detail");
    });
  });

  describe("getActionErrorMessage", () => {
    it("returns undefined for null or non-object", () => {
      expect(getActionErrorMessage(null)).toBeUndefined();
      expect(getActionErrorMessage("string")).toBeUndefined();
    });
    it("returns undefined when no error key", () => {
      expect(getActionErrorMessage({ success: false })).toBeUndefined();
    });
    it("returns string when error is string", () => {
      expect(getActionErrorMessage({ error: "failed" })).toBe("failed");
    });
    it("returns message when error is object with message", () => {
      expect(
        getActionErrorMessage({ error: { message: "Validation failed" } })
      ).toBe("Validation failed");
    });
    it("returns MEDIA_NOT_READY_MESSAGE when code is MEDIA_NOT_READY", () => {
      const out = getActionErrorMessage({
        error: { message: "x", code: "MEDIA_NOT_READY" },
      });
      expect(out).toBe("Media is still processing. Please retry in a moment.");
    });
    it("returns message when message contains media_not_ready", () => {
      const out = getActionErrorMessage({
        error: { message: "error: media_not_ready" },
      });
      expect(out).toBe("Media is still processing. Please retry in a moment.");
    });
    it("returns undefined when error object has no string message", () => {
      expect(
        getActionErrorMessage({ error: { message: 123 } })
      ).toBeUndefined();
    });
  });

  describe("ErrorCodes", () => {
    it("exports expected codes", () => {
      expect(ErrorCodes.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
      expect(ErrorCodes.MEDIA_NOT_READY).toBe("MEDIA_NOT_READY");
    });
  });
});
