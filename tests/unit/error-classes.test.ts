/**
 * Unit tests for error classes and utilities
 * Tests error classes from: app/lib/errors.ts
 *
 * Migrated from tests/e2e/unit/error-classes.cy.ts
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  isAppError,
  isError,
  normalizeError,
  getUserFriendlyMessage,
  ErrorCodes,
} from "~/lib/errors";

describe("Error Classes Unit Tests", () => {
  describe("AppError", () => {
    it("should create an AppError with default values", () => {
      const error = new AppError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("INTERNAL_ERROR");
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe("AppError");
      expect(error.timestamp).toBeTypeOf("string");
      expect(new Date(error.timestamp).getTime()).toBeTypeOf("number");
    });

    it("should create an AppError with custom values", () => {
      const context = { userId: "123", action: "test" };
      const error = new AppError(
        "Custom error",
        404,
        "CUSTOM_ERROR",
        false,
        context
      );

      expect(error.message).toBe("Custom error");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("CUSTOM_ERROR");
      expect(error.isOperational).toBe(false);
      expect(error.context).toEqual(context);
    });

    it("should serialize to JSON correctly", () => {
      const context = { userId: "123" };
      const error = new AppError(
        "Test error",
        400,
        "TEST_ERROR",
        true,
        context
      );
      const json = error.toJSON();

      expect(json).toHaveProperty("name", "AppError");
      expect(json).toHaveProperty("message", "Test error");
      expect(json).toHaveProperty("code", "TEST_ERROR");
      expect(json).toHaveProperty("statusCode", 400);
      expect(json).toHaveProperty("timestamp");
      expect(json).toHaveProperty("context", context);
    });

    it("should include stack trace when available", () => {
      const error = new AppError("Test error");
      // Stack trace should be available in Node.js/V8 environments
      expect(error.stack).toBeTypeOf("string");
    });
  });

  describe("ValidationError", () => {
    it("should create a ValidationError with correct defaults", () => {
      const error = new ValidationError("Invalid input");

      expect(error.message).toBe("Invalid input");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe("ValidationError");
    });

    it("should accept context", () => {
      const context = { field: "email", value: "invalid" };
      const error = new ValidationError("Invalid email", context);

      expect(error.context).toEqual(context);
    });
  });

  describe("AuthenticationError", () => {
    it("should create an AuthenticationError with default message", () => {
      const error = new AuthenticationError();

      expect(error.message).toBe("Authentication required");
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("AUTHENTICATION_ERROR");
      expect(error.isOperational).toBe(true);
    });

    it("should accept custom message and context", () => {
      const context = { token: "expired" };
      const error = new AuthenticationError("Token expired", context);

      expect(error.message).toBe("Token expired");
      expect(error.context).toEqual(context);
    });
  });

  describe("AuthorizationError", () => {
    it("should create an AuthorizationError with default message", () => {
      const error = new AuthorizationError();

      expect(error.message).toBe("Insufficient permissions");
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("AUTHORIZATION_ERROR");
      expect(error.isOperational).toBe(true);
    });

    it("should accept custom message and context", () => {
      const context = { resource: "post", action: "delete" };
      const error = new AuthorizationError("Cannot delete post", context);

      expect(error.message).toBe("Cannot delete post");
      expect(error.context).toEqual(context);
    });
  });

  describe("NotFoundError", () => {
    it("should create a NotFoundError with default message", () => {
      const error = new NotFoundError();

      expect(error.message).toBe("Resource not found");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND_ERROR");
      expect(error.isOperational).toBe(true);
    });

    it("should accept custom message and context", () => {
      const context = { resourceId: "123", resourceType: "user" };
      const error = new NotFoundError("User not found", context);

      expect(error.message).toBe("User not found");
      expect(error.context).toEqual(context);
    });
  });

  describe("ConflictError", () => {
    it("should create a ConflictError with default message", () => {
      const error = new ConflictError();

      expect(error.message).toBe("Resource conflict");
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe("CONFLICT_ERROR");
      expect(error.isOperational).toBe(true);
    });

    it("should accept custom message and context", () => {
      const context = { field: "email", value: "test@example.com" };
      const error = new ConflictError("Email already exists", context);

      expect(error.message).toBe("Email already exists");
      expect(error.context).toEqual(context);
    });
  });

  describe("RateLimitError", () => {
    it("should create a RateLimitError with default message", () => {
      const error = new RateLimitError();

      expect(error.message).toBe("Rate limit exceeded");
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMIT_ERROR");
      expect(error.isOperational).toBe(true);
    });

    it("should accept custom message and context", () => {
      const context = { limit: 100, window: "1 hour" };
      const error = new RateLimitError("Too many requests", context);

      expect(error.message).toBe("Too many requests");
      expect(error.context).toEqual(context);
    });
  });

  describe("ExternalServiceError", () => {
    it("should create an ExternalServiceError with default status code", () => {
      const error = new ExternalServiceError("Service unavailable");

      expect(error.message).toBe("Service unavailable");
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe("EXTERNAL_SERVICE_ERROR");
      expect(error.isOperational).toBe(true);
    });

    it("should accept custom status code and context", () => {
      const context = { service: "payment-gateway", endpoint: "/charge" };
      const error = new ExternalServiceError(
        "Payment service error",
        503,
        context
      );

      expect(error.message).toBe("Payment service error");
      expect(error.statusCode).toBe(503);
      expect(error.context).toEqual(context);
    });

    it("should support different status codes", () => {
      const error502 = new ExternalServiceError("Bad gateway", 502);
      const error503 = new ExternalServiceError("Service unavailable", 503);
      const error504 = new ExternalServiceError("Gateway timeout", 504);

      expect(error502.statusCode).toBe(502);
      expect(error503.statusCode).toBe(503);
      expect(error504.statusCode).toBe(504);
    });
  });

  describe("DatabaseError", () => {
    it("should create a DatabaseError with default message", () => {
      const error = new DatabaseError();

      expect(error.message).toBe("Database operation failed");
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe("DATABASE_ERROR");
      expect(error.isOperational).toBe(true);
    });

    it("should accept custom message and context", () => {
      const context = { operation: "insert", table: "users" };
      const error = new DatabaseError("Failed to insert user", context);

      expect(error.message).toBe("Failed to insert user");
      expect(error.context).toEqual(context);
    });
  });

  describe("isAppError", () => {
    it("should return true for AppError instances", () => {
      const error = new AppError("Test");
      expect(isAppError(error)).toBe(true);
    });

    it("should return true for ValidationError instances", () => {
      const error = new ValidationError("Test");
      expect(isAppError(error)).toBe(true);
    });

    it("should return true for objects with statusCode and code", () => {
      const errorLike = {
        statusCode: 400,
        code: "TEST_ERROR",
        message: "Test",
      };
      expect(isAppError(errorLike)).toBe(true);
    });

    it("should return false for regular Error instances", () => {
      const error = new Error("Test");
      expect(isAppError(error)).toBe(false);
    });

    it("should return false for plain objects without required properties", () => {
      expect(isAppError({ message: "Test" })).toBe(false);
      expect(isAppError({ statusCode: 400 })).toBe(false);
      expect(isAppError({ code: "TEST" })).toBe(false);
    });

    it("should return false for null and undefined", () => {
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isAppError("string")).toBe(false);
      expect(isAppError(123)).toBe(false);
      expect(isAppError(true)).toBe(false);
    });
  });

  describe("isError", () => {
    it("should return true for Error instances", () => {
      const error = new Error("Test");
      expect(isError(error)).toBe(true);
    });

    it("should return true for AppError instances", () => {
      const error = new AppError("Test");
      expect(isError(error)).toBe(true);
    });

    it("should return false for non-Error objects", () => {
      expect(isError({ message: "Test" })).toBe(false);
      expect(isError("string")).toBe(false);
      expect(isError(123)).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
    });
  });

  describe("normalizeError", () => {
    it("should return AppError as-is", () => {
      const error = new AppError("Test error");
      const normalized = normalizeError(error);

      expect(normalized).toBe(error);
      expect(normalized.message).toBe("Test error");
    });

    it("should return ValidationError as-is", () => {
      const error = new ValidationError("Invalid input");
      const normalized = normalizeError(error);

      expect(normalized).toBe(error);
    });

    it("should convert Prisma Unique constraint error to ConflictError", () => {
      const prismaError = new Error(
        "Unique constraint failed on the fields: (`email`)"
      );
      const normalized = normalizeError(prismaError);

      expect(normalized).toBeInstanceOf(ConflictError);
      expect(normalized.message).toContain("already exists");
      expect(normalized.statusCode).toBe(409);
      expect(normalized.context).toHaveProperty("originalError");
    });

    it("should convert Prisma 'not found' error to NotFoundError", () => {
      const prismaError = new Error("Record to update not found");
      const normalized = normalizeError(prismaError);

      expect(normalized).toBeInstanceOf(NotFoundError);
      expect(normalized.message).toContain("doesn't exist");
      expect(normalized.statusCode).toBe(404);
      expect(normalized.context).toHaveProperty("originalError");
    });

    it("should convert generic Error to AppError", () => {
      const error = new Error("Something went wrong");
      const normalized = normalizeError(error);

      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.message).toBe("Something went wrong");
      expect(normalized.statusCode).toBe(500);
      expect(normalized.code).toBe("INTERNAL_ERROR");
      expect(normalized.isOperational).toBe(false);
    });

    it("should convert Error with empty message to AppError with default", () => {
      const error = new Error("");
      const normalized = normalizeError(error);

      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.message).toBe("An unexpected error occurred");
    });

    it("should convert unknown error types to AppError", () => {
      const unknownError = "String error";
      const normalized = normalizeError(unknownError);

      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.message).toBe("An unexpected error occurred");
      expect(normalized.code).toBe("UNKNOWN_ERROR");
      expect(normalized.isOperational).toBe(false);
      expect(normalized.context).toHaveProperty(
        "originalError",
        "String error"
      );
    });

    it("should convert null to AppError", () => {
      const normalized = normalizeError(null);

      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.message).toBe("An unexpected error occurred");
      expect(normalized.code).toBe("UNKNOWN_ERROR");
    });

    it("should convert number to AppError", () => {
      const normalized = normalizeError(123);

      expect(normalized).toBeInstanceOf(AppError);
      expect(normalized.context).toHaveProperty("originalError", "123");
    });
  });

  describe("getUserFriendlyMessage", () => {
    beforeEach(() => {
      // Reset NODE_ENV to test
      process.env["NODE_ENV"] = "test";
    });

    it("should return error message for operational errors", () => {
      const error = new ValidationError("Invalid input");
      const message = getUserFriendlyMessage(error);

      expect(message).toBe("Invalid input");
    });

    it("should return error message for non-operational errors in development", () => {
      process.env["NODE_ENV"] = "development";
      const error = new AppError(
        "Internal database error",
        500,
        "INTERNAL_ERROR",
        false
      );

      const message = getUserFriendlyMessage(error);
      expect(message).toBe("Internal database error");
    });

    it("should return generic message for non-operational errors in production", () => {
      process.env["NODE_ENV"] = "production";
      const error = new AppError(
        "Internal database error",
        500,
        "INTERNAL_ERROR",
        false
      );

      const message = getUserFriendlyMessage(error);
      expect(message).toBe(
        "An unexpected error occurred. Please try again later."
      );
    });
  });

  describe("ErrorCodes", () => {
    it("should contain all expected error codes", () => {
      expect(ErrorCodes.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
      expect(ErrorCodes.AUTHENTICATION_ERROR).toBe("AUTHENTICATION_ERROR");
      expect(ErrorCodes.AUTHORIZATION_ERROR).toBe("AUTHORIZATION_ERROR");
      expect(ErrorCodes.NOT_FOUND_ERROR).toBe("NOT_FOUND_ERROR");
      expect(ErrorCodes.CONFLICT_ERROR).toBe("CONFLICT_ERROR");
      expect(ErrorCodes.RATE_LIMIT_ERROR).toBe("RATE_LIMIT_ERROR");
      expect(ErrorCodes.EXTERNAL_SERVICE_ERROR).toBe("EXTERNAL_SERVICE_ERROR");
      expect(ErrorCodes.DATABASE_ERROR).toBe("DATABASE_ERROR");
      expect(ErrorCodes.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
      expect(ErrorCodes.UNKNOWN_ERROR).toBe("UNKNOWN_ERROR");
    });

    it("should have all error codes as constants", () => {
      const codes = Object.values(ErrorCodes);
      expect(codes.length).toBe(10);
      codes.forEach((code) => {
        expect(code).toBeTypeOf("string");
        expect(code.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Error inheritance and polymorphism", () => {
    it("should allow all error types to be treated as AppError", () => {
      const errors: AppError[] = [
        new ValidationError("Test"),
        new AuthenticationError("Test"),
        new AuthorizationError("Test"),
        new NotFoundError("Test"),
        new ConflictError("Test"),
        new RateLimitError("Test"),
        new ExternalServiceError("Test"),
        new DatabaseError("Test"),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(Error);
        expect(isAppError(error)).toBe(true);
        expect(isError(error)).toBe(true);
      });
    });

    it("should maintain correct error types after serialization", () => {
      const error = new ValidationError("Test", { field: "email" });
      const json = error.toJSON();

      expect(json.name).toBe("ValidationError");
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.statusCode).toBe(400);
      expect(json.context).toEqual({ field: "email" });
    });
  });
});
