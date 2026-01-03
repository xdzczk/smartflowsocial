# Custom Integrations

**Estimated time:** 45 minutes  
**Difficulty:** Advanced  
**Last updated:** 2026-01-02

Learn how to build custom integrations with SmartFlowSocial, including webhooks, third-party services, and automation workflows.

---

## Prerequisites

- ✅ Account created and logged in
- ✅ Understanding of REST APIs
- ✅ Programming experience (JavaScript/TypeScript recommended)
- ✅ Completed [API Usage](./api-usage.md)
- ✅ Access to SmartFlowSocial API

---

## Overview

**Custom integrations allow you to:**

- Connect SmartFlowSocial to external services
- Automate posting workflows
- Build custom applications
- Integrate with third-party tools
- Create webhook handlers

---

## Integration Architecture

### Integration Points

**Available integration points:**

1. **REST API** - HTTP endpoints
2. **Nostr Protocol** - Native event publishing
3. **Session Authentication** - Cookie-based auth
4. **File Upload API** - Media uploads
5. **Queue API** - Schedule management

### Authentication

**Session-based authentication:**

```typescript
// Get session cookie from browser
const sessionCookie = document.cookie
  .split("; ")
  .find((row) => row.startsWith("session="))
  ?.split("=")[1];

// Use in API requests
const response = await fetch("/api/endpoint", {
  headers: {
    Cookie: `session=${sessionCookie}`,
  },
  credentials: "include",
});
```

---

## Integration 1: RSS Feed to Posts

### Overview

**Automatically post from RSS feeds:**

- Monitor RSS feeds
- Convert items to posts
- Schedule automatically
- Maintain consistency

### Implementation

```typescript
import { SmartFlowSocialClient } from "./client";
import Parser from "rss-parser";

const parser = new Parser();
const client = new SmartFlowSocialClient(
  process.env.SMARTFLOW_URL!,
  process.env.SESSION_COOKIE!,
);

async function rssToPosts(feedUrl: string) {
  // Parse RSS feed
  const feed = await parser.parseURL(feedUrl);

  // Process each item
  for (const item of feed.items) {
    // Create post content
    const content = `${item.title}\n\n${item.contentSnippet}\n\n${item.link}`;

    // Create Nostr event
    const event = {
      kind: 1,
      content,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["r", item.link]],
    };

    // Sign event (requires Nostr extension or private key)
    const signedEvent = await signEvent(event);

    // Publish via API
    await client.publishEvent(signedEvent, ["wss://relay.example.com"]);
  }
}

// Run on schedule
setInterval(
  () => {
    rssToPosts("https://example.com/feed.xml");
  },
  60 * 60 * 1000,
); // Every hour
```

---

## Integration 2: Twitter/X to Nostr Bridge

### Overview

**Bridge Twitter/X posts to Nostr:**

- Monitor Twitter account
- Convert tweets to Nostr posts
- Maintain original content
- Schedule automatically

### Implementation

```typescript
import { SmartFlowSocialClient } from "./client";
import TwitterApi from "twitter-api-v2";

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

const smartflowClient = new SmartFlowSocialClient(
  process.env.SMARTFLOW_URL!,
  process.env.SESSION_COOKIE!,
);

async function syncTwitterToNostr() {
  // Get recent tweets
  const tweets = await twitterClient.v2.userTimeline(
    process.env.TWITTER_USER_ID!,
    { max_results: 10 },
  );

  for (const tweet of tweets.data) {
    // Check if already posted
    if (await isAlreadyPosted(tweet.id)) continue;

    // Convert tweet to post
    const content = tweet.text;

    // Add media if present
    let postContent = content;
    if (tweet.attachments?.media_keys) {
      // Fetch media URLs and add to content
      const mediaUrls = await getMediaUrls(tweet.attachments.media_keys);
      postContent += "\n\n" + mediaUrls.join("\n");
    }

    // Create and publish Nostr event
    const event = {
      kind: 1,
      content: postContent,
      created_at: Math.floor(new Date(tweet.created_at).getTime() / 1000),
      tags: [["twitter", tweet.id]],
    };

    const signedEvent = await signEvent(event);
    await smartflowClient.publishEvent(signedEvent, [
      "wss://relay.example.com",
    ]);

    // Mark as posted
    await markAsPosted(tweet.id);
  }
}
```

---

## Integration 3: Webhook Handler

### Overview

**Receive webhooks and post to Nostr:**

- Set up webhook endpoint
- Receive external events
- Convert to Nostr posts
- Publish automatically

### Implementation

```typescript
import express from "express";
import { SmartFlowSocialClient } from "./client";

const app = express();
app.use(express.json());

const client = new SmartFlowSocialClient(
  process.env.SMARTFLOW_URL!,
  process.env.SESSION_COOKIE!,
);

// Webhook endpoint
app.post("/webhook/smartflow", async (req, res) => {
  try {
    const { event, data } = req.body;

    // Handle different event types
    switch (event) {
      case "post.created":
        await handlePostCreated(data);
        break;
      case "post.updated":
        await handlePostUpdated(data);
        break;
      default:
        console.log("Unknown event:", event);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

async function handlePostCreated(data: any) {
  // Convert webhook data to Nostr post
  const content = `${data.title}\n\n${data.content}`;

  const event = {
    kind: 1,
    content,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["source", "webhook"]],
  };

  const signedEvent = await signEvent(event);
  await client.publishEvent(signedEvent, ["wss://relay.example.com"]);
}

app.listen(3000, () => {
  console.log("Webhook server running on port 3000");
});
```

---

## Integration 4: Discord Bot Integration

### Overview

**Post Discord messages to Nostr:**

- Monitor Discord channels
- Convert messages to posts
- Filter by criteria
- Schedule automatically

