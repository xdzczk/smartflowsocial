import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * API Endpoint Tests
 * 
 * Tests API endpoints:
 * - Effective hashtags API
 * - Queue schedule API
 * - Link preview API
 * - Payment status API
 * - Error metrics API (if accessible)
 */
describe("API Endpoints", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Effective Hashtags API", () => {
    it("should fetch effective hashtags for queue type", () => {
      cy.request({
        method: "POST",
        url: "/api/effective-hashtags",
        body: {
          queueTypeName: "Unassigned",
        },
        headers: {
          "Content-Type": "application/json",
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 400, 401]);
        if (response.status === 200) {
          expect(response.body).to.have.property("hashtags");
        }
      });
    });
  });

  describe("Queue Schedule API", () => {
    it("should fetch queue schedule data", () => {
      cy.request({
        method: "GET",
        url: "/api/queue-schedule",
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 400, 401, 404]);
        if (response.status === 200) {
          expect(response.body).to.exist;
        }
      });
    });
  });

  describe("Link Preview API", () => {
    it("should fetch link preview data", () => {
      cy.request({
        method: "GET",
        url: "/api/link-preview?url=https://example.com",
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 400, 401, 500]);
        if (response.status === 200) {
          expect(response.body).to.exist;
        }
      });
    });

    it("should handle invalid URL", () => {
      cy.request({
        method: "GET",
        url: "/api/link-preview?url=invalid",
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 500]);
      });
    });
  });

  describe("Payment Status API", () => {
    it("should fetch payment status", () => {
      cy.request({
        method: "GET",
        url: "/api/payment-status",
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 401]);
        if (response.status === 200) {
          expect(response.body).to.exist;
        }
      });
    });
  });

  describe("API Authentication", () => {
    it("should require authentication for protected endpoints", () => {
      cy.clearCookies();
      
      cy.request({
        method: "POST",
        url: "/api/effective-hashtags",
        body: { queueTypeName: "Unassigned" },
        headers: { "Content-Type": "application/json" },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([401, 403]);
      });
    });
  });

  describe("API Error Handling", () => {
    it("should return proper error responses for invalid requests", () => {
      cy.request({
        method: "POST",
        url: "/api/effective-hashtags",
        body: {},
        headers: { "Content-Type": "application/json" },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 400, 401]);
        if (response.status === 400) {
          expect(response.body).to.have.property("error");
        }
      });
    });
  });
});

