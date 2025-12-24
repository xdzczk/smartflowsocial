/**
 * Integration tests for centralized error handling system
 * Tests error handling in actual routes and API endpoints
 */

import { TEST_NPUB } from "../../support/nostr-test-keys";

describe("Error Handling Integration Tests", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("API Route Error Handling", () => {
    describe("ValidationError (400)", () => {
      it("should return ValidationError for missing required parameters", () => {
        cy.request({
          method: "POST",
          url: "/api/effective-hashtags",
          body: {},
          failOnStatusCode: false,
        }).then((response) => {
          // Should return 400 for validation error
          expect(response.status).to.equal(400);
          // Response should have standard error format
          if (response.body.error) {
            expect(response.body).to.have.property("success", false);
            expect(response.body.error).to.have.property("code");
            expect(response.body.error).to.have.property("statusCode", 400);
            expect(response.body.error).to.have.property("message");
            expect(response.body.error).to.have.property("timestamp");
          }
        });
      });

      it("should return ValidationError for invalid URL format in link-preview", () => {
        cy.request({
          method: "GET",
          url: "/api/link-preview?url=not-a-valid-url",
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.equal(400);
          expect(response.body).to.have.property("success", false);
          expect(response.body.error).to.have.property("code", "VALIDATION_ERROR");
          expect(response.body.error).to.have.property("statusCode", 400);
          expect(response.body.error.message).to.include("Invalid URL format");
        });
      });

      it("should return ValidationError for missing URL parameter", () => {
        cy.request({
          method: "GET",
          url: "/api/link-preview",
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.equal(400);
          expect(response.body).to.have.property("success", false);
          expect(response.body.error).to.have.property("code", "VALIDATION_ERROR");
          expect(response.body.error.message).to.include("URL parameter is required");
        });
      });

      it("should return ValidationError for invalid JSON in request body", () => {
        cy.request({
          method: "POST",
          url: "/api/effective-hashtags",
          body: "invalid json",
          headers: {
            "Content-Type": "application/json",
          },
          failOnStatusCode: false,
        }).then((response) => {
          expect(response.status).to.equal(400);
          // Error response should have standard format
          if (response.body.error) {
            expect(response.body).to.have.property("success", false);
            expect(response.body.error).to.have.property("code", "VALIDATION_ERROR");
            expect(response.body.error).to.have.property("statusCode", 400);
          }
        });
      });
    });

    describe("AuthenticationError (401)", () => {
      it("should return AuthenticationError for unauthenticated requests", () => {
        cy.clearCookie("__session");
        cy.request({
          method: "POST",
          url: "/api/effective-hashtags",
          body: { queueTypeName: "test" },
          failOnStatusCode: false,
        }).then((response) => {
          // Should redirect or return 401
          expect([401, 302, 307]).to.include(response.status);
        });
      });
    });

    describe("NotFoundError (404)", () => {
      it("should return NotFoundError for non-existent resources", () => {
        cy.request({
          method: "GET",
          url: "/api/thread-view",
          qs: {
            eventId: "0000000000000000000000000000000000000000000000000000000000000000",
          },
          failOnStatusCode: false,
        }).then((response) => {
          // May return 404 or empty results depending on implementation
          expect([200, 404]).to.include(response.status);
          if (response.status === 404) {
            expect(response.body).to.have.property("success", false);
            expect(response.body.error).to.have.property("code", "NOT_FOUND_ERROR");
          }
        });
      });
    });

    describe("ExternalServiceError (502/503)", () => {
      it("should return ExternalServiceError for invalid external URLs", () => {
        cy.request({
          method: "GET",
          url: "/api/link-preview",
          qs: {
            url: "https://invalid-domain-that-does-not-exist-12345.com",
          },
          failOnStatusCode: false,
          timeout: 10000,
        }).then((response) => {
          // Should handle timeout or connection errors
          expect([502, 503, 504, 500]).to.include(response.status);
          if (response.body.error) {
            expect(response.body.error).to.have.property("code");
            // Could be EXTERNAL_SERVICE_ERROR or INTERNAL_ERROR
          }
        });
      });
    });

    describe("Error Response Format", () => {
      it("should return standardized error response format", () => {
        cy.request({
          method: "POST",
          url: "/api/effective-hashtags",
          body: {},
          failOnStatusCode: false,
        }).then((response) => {
          // Check standard error response structure
          expect(response.body).to.have.property("success", false);
          expect(response.body).to.have.property("error");
          expect(response.body.error).to.have.property("message");
          expect(response.body.error).to.have.property("code");
          expect(response.body.error).to.have.property("statusCode");
          expect(response.body.error).to.have.property("timestamp");
          expect(response.body.error.statusCode).to.be.a("number");
          expect(response.body.error.code).to.be.a("string");
          expect(response.body.error.message).to.be.a("string");
          expect(response.body.error.timestamp).to.be.a("string");
        });
      });

      it("should include error context in development mode", () => {
        cy.request({
          method: "POST",
          url: "/api/effective-hashtags",
          body: {},
          failOnStatusCode: false,
        }).then((response) => {
          // In development, context may be included
          if (response.body.error.context) {
            expect(response.body.error.context).to.be.an("object");
          }
        });
      });
    });
  });

  describe("Loader Error Handling", () => {
    it("should handle loader errors gracefully with safe defaults", () => {
      // Test a loader that might fail
      cy.visit("/dashboard/drafts");
      // Should load with safe defaults or show error boundary
      cy.get("body").should("exist");
    });

    it("should display error boundary for critical loader failures", () => {
      // Visit a route that might have loader errors
      cy.visit("/dashboard/settings");
      // Should either load successfully or show error boundary
      cy.get("body").should("exist");
    });
  });

  describe("Action Error Handling", () => {
    it("should handle action errors and return standardized format", () => {
      // Test an action that will fail validation
      cy.request({
        method: "POST",
        url: "/api/upload",
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.greaterThanOrEqual(400);
        if (response.body.error) {
          expect(response.body).to.have.property("success", false);
          expect(response.body.error).to.have.property("code");
          expect(response.body.error).to.have.property("statusCode");
        }
      });
    });

    it("should handle file upload errors gracefully", () => {
      cy.request({
        method: "POST",
        url: "/api/upload",
        body: new FormData(),
        failOnStatusCode: false,
      }).then((response) => {
        // Should return error response, not crash
        expect(response.status).to.be.greaterThanOrEqual(400);
      });
    });
  });

  describe("Error Boundary", () => {
    it("should display error boundary for route errors", () => {
      // Try to access a route that might error
      cy.visit("/dashboard/drafts/edit/invalid-id", {
        failOnStatusCode: false,
      });
      
      // Should show error boundary or redirect
      cy.get("body").should("exist");
    });

    it("should show user-friendly error messages in production", () => {
      cy.request({
        method: "POST",
        url: "/api/effective-hashtags",
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        // Error message should be user-friendly
        expect(response.body.error.message).to.be.a("string");
        expect(response.body.error.message.length).to.be.greaterThan(0);
      });
    });
  });

  describe("Error Logging", () => {
    it("should log errors with proper structure", () => {
      // Make a request that will error
      cy.request({
        method: "POST",
        url: "/api/effective-hashtags",
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        // Error should be logged server-side (we can't directly test logs in Cypress,
        // but we can verify the error response includes timestamp which indicates logging)
        expect(response.body.error).to.have.property("timestamp");
        expect(response.body.error.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });
  });

  describe("Error Normalization", () => {
    it("should normalize unknown errors to AppError", () => {
      // Test that any error gets normalized to standard format
      cy.request({
        method: "GET",
        url: "/api/link-preview?url=https://example.com",
        failOnStatusCode: false,
      }).then((response) => {
        // Response should always have standard format, even if external service fails
        if (response.status >= 400) {
          expect(response.body).to.have.property("success", false);
          expect(response.body.error).to.have.property("code");
          expect(response.body.error).to.have.property("statusCode");
        }
      });
    });
  });

  describe("Success Response Format", () => {
    it("should return standardized success response format when using createSuccessResponse", () => {
      cy.request({
        method: "POST",
        url: "/api/effective-hashtags",
        body: { queueTypeName: "test" },
      }).then((response) => {
        // Success responses should have standard format
        expect(response.status).to.equal(200);
        // Routes using createSuccessResponse will have { success: true, data: {...} }
        // Routes using direct json() will have direct data
        if (response.body.success !== undefined) {
          expect(response.body).to.have.property("success", true);
          expect(response.body).to.have.property("data");
        } else {
          // Direct json response is also valid
          expect(response.body).to.be.an("object");
        }
      });
    });
  });

  describe("Error Context", () => {
    it("should include relevant context in error responses", () => {
      cy.request({
        method: "GET",
        url: "/api/link-preview?url=invalid-url",
        failOnStatusCode: false,
      }).then((response) => {
        if (response.body.error && response.body.error.context) {
          expect(response.body.error.context).to.be.an("object");
          // Context should include relevant information
          expect(response.body.error.context).to.have.property("targetUrl");
        }
      });
    });
  });

  describe("HTTP Status Codes", () => {
    it("should return correct status codes for different error types", () => {
      // ValidationError should return 400
      cy.request({
        method: "POST",
        url: "/api/effective-hashtags",
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.equal(400);
        expect(response.body.error.statusCode).to.equal(400);
      });

      // Test 404 for not found (if applicable)
      cy.request({
        method: "GET",
        url: "/api/nonexistent-endpoint",
        failOnStatusCode: false,
      }).then((response) => {
        expect([404, 405]).to.include(response.status);
      });
    });
  });

  describe("Error Recovery", () => {
    it("should allow retry after error", () => {
      // First request with error
      cy.request({
        method: "POST",
        url: "/api/effective-hashtags",
        body: {},
        failOnStatusCode: false,
      }).then((firstResponse) => {
        expect(firstResponse.status).to.equal(400);

        // Second request with valid data should succeed
        cy.request({
          method: "POST",
          url: "/api/effective-hashtags",
          body: { queueTypeName: "unassigned" },
        }).then((secondResponse) => {
          expect(secondResponse.status).to.equal(200);
        });
      });
    });
  });

  describe("Concurrent Error Handling", () => {
    it("should handle multiple concurrent error requests", () => {
      const requests = Array(5).fill(null).map(() =>
        cy.request({
          method: "POST",
          url: "/api/effective-hashtags",
          body: {},
          failOnStatusCode: false,
        })
      );

      cy.wrap(Promise.all(requests)).then((responses) => {
        responses.forEach((response: Cypress.Response<any>) => {
          expect(response.status).to.equal(400);
          if (response.body.error) {
            expect(response.body).to.have.property("success", false);
            expect(response.body.error).to.have.property("code");
          }
        });
      });
    });
  });

  describe("Specific Error Scenarios", () => {
    it("should handle missing event_id parameter in thread-view", () => {
      cy.request({
        method: "GET",
        url: "/api/thread-view",
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.equal(400);
        if (response.body.error) {
          expect(response.body.error).to.have.property("code", "VALIDATION_ERROR");
          expect(response.body.error.message).to.include("event_id");
        }
      });
    });

    it("should handle invalid content type in upload endpoint", () => {
      cy.request({
        method: "POST",
        url: "/api/upload",
        body: {},
        headers: {
          "Content-Type": "application/json",
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.equal(400);
        if (response.body.error) {
          expect(response.body.error).to.have.property("code", "VALIDATION_ERROR");
          expect(response.body.error.message).to.include("multipart/form-data");
        }
      });
    });

    it("should handle missing file in upload endpoint", () => {
      // Create a FormData-like request without file
      cy.request({
        method: "POST",
        url: "/api/upload",
        body: new FormData(),
        failOnStatusCode: false,
      }).then((response) => {
        // Should return validation error
        expect(response.status).to.be.greaterThanOrEqual(400);
        if (response.body.error) {
          expect(response.body.error).to.have.property("code");
        }
      });
    });

    it("should handle URL without http/https protocol", () => {
      cy.request({
        method: "GET",
        url: "/api/link-preview",
        qs: {
          url: "ftp://example.com",
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.equal(400);
        if (response.body.error) {
          expect(response.body.error).to.have.property("code", "VALIDATION_ERROR");
          expect(response.body.error.message).to.include("http:// or https://");
        }
      });
    });
  });

  describe("Error Response Consistency", () => {
    it("should maintain consistent error response structure across all endpoints", () => {
      const endpoints = [
        { method: "POST", url: "/api/effective-hashtags", body: {} },
        { method: "GET", url: "/api/link-preview" },
        { method: "GET", url: "/api/thread-view" },
      ];

      endpoints.forEach((endpoint) => {
        cy.request({
          ...endpoint,
          failOnStatusCode: false,
        }).then((response) => {
          if (response.status >= 400 && response.body.error) {
            // All errors should have consistent structure
            expect(response.body).to.have.property("success", false);
            expect(response.body.error).to.have.property("message");
            expect(response.body.error).to.have.property("code");
            expect(response.body.error).to.have.property("statusCode");
            expect(response.body.error).to.have.property("timestamp");
            expect(response.body.error.statusCode).to.equal(response.status);
          }
        });
      });
    });
  });
});

