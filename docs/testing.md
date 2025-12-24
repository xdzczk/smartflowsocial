# Testing Guide

This guide covers how to run and write tests for SmartFlowSocial. All tests use **Cypress** for end-to-end testing.

## Test Types

SmartFlowSocial uses the following test types:

| Type | Description | Location |
|------|-------------|----------|
| **E2E Tests** | Full user flow tests (login, navigation, forms) | `cypress/e2e/*.cy.ts` |
| **Integration Tests** | Loader/API tests that verify data loading | `cypress/e2e/loaders/`, `cypress/e2e/subscription/` |
| **Smoke Tests** | Quick sanity checks for critical paths | `cypress/e2e/smoke.cy.ts` |
| **Unit Tests** | Pure function tests for critical business logic | `cypress/e2e/unit/` |

> [!NOTE]
> All tests run via Cypress, including unit tests which exercise pure functions independently of the UI.

## Prerequisites

Before running tests, ensure you have:

1. **Node.js 20+** installed
2. **Dependencies installed**: Run `npm install`
3. **Database running**: Ensure PostgreSQL is accessible (via Docker or local install)
4. **Environment configured**: Copy `example.env` to `.env` and configure required variables

## Running Tests

### Development Server Required

> [!IMPORTANT]
> The development server **must be running** before executing tests. Tests run against `http://localhost:3000` by default.

```bash
# Terminal 1: Start the dev server
npm run dev

# Terminal 2: Run tests
npm run test
```

### Available Test Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Run all Cypress tests headlessly |
| `npm run test:e2e` | Run all E2E tests (alias for `test`) |
| `npm run test:loaders` | Run loader integration tests only |
| `npm run test:integration` | Run integration tests (loaders + subscription) |
| `npm run test:unit` | Run unit tests only |
| `npm run test:open` | Open Cypress UI for interactive testing |
| `npm run test:dev` | Starts dev server and opens Cypress (all-in-one) |

### Running Specific Tests

```bash
# Run a single test file
npx cypress run --spec "cypress/e2e/smoke.cy.ts"

# Run tests in a specific folder
npx cypress run --spec "cypress/e2e/posts/**/*.cy.ts"

# Run loader tests only
npm run test:loaders

# Run unit tests only
npx cypress run --spec "cypress/e2e/unit/**/*.cy.ts"

# Run multiple specific tests
npx cypress run --spec "cypress/e2e/smoke.cy.ts,cypress/e2e/dashboard.cy.ts"
```

---

## Test Structure

```
cypress/
├── e2e/                    # Test files organized by feature
│   ├── smoke.cy.ts         # Basic smoke tests
│   ├── dashboard.cy.ts     # Dashboard tests
│   ├── nostr-auth.cy.ts    # Nostr authentication tests
│   ├── engagement/         # Engagement feature tests
│   │   └── feed.cy.ts      # Engagement feed + loader tests
│   ├── loaders/            # Data loader integration tests
│   │   ├── dashboard-loader.cy.ts  # Dashboard data loading
│   │   └── queues-loader.cy.ts     # Queue data loading
│   ├── posts/              # Post creation/management tests
│   │   ├── bulk-posts.cy.ts        # Bulk post upload tests
│   │   ├── calendar.cy.ts          # Calendar view tests
│   │   ├── drafts.cy.ts            # Draft management tests
│   │   ├── new-post.cy.ts          # New post creation tests
│   │   └── scheduled-posts.cy.ts   # Scheduled posts tests
│   ├── settings/           # Settings page tests
│   │   ├── queue-types.cy.ts       # Queue type settings tests
│   │   └── user-settings.cy.ts     # User settings tests
│   ├── subscription/       # Subscription/billing tests
│   │   └── billing-loader.cy.ts    # Billing data loading
│   └── unit/               # Unit tests for pure functions
│       ├── scheduling-logic.cy.ts   # Queue/scheduling logic tests
│       ├── engagement-logic.cy.ts   # Engagement grouping/filtering tests
│       └── subscription-logic.cy.ts # Plan enforcement tests
├── fixtures/               # Test data files
├── memes_test_files/       # Test images for upload tests
├── support/                # Custom commands and utilities
│   ├── commands.ts         # Cypress custom commands
│   ├── e2e.ts              # E2E support file
│   ├── nostr-test-keys.ts  # Test Nostr keys
│   ├── nostr-signer.ts     # Nostr event signing utility
│   ├── create-nostr-user.ts  # Creates test user with Nostr auth
│   ├── delete-nostr-user.ts  # Cleans up test user
│   ├── create-user.ts        # Creates test user with email
│   ├── delete-user.ts        # Cleans up email user
│   └── update-subscription-status.ts # Updates user subscription state
└── tsconfig.json           # Cypress TypeScript config
```


---

