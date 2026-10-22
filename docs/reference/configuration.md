# Configuration Reference

**Last updated:** 2026-04-11

Complete reference for all environment variables and configuration options in SmartFlowSocial.

---

## Table of Contents

- [Required Variables](#required-variables)
- [Optional Variables](#optional-variables)
- [Storage Configuration](#storage-configuration)
- [External Services](#external-services)
- [Development Settings](#development-settings)
- [Production Settings](#production-settings)
- [Validation](#validation)

---

## Required Variables

These variables must be set for SmartFlowSocial to run.

### DATABASE_URL

PostgreSQL connection string.

**Format:**

```
postgresql://[user]:[password]@[host]:[port]/[database]?schema=[schema]
```

**Examples:**

```env
# Local development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow?schema=public

# Docker
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow

# Managed service (Supabase)
DATABASE_URL=postgresql://user:password@db.xxx.supabase.co:5432/postgres

# With SSL
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
```

**Validation:**

- Must be a valid PostgreSQL connection string
- Database must exist
- User must have CREATE, SELECT, INSERT, UPDATE, DELETE permissions

---

### SESSION_SECRET

Random secret for encrypting session cookies.

**Generate:**

```bash
openssl rand -base64 32
```

**Example:**

```env
SESSION_SECRET=your-random-32-character-secret-string-here
```

**Security:**

- Must be at least 32 characters
- Use a cryptographically secure random generator
- Never commit to version control
- Rotate every 90 days in production

---

### NOSTR_PUBLISHER_URL

URL to your HTTP Nostr Publisher service.

**Format:**

```
https://your-publisher.example.com
```

**Example:**

```env
NOSTR_PUBLISHER_URL=https://publisher.example.com
```

**Required for:**

- Publishing posts to Nostr relays
- Signing events server-side (when needed)

**Setup:**

1. Deploy [HTTP Nostr Publisher](https://github.com/getAlby/http-nostr-publisher)
2. Configure with your Nostr private key
3. Set this variable to the service URL

---

### REDIS_URL

Redis connection string for BullMQ job queues.

**Format:**

```
redis://[password@][host]:[port]/[database]
```

**Examples:**

```env
# Local development
REDIS_URL=redis://localhost:6379

# With password
REDIS_URL=redis://:password@localhost:6379

# With database number
REDIS_URL=redis://localhost:6379/0

# Managed service (Upstash)
REDIS_URL=rediss://default:password@xxx.upstash.io:6379
```

**Required for:**

- Scheduled post processing
- Background job queue
- Worker process functionality

---

### Storage Variables

S3-compatible storage configuration for image uploads.

#### STORAGE_ACCESS_KEY

Storage service access key.

```env
STORAGE_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
```

#### STORAGE_SECRET

Storage service secret key.

```env
STORAGE_SECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

#### STORAGE_REGION

Storage service region.

```env
# AWS S3
STORAGE_REGION=us-east-1

# Cloudflare R2
STORAGE_REGION=auto

# MinIO
STORAGE_REGION=us-east-1
```

#### STORAGE_BUCKET

Storage bucket name.

```env
STORAGE_BUCKET=my-smartflow-bucket
```

#### STORAGE_CDN_URL

Optional public CDN/domain base used for generated S3 media URLs. When set, uploaded file URLs are
returned as `${STORAGE_CDN_URL}/{object-key}` instead of the raw `*.s3.*.amazonaws.com` host.

```env
STORAGE_CDN_URL=https://cdn.smartflow.social
```

Notes:

- Do not include a trailing slash (it is tolerated, but normalized).
- This domain must publicly serve the same bucket/object keys.
- Use HTTPS for Nostr/media client compatibility.

**See [Storage Configuration](#storage-configuration) for provider-specific setup.**

---

## Optional Variables

### NODE_ENV

Application environment mode.

**Values:**

- `development` - Development mode (default)
- `production` - Production mode
- `test` - Test mode

**Example:**

```env
NODE_ENV=production
```

**Effects:**

- Development: Debug logging, hot reload
- Production: Optimized builds, error tracking
- Test: Test database, mock services

---

### PRIMAL_CACHING_URL

Primal caching service URL for profile and event lookups. Two formats are supported.

**1. HTTP(S) proxy (e.g. Cloudflare Worker)**  
Use when you run a proxy that accepts POST with `{ requestType, params }` and returns the same array
format as the WebSocket API:

```env
PRIMAL_CACHING_URL=https://primal-caching-websocket-worker.your-domain.workers.dev
```

**2. WebSocket (direct cache)**  
Single endpoint or comma-separated list:

```env
PRIMAL_CACHING_URL=wss://cache.example.com/v1
PRIMAL_CACHING_URL=wss://cache1.example.com/v1,wss://cache2.example.com/v1
```

**Default:** If not set, uses public Primal cache endpoints:

- `wss://cache1.primal.net/v1`
- `wss://cache2.primal.net/v1`

**Used for:**

- Profile lookups (pfp, display names)
- Event fetching
- Thread views
- Engagement feed

---

### NOSTR_NSEC

Nostr secret key for server-side event signing and DMs.

**Format:**

```
nsec1...
```

**Example:**

```env
NOSTR_NSEC=nsec1abc123...
```

**Security Warning:**

- ⚠️ Keep this secret! Never commit to version control
- Store in secure secret management service
- Rotate if compromised

**Required for:**

- Sending subscription-related DMs
- Server-side event signing (when user extension unavailable)

---

### NOSTR_DM_NIP17_ENABLED

When **true** (default), the server attempts **NIP-17** private DMs (gift-wrapped kind `1059`) for
recipients who publish **kind `10050`** inbox relay lists. **NIP-04** (kind `4`) is always published
afterward for legacy clients.

Set to `false` to disable only the NIP-17 leg (NIP-04 remains).

**Example:**

```env
NOSTR_DM_NIP17_ENABLED=true
```

---

### FEEDBACK_INBOX_NPUB

**npub** (or hex pubkey) of the Nostr inbox that receives **Report a bug / Suggest a feature**
submissions from the dashboard sidebar. The user’s client **encrypts (NIP-04) and signs (kind 4)**
with their active identity - **NIP-07** (`window.nostr.nip04`) or **NIP-46** (`nip04_encrypt` on the
remote signer). The server only validates and **publishes** (`/api/feedback-dm`); no `NOSTR_NSEC` is
used for feedback. If **`NOSTR_DM_NIP17_ENABLED`** is on and this inbox has **kind `10050`** inbox
relays, clients may also submit two **NIP-17 gift wraps** using **NIP-44** via **`nip44_encrypt`**
(remote) or `window.nostr.nip44.encrypt` (extension).

When unset or invalid, the sidebar feedback control is hidden.

**Example:**

```env
FEEDBACK_INBOX_NPUB=npub1...
```

---

### OWNER_NWC

Nostr Wallet Connect string for receiving subscription payments.

**Format:**

```
nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=...
```

**Example:**

```env
OWNER_NWC=nostr+walletconnect://npub1...?relay=wss://relay.example.com&secret=...
```

**How to get:**

1. Use a Lightning wallet supporting NWC (Alby, Mutiny, etc.)
2. Generate connection string from wallet
3. Set as this environment variable

**Required for:**

- Accepting Lightning payments
- Subscription management
- **Referral payouts** (operator UI at `/dashboard/admin` and `cron.referral-payout`)

---

### ADMIN_NPUBS

Comma-separated list of operator **npubs** allowed to access the admin area under `/dashboard/admin`
(Overview, Analytics, Users, Operations, Referrals). Legacy URL `/dashboard/admin/earnings`
redirects to Referrals.

**Example:**

```env
ADMIN_NPUBS=npub1abc...,npub1def...
```

If unset or empty, no accounts have admin access.

Comparison accepts **either** bech32 `npub1…` **or** 64-character **hex** pubkeys, and normalizes
them to the same form. That matches how login works: Nostr auth v2 stores **`User.npub` as hex**,
while wallets usually show **`npub1…`** - you can paste either into `ADMIN_NPUBS`. Stray zero-width
characters are stripped. Watch **capital `I` vs lowercase `l`** when pasting bech32.

---

### REFERRAL_MANUAL_PAYOUT_SECRET

Optional secret for `POST /api/referral/manual-payout` (JSON body with `referrer_npub`, `bolt11`,
`amount_sats`). When unset, the route does not require a header check (avoid in production unless
the endpoint is otherwise protected).

The signed-in operator UI at `/dashboard/admin` does **not** use this secret; it relies on
`ADMIN_NPUBS` and session auth.

---

### SUBSCRIPTION_RENEWAL_INTERVAL_MINUTES

How often, in minutes, the worker renews NWC auto-renew subscriptions. Default `60`. Set to `0` to
turn the worker sweep off.

Renewals do not depend on an outside cron. `GET` or `POST /cron/checksubscription` runs the same
sweep when you want to trigger it by hand.

---

### CRON_SECRET

Optional secret for `GET` or `POST /cron/checksubscription`. Send it as `X-Cron-Secret` or
`Authorization: Bearer <secret>`. When unset, the route does not check a header (set this in
production).

---

### APP_URL

Canonical application URL. Used for CSRF origin validation and links in emails/push.

**Format:** Full URL including scheme, no trailing slash.

**Example:**

```env
APP_URL=http://localhost:3000
APP_URL=https://smartflow.social
```

**Default:** Not set (some features may fall back to request host).

**Required for:**

- CSRF protection (origin check)
- Web Push VAPID subject when `VAPID_SUBJECT` is not set

---

### ALLOWED_ORIGINS

Comma-separated list of allowed origins for CSRF protection. Use when the app is accessed from
multiple domains (e.g. main domain + www).

**Example:**

```env
ALLOWED_ORIGINS=https://smartflow.social,https://www.smartflow.social
```

**Default:** If not set, only the same origin as the request is allowed.

---

### NOSTR_AUTH_V2_ENABLED

Enable server-issued Nostr login (challenge/verify flow). When enabled, the app exposes
`POST /auth/nostr/challenge` and `POST /auth/nostr/verify`.

**Values:** `true` | `false`

**Example:**

```env
NOSTR_AUTH_V2_ENABLED=true
```

**Default:** `true`

---

### MEDIA_PIPELINE_V2_ENABLED

Enable the unified media intent/commit pipeline (`/api/media/intents`, `/api/media/commit`).

**Values:** `true` | `false`

**Example:**

```env
MEDIA_PIPELINE_V2_ENABLED=true
```

---

### ENFORCE_NOSTR_SESSION_PUBKEY

Enforce that every signed Nostr event’s pubkey matches the active session pubkey. Prevents using one
session to sign as another identity.

**Values:** `true` | `false`

**Example:**

```env
ENFORCE_NOSTR_SESSION_PUBKEY=true
```

**Default:** `true`

---

### VAPID_PUBLIC_KEY

Public key for Web Push (VAPID). Required for browser push notifications.

**How to generate:**

```bash
npx web-push generate-vapid-keys
```

**Example:**

```env
VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiHIa-I0...
```

**Required for:** Push notifications (optional feature).

---

### VAPID_PRIVATE_KEY

Private key for Web Push (VAPID). Keep secret.

**Example:**

```env
VAPID_PRIVATE_KEY=...
```

**Security:** Never commit to version control. Store in secret manager.

---

### VAPID_SUBJECT

Subject for Web Push (mailto or URL). Shown to users in push subscription UI.

**Example:**

```env
VAPID_SUBJECT=mailto:admin@smartflow.social
VAPID_SUBJECT=https://smartflow.social
```

**Default:** Falls back to `APP_URL` or a default mailto if unset.

---

### TEST_DATABASE_URL

Test database connection string (optional).

**Format:**

```
postgresql://user:password@host:port/testdb
```

**Example:**

```env
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow_test
```

**Default:** If not set, uses `DATABASE_URL` for tests.

**Use case:**

- Separate test database
- Avoid polluting development data

---

### SENTRY_DSN

Sentry error tracking DSN (optional).

**Format:**

```
https://xxx@xxx.ingest.sentry.io/xxx
```

**Example:**

```env
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456
```

**How to get:**

1. Create project at [sentry.io](https://sentry.io)
2. Get DSN from project settings
3. Set as this environment variable

**Required for:**

- Error tracking
- Performance monitoring
- Release tracking

---

### SENTRY_TRACES_SAMPLE_RATE

Sentry performance tracing sample rate.

**Format:** Number between 0 and 1 (inclusive).

**Example:**

```env
SENTRY_TRACES_SAMPLE_RATE=0.1
```

---

### SENTRY_PROFILES_SAMPLE_RATE

Sentry profiling sample rate.

**Format:** Number between 0 and 1 (inclusive).

**Example:**

```env
SENTRY_PROFILES_SAMPLE_RATE=0.05
```

---

### METRICS_PORT

Port for the web process Prometheus endpoint (`GET /metrics`).

**Example:**

```env
METRICS_PORT=3010
```

---

### WORKER_METRICS_PORT

Port for the worker process Prometheus endpoint (`GET /metrics`).

**Example:**

```env
WORKER_METRICS_PORT=3011
```

---

### METRICS_TOKEN

Optional token to protect Prometheus endpoints.

---

### METRICS_ALLOWED_IPS

Optional allowlist of source IPs that can access Prometheus endpoints.

---

### BLOSSOM_INTERNAL_SECRET

Optional secret for the internal subscription-status endpoint used by a Blossom server (vibe-cdn).
When set, Blossom can call `GET /internal/subscription-status?pubkey=<hex>` with header
`x-internal-secret` to check if a user is allowed to upload; inactive users receive 403 from
Blossom. Set the same value as `SFS_INTERNAL_SECRET` on the Blossom server.

**Example:**

```env
BLOSSOM_INTERNAL_SECRET=your-shared-secret-with-blossom-server
```

---

### BLOSSOM_SFS_API_URL

Optional base URL for SmartFlow Blossom API operations performed by the app server (for example,
deleting remote files from R2 when deleting media records in Settings). Defaults to
`https://blossom-api.smartflow.social`.

**Example:**

```env
BLOSSOM_SFS_API_URL=https://blossom-api.smartflow.social
```

---

### BLOSSOM_UPLOAD_TOKEN_SECRET

Optional secret used to sign Blossom v2 upload tokens issued by `POST /api/blossom/tokens`. If
omitted, SmartFlow falls back to `BLOSSOM_INTERNAL_SECRET` for signing.

Set this to the same value as `SFS_UPLOAD_TOKEN_SECRET` (or fallback `SFS_INTERNAL_SECRET`) on the
Blossom gateway so token verification succeeds.

**Example:**

```env
BLOSSOM_UPLOAD_TOKEN_SECRET=your-upload-token-signing-secret
```

---

### ENABLE_NOSTR_DELETE_EVENTS

Feature flag for asynchronous Nostr deletion requests (`kind:5`) when users delete published
posts/longform content.

When enabled, local delete still completes immediately, and relay delete requests are emitted
through the outbox worker in best-effort mode.

```env
ENABLE_NOSTR_DELETE_EVENTS=false
```

Recommended rollout:

1. Start with `false` in production.
2. Enable in staging and monitor outbox dead-letter / relay ACK outcomes.
3. Enable in production once relay error rates are acceptable.

---

### NIP88_POLLS_ENABLED

When `true`, enables NIP-88 **polls** in the product: poll composer on **New post**,
`PostType.POLL`, kind **`1068`** publish/schedule, vote submission (**`1018`**) through
`/api/publish` with merged execution + poll relays, and in-app tally subscriptions.

Defaults to **off**; safe for production until you intentionally roll out.

```env
NIP88_POLLS_ENABLED=true
```

**Related:** [Nostr reference - NIP-88](./nostr.md#nip-88-polls-kind-1068--1018)

---

### CONTESTS_V1_ENABLED

When `true`, enables Contests v1 UI/routes under `/dashboard/contests`.

```env
CONTESTS_V1_ENABLED=true
```

---

### SUBSCRIPTION_CHECKOUT_V2_ENABLED

When `true`, enables dual-lane subscription checkout flows.

```env
SUBSCRIPTION_CHECKOUT_V2_ENABLED=true
```

---

### BTCPAY_URL

Base URL for BTCPay Server Greenfield API.

```env
BTCPAY_URL=https://btcpay.yourdomain.com
```

---

### BTCPAY_API_KEY

Greenfield API key used by SmartFlowSocial to create/query BTCPay resources.

```env
BTCPAY_API_KEY=your-btcpay-greenfield-api-key
```

---

### BTCPAY_STORE_ID

BTCPay Store ID associated with your checkout/invoice flows.

```env
BTCPAY_STORE_ID=your-store-id
```

---

### BTCPAY_WEBHOOK_SECRET

Secret used to verify signatures for `POST /api/btcpay/webhook`.

```env
BTCPAY_WEBHOOK_SECRET=your-webhook-secret
```

---

## Storage Configuration

### AWS S3

```env
STORAGE_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
STORAGE_SECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
STORAGE_REGION=us-east-1
STORAGE_BUCKET=my-smartflow-bucket
STORAGE_CDN_URL=https://cdn.smartflow.social
```

**Setup:**

1. Create S3 bucket in AWS Console
2. Create IAM user with S3 access
3. Generate access keys
4. Configure bucket CORS if needed

**CORS Configuration:**

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

---

### Cloudflare R2

```env
STORAGE_ACCESS_KEY=your-r2-access-key
STORAGE_SECRET=your-r2-secret-key
STORAGE_REGION=auto
STORAGE_BUCKET=your-bucket-name
```

**Setup:**

1. Create R2 bucket in Cloudflare Dashboard
2. Create API token
3. Use `auto` for region

---

### MinIO (Self-Hosted)

```env
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET=minioadmin
STORAGE_REGION=us-east-1
STORAGE_BUCKET=smartflow
```

**Docker Setup:**

```bash
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

---

## External Services

### HTTP Nostr Publisher

**Required:** Yes  
**Purpose:** Sign and publish Nostr events

**Deploy:**

- [HTTP Nostr Publisher](https://github.com/getAlby/http-nostr-publisher)

**Configuration:**

```env
NOSTR_PUBLISHER_URL=https://publisher.example.com
```

---

### Primal Caching Service

**Required:** No (uses public endpoints if not set)  
**Purpose:** Profile and event lookups

**Deploy:**

- [Primal Caching Service](https://github.com/PrimalHQ/primal-caching-service)

**Configuration:**

```env
PRIMAL_CACHING_URL=wss://cache.example.com/v1
```

---

## Development Settings

### Recommended Development Configuration

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow

# Session
SESSION_SECRET=dev-secret-change-in-production

# Nostr Publisher
NOSTR_PUBLISHER_URL=http://localhost:8080

# Redis
REDIS_URL=redis://localhost:6379

# Storage (MinIO for local dev)
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET=minioadmin
STORAGE_REGION=us-east-1
STORAGE_BUCKET=smartflow

# Environment
NODE_ENV=development
```

---

## Production Settings

### Recommended Production Configuration

```env
# Database (managed service)
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require

# Session (strong secret)
SESSION_SECRET=<generated-with-openssl-rand-base64-32>

# Nostr Publisher
NOSTR_PUBLISHER_URL=https://publisher.example.com

# Redis (managed service)
REDIS_URL=rediss://default:password@xxx.upstash.io:6379

# Storage (production service)
STORAGE_ACCESS_KEY=<production-key>
STORAGE_SECRET=<production-secret>
STORAGE_REGION=us-east-1
STORAGE_BUCKET=smartflow-prod

# Primal Cache (optional, self-hosted)
PRIMAL_CACHING_URL=wss://cache.example.com/v1

# Payments
OWNER_NWC=nostr+walletconnect://...

# Server signing (optional)
NOSTR_NSEC=nsec1...

# Error tracking
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Environment
NODE_ENV=production
```

**Security Checklist:**

- ✅ Strong `SESSION_SECRET` (32+ characters)
- ✅ SSL/TLS for all connections
- ✅ Secure secret management (not in code)
- ✅ Regular secret rotation
- ✅ Environment-specific values

---

## Validation

### Validate Configuration

Create a validation script:

```javascript
// scripts/validate-env.js
const required = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "NOSTR_PUBLISHER_URL",
  "REDIS_URL",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET",
  "STORAGE_REGION",
  "STORAGE_BUCKET",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("❌ Missing required environment variables:");
  missing.forEach((key) => console.error(`  - ${key}`));
  process.exit(1);
}

console.log("✅ All required environment variables are set");
```

**Run:**

```bash
node scripts/validate-env.js
```

---

## Related Documentation

- [Installation Guide](../getting-started/installation.md) - Setup instructions
- [Deployment Guide](../guides/deployment.md) - Production deployment
- [Security Guide](../guides/security.md) - Security best practices
- [Troubleshooting](../troubleshooting/common-issues.md) - Common issues

---

**Next:** [Installation Guide](../getting-started/installation.md) → Set up your environment
