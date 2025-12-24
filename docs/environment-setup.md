# Environment Setup

This guide explains all environment variables required to run SmartFlowSocial.

## Quick Start

```bash
cp example.env .env
```

Then edit `.env` with your configuration values.

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random secret for session encryption |
| `NOSTR_PUBLISHER_URL` | HTTP Nostr Publisher service URL |
| `NOSTR_NSEC` | Nostr private key for server-side signing and DMs |
| `PRIMAL_CACHING_URL` | Primal caching service for profile/event lookups |
| `REDIS_URL` | Redis connection for job queues |

### Storage (Required for Image Uploads)

| Variable | Description |
|----------|-------------|
| `STORAGE_ACCESS_KEY` | S3-compatible storage access key |
| `STORAGE_SECRET` | S3-compatible storage secret key |
| `STORAGE_REGION` | Storage region (e.g., `us-east-1`) |
| `STORAGE_BUCKET` | Storage bucket name |
| `OWNER_NWC` | NWC string for receiving payments | - |
| `NODE_ENV` | Environment mode | `development` |

---

## Detailed Configuration

### DATABASE_URL

PostgreSQL connection string.

```env
DATABASE_URL=postgresql://user:password@localhost:5432/smartflow?schema=public
```

**Local Development with Docker:**
```bash
npm run docker  # Starts PostgreSQL container
# Use: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow
```

**Production:**
Use a managed PostgreSQL service (Supabase, Railway, Render, etc.)

---

### SESSION_SECRET

Random string used to encrypt session cookies. Generate one using:

```bash
openssl rand -base64 32
```

```env
SESSION_SECRET=your-random-32-character-string-here
```

---

### NOSTR_PUBLISHER_URL

URL to your [HTTP Nostr Publisher](https://github.com/getAlby/http-nostr-publisher) instance.

This service handles signing and publishing Nostr events to relays.

```env
NOSTR_PUBLISHER_URL=https://your-publisher.example.com
```

**Setup:**
1. Deploy the HTTP Nostr Publisher service
2. Configure it with your Nostr private key
3. Point this variable to the service URL

---

### Storage Configuration

SmartFlowSocial supports S3-compatible storage for image uploads.

**For AWS S3:**
```env
STORAGE_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
STORAGE_SECRET=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
STORAGE_REGION=us-east-1
STORAGE_BUCKET=my-smartflow-bucket
```

**For Cloudflare R2:**
```env
STORAGE_ACCESS_KEY=your-r2-access-key
STORAGE_SECRET=your-r2-secret-key
STORAGE_REGION=auto
STORAGE_BUCKET=your-bucket-name
```

**For MinIO (self-hosted):**
```env
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET=minioadmin
STORAGE_REGION=us-east-1
STORAGE_BUCKET=smartflow
```

---

### PRIMAL_CACHING_URL

WebSocket URL(s) to [Primal Caching Service](https://github.com/PrimalHQ/primal-caching-service) for profile and event lookups.

**Single endpoint:**
```env
PRIMAL_CACHING_URL=wss://your-primal-cache.example.com/v1
```

**Multiple endpoints (comma-separated):**
```env
PRIMAL_CACHING_URL=wss://cache1.example.com/v1,wss://cache2.example.com/v1
```

**If not set:** The app will use default public Primal cache endpoints:
- `wss://cache1.primal.net/v1`
- `wss://cache2.primal.net/v1`

> **Note:** These are public endpoints provided by Primal. For production use, consider setting up your own Primal cache instance or using a managed service.

**Required for:**
- Profile lookups and user metadata
- Event fetching and thread views
- Engagement feed functionality

---

### REDIS_URL

Redis connection for BullMQ job queues.

```env
REDIS_URL=redis://localhost:6379
```

**Required for:**
- Scheduled post processing
- Background job queue
- Worker process functionality

---

### OWNER_NWC 

Nostr Wallet Connect string for receiving subscription payments.

```env
OWNER_NWC=nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=...
```

**How to get:**
1. Use a Lightning wallet that supports NWC (Alby, Mutiny, etc.)
2. Generate a connection string from your wallet
3. Set it as this environment variable

**Required for:**
- Accepting Lightning payments for subscriptions

---

### NODE_ENV

Application environment mode.

```env
NODE_ENV=development  # For local development
NODE_ENV=production   # For production deployment
```

---

### NOSTR_NSEC

Nostr secret key for server-side event signing and sending DMs.

```env
NOSTR_NSEC=nsec1...
```

> ⚠️ **Security Warning:** Keep this secret! Never commit to version control.

**Required for:**
- Sending subscription-related Nostr DMs
- Server-side event signing when user extension isn't available

---

## Example Complete Configuration

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartflow

# Session
SESSION_SECRET=your-super-secret-session-key-here

# Nostr Publisher
NOSTR_PUBLISHER_URL=https://publisher.example.com
NOSTR_NSEC=nsec1...

# Primal Cache (supports comma-separated endpoints for redundancy)
PRIMAL_CACHING_URL=wss://cache.example.com/v1
# Or multiple: PRIMAL_CACHING_URL=wss://cache1.example.com/v1,wss://cache2.example.com/v1

# Redis for queues
REDIS_URL=redis://localhost:6379

# S3 Storage
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET=your-secret-key
STORAGE_REGION=us-east-1
STORAGE_BUCKET=smartflow-uploads

# Payments (optional)
OWNER_NWC=nostr+walletconnect://...

# Environment
NODE_ENV=development

# Server signing (optional)
NOSTR_NSEC=nsec1...
```

## Verifying Setup

After configuring your environment:

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

The app should be running at http://localhost:3000