## Unit Tests

Unit tests exercise pure functions independently of the UI. They provide minimal safety coverage for critical logic paths.

### Scheduling Logic (`scheduling-logic.cy.ts`)

Tests queue/scheduling functions from `app/features/posts/schedulers.ts`:
- **UTC formatting**: Datetime string formatting for `datetime-local` inputs
- **Timezone conversion**: Converting between user timezones and UTC
- **Interval scheduling**: Delay calculation based on last post time
- **Fixed slot ordering**: Slot time parsing and chronological ordering

### Engagement Logic (`engagement-logic.cy.ts`)

Tests engagement grouping/filtering from `app/features/engagement/`:
- **`groupNotificationsByType`**: Categorizes notifications as replies, mentions, zaps, quotes
- **`groupNotificationsByParent`**: Groups notifications by parent event ID
- **`calculateTrustScore`**: Trust score algorithm (0-100 scale based on profile completeness, account age, social engagement)
- **`getTrustLevel`**: Maps scores to trust levels (Highly Trusted, Trusted, Developing, New, Unverified)
- **`getTrustScoreBadgeColor`**: Maps scores to Tailwind color classes

### Subscription Logic (`subscription-logic.cy.ts`)

Tests plan enforcement from `app/features/payments/types.ts`:
- **`getUserPlanType`**: Determines plan type (free/basic/premium/pro/enterprise) from subscription state
- **`hasFeatureAccess`**: Checks if a plan grants access to specific features
- **`getMinimumPlanForFeature`**: Returns the minimum required plan for a feature
- **`isNewUserWithoutSubscription`**: Detects new users without active subscriptions
- **`PLAN_FEATURES` configuration**: Validates feature flags per plan tier

---

## Custom Commands

SmartFlowSocial includes custom Cypress commands for common operations:

### Authentication Commands

```typescript
// Login with Nostr test user (creates user if needed)
cy.loginNostr();

// Login with specific npub
cy.loginNostr({ npub: 'npub1xxx...' });

// Login with email (legacy)
cy.login({ email: 'test@example.com' });

// Cleanup test users after test
cy.cleanupNostrUser();
cy.cleanupUser();
```

### Navigation Commands

```typescript
// Visit URL and wait for it to load (avoids flaky tests)
cy.visitAndCheck('/dashboard');
cy.visitAndCheck('/dashboard', 2000); // Custom wait time
```

### File Upload Commands

```typescript
// Upload test file from cypress/memes_test_files/
cy.uploadTestFile('input[type="file"]', 0);        // First test file
cy.uploadTestFile('input[type="file"]', [0, 1]);   // Multiple files
```

### Nostr Commands

```typescript
// Sign a Nostr event with test keys
cy.signNostrEvent({
  content: 'Hello Nostr!',
  kind: 1,
  tags: []
});
```

---

## Writing Tests

### Basic Test Example

```typescript
describe('Dashboard', () => {
  beforeEach(() => {
    // Login before each test
    cy.loginNostr();
  });

  afterEach(() => {
    // Clean up test user
    cy.cleanupNostrUser();
  });

  it('should display dashboard after login', () => {
    cy.visitAndCheck('/dashboard');
    cy.contains('Dashboard').should('be.visible');
  });
});
```

### Test Without Authentication

```typescript
describe('Landing Page', () => {
  it('should display hero section', () => {
    cy.visitAndCheck('/');
    cy.contains('SmartFlow').should('be.visible');
  });
});
```

---

## Configuration

Configuration is in `cypress.config.ts`:

- **Base URL**: Defaults to `http://localhost:3000` (or port from `PORT` env var)
- **CI Mode**: Uses port `8811` when `CI=true`
- **Screenshots**: Disabled in CI, enabled locally on failure

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Override base URL port (default: 3000) |
| `CI` | Set to `true` for CI environment settings |

---

## Troubleshooting

### "Connection refused" errors

Ensure the dev server is running:

```bash
npm run dev
```

### Tests timing out

1. Check if the app is accessible at `http://localhost:3000`
2. Increase timeout in `cypress.config.ts` if needed
3. Use `cy.visitAndCheck()` instead of `cy.visit()` for more reliable navigation

### Database-related failures

1. Ensure PostgreSQL is running: `npm run docker` (if using Docker)
2. Check `.env` has correct `DATABASE_URL`
3. Run migrations: `npx prisma migrate deploy`

### Nostr authentication issues

1. Verify test keys in `cypress/support/nostr-test-keys.ts`
2. Check that `create-nostr-user.ts` can connect to the database
3. Look for session cookie issues in browser dev tools

---

## CI/CD Integration

For CI environments, set `CI=true`:

```bash
CI=true npm run test
```

This:
- Uses port `8811` instead of `3000`
- Disables screenshot capture on failure
