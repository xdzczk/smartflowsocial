/**
 * Example test demonstrating factory usage
 * This file shows how to use factories in tests
 */

import { describe, it, expect } from "vitest";

import {
  postFactory,
  userFactory,
  queueTypeFactory,
  hashTagPresetFactory,
  paymentFactory,
  PostFactory,
  UserFactory,
} from "./index";
import {
  deriveIsDraft,
  deriveIsScheduled,
  deriveIsPublished,
} from "~/features/posts/state-machine/post-state";

describe("Factory Usage Examples", () => {
  it("should create a draft post using convenience function", () => {
    const post = postFactory.draft();

    expect(deriveIsDraft(post.currentState)).toBe(true);
    expect(deriveIsPublished(post.currentState)).toBe(false);
    expect(deriveIsScheduled(post.currentState)).toBe(false);
  });

  it("should create a scheduled post using builder pattern", () => {
    const scheduledFor = new Date(Date.now() + 3600000);
    const post = new PostFactory()
      .withCaption("Scheduled post")
      .withImages(["https://example.com/image.jpg"])
      .asScheduled(scheduledFor)
      .build();

    expect(deriveIsScheduled(post.currentState)).toBe(true);
    expect(deriveIsDraft(post.currentState)).toBe(false);
    expect(post.scheduledAtUtc).toBeDefined();
  });

  it("should create related entities", () => {
    const user = userFactory.basic({ id: "user-1" });
    const queue = queueTypeFactory.interval(4, { userId: user.id });
    const preset = hashTagPresetFactory.basic({ userId: user.id });
    const post = postFactory.draft({
      userId: user.id,
      queueTypeId: queue.id,
      hashTagPresetId: preset.id,
    });

    expect(post.userId).toBe(user.id);
    expect(post.queueTypeId).toBe(queue.id);
    expect(post.hashTagPresetId).toBe(preset.id);
  });

  it("should create multiple posts", () => {
    const posts = postFactory.many(5, { currentState: "DRAFT" });

    expect(posts).toHaveLength(5);
    posts.forEach((post) => {
      expect(deriveIsDraft(post.currentState)).toBe(true);
    });
  });

  it("should create a user with specific settings", () => {
    const user = new UserFactory()
      .withTimezone("America/New_York")
      .withRelays(["wss://relay1.com"])
      .withHashTagsInPosts(true)
      .build();

    expect(user.timezone).toBe("America/New_York");
    expect(user.userRelays).toEqual(["wss://relay1.com"]);
    expect(user.showHashTagsinPosts).toBe(true);
  });

  it("should create a payment with different statuses", () => {
    const pending = paymentFactory.pending();
    const paid = paymentFactory.paid();
    const failed = paymentFactory.failed("Insufficient funds");

    expect(pending.status).toBe("PENDING");
    expect(paid.status).toBe("COMPLETED");
    expect(failed.status).toBe("FAILED");
  });
});
