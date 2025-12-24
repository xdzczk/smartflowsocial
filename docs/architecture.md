# Project Architecture

This document describes the folder structure and code organization of SmartFlowSocial.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | [Remix](https://remix.run) (Full-stack React) |
| Database | PostgreSQL with [Prisma](https://prisma.io) ORM |
| Styling | [TailwindCSS](https://tailwindcss.com) |
| Queue System | [BullMQ](https://docs.bullmq.io/) with Redis |
| Authentication | Nostr-based (NIP-07 browser extensions) |
| Payments | Lightning Network via NWC |

## Project Structure

```
smartflow-social/
├── app/                          # Main application code
│   ├── components/               # Reusable UI components
│   │   ├── dashboard/           # Dashboard-specific components
│   │   ├── layout/              # Layout components (Header, Sidebar)
│   │   ├── settings/            # Settings page components
│   │   └── ui/                  # Generic UI components (Button, Input, etc.)
│   │
│   ├── features/                 # Feature-based modules
│   │   ├── assets/              # Asset management
│   │   ├── auth/                # Authentication logic
│   │   ├── cache/               # Caching utilities
│   │   ├── engagement/          # Engagement feed & notifications
│   │   ├── giveaway/            # Giveaway management
│   │   ├── payments/            # Payment processing
│   │   ├── posts/               # Post creation & scheduling (40+ files)
│   │   ├── templates/           # Post templates
│   │   ├── upload/              # File upload handling
│   │   └── user/                # User management
│   │
│   ├── lib/                      # Shared utilities and helpers
│   │   ├── date.ts              # Date/time utilities
│   │   ├── encryption.server.ts # Encryption helpers
│   │   ├── helpers.ts           # General helpers
│   │   ├── nostr.ts             # Nostr protocol utilities
│   │   ├── nostrwebsocket.server.ts # WebSocket connections
│   │   ├── prisma.server.ts     # Database client
│   │   ├── relays.ts            # Nostr relay configuration
│   │   └── utils.ts             # Misc utilities
│   │
│   ├── models/                   # Database models (server-side)
│   │   ├── asset.server.ts      # Asset CRUD operations
│   │   ├── longformpost.server.ts # Long-form post operations
│   │   ├── payment.server.ts    # Payment processing
│   │   ├── post.server.ts       # Post CRUD operations
│   │   ├── template.server.ts   # Template operations
│   │   └── user.server.ts       # User management
│   │
│   ├── routes/                   # Remix file-based routing
│   │   ├── _index.tsx           # Landing page
│   │   ├── api.*.tsx            # API endpoints
│   │   ├── cron.*.tsx           # Cron job endpoints
│   │   ├── dashboard.*.tsx      # Dashboard pages
│   │   ├── login.tsx            # Login page
│   │   └── plans.tsx            # Subscription plans
│   │
│   ├── utils/                    # Additional utilities
│   ├── entry.client.tsx          # Client entry point
│   ├── entry.server.tsx          # Server entry point
│   ├── root.tsx                  # Root layout component
│   └── tailwind.css              # Global styles
│
├── docs/                         # Documentation
├── prisma/                       # Database configuration
│   ├── schema.prisma            # Database schema
│   ├── seed.ts                  # Database seeding
│   └── migrations/              # Database migrations
│
├── public/                       # Static assets
├── tests/                        # Test files
│   ├── integration/             # Integration tests
│   ├── unit/                    # Unit tests
│   ├── utils/                   # Test utilities
│   └── setup.ts                 # Test configuration
│
├── server.ts                     # Express server entry
├── worker.ts                     # BullMQ worker process
└── [config files]                # Various configuration files
```

## Key Conventions

### File Naming
- **Routes**: Lowercase with dots for nesting (`dashboard.settings.tsx`)
- **Components**: PascalCase (`PostBlock.tsx`)
- **Utilities**: camelCase (`helpers.ts`)
- **Server-only**: `.server.ts` suffix

### Route Structure
Remix uses file-based routing with dot notation:
- `dashboard.tsx` → Layout wrapper for `/dashboard/*`
- `dashboard._index.tsx` → `/dashboard` (index)
- `dashboard.settings.tsx` → `/dashboard/settings`
- `dashboard.calendar.$queueType.tsx` → `/dashboard/calendar/:queueType`

### Server vs Client Code
- Files with `.server.ts` run only on the server
- Keep Prisma database operations in `models/` directory
- Use `loader` functions for data fetching, `action` functions for mutations

### Remix Loaders and Actions

This project follows the standard **Remix Run** pattern where route files contain two key server-side functions:

#### `loader` Function
- Runs on **GET requests** before the component renders
- Fetches data from the database via model functions
- Returns data that the component receives via `useLoaderData()`
- Contains business logic for data validation and transformation

```typescript
// Example: app/routes/dashboard.posts.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);           // Auth check
  const posts = await getScheduledPosts({ userId: user.id }); // Model call
  return json({ posts, user });                      // Return to component
}
```

#### `action` Function
- Runs on **POST/PUT/DELETE requests** (form submissions)
- Handles mutations (create, update, delete operations)
- Contains business logic for validation and processing
- Typically redirects or returns updated data after completion

```typescript
// Example: app/routes/dashboard.posts.tsx
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  if (intent === "delete") {
    await deletePost({ id: formData.get("postId"), userId: user.id });
    return json({ success: true });
  }
  // ... other intents
}
```

#### Where Logic Lives

| Layer | Responsibility | Example |
|-------|----------------|--------|
| **Routes (loaders/actions)** | Business logic, validation, orchestration | Auth checks, permission validation, combining data |
| **Models** | Database operations (Prisma wrappers) | `createPost()`, `getUserById()`, `deletePost()` |
| **Features** | Reusable domain logic | Post publishing, payment processing |
| **Lib** | Utilities and helpers | Encryption, date formatting, Nostr utilities |

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   React     │    │   Nostr     │    │    Wallet       │  │
│  │ Components  │    │ Extension   │    │  (Alby/Amber)   │  │
│  └──────┬──────┘    └──────┬──────┘    └────────┬────────┘  │
└─────────┼──────────────────┼───────────────────┼────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Remix Server                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   Routes    │───▶│   Models    │───▶│     Prisma      │  │
│  │  (loaders/  │    │  (database  │    │   (PostgreSQL)  │  │
│  │  actions)   │    │ operations) │    │                 │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  PostgreSQL │    │    Redis    │    │  Nostr Relays   │  │
│  │  (data)     │    │  (queues)   │    │  (publishing)   │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Worker Process

The application runs two processes:
1. **Main Server** (`server.ts`) - Handles HTTP requests
2. **Worker** (`worker.ts`) - Processes background jobs via BullMQ

Worker responsibilities:
- Processing scheduled posts
- Publishing to Nostr relays
- Handling async tasks
