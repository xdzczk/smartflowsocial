/**
 * Unit tests for subscription and plan enforcement logic
 * Tests real exported functions from app/features/payments/types.ts
 * 
 * Migrated from tests/e2e/unit/subscription-logic.cy.ts
 */

import { describe, it, expect } from "vitest";

import {
  PLAN_FEATURES,
  getUserPlanType,
  hasFeatureAccess,
  getMinimumPlanForFeature,
  isNewUserWithoutSubscription,
  type UserSubscription,
  type SubscriptionData,
  type PlanType,
} from "~/features/payments/types";

describe("Subscription & Plan Enforcement Unit Tests", () => {
  describe("getUserPlanType", () => {
    it("should return 'free' for null subscription", () => {
      const result = getUserPlanType(null);
      expect(result).toBe("free");
    });

    it("should return 'free' for inactive subscription", () => {
      const subscription: UserSubscription = {
        planId: "basic",
        status: "EXPIRED",
        Plan: { name: "Basic Plan", id: "basic" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("free");
    });

    it("should return 'free' for pending subscription", () => {
      const subscription: UserSubscription = {
        planId: "premium",
        status: "PENDING",
        Plan: { name: "Premium Plan", id: "premium" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("free");
    });

    it("should return 'basic' for active basic subscription", () => {
      const subscription: UserSubscription = {
        planId: "basic",
        status: "ACTIVE",
        Plan: { name: "Basic Plan", id: "basic" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("basic");
    });

    it("should return 'premium' for active premium subscription", () => {
      const subscription: UserSubscription = {
        planId: "premium",
        status: "ACTIVE",
        Plan: { name: "Premium Plan", id: "premium" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("premium");
    });

    it("should return 'pro' for active pro subscription", () => {
      const subscription: UserSubscription = {
        planId: "pro",
        status: "ACTIVE",
        Plan: { name: "Pro Plan", id: "pro" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("pro");
    });

    it("should return 'enterprise' for active enterprise subscription", () => {
      const subscription: UserSubscription = {
        planId: "enterprise",
        status: "ACTIVE",
        Plan: { name: "Enterprise Plan", id: "enterprise" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("enterprise");
    });

    it("should match by planId first (more reliable)", () => {
      const subscription: UserSubscription = {
        planId: "premium",
        status: "ACTIVE",
        Plan: { name: "Custom Plan Name", id: "premium" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("premium");
    });

    it("should fallback to plan name matching", () => {
      const subscription: UserSubscription = {
        planId: "custom-id",
        status: "ACTIVE",
        Plan: { name: "Enterprise Special", id: "custom-id" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("enterprise");
    });

    it("should return 'free' for unrecognized plan", () => {
      const subscription: UserSubscription = {
        planId: "unknown-plan",
        status: "ACTIVE",
        Plan: { name: "Unknown Plan", id: "unknown-plan" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("free");
    });
  });

  describe("hasFeatureAccess", () => {
    describe("Free Plan Feature Access", () => {
      const freeSubscription: UserSubscription | null = null;

      it("should allow basicScheduling for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "basicScheduling")).toBe(true);
      });

      it("should allow newPost for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "newPost")).toBe(true);
      });

      it("should allow dashboard for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "dashboard")).toBe(true);
      });

      it("should deny drafts for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "drafts")).toBe(false);
      });

      it("should deny calendar for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "calendar")).toBe(false);
      });

      it("should deny bulkScheduling for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "bulkScheduling")).toBe(false);
      });

      it("should deny longformPosts for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "longformPosts")).toBe(false);
      });

      it("should deny templates for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "templates")).toBe(false);
      });
    });

    describe("Basic Plan Feature Access", () => {
      const basicSubscription: UserSubscription = {
        planId: "basic",
        status: "ACTIVE",
        Plan: { name: "Basic", id: "basic" },
      };

      it("should allow all free features for basic users", () => {
        expect(hasFeatureAccess(basicSubscription, "basicScheduling")).toBe(true);
        expect(hasFeatureAccess(basicSubscription, "newPost")).toBe(true);
        expect(hasFeatureAccess(basicSubscription, "dashboard")).toBe(true);
      });

      it("should allow premium features for basic users", () => {
        expect(hasFeatureAccess(basicSubscription, "drafts")).toBe(true);
        expect(hasFeatureAccess(basicSubscription, "calendar")).toBe(true);
        expect(hasFeatureAccess(basicSubscription, "bulkScheduling")).toBe(true);
        expect(hasFeatureAccess(basicSubscription, "longformPosts")).toBe(true);
        expect(hasFeatureAccess(basicSubscription, "templates")).toBe(true);
      });
    });

    describe("Expired Subscription Access", () => {
      const expiredSubscription: UserSubscription = {
        planId: "premium",
        status: "EXPIRED",
        Plan: { name: "Premium", id: "premium" },
      };

      it("should only have free-tier access when expired", () => {
        expect(hasFeatureAccess(expiredSubscription, "drafts")).toBe(false);
        expect(hasFeatureAccess(expiredSubscription, "calendar")).toBe(false);
        expect(hasFeatureAccess(expiredSubscription, "bulkScheduling")).toBe(false);
      });

      it("should still allow basic features when expired", () => {
        expect(hasFeatureAccess(expiredSubscription, "basicScheduling")).toBe(true);
        expect(hasFeatureAccess(expiredSubscription, "newPost")).toBe(true);
        expect(hasFeatureAccess(expiredSubscription, "dashboard")).toBe(true);
      });
    });
  });

  describe("getMinimumPlanForFeature", () => {
    it("should return 'free' for basicScheduling", () => {
      const result = getMinimumPlanForFeature("basicScheduling");
      expect(result).toBe("free");
    });

    it("should return 'free' for newPost", () => {
      const result = getMinimumPlanForFeature("newPost");
      expect(result).toBe("free");
    });

    it("should return 'free' for dashboard", () => {
      const result = getMinimumPlanForFeature("dashboard");
      expect(result).toBe("free");
    });

    it("should return 'basic' for drafts", () => {
      const result = getMinimumPlanForFeature("drafts");
      expect(result).toBe("basic");
    });

    it("should return 'basic' for calendar", () => {
      const result = getMinimumPlanForFeature("calendar");
      expect(result).toBe("basic");
    });

    it("should return 'basic' for bulkScheduling", () => {
      const result = getMinimumPlanForFeature("bulkScheduling");
      expect(result).toBe("basic");
    });

    it("should return 'basic' for longformPosts", () => {
      const result = getMinimumPlanForFeature("longformPosts");
      expect(result).toBe("basic");
    });

    it("should return 'basic' for templates", () => {
      const result = getMinimumPlanForFeature("templates");
      expect(result).toBe("basic");
    });
  });

  describe("isNewUserWithoutSubscription", () => {
    it("should return true for null subscription data", () => {
      const result = isNewUserWithoutSubscription(null);
      expect(result).toBe(true);
    });

    it("should return true for user without user data", () => {
      const subscriptionData: SubscriptionData = {
        user: null,
        currentSubscription: null,
      };

      const result = isNewUserWithoutSubscription(subscriptionData);
      expect(result).toBe(true);
    });

    it("should return true for user with no subscription", () => {
      const subscriptionData: SubscriptionData = {
        user: { id: "user-123", isEnabled: true },
        currentSubscription: null,
      };

      const result = isNewUserWithoutSubscription(subscriptionData);
      expect(result).toBe(true);
    });

    it("should return true for user with inactive subscription", () => {
      const subscriptionData: SubscriptionData = {
        user: { id: "user-123", isEnabled: true },
        currentSubscription: {
          planId: "basic",
          status: "EXPIRED",
          Plan: { name: "Basic", id: "basic" },
        },
      };

      const result = isNewUserWithoutSubscription(subscriptionData);
      expect(result).toBe(true);
    });

    it("should return false for user with active subscription", () => {
      const subscriptionData: SubscriptionData = {
        user: { id: "user-123", isEnabled: true },
        currentSubscription: {
          planId: "basic",
          status: "ACTIVE",
          Plan: { name: "Basic", id: "basic" },
        },
      };

      const result = isNewUserWithoutSubscription(subscriptionData);
      expect(result).toBe(false);
    });
  });

  describe("PLAN_FEATURES Configuration", () => {
    it("should have all required plan types", () => {
      const plans = Object.keys(PLAN_FEATURES);
      expect(plans).toContain("free");
      expect(plans).toContain("basic");
      expect(plans).toContain("premium");
      expect(plans).toContain("pro");
      expect(plans).toContain("enterprise");
    });

    it("should have consistent feature keys across all plans", () => {
      const freeFeatures = Object.keys(PLAN_FEATURES.free);
      const basicFeatures = Object.keys(PLAN_FEATURES.basic);

      // All free features should exist in basic (and basic may have more)
      freeFeatures.forEach((feature) => {
        expect(basicFeatures).toContain(feature);
      });
    });

    it("should have free plan with restricted features", () => {
      expect(PLAN_FEATURES.free.drafts).toBe(false);
      expect(PLAN_FEATURES.free.calendar).toBe(false);
      expect(PLAN_FEATURES.free.bulkScheduling).toBe(false);
      expect(PLAN_FEATURES.free.longformPosts).toBe(false);
    });

    it("should have paid plans with full features", () => {
      const paidPlans: PlanType[] = ["basic", "premium", "pro", "enterprise"];

      paidPlans.forEach((plan) => {
        expect(PLAN_FEATURES[plan].drafts).toBe(true);
        expect(PLAN_FEATURES[plan].calendar).toBe(true);
        expect(PLAN_FEATURES[plan].bulkScheduling).toBe(true);
        expect(PLAN_FEATURES[plan].longformPosts).toBe(true);
      });
    });
  });
});

