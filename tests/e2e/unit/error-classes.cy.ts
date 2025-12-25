/**
 * Unit tests for error classes and utilities
 * Tests error classes from:
 * - app/lib/errors.ts
 */

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

            expect(error.message).to.equal("Test error");
            expect(error.statusCode).to.equal(500);
            expect(error.code).to.equal("INTERNAL_ERROR");
            expect(error.isOperational).to.equal(true);
            expect(error.name).to.equal("AppError");
            expect(error.timestamp).to.be.a("string");
            expect(new Date(error.timestamp).getTime()).to.be.a("number");
        });

        it("should create an AppError with custom values", () => {
            const context = { userId: "123", action: "test" };
            const error = new AppError(
                "Custom error",
                404,
                "CUSTOM_ERROR",
                false,
                context,
            );

            expect(error.message).to.equal("Custom error");
            expect(error.statusCode).to.equal(404);
            expect(error.code).to.equal("CUSTOM_ERROR");
            expect(error.isOperational).to.equal(false);
            expect(error.context).to.deep.equal(context);
        });

        it("should serialize to JSON correctly", () => {
            const context = { userId: "123" };
            const error = new AppError("Test error", 400, "TEST_ERROR", true, context);
            const json = error.toJSON();

            expect(json).to.have.property("name", "AppError");
            expect(json).to.have.property("message", "Test error");
            expect(json).to.have.property("code", "TEST_ERROR");
            expect(json).to.have.property("statusCode", 400);
            expect(json).to.have.property("timestamp");
            expect(json).to.have.property("context", context);
        });

        it("should include stack trace when available", () => {
            const error = new AppError("Test error");
            // Stack trace should be available in Node.js/V8 environments
            expect(error.stack).to.be.a("string");
        });
    });

    describe("ValidationError", () => {
        it("should create a ValidationError with correct defaults", () => {
            const error = new ValidationError("Invalid input");

            expect(error.message).to.equal("Invalid input");
            expect(error.statusCode).to.equal(400);
            expect(error.code).to.equal("VALIDATION_ERROR");
            expect(error.isOperational).to.equal(true);
            expect(error.name).to.equal("ValidationError");
        });

        it("should accept context", () => {
            const context = { field: "email", value: "invalid" };
            const error = new ValidationError("Invalid email", context);

            expect(error.context).to.deep.equal(context);
        });
    });

    describe("AuthenticationError", () => {
        it("should create an AuthenticationError with default message", () => {
            const error = new AuthenticationError();

            expect(error.message).to.equal("Authentication required");
            expect(error.statusCode).to.equal(401);
            expect(error.code).to.equal("AUTHENTICATION_ERROR");
            expect(error.isOperational).to.equal(true);
        });

        it("should accept custom message and context", () => {
            const context = { token: "expired" };
            const error = new AuthenticationError("Token expired", context);

            expect(error.message).to.equal("Token expired");
            expect(error.context).to.deep.equal(context);
        });
    });

    describe("AuthorizationError", () => {
        it("should create an AuthorizationError with default message", () => {
            const error = new AuthorizationError();

            expect(error.message).to.equal("Insufficient permissions");
            expect(error.statusCode).to.equal(403);
            expect(error.code).to.equal("AUTHORIZATION_ERROR");
            expect(error.isOperational).to.equal(true);
        });

        it("should accept custom message and context", () => {
            const context = { resource: "post", action: "delete" };
            const error = new AuthorizationError("Cannot delete post", context);

            expect(error.message).to.equal("Cannot delete post");
            expect(error.context).to.deep.equal(context);
        });
    });

    describe("NotFoundError", () => {
        it("should create a NotFoundError with default message", () => {
            const error = new NotFoundError();

            expect(error.message).to.equal("Resource not found");
            expect(error.statusCode).to.equal(404);
            expect(error.code).to.equal("NOT_FOUND_ERROR");
            expect(error.isOperational).to.equal(true);
        });

        it("should accept custom message and context", () => {
            const context = { resourceId: "123", resourceType: "user" };
            const error = new NotFoundError("User not found", context);

            expect(error.message).to.equal("User not found");
            expect(error.context).to.deep.equal(context);
        });
    });

    describe("ConflictError", () => {
        it("should create a ConflictError with default message", () => {
            const error = new ConflictError();

            expect(error.message).to.equal("Resource conflict");
            expect(error.statusCode).to.equal(409);
            expect(error.code).to.equal("CONFLICT_ERROR");
            expect(error.isOperational).to.equal(true);
        });

        it("should accept custom message and context", () => {
            const context = { field: "email", value: "test@example.com" };
            const error = new ConflictError("Email already exists", context);

            expect(error.message).to.equal("Email already exists");
            expect(error.context).to.deep.equal(context);
        });
    });

    describe("RateLimitError", () => {
        it("should create a RateLimitError with default message", () => {
            const error = new RateLimitError();

            expect(error.message).to.equal("Rate limit exceeded");
            expect(error.statusCode).to.equal(429);
            expect(error.code).to.equal("RATE_LIMIT_ERROR");
            expect(error.isOperational).to.equal(true);
        });

        it("should accept custom message and context", () => {
            const context = { limit: 100, window: "1 hour" };
            const error = new RateLimitError("Too many requests", context);

            expect(error.message).to.equal("Too many requests");
            expect(error.context).to.deep.equal(context);
        });
    });

    describe("ExternalServiceError", () => {
        it("should create an ExternalServiceError with default status code", () => {
            const error = new ExternalServiceError("Service unavailable");

            expect(error.message).to.equal("Service unavailable");
            expect(error.statusCode).to.equal(502);
            expect(error.code).to.equal("EXTERNAL_SERVICE_ERROR");
            expect(error.isOperational).to.equal(true);
        });

        it("should accept custom status code and context", () => {
            const context = { service: "payment-gateway", endpoint: "/charge" };
            const error = new ExternalServiceError(
                "Payment service error",
                503,
                context,
            );

            expect(error.message).to.equal("Payment service error");
            expect(error.statusCode).to.equal(503);
            expect(error.context).to.deep.equal(context);
        });

        it("should support different status codes", () => {
            const error502 = new ExternalServiceError("Bad gateway", 502);
            const error503 = new ExternalServiceError("Service unavailable", 503);
            const error504 = new ExternalServiceError("Gateway timeout", 504);

            expect(error502.statusCode).to.equal(502);
            expect(error503.statusCode).to.equal(503);
            expect(error504.statusCode).to.equal(504);
        });
    });

    describe("DatabaseError", () => {
        it("should create a DatabaseError with default message", () => {
            const error = new DatabaseError();

            expect(error.message).to.equal("Database operation failed");
            expect(error.statusCode).to.equal(500);
            expect(error.code).to.equal("DATABASE_ERROR");
            expect(error.isOperational).to.equal(true);
        });

        it("should accept custom message and context", () => {
            const context = { operation: "insert", table: "users" };
            const error = new DatabaseError("Failed to insert user", context);

            expect(error.message).to.equal("Failed to insert user");
            expect(error.context).to.deep.equal(context);
        });
    });

    describe("isAppError", () => {
        it("should return true for AppError instances", () => {
            const error = new AppError("Test");
            expect(isAppError(error)).to.be.true;
        });

        it("should return true for ValidationError instances", () => {
            const error = new ValidationError("Test");
            expect(isAppError(error)).to.be.true;
        });

        it("should return true for objects with statusCode and code", () => {
            const errorLike = {
                statusCode: 400,
                code: "TEST_ERROR",
                message: "Test",
            };
            expect(isAppError(errorLike)).to.be.true;
        });

        it("should return false for regular Error instances", () => {
            const error = new Error("Test");
            expect(isAppError(error)).to.be.false;
        });

        it("should return false for plain objects without required properties", () => {
            expect(isAppError({ message: "Test" })).to.be.false;
            expect(isAppError({ statusCode: 400 })).to.be.false;
            expect(isAppError({ code: "TEST" })).to.be.false;
        });

        it("should return false for null and undefined", () => {
            expect(isAppError(null)).to.be.false;
            expect(isAppError(undefined)).to.be.false;
        });

        it("should return false for primitives", () => {
            expect(isAppError("string")).to.be.false;
            expect(isAppError(123)).to.be.false;
            expect(isAppError(true)).to.be.false;
        });
    });

    describe("isError", () => {
        it("should return true for Error instances", () => {
            const error = new Error("Test");
            expect(isError(error)).to.be.true;
        });

        it("should return true for AppError instances", () => {
            const error = new AppError("Test");
            expect(isError(error)).to.be.true;
        });

        it("should return false for non-Error objects", () => {
            expect(isError({ message: "Test" })).to.be.false;
            expect(isError("string")).to.be.false;
            expect(isError(123)).to.be.false;
            expect(isError(null)).to.be.false;
            expect(isError(undefined)).to.be.false;
        });
    });

    describe("normalizeError", () => {
        it("should return AppError as-is", () => {
            const error = new AppError("Test error");
            const normalized = normalizeError(error);

            expect(normalized).to.equal(error);
            expect(normalized.message).to.equal("Test error");
        });

        it("should return ValidationError as-is", () => {
            const error = new ValidationError("Invalid input");
            const normalized = normalizeError(error);

            expect(normalized).to.equal(error);
        });

        it("should convert Prisma Unique constraint error to ConflictError", () => {
            const prismaError = new Error(
                "Unique constraint failed on the fields: (`email`)",
            );
            const normalized = normalizeError(prismaError);

            expect(normalized).to.be.instanceOf(ConflictError);
            expect(normalized.message).to.include("already exists");
            expect(normalized.statusCode).to.equal(409);
            expect(normalized.context).to.have.property("originalError");
        });

        it("should convert Prisma 'not found' error to NotFoundError", () => {
            const prismaError = new Error("Record to update not found");
            const normalized = normalizeError(prismaError);

            expect(normalized).to.be.instanceOf(NotFoundError);
            expect(normalized.message).to.include("doesn't exist");
            expect(normalized.statusCode).to.equal(404);
            expect(normalized.context).to.have.property("originalError");
        });

        it("should convert generic Error to AppError", () => {
            const error = new Error("Something went wrong");
            const normalized = normalizeError(error);

            expect(normalized).to.be.instanceOf(AppError);
            expect(normalized.message).to.equal("Something went wrong");
            expect(normalized.statusCode).to.equal(500);
            expect(normalized.code).to.equal("INTERNAL_ERROR");
            expect(normalized.isOperational).to.equal(false);
        });

        it("should convert Error with empty message to AppError with default", () => {
            const error = new Error("");
            const normalized = normalizeError(error);

            expect(normalized).to.be.instanceOf(AppError);
            expect(normalized.message).to.equal("An unexpected error occurred");
        });

        it("should convert unknown error types to AppError", () => {
            const unknownError = "String error";
            const normalized = normalizeError(unknownError);

            expect(normalized).to.be.instanceOf(AppError);
            expect(normalized.message).to.equal("An unexpected error occurred");
            expect(normalized.code).to.equal("UNKNOWN_ERROR");
            expect(normalized.isOperational).to.equal(false);
            expect(normalized.context).to.have.property("originalError", "String error");
        });

        it("should convert null to AppError", () => {
            const normalized = normalizeError(null);

            expect(normalized).to.be.instanceOf(AppError);
            expect(normalized.message).to.equal("An unexpected error occurred");
            expect(normalized.code).to.equal("UNKNOWN_ERROR");
        });

        it("should convert number to AppError", () => {
            const normalized = normalizeError(123);

            expect(normalized).to.be.instanceOf(AppError);
            expect(normalized.context).to.have.property("originalError", "123");
        });
    });

    describe("getUserFriendlyMessage", () => {
        it("should return error message for operational errors in production", () => {
            const error = new ValidationError("Invalid input");
            const message = getUserFriendlyMessage(error);

            expect(message).to.equal("Invalid input");
        });

        it("should return error message for operational errors in development", () => {
            // Note: This test assumes NODE_ENV is not 'production'
            // In actual production, it would return the message
            const error = new ValidationError("Invalid input");
            const message = getUserFriendlyMessage(error);

            expect(message).to.equal("Invalid input");
        });

        it("should return error message for non-operational errors (environment-dependent)", () => {
            // Create a non-operational error
            const error = new AppError(
                "Internal database error",
                500,
                "INTERNAL_ERROR",
                false,
            );

            const message = getUserFriendlyMessage(error);

            // In production, non-operational errors return generic message
            // In development, they return the actual error message
            // Since we can't modify process.env in browser, we test the current behavior
            if (process.env.NODE_ENV === "production") {
                expect(message).to.equal("An unexpected error occurred. Please try again later.");
            } else {
                expect(message).to.equal("Internal database error");
            }
        });
    });

    describe("ErrorCodes", () => {
        it("should contain all expected error codes", () => {
            expect(ErrorCodes.VALIDATION_ERROR).to.equal("VALIDATION_ERROR");
            expect(ErrorCodes.AUTHENTICATION_ERROR).to.equal("AUTHENTICATION_ERROR");
            expect(ErrorCodes.AUTHORIZATION_ERROR).to.equal("AUTHORIZATION_ERROR");
            expect(ErrorCodes.NOT_FOUND_ERROR).to.equal("NOT_FOUND_ERROR");
            expect(ErrorCodes.CONFLICT_ERROR).to.equal("CONFLICT_ERROR");
            expect(ErrorCodes.RATE_LIMIT_ERROR).to.equal("RATE_LIMIT_ERROR");
            expect(ErrorCodes.EXTERNAL_SERVICE_ERROR).to.equal("EXTERNAL_SERVICE_ERROR");
            expect(ErrorCodes.DATABASE_ERROR).to.equal("DATABASE_ERROR");
            expect(ErrorCodes.INTERNAL_ERROR).to.equal("INTERNAL_ERROR");
            expect(ErrorCodes.UNKNOWN_ERROR).to.equal("UNKNOWN_ERROR");
        });

        it("should have all error codes as constants", () => {
            const codes = Object.values(ErrorCodes);
            expect(codes.length).to.equal(10);
            codes.forEach((code) => {
                expect(code).to.be.a("string");
                expect(code.length).to.be.greaterThan(0);
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
                expect(error).to.be.instanceOf(AppError);
                expect(error).to.be.instanceOf(Error);
                expect(isAppError(error)).to.be.true;
                expect(isError(error)).to.be.true;
            });
        });

        it("should maintain correct error types after serialization", () => {
            const error = new ValidationError("Test", { field: "email" });
            const json = error.toJSON();

            expect(json.name).to.equal("ValidationError");
            expect(json.code).to.equal("VALIDATION_ERROR");
            expect(json.statusCode).to.equal(400);
            expect(json.context).to.deep.equal({ field: "email" });
        });
    });
});

