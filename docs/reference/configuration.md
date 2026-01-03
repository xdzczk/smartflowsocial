# Configuration Reference

**Last updated:** 2026-01-02

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

Primal caching service WebSocket URL(s) for profile and event lookups.

**Format:**

```
wss://cache.example.com/v1
```

**Single endpoint:**

```env
PRIMAL_CACHING_URL=wss://cache.example.com/v1
```

**Multiple endpoints (comma-separated):**

```env
PRIMAL_CACHING_URL=wss://cache1.example.com/v1,wss://cache2.example.com/v1
```

**Default:**
If not set, uses public Primal cache endpoints:

- `wss://cache1.primal.net/v1`
- `wss://cache2.primal.net/v1`

**Required for:**

- Profile lookups
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

**Default:**
If not set, uses `DATABASE_URL` for tests.

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

## Storage Configuration

### AWS S3

```env
STORAGE_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
STORAGE_SECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
STORAGE_REGION=us-east-1
STORAGE_BUCKET=my-smartflow-bucket
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

