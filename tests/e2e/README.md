# E2E Tests - Best Practices

**Last Updated:** 2026-01-01  
**Status:** ✅ Rewritten from scratch using best practices

## Overview

These e2e tests follow best practices and focus on **critical user flows** rather than testing every possible scenario. Quality over quantity.

## Test Files

### Core Tests

#### `smoke.cy.ts` - Critical Path Sanity Checks

- Landing page loads
- Authentication redirects
- Dashboard access

**Purpose:** Fast, reliable tests that verify the app is working at a basic level.

#### `authentication.cy.ts` - Authentication Flow

- Unauthenticated access restrictions
- Login flow
- Session persistence

**Purpose:** Verify authentication works correctly.

#### `navigation.cy.ts` - Navigation and Routing

- Dashboard navigation
- Sidebar navigation
- Direct URL access
- Browser back/forward navigation
- Protected routes

**Purpose:** Test navigation and routing functionality.

### Post Management Tests

#### `post-creation.cy.ts` - Post Creation Flow

- Navigate to new post page
- Fill in post content
- Submit immediate post
- Verify post appears in posted queue
- Form validation

**Purpose:** Test the core feature of creating posts.

#### `post-scheduling.cy.ts` - Post Scheduling Flow

- Enable scheduling
- Set schedule date/time
- Create scheduled post
- Verify in scheduled queue

**Purpose:** Test scheduling functionality.

#### `drafts.cy.ts` - Drafts Management

- View drafts list
- Create drafts
- Draft actions (edit/delete)
- Empty states

**Purpose:** Test draft functionality.

#### `posted-posts.cy.ts` - Posted Posts Queue

- View posted posts
- Filter by queue type
- View post details
- Pagination

**Purpose:** Test posted posts queue functionality.

#### `long-form-posts.cy.ts` - Long Form Posts

- Navigate to new long form post page
- Create long form post
- View long form posts
- Editor functionality

**Purpose:** Test long form post functionality.

#### `bulk-posts.cy.ts` - Bulk Posts Upload

- Navigate to bulk posts page
- Upload multiple files
- Configure scheduling
- Submit bulk posts

**Purpose:** Test bulk post upload functionality.

### View and Display Tests

#### `calendar.cy.ts` - Calendar View

- Navigate to calendar page
- Display calendar view
- Filter by queue type
- View scheduled posts on calendar

**Purpose:** Test calendar view functionality.

#### `engagement.cy.ts` - Engagement Feed

- Navigate to engagement feed
- View engagement feed
- Filter engagement

**Purpose:** Test engagement feed functionality.

#### `recyclables.cy.ts` - Recyclables Queue

- View recyclables queue
- Filter recyclables
- Recyclable post actions

**Purpose:** Test recyclables functionality.

### Configuration Tests

#### `settings.cy.ts` - Settings

- Access settings page
- View settings sections
- Settings tabs
- Queue settings

**Purpose:** Test settings page accessibility and functionality.

#### `templates.cy.ts` - Templates

- View templates list
- Create templates
- Edit templates
- Use templates

**Purpose:** Test template functionality.

### Error Handling Tests

**Note:** Error handling scenarios are covered in other test files:

- **Form validation**: Covered in `accessibility.cy.ts` and `post-creation.cy.ts`
- **Empty states**: Covered in feature-specific test files (`drafts.cy.ts`, `post-scheduling.cy.ts`, etc.)
- **API error handling**: Covered in `api-endpoints.cy.ts`

## Best Practices Followed

### ✅ Strong Assertions

- Use specific element selectors
- Check for actual content, not just "body exists"
- Verify functionality works, not just pages load

### ✅ No Force Clicks

- All clicks verify elements are visible and interactable
- Tests real user behavior

### ✅ No Conditional Logic

- Tests always run their assertions
- Clear pass/fail criteria

### ✅ Test Data Setup

- Uses `beforeEach` to set up authentication
- Uses `afterEach` to clean up
- Tests create their own data when needed

### ✅ Real User Flows

- Tests complete workflows, not just page loads
- Verifies end-to-end functionality

### ✅ Proper Waits

- Uses Cypress's built-in retry-ability
- No hardcoded waits (except where necessary)
- Uses `visitAndCheck` helper for reliable navigation

## Running Tests

```bash
# Run all e2e tests
npx cypress run

# Run specific test file
npx cypress run --spec "tests/e2e/smoke.cy.ts"

# Open Cypress UI
npx cypress open
```

## Test Structure

Each test file follows this structure:

```typescript
describe("Feature Name", () => {
  beforeEach(() => {
    cy.loginNostr({ npub: TEST_NPUB });
  });

  afterEach(() => {
    cy.cleanupNostrUser();
  });

  describe("Sub-feature", () => {
    it("should do something specific", () => {
      // Arrange
      cy.visitAndCheck("/dashboard");

      // Act
      cy.get("button").click();

      // Assert
      cy.location("pathname").should("include", "expected");
    });
  });
});
```

## Common Patterns

### Navigation

```typescript
cy.visitAndCheck("/dashboard");
cy.location("pathname").should("include", "dashboard");
```

### Form Interaction

```typescript
cy.get("textarea").first().type("Content");
cy.get('button[type="submit"]').click();
```

### Verification

```typescript
cy.contains("Expected text").should("exist");
cy.get('[data-testid="element"]').should("be.visible");
```

## Notes

- **ESLint Warnings:** Some `jest/expect-expect` warnings are false positives - Cypress uses different assertion patterns than Jest.
- **Test Data:** Tests use the `TEST_NPUB` from `support/nostr-test-keys.ts` for consistent authentication.
- **Cleanup:** All tests clean up after themselves using `afterEach` hooks.

## Test Coverage Summary

**Total Test Files:** 15  
**Total Lines of Code:** ~1,200

### Coverage by Feature:

- ✅ Authentication & Authorization
- ✅ Post Creation (immediate)
- ✅ Post Scheduling
- ✅ Drafts Management
- ✅ Posted Posts Queue
- ✅ Bulk Posts Upload
- ✅ Calendar View
- ✅ Engagement Feed
- ✅ Recyclables Queue
- ✅ Long Form Posts
- ✅ Templates
- ✅ Settings
- ✅ Navigation & Routing
- ✅ Error Handling
- ✅ Empty States

### Coverage Statistics:

- **Routes Covered:** ~20+ routes
- **User Flows:** 15+ complete workflows
- **Edge Cases:** Error handling, empty states, validation

## Future Improvements

- Add more specific test data creation helpers
- Add visual regression testing
- Add performance benchmarks
- Add more detailed interaction tests (clicking, typing, etc.)
- Add tests for API endpoints
- Add tests for subscription/payment flows
