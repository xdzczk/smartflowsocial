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
        planId: "creator",
        status: "EXPIRED",
        Plan: { name: "Creator Plan", id: "creator" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("free");
    });

    it("should return 'free' for pending subscription", () => {
      const subscription: UserSubscription = {
        planId: "pro",
        status: "PENDING",
        Plan: { name: "Pro Plan", id: "pro" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("free");
    });

    it("should return 'creator' for active creator subscription", () => {
      const subscription: UserSubscription = {
        planId: "creator",
        status: "ACTIVE",
        Plan: { name: "Creator Plan", id: "creator" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("creator");
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

    it("should return 'pro' for active pro subscription", () => {
      const subscription: UserSubscription = {
        planId: "pro",
        status: "ACTIVE",
        Plan: { name: "Pro Plan", id: "pro" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("pro");
    });

    it("should match by planId first (more reliable)", () => {
      const subscription: UserSubscription = {
        planId: "pro",
        status: "ACTIVE",
        Plan: { name: "Custom Plan Name", id: "pro" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("pro");
    });

    it("should fallback to plan name matching", () => {
      const subscription: UserSubscription = {
        planId: "custom-id",
        status: "ACTIVE",
        Plan: { name: "Creator Special", id: "custom-id" },
      };

      const result = getUserPlanType(subscription);
      expect(result).toBe("creator");
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

    it("should return founder for founder planId", () => {
      const subscription: UserSubscription = {
        planId: "founder",
        status: "ACTIVE",
        Plan: { name: "Founder", id: "founder" },
      };

      expect(getUserPlanType(subscription)).toBe("founder");
    });

    it("should return teams for teams planId", () => {
      const subscription: UserSubscription = {
        planId: "teams",
        status: "ACTIVE",
        Plan: { name: "Teams", id: "teams" },
      };

      expect(getUserPlanType(subscription)).toBe("teams");
    });
  });

  describe("hasFeatureAccess", () => {
    describe("Free Plan Feature Access", () => {
      const freeSubscription: UserSubscription | null = null;

      it("should allow basicScheduling for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "basicScheduling")).toBe(
          true
        );
      });

      it("should allow newPost for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "newPost")).toBe(true);
      });

      it("should allow dashboard for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "dashboard")).toBe(true);
      });

      it("should allow drafts surface for free users (limits apply on create)", () => {
        expect(hasFeatureAccess(freeSubscription, "drafts")).toBe(true);
      });

      it("should allow calendar for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "calendar")).toBe(true);
      });

      it("should allow bulkScheduling surface for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "bulkScheduling")).toBe(true);
      });

      it("should allow longformPosts for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "longformPosts")).toBe(true);
      });

      it("should allow templates surface for free users", () => {
        expect(hasFeatureAccess(freeSubscription, "templates")).toBe(true);
      });
    });

    describe("Creator Plan Feature Access", () => {
      const creatorSubscription: UserSubscription = {
        planId: "creator",
        status: "ACTIVE",
        Plan: { name: "Creator", id: "creator" },
      };

      it("should allow all free features for creator users", () => {
        expect(hasFeatureAccess(creatorSubscription, "basicScheduling")).toBe(
          true
        );
        expect(hasFeatureAccess(creatorSubscription, "newPost")).toBe(true);
        expect(hasFeatureAccess(creatorSubscription, "dashboard")).toBe(true);
      });

      it("should allow paid features for creator users", () => {
        expect(hasFeatureAccess(creatorSubscription, "drafts")).toBe(true);
        expect(hasFeatureAccess(creatorSubscription, "calendar")).toBe(true);
        expect(hasFeatureAccess(creatorSubscription, "bulkScheduling")).toBe(
          true
        );
        expect(hasFeatureAccess(creatorSubscription, "longformPosts")).toBe(
          true
        );
        expect(hasFeatureAccess(creatorSubscription, "templates")).toBe(true);
      });
    });

    describe("Expired Subscription Access", () => {
      const expiredSubscription: UserSubscription = {
        planId: "pro",
        status: "EXPIRED",
        Plan: { name: "Pro", id: "pro" },
      };

      it("should only have free-tier browse access when expired", () => {
        expect(hasFeatureAccess(expiredSubscription, "drafts")).toBe(true);
        expect(hasFeatureAccess(expiredSubscription, "calendar")).toBe(true);
        expect(hasFeatureAccess(expiredSubscription, "bulkScheduling")).toBe(
          true
        );
      });

      it("should still allow free features when expired", () => {
        expect(hasFeatureAccess(expiredSubscription, "basicScheduling")).toBe(
          true
        );
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

    it("should return 'free' for drafts", () => {
      const result = getMinimumPlanForFeature("drafts");
      expect(result).toBe("free");
    });

    it("should return 'free' for calendar", () => {
      const result = getMinimumPlanForFeature("calendar");
      expect(result).toBe("free");
    });

    it("should return 'starter' for bulkScheduling", () => {
      const result = getMinimumPlanForFeature("bulkScheduling");
      expect(result).toBe("starter");
    });

    it("should return 'free' for longformPosts", () => {
      const result = getMinimumPlanForFeature("longformPosts");
      expect(result).toBe("free");
    });

    it("should return 'free' for templates", () => {
      const result = getMinimumPlanForFeature("templates");
      expect(result).toBe("free");
    });

    it("should return 'starter' for broadcasts (send / scale)", () => {
      expect(getMinimumPlanForFeature("broadcasts")).toBe("starter");
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
          planId: "creator",
          status: "EXPIRED",
          Plan: { name: "Creator", id: "creator" },
        },
      };

      const result = isNewUserWithoutSubscription(subscriptionData);
      expect(result).toBe(true);
    });

    it("should return false for user with active subscription", () => {
      const subscriptionData: SubscriptionData = {
        user: { id: "user-123", isEnabled: true },
        currentSubscription: {
          planId: "creator",
          status: "ACTIVE",
          Plan: { name: "Creator", id: "creator" },
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
      expect(plans).toContain("starter");
      expect(plans).toContain("creator");
      expect(plans).toContain("pro");
      expect(plans).toContain("teams");
      expect(plans).toContain("founder");
    });

    it("should have consistent feature keys across all plans", () => {
      const freeFeatures = Object.keys(PLAN_FEATURES.free);
      const creatorFeatures = Object.keys(PLAN_FEATURES.creator);

      // All free features should exist in creator (and creator may have more)
      freeFeatures.forEach((feature) => {
        expect(creatorFeatures).toContain(feature);
      });
    });

    it("should have free plan with browse-all surfaces (execution limits elsewhere)", () => {
      expect(PLAN_FEATURES.free.drafts).toBe(true);
      expect(PLAN_FEATURES.free.calendar).toBe(true);
      expect(PLAN_FEATURES.free.bulkScheduling).toBe(true);
      expect(PLAN_FEATURES.free.longformPosts).toBe(true);
      expect(PLAN_FEATURES.free.broadcasts).toBe(true);
    });

    it("should have paid plans with full features", () => {
      const paidPlans: PlanType[] = [
        "starter",
        "creator",
        "pro",
        "teams",
        "founder",
      ];

      paidPlans.forEach((plan) => {
        expect(PLAN_FEATURES[plan].drafts).toBe(true);
        expect(PLAN_FEATURES[plan].calendar).toBe(true);
        expect(PLAN_FEATURES[plan].bulkScheduling).toBe(true);
        expect(PLAN_FEATURES[plan].longformPosts).toBe(true);
        expect(PLAN_FEATURES[plan].broadcasts).toBe(true);
      });
    });
  });
});
