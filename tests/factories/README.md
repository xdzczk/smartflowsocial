# Test Data Factories

This directory contains test data factories using the builder pattern for creating test data easily and consistently.

## Overview

Factories provide a clean, fluent API for creating test data with sensible defaults and easy customization.

## Usage

### Basic Usage

```typescript
import { postFactory, userFactory } from "~/tests/factories";

// Create a simple draft post
const post = postFactory.draft();

// Create a scheduled post
const scheduledPost = postFactory.scheduled("1704067200");

// Create a posted post
const postedPost = postFactory.posted();
```

### Builder Pattern

```typescript
import { PostFactory } from "~/tests/factories";

// Use builder for complex scenarios
const post = new PostFactory()
  .withCaption("My post")
  .withImages(["https://example.com/image.jpg"])
  .withQueueType("queue-123")
  .withTags(["tag1", "tag2"])
  .asScheduled("1704067200")
  .build();
```

### Convenience Functions

Each factory provides convenience functions for common scenarios:

```typescript
// Posts
postFactory.draft();
postFactory.scheduled(scheduledFor);
postFactory.posted();
postFactory.image(urls);
postFactory.video(url);
postFactory.text(content);
postFactory.recyclable();
postFactory.many(count);

// Longform Posts
longFormPostFactory.draft();
longFormPostFactory.scheduled(scheduledFor);
longFormPostFactory.published();
longFormPostFactory.many(count);

// Users
userFactory.basic();
userFactory.disabled();
userFactory.child(parentNpub);
userFactory.parent();
userFactory.withMutedUsers(npubs);
userFactory.many(count);

// Queue Types
queueTypeFactory.interval(intervalHours);
queueTypeFactory.fixedSlots(slots);
queueTypeFactory.default();
queueTypeFactory.many(count);

// Hashtag Presets
hashTagPresetFactory.basic();
hashTagPresetFactory.withTags(tags);
hashTagPresetFactory.many(count);

// Payments
paymentFactory.pending();
paymentFactory.paid();
paymentFactory.failed(failureReason);
paymentFactory.many(count);

// Templates
templateFactory.basic();
templateFactory.many(count);

// Assets
assetFactory.text();
assetFactory.image(fileUrl);
assetFactory.video(fileUrl);
assetFactory.many(count);
```

## Examples

### Creating Related Data

```typescript
import { userFactory, queueTypeFactory, postFactory } from "~/tests/factories";

// Create a user
const user = userFactory.basic({ id: "user-1", npub: "npub123" });

// Create a queue type for that user
const queue = queueTypeFactory.interval(4, { userId: user.id });

// Create posts in that queue
const posts = postFactory.many(3, {
  userId: user.id,
  queueTypeId: queue.id,
});
```

### Complex Scenarios

```typescript
import { PostFactory, UserFactory } from "~/tests/factories";

// Create a user with specific settings
const user = new UserFactory()
  .withTimezone("America/New_York")
  .withRelays(["wss://relay1.com", "wss://relay2.com"])
  .withHashTagsInPosts(true)
  .withMutedUsers(["muted-pubkey"])
  .build();

// Create a scheduled post with Nostr event
const post = new PostFactory()
  .withUserId(user.id)
  .withCaption("Scheduled post")
  .withImages(["https://example.com/image.jpg"])
  .withSignedEvent({ id: "event-123", kind: 1 })
  .withNostrEvent({ id: "event-123", content: "Post content" })
  .asScheduled(new Date(Date.now() + 3600000))
  .build();
```

### Bulk Creation

```typescript
import { postFactory } from "~/tests/factories";

// Create 10 draft posts
const drafts = postFactory.many(10, { draft: true });

// Create 5 scheduled posts
const scheduled = Array.from({ length: 5 }, (_, i) =>
  postFactory.scheduled(new Date(Date.now() + (i + 1) * 3600000).toISOString()),
);
```

## Benefits

1. **Consistency**: All test data uses the same structure
2. **Maintainability**: Update defaults in one place
3. **Readability**: Clear, fluent API
4. **Flexibility**: Easy to override any field
5. **Type Safety**: Full TypeScript support

## Best Practices

1. **Use Factories**: Always use factories instead of manually creating objects
2. **Override Only What's Needed**: Use defaults when possible
3. **Use Convenience Functions**: Prefer convenience functions for common cases
4. **Use Builders for Complex Cases**: Use builder pattern for complex scenarios
5. **Create Related Data Together**: Use factories to create related entities

## Adding New Factories

To add a new factory:

1. Create a new file in `tests/factories/`
2. Define the factory class with builder methods
3. Export convenience functions
4. Add to `tests/factories/index.ts`
5. Update this README

Example structure:

```typescript
export class MyEntityFactory {
  private options: MyEntityFactoryOptions;

  constructor(options = {}) {
    this.options = { /* defaults */, ...options };
  }

  withField(value: string): this {
    this.options.field = value;
    return this;
  }

  build(): MyEntity {
    return { /* build object */ } as MyEntity;
  }
}

export const myEntityFactory = {
  basic: (overrides?) => new MyEntityFactory(overrides).build(),
  many: (count, overrides?) => /* create many */,
};
```
