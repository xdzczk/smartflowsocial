/**
 * Unit tests for Post State Logic
 * Tests app/features/posts/state-machine/post-state.ts
 */

import { describe, it, expect } from "vitest";

import {
  canTransition,
  transitionPost,
  getValidNextStates,
  type PostState,
} from "~/features/posts/state-machine/post-state";

describe("Post State Logic", () => {
  describe("canTransition", () => {
    it("should allow valid transitions from DRAFT", () => {
      expect(canTransition("DRAFT", "SCHEDULED")).toBe(true);
      expect(canTransition("DRAFT", "PUBLISHED")).toBe(true);
      expect(canTransition("DRAFT", "CANCELLED")).toBe(true);
    });

    it("should allow valid transitions from SCHEDULED", () => {
      expect(canTransition("SCHEDULED", "PUBLISHING")).toBe(true);
      expect(canTransition("SCHEDULED", "CANCELLED")).toBe(true);
      expect(canTransition("SCHEDULED", "DRAFT")).toBe(true);
    });

    it("should allow valid transitions from PUBLISHING", () => {
      expect(canTransition("PUBLISHING", "PUBLISHED")).toBe(true);
      expect(canTransition("PUBLISHING", "FAILED")).toBe(true);
    });

    it("should not allow transitions from PUBLISHED (terminal state)", () => {
      expect(canTransition("PUBLISHED", "DRAFT")).toBe(false);
      expect(canTransition("PUBLISHED", "SCHEDULED")).toBe(false);
      expect(canTransition("PUBLISHED", "PUBLISHING")).toBe(false);
    });

    it("should allow valid transitions from FAILED", () => {
      expect(canTransition("FAILED", "SCHEDULED")).toBe(true);
      expect(canTransition("FAILED", "DRAFT")).toBe(true);
      expect(canTransition("FAILED", "CANCELLED")).toBe(true);
    });

    it("should not allow transitions from CANCELLED (terminal state)", () => {
      expect(canTransition("CANCELLED", "DRAFT")).toBe(false);
      expect(canTransition("CANCELLED", "SCHEDULED")).toBe(false);
      expect(canTransition("CANCELLED", "PUBLISHED")).toBe(false);
    });

    it("should not allow invalid transitions", () => {
      // DRAFT -> PUBLISHING and DRAFT -> FAILED are now valid transitions
      expect(canTransition("SCHEDULED", "PUBLISHED")).toBe(false);
      expect(canTransition("PUBLISHING", "DRAFT")).toBe(false);
      expect(canTransition("PUBLISHING", "SCHEDULED")).toBe(false);
    });
  });

  describe("transitionPost", () => {
    it("should create a valid transition", () => {
      const transition = transitionPost("DRAFT", "SCHEDULED", "Post scheduled");

      expect(transition.from).toBe("DRAFT");
      expect(transition.to).toBe("SCHEDULED");
      expect(transition.reason).toBe("Post scheduled");
      expect(transition.timestamp).toBeInstanceOf(Date);
    });

    it("should throw error for invalid transition", () => {
      expect(() => {
        transitionPost("SCHEDULED", "PUBLISHED", "Invalid transition");
      }).toThrow(/Invalid transition from SCHEDULED to PUBLISHED/);
    });

    it("should throw error when transitioning from terminal state", () => {
      expect(() => {
        transitionPost(
          "PUBLISHED",
          "DRAFT",
          "Cannot transition from published"
        );
      }).toThrow("Invalid transition from PUBLISHED to DRAFT");
    });

    it("should throw error when transitioning from CANCELLED", () => {
      expect(() => {
        transitionPost(
          "CANCELLED",
          "DRAFT",
          "Cannot transition from cancelled"
        );
      }).toThrow("Invalid transition from CANCELLED to DRAFT");
    });
  });

  describe("getValidNextStates", () => {
    it("should return valid next states for DRAFT", () => {
      const nextStates = getValidNextStates("DRAFT");
      expect(nextStates).toEqual([
        "SCHEDULED",
        "PUBLISHED",
        "PUBLISHING",
        "CANCELLED",
        "FAILED",
      ]);
    });

    it("should return valid next states for SCHEDULED", () => {
      const nextStates = getValidNextStates("SCHEDULED");
      expect(nextStates).toEqual(["PUBLISHING", "CANCELLED", "DRAFT"]);
    });

    it("should return valid next states for PUBLISHING", () => {
      const nextStates = getValidNextStates("PUBLISHING");
      expect(nextStates).toEqual(["PUBLISHED", "FAILED"]);
    });

    it("should return empty array for terminal states", () => {
      expect(getValidNextStates("PUBLISHED")).toEqual([]);
      expect(getValidNextStates("CANCELLED")).toEqual([]);
    });

    it("should return valid next states for FAILED", () => {
      const nextStates = getValidNextStates("FAILED");
      expect(nextStates).toEqual(["SCHEDULED", "DRAFT", "CANCELLED"]);
    });
  });

  describe("State Transition Matrix", () => {
    const allStates: PostState[] = [
      "DRAFT",
      "SCHEDULED",
      "PUBLISHING",
      "PUBLISHED",
      "FAILED",
      "CANCELLED",
    ];

    it("should have all states defined in VALID_TRANSITIONS", () => {
      allStates.forEach((state) => {
        const nextStates = getValidNextStates(state);
        expect(Array.isArray(nextStates)).toBe(true);
      });
    });

    it("should allow all documented transitions", () => {
      // Test all documented valid transitions
      const validTransitions: Array<[PostState, PostState]> = [
        ["DRAFT", "SCHEDULED"],
        ["DRAFT", "PUBLISHED"],
        ["DRAFT", "CANCELLED"],
        ["SCHEDULED", "PUBLISHING"],
        ["SCHEDULED", "CANCELLED"],
        ["SCHEDULED", "DRAFT"],
        ["PUBLISHING", "PUBLISHED"],
        ["PUBLISHING", "FAILED"],
        ["FAILED", "SCHEDULED"],
        ["FAILED", "DRAFT"],
        ["FAILED", "CANCELLED"],
      ];

      validTransitions.forEach(([from, to]) => {
        expect(canTransition(from, to)).toBe(true);
      });
    });

    it("should prevent all documented invalid transitions", () => {
      // Test some documented invalid transitions
      // Note: DRAFT -> PUBLISHING and DRAFT -> FAILED are now valid
      const invalidTransitions: Array<[PostState, PostState]> = [
        ["SCHEDULED", "PUBLISHED"],
        ["PUBLISHING", "DRAFT"],
        ["PUBLISHING", "SCHEDULED"],
        ["PUBLISHED", "DRAFT"],
        ["PUBLISHED", "SCHEDULED"],
        ["PUBLISHED", "PUBLISHING"],
        ["CANCELLED", "DRAFT"],
        ["CANCELLED", "SCHEDULED"],
      ];

      invalidTransitions.forEach(([from, to]) => {
        expect(canTransition(from, to)).toBe(false);
      });
    });
  });
});