### Implementation

```typescript
import { Client, GatewayIntentBits } from "discord.js";
import { SmartFlowSocialClient } from "./client";

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const smartflowClient = new SmartFlowSocialClient(
  process.env.SMARTFLOW_URL!,
  process.env.SESSION_COOKIE!,
);

discordClient.on("messageCreate", async (message) => {
  // Filter messages
  if (message.author.bot) return;
  if (!message.content.startsWith("!post")) return;

  // Extract content
  const content = message.content.slice(5).trim();

  // Get attachments
  let postContent = content;
  if (message.attachments.size > 0) {
    const attachment = message.attachments.first();
    // Upload to SmartFlowSocial
    const imageUrl = await uploadAttachment(attachment);
    postContent += `\n\n${imageUrl}`;
  }

  // Create and publish Nostr event
  const event = {
    kind: 1,
    content: postContent,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["source", "discord"]],
  };

  const signedEvent = await signEvent(event);
  await smartflowClient.publishEvent(signedEvent, ["wss://relay.example.com"]);

  await message.reply("Posted to Nostr!");
});

discordClient.login(process.env.DISCORD_TOKEN!);
```

---

## Integration 5: Zapier/IFTTT Integration

### Overview

**Connect Zapier/IFTTT to SmartFlowSocial:**

- Use webhook triggers
- Convert data to posts
- Schedule automatically
- Maintain consistency

### Zapier Integration

```typescript
// Zapier webhook receives data
app.post("/zapier-webhook", express.json(), async (req, res) => {
  const { value1, value2, value3 } = req.body;

  // value1 = content
  // value2 = image URL (optional)
  // value3 = hashtags (optional)

  const client = new SmartFlowSocialClient(
    process.env.SMARTFLOW_URL!,
    process.env.SESSION_COOKIE!,
  );

  // Build post content
  let content = value1 || "";
  if (value2) content += `\n\n${value2}`;
  if (value3) content += `\n\n${value3}`;

  // Publish
  const event = {
    kind: 1,
    content,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
  };

  const signedEvent = await signEvent(event);
  await client.publishEvent(signedEvent, ["wss://relay.example.com"]);

  res.json({ success: true });
});
```

---

## Integration 6: Scheduled Content Pipeline

### Overview

**Automated content pipeline:**

- Fetch content from multiple sources
- Process and format
- Schedule automatically
- Maintain queue balance

### Implementation

```typescript
import { SmartFlowSocialClient } from "./client";
import { Queue } from "bullmq";

const client = new SmartFlowSocialClient(
  process.env.SMARTFLOW_URL!,
  process.env.SESSION_COOKIE!,
);

const contentQueue = new Queue("content-processing");

// Add jobs to queue
async function addContentToQueue(source: string, content: any) {
  await contentQueue.add("process-content", {
    source,
    content,
    timestamp: Date.now(),
  });
}

// Process queue jobs
contentQueue.process("process-content", async (job) => {
  const { source, content } = job.data;

  // Process based on source
  let postContent = "";
  switch (source) {
    case "rss":
      postContent = formatRSSItem(content);
      break;
    case "api":
      postContent = formatAPIResponse(content);
      break;
    case "file":
      postContent = formatFileContent(content);
      break;
  }

  // Get queue schedule time
  const schedule = await client.getQueueSchedule("Content Queue");

  // Create and schedule post
  const event = {
    kind: 1,
    content: postContent,
    created_at: Math.floor(
      new Date(schedule.nextScheduleTime).getTime() / 1000,
    ),
    tags: [["source", source]],
  };

  const signedEvent = await signEvent(event);
  await client.publishEvent(signedEvent, ["wss://relay.example.com"]);
});
```

---

## Best Practices

### Error Handling

**Robust error handling:**

```typescript
async function safeIntegrationCall(fn: () => Promise<any>, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, i)),
      );
    }
  }
}
```

### Rate Limiting

**Respect rate limits:**

```typescript
import pLimit from "p-limit";

const limit = pLimit(5); // Max 5 concurrent requests

const requests = items.map((item) => limit(() => processItem(item)));

await Promise.all(requests);
```

### Logging

**Comprehensive logging:**

```typescript
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: "integration.log" })],
});

logger.info("Integration started", { source, itemCount });
```

---

## Security Considerations

### API Keys

**Secure storage:**

- Use environment variables
- Never commit keys
- Rotate regularly
- Use secrets management

### Authentication

**Session management:**

- Secure session cookies
- Implement token refresh
- Handle expiration
- Validate sessions

### Data Validation

**Input validation:**

- Validate all inputs
- Sanitize content
- Check file types
- Limit sizes

---

## Troubleshooting

### API Errors

**Problem:** API calls failing

**Solutions:**

- Check authentication
- Verify endpoints
- Review error messages
- Check rate limits
- Validate request format

### Integration Failures

**Problem:** Integration not working

**Solutions:**

- Check logs
- Verify configuration
- Test endpoints individually
- Review error handling
- Check dependencies

---

## What You Learned

✅ How to build custom integrations  
✅ How to use the API for automation  
✅ How to handle webhooks  
✅ How to integrate with third-party services  
✅ Security best practices

---

## Next Steps

1. **[API Usage](./api-usage.md)** - Deep dive into API
2. **[Advanced Queue Management](./advanced-queue-management.md)** - Master queues
3. **[Performance Optimization](./performance-optimization.md)** - Scale efficiently

---

## Related Documentation

- [Integration Examples](../../examples/integrations.md) - More examples
- [API Reference](../../reference/api.md) - Complete API docs
- [Developer Guide](../../guides/developer-guide.md) - Development workflow

---

**Next Tutorial:** [API Usage](./api-usage.md) → Deep dive into the API


