# Integration Examples

**Last updated:** 2025-03-12

Complete examples for integrating SmartFlowSocial with external services, custom applications, and
automation tools.

---

## Table of Contents

- [Overview](#overview)
- [API Integration](#api-integration)
- [Webhook Integration](#webhook-integration)
- [Nostr Client Integration](#nostr-client-integration)
- [Automation Examples](#automation-examples)
- [Custom Integrations](#custom-integrations)

---

## Overview

SmartFlowSocial provides several integration points:

- **REST API** - HTTP endpoints for programmatic access
- **Nostr Protocol** - Native Nostr event publishing
- **Webhooks** - Event notifications (if implemented)
- **OAuth/SSO** - Nostr-based authentication

---

## API Integration

### Basic API Client

**TypeScript/JavaScript Example:**

```typescript
class SmartFlowSocialClient {
  private baseUrl: string;
  private sessionCookie: string;

  constructor(baseUrl: string, sessionCookie: string) {
    this.baseUrl = baseUrl;
    this.sessionCookie = sessionCookie;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}/api/${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Cookie: this.sessionCookie,
        ...options.headers,
      },
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Request failed");
    }

    return await response.json();
  }

  async publishEvent(event: any, relays: string[]) {
    return this.request("publish", {
      method: "POST",
      body: JSON.stringify({ event, relays }),
    });
  }

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: "POST",
      headers: {
        Cookie: this.sessionCookie,
      },
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const result = await response.json();
    return result.data.fileUrl;
  }

  async getEffectiveHashtags(queueTypeName: string, queueTypeId?: string) {
    return this.request("effective-hashtags", {
      method: "POST",
      body: JSON.stringify({ queueTypeName, queueTypeId }),
    });
  }

  async getQueueSchedule(queueTypeName: string, queueTypeId?: string) {
    return this.request("queue-schedule", {
      method: "POST",
      body: JSON.stringify({ queueTypeName, queueTypeId }),
    });
  }
}

// Usage
const client = new SmartFlowSocialClient("https://your-domain.com", "session=your-session-cookie");

// Upload an image
const file = new File(["..."], "image.jpg", { type: "image/jpeg" });
const imageUrl = await client.uploadFile(file);

// Get effective hashtags for a queue
const hashtags = await client.getEffectiveHashtags("Bitcoin News");
console.log(hashtags.effectiveHashtags);
```

### Python Example

```python
import requests
from typing import Optional, Dict, Any

class SmartFlowSocialClient:
    def __init__(self, base_url: str, session_cookie: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.cookies.set('session', session_cookie)
        self.session.headers.update({
            'Content-Type': 'application/json'
        })

    def request(self, endpoint: str, method: str = 'GET',
                data: Optional[Dict] = None) -> Dict[str, Any]:
        url = f"{self.base_url}/api/{endpoint}"
        response = self.session.request(method, url, json=data)
        response.raise_for_status()
        return response.json()

    def upload_file(self, file_path: str) -> str:
        url = f"{self.base_url}/api/upload"
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = self.session.post(url, files=files)
            response.raise_for_status()
            result = response.json()
            return result['data']['fileUrl']

    def publish_event(self, event: Dict, relays: list) -> Dict:
        return self.request('publish', 'POST', {
            'event': event,
            'relays': relays
        })

    def get_effective_hashtags(self, queue_type_name: str,
                              queue_type_id: Optional[str] = None) -> Dict:
        return self.request('effective-hashtags', 'POST', {
            'queueTypeName': queue_type_name,
            'queueTypeId': queue_type_id
        })

# Usage
client = SmartFlowSocialClient(
    'https://your-domain.com',
    'your-session-cookie'
)

# Upload an image
image_url = client.upload_file('image.jpg')
print(f"Uploaded: {image_url}")

# Get hashtags
hashtags = client.get_effective_hashtags('Bitcoin News')
print(f"Hashtags: {hashtags['effectiveHashtags']}")
```

---

## Webhook Integration

### Setting Up Webhooks

**Note:** Webhooks may need to be implemented in your deployment. This is a template for how they
would work.

```typescript
// Webhook payload structure
interface WebhookPayload {
  event: "post.published" | "post.scheduled" | "post.failed";
  timestamp: string;
  data: {
    postId: string;
    eventId?: string;
    content: string;
    scheduledFor?: string;
    error?: string;
  };
}

// Webhook handler example
async function handleWebhook(payload: WebhookPayload) {
  switch (payload.event) {
    case "post.published":
      console.log("Post published:", payload.data.eventId);
      // Send notification, update external system, etc.
      break;

    case "post.scheduled":
      console.log("Post scheduled:", payload.data.scheduledFor);
      // Log to analytics, update calendar, etc.
      break;

    case "post.failed":
      console.error("Post failed:", payload.data.error);
      // Send alert, retry logic, etc.
      break;
  }
}

// Express.js webhook endpoint
app.post("/webhook", express.json(), async (req, res) => {
  const payload = req.body as WebhookPayload;
  await handleWebhook(payload);
  res.status(200).send("OK");
});
```

---

## Nostr Client Integration

### Publishing via Nostr Client

**Using nostr-tools:**

```typescript
import { finalizeEvent, getPublicKey } from "nostr-tools";
import { SmartFlowSocialClient } from "./client";

async function publishToSmartFlowSocial(privateKey: string, content: string, relays: string[]) {
  // Create Nostr event
  const event = {
    kind: 1,
    content,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
  };

  // Sign event
  const signedEvent = finalizeEvent(event, privateKey);

  // Publish via SmartFlowSocial API
  const client = new SmartFlowSocialClient("https://your-domain.com", "session-cookie");

  return await client.publishEvent(signedEvent, relays);
}

// Usage
const privateKey = "your-hex-private-key";
const content = "Hello from SmartFlowSocial!";
const relays = ["wss://relay.example.com"];

await publishToSmartFlowSocial(privateKey, content, relays);
```

### Reading from Nostr

**Using nostr-tools to read events:**

```typescript
import { SimplePool } from "nostr-tools";

async function readUserPosts(pubkey: string, relays: string[]) {
  const pool = new SimplePool();

  const events = await pool.list(relays, [
    {
      kinds: [1],
      authors: [pubkey],
      limit: 10,
    },
  ]);

  return events;
}

// Usage
const pubkey = "user-pubkey";
const relays = ["wss://relay.example.com"];
const posts = await readUserPosts(pubkey, relays);
```

---

## Automation Examples

### Automated Posting Script

**Node.js script for automated posting:**

```typescript
import { SmartFlowSocialClient } from "./client";
import { finalizeEvent } from "nostr-tools";

async function automatedPosting() {
  const client = new SmartFlowSocialClient(process.env.SMARTFLOW_URL!, process.env.SESSION_COOKIE!);

  const privateKey = process.env.NOSTR_PRIVATE_KEY!;
  const relays = process.env.RELAYS!.split(",");

  // Get content from external source (RSS, API, etc.)
  const content = await fetchContentFromSource();

  // Create and sign event
  const event = {
    kind: 1,
    content,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["t", "automated"]],
  };

  const signedEvent = finalizeEvent(event, privateKey);

  // Publish
  await client.publishEvent(signedEvent, relays);
  console.log("Posted:", signedEvent.id);
}

// Run on schedule (using node-cron)
import cron from "node-cron";

cron.schedule("0 9 * * *", async () => {
  await automatedPosting();
});
```

### Bulk Upload Automation

```typescript
import { SmartFlowSocialClient } from "./client";
import * as fs from "fs";
import * as path from "path";

async function bulkUploadImages(directory: string) {
  const client = new SmartFlowSocialClient(process.env.SMARTFLOW_URL!, process.env.SESSION_COOKIE!);

  const files = fs.readdirSync(directory).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));

  const uploads = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(directory, file);
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer]);
      const fileObj = new File([blob], file, { type: "image/jpeg" });

      return await client.uploadFile(fileObj);
    })
  );

  console.log(`Uploaded ${uploads.length} images`);
  return uploads;
}
```

---

## Custom Integrations

### Zapier Integration

**Zapier webhook example:**

```typescript
// Zapier webhook receives data and posts to SmartFlowSocial
app.post("/zapier-webhook", express.json(), async (req, res) => {
  const { content, imageUrl, hashtags } = req.body;

  const client = new SmartFlowSocialClient(process.env.SMARTFLOW_URL!, process.env.SESSION_COOKIE!);

  // Create post content
  let postContent = content;
  if (imageUrl) {
    postContent += `\n\n${imageUrl}`;
  }
  if (hashtags) {
    postContent += `\n\n${hashtags}`;
  }

  // Sign and publish
  const event = {
    kind: 1,
    content: postContent,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
  };

  const signedEvent = finalizeEvent(event, process.env.NOSTR_PRIVATE_KEY!);

  await client.publishEvent(signedEvent, process.env.RELAYS!.split(","));

  res.json({ success: true });
});
```

### IFTTT Integration

**IFTTT webhook example:**

```typescript
app.post("/ifttt-webhook", express.json(), async (req, res) => {
  const { value1, value2, value3 } = req.body;

  // value1 = content
  // value2 = image URL (optional)
  // value3 = hashtags (optional)

  const client = new SmartFlowSocialClient(process.env.SMARTFLOW_URL!, process.env.SESSION_COOKIE!);

  // Build post content
  let content = value1 || "";
  if (value2) content += `\n\n${value2}`;
  if (value3) content += `\n\n${value3}`;

  // Publish (similar to Zapier example above)
  // ...

  res.json({ success: true });
});
```

### Discord Bot Integration

```typescript
import { Client, GatewayIntentBits } from "discord.js";
import { SmartFlowSocialClient } from "./client";

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const smartflowClient = new SmartFlowSocialClient(
  process.env.SMARTFLOW_URL!,
  process.env.SESSION_COOKIE!
);

discordClient.on("messageCreate", async (message) => {
  if (message.content.startsWith("!post")) {
    const content = message.content.slice(5).trim();

    // Get image if attached
    let imageUrl = null;
    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      // Download and upload to SmartFlowSocial
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const file = new File([blob], attachment.name!);
      imageUrl = await smartflowClient.uploadFile(file);
    }

    // Create post
    let postContent = content;
    if (imageUrl) {
      postContent += `\n\n${imageUrl}`;
    }

    // Publish (similar to previous examples)
    // ...

    await message.reply("Posted to Nostr!");
  }
});

discordClient.login(process.env.DISCORD_TOKEN!);
```

---

## Error Handling

**Robust error handling example:**

```typescript
async function safeApiCall<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
}

// Usage
const result = await safeApiCall(async () => {
  return await client.publishEvent(event, relays);
});
```

---

## Related Documentation

- [API Reference](../reference/api.md) - Complete API documentation
- [Nostr Integration](../reference/nostr.md) - Nostr protocol details
- [Configuration Reference](../reference/configuration.md) - Environment setup

---

**Next:** [Code Samples](./code-samples.md) → More code examples
