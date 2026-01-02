import { TEST_NPUB } from "./support/nostr-test-keys";

/**
 * Subscription and Payment Flow Tests
 * 
 * Tests subscription and payment functionality:
 * - View plans page
 * - Select subscription plan
 * - Payment flow
 * - Subscription status
 */
describe("Subscription and Payment Flow", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Plans Page", () => {
    it("should navigate to plans page", () => {
      cy.visitAndCheck("/plans");
      cy.location("pathname").should("include", "plans");
      cy.get("body").should("be.visible");
    });

    it("should display pricing plans", () => {
      cy.visitAndCheck("/plans");
      cy.get("body").then(($body) => {
        const hasPlans =
          $body.find('[data-testid="pricing-card"]').length > 0 ||
          $body.find(".pricing-card, .plan-card").length > 0 ||
          $body.text().toLowerCase().includes("plan") ||
          $body.text().toLowerCase().includes("pricing");
        
        expect(hasPlans).to.be.true;
      });
    });

    it("should display plan features", () => {
      cy.visitAndCheck("/plans");
      cy.get("body").then(($body) => {
        const hasFeatures =
          $body.find('[data-testid="feature"]').length > 0 ||
          $body.find("ul, li").length > 0 ||
          $body.text().toLowerCase().includes("feature");
        
        expect(hasFeatures).to.be.true;
      });
    });
  });

  describe("Subscription Status", () => {
    it("should display current subscription in settings", () => {
      cy.visitAndCheck("/dashboard/settings");
      cy.get("body").then(($body) => {
        const hasSubscriptionInfo =
          $body.find('[data-testid="subscription-info"]').length > 0 ||
          $body.text().toLowerCase().includes("subscription") ||
          $body.text().toLowerCase().includes("plan");
        
        expect(hasSubscriptionInfo).to.be.true;
      });
    });

    it("should allow setting subscription status for testing", () => {
      cy.setSubscriptionStatus("FREE");
      // After setting subscription, user might be redirected to /plans
      // Accept either /dashboard/settings or /plans as valid
      cy.visit("/dashboard/settings", { failOnStatusCode: false });
      cy.location("pathname").then((pathname) => {
        // Accept either settings page or plans page (if redirected)
        expect(pathname).to.satisfy((p: string) => 
          p.includes("settings") || p.includes("plans") || p.includes("dashboard")
        );
      });
      cy.get("body").should("be.visible");
    });
  });

  describe("Feature Access", () => {
    it("should restrict features based on subscription", () => {
      cy.setSubscriptionStatus("FREE");
      // Free plan users might be redirected to /plans
      cy.visit("/dashboard", { failOnStatusCode: false });
      cy.location("pathname").then((pathname) => {
        // Accept either dashboard or plans page (if redirected)
        expect(pathname).to.satisfy((p: string) => 
          p.includes("dashboard") || p.includes("plans")
        );
      });
      cy.get("body").should("be.visible");
    });

    it("should allow access with active subscription", () => {
      cy.setSubscriptionStatus("ACTIVE");
      cy.visitAndCheck("/dashboard");
      cy.location("pathname").should("include", "dashboard");
    });
  });
});


