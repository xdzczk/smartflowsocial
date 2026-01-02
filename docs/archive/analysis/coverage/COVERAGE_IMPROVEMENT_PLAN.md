# Coverage Improvement Plan: 53% → 70%+

## Current Status
- **Lines**: 53.33% (need +17% to reach 70%)
- **Functions**: 56.71% (need +13% to reach 70%)
- **Statements**: 53.33% (need +17% to reach 70%)
- **Branches**: 51.44% (need +19% to reach 70%)

## Priority 1: High-Impact, Low-Effort Tests

### 1. Action Handlers (High Coverage Potential)
These are straightforward CRUD operations that are easy to test:

#### `app/features/posts/services/dashboard-action.server.ts` (0% coverage)
**Missing Tests:**
- ✅ `handleDashboardAction` - delete action
- ✅ `handleDashboardAction` - deleteLongForm action
- ✅ `handleDashboardAction` - bulkDelete action
- ✅ `handleDashboardAction` - bulkDeleteLongForm action
- ✅ Error handling for invalid postIds
- ✅ Error handling for missing postId

**Estimated Impact**: +2-3% overall coverage

#### `app/features/posts/services/scheduled-action.server.ts` (0% coverage)
**Missing Tests:**
- ✅ `handleScheduledAction` - delete action
- ✅ `handleScheduledAction` - deleteLongForm action
- ✅ `handleScheduledAction` - bulkDelete action
- ✅ `handleScheduledAction` - bulkDeleteLongForm action
- ✅ `handleScheduledAction` - bulkDeleteMixed action
- ✅ Error handling for invalid JSON

**Estimated Impact**: +2-3% overall coverage

#### `app/features/posts/services/drafts-action.server.ts` (0% coverage)
**Missing Tests:**
- ✅ `handleDraftsAction` - delete action
- ✅ `handleDraftsAction` - deleteLongForm action
- ✅ `handleDraftsAction` - bulkDelete action
- ✅ `handleDraftsAction` - bulkDeleteLongForm action
- ✅ `handleDraftsAction` - bulkSignAndResume action
- ✅ Queue type resolution in bulkSignAndResume
- ✅ Error handling for invalid data

**Estimated Impact**: +2-3% overall coverage

#### `app/features/posts/services/calendar-action.server.ts` (0% coverage)
**Missing Tests:**
- ✅ Calendar action handlers (if any)
- ✅ Date/time manipulation
- ✅ Timezone handling

**Estimated Impact**: +1-2% overall coverage

### 2. Settings Action Handlers (Medium Coverage Potential)

#### `app/features/settings/settings-actions.server.ts` (0% coverage)
**Missing Tests:**
- ✅ `handleSettingsAction` - routing to correct handler
- ✅ `handleSettingsAction` - invalid action handling
- ✅ `handleSettingsAction` - missing action handling

**Estimated Impact**: +1% overall coverage

#### `app/features/settings/actions/*.server.ts` (0% coverage)
**Missing Tests for each handler:**
- ✅ `handleGeneralSettingsAction` - all action types
- ✅ `handleQueueTypeAction` - create/update/delete queue types
- ✅ `handleHashtagPresetAction` - CRUD operations
- ✅ `handleStorageSettingsAction` - storage configuration
- ✅ `handleNWCAction` - NWC wallet operations
- ✅ `handleAccountsAction` - account management
- ✅ `handleSubscriptionAction` - subscription management
- ✅ `handleEngagementAction` - engagement settings

**Estimated Impact**: +5-7% overall coverage

### 3. Utility Functions (Medium Coverage Potential)

#### `app/lib/nostr.ts` (62.98% coverage → target 85%+)
**Missing Tests:**
- ✅ `signEventFn` - retry logic (mock window.nostr)
- ✅ `signEventFn` - error handling
- ✅ `signEventFn` - different return types from extensions
- ✅ `signLongFormEvent` - retry logic
- ✅ `signLongFormEvent` - error handling
- ✅ `convertEditorJSToMarkdown` - edge cases (lines 355-356, 402)
- ✅ `convertMarkdownToEditorJS` - edge cases (lines 512-513)
- ✅ Complex markdown parsing scenarios

**Estimated Impact**: +3-4% overall coverage

#### `app/lib/remix-utils.ts` (22.22% coverage → target 70%+)
**Missing Tests:**
- ⚠️ `useMatchesData` - requires React Testing Library
- ⚠️ `useOptionalUser` - requires React Testing Library
- ⚠️ `useUser` - requires React Testing Library
- ✅ `validateEmail` - validation logic (currently 0%)

**Note**: React hooks need React Testing Library setup. Consider:
- Setting up `@testing-library/react` and `@testing-library/react-hooks`
- Creating a test wrapper for Remix hooks
- Or testing the logic separately from the hooks

**Estimated Impact**: +2-3% overall coverage (if hooks are testable)

### 4. Service Functions (High Coverage Potential)

#### `app/features/posts/services/queue-schedule.server.ts` (0% coverage)
**Missing Tests:**
- ✅ Schedule calculation logic
- ✅ Timezone handling
- ✅ Interval-based scheduling
- ✅ Fixed slot scheduling

**Estimated Impact**: +2-3% overall coverage

#### `app/features/posts/services/effective-hashtags.server.ts` (0% coverage)
**Missing Tests:**
- ✅ Effective hashtag calculation
- ✅ Queue type hashtag resolution
- ✅ Global hashtag fallback

**Estimated Impact**: +1-2% overall coverage

#### `app/features/posts/services/queue-type-resolver.server.ts` (0% coverage)
**Missing Tests:**
- ✅ `resolveQueueTypeId` - name to ID resolution
- ✅ `resolveQueueTypeId` - ID passthrough
- ✅ `resolveQueueTypeId` - null handling

**Estimated Impact**: +1% overall coverage

#### `app/features/posts/services/longform-status-calculator.server.ts` (0% coverage)
**Missing Tests:**
- ✅ Status calculation logic
- ✅ Draft vs published vs scheduled
- ✅ Edge cases

**Estimated Impact**: +1-2% overall coverage

## Priority 2: Medium-Impact Tests

### 5. Loader Functions (Some Coverage Exists)

#### `app/features/posts/services/newpost-loader.server.ts` (partial coverage)
**Missing Tests:**
- ✅ Edge cases in data loading
- ✅ Error handling paths
- ✅ Filtering logic

**Estimated Impact**: +1-2% overall coverage

#### `app/features/posts/services/newlongform-loader.server.ts` (partial coverage)
**Missing Tests:**
- ✅ Edge cases
- ✅ Error handling

**Estimated Impact**: +1% overall coverage

### 6. Payment Services (Some Coverage Exists)

#### `app/features/payments/services/subscription-renewal.server.ts` (partial coverage)
**Missing Tests:**
- ✅ Renewal logic edge cases
- ✅ Error handling
- ✅ NWC integration

**Estimated Impact**: +1-2% overall coverage

### 7. Upload Services

#### `app/features/upload/s3.server.ts` (0% coverage)
**Missing Tests:**
- ✅ S3 upload logic
- ✅ Error handling
- ✅ File validation

**Estimated Impact**: +1-2% overall coverage

## Priority 3: Lower Priority (But Still Valuable)

### 8. Infrastructure Services

#### `app/features/infra/services/healthcheck.server.ts` (0% coverage)
**Missing Tests:**
- ✅ Health check endpoints
- ✅ Database connectivity checks

**Estimated Impact**: +0.5% overall coverage

### 9. Cache Services

#### `app/features/cache/primalCache.server.ts` (0% coverage)
**Missing Tests:**
- ✅ Cache operations
- ✅ Cache invalidation
- ✅ Error handling

**Estimated Impact**: +1% overall coverage

## Testing Strategy

### Quick Wins (Do First)
1. **Action Handlers** (dashboard, scheduled, drafts) - Easy to test, high coverage
2. **Settings Actions** - Straightforward CRUD operations
3. **Queue Schedule Service** - Core business logic
4. **Effective Hashtags Service** - Simple utility

### Medium Effort
5. **Nostr.ts edge cases** - Need to mock window.nostr
6. **Remix Utils** - Need React Testing Library setup
7. **Longform Status Calculator** - Business logic

### Lower Priority
8. **S3 Upload** - May require AWS mocking
9. **Cache Services** - May require Redis mocking
10. **Infrastructure** - Lower business value

## Estimated Coverage After Implementation

| Category | Current | After Priority 1 | After Priority 2 | Target (70%) |
|----------|---------|-----------------|------------------|--------------|
| **Lines** | 53.33% | ~60% | ~65% | 70%+ |
| **Functions** | 56.71% | ~63% | ~68% | 70%+ |
| **Statements** | 53.33% | ~60% | ~65% | 70%+ |
| **Branches** | 51.44% | ~58% | ~63% | 70%+ |

## Recommended Test File Structure

```
tests/
├── integration/
│   ├── actions/
│   │   ├── dashboard-action.test.ts
│   │   ├── scheduled-action.test.ts
│   │   ├── drafts-action.test.ts
│   │   └── calendar-action.test.ts
│   ├── settings/
│   │   ├── settings-actions.test.ts
│   │   ├── general-settings-actions.test.ts
│   │   ├── queue-types-actions.test.ts
│   │   ├── hashtag-presets-actions.test.ts
│   │   ├── storage-settings-actions.test.ts
│   │   ├── nwc-actions.test.ts
│   │   ├── accounts-actions.test.ts
│   │   ├── subscription-actions.test.ts
│   │   └── engagement-actions.test.ts
│   └── services/
│       ├── queue-schedule.test.ts
│       ├── effective-hashtags.test.ts
│       ├── queue-type-resolver.test.ts
│       └── longform-status-calculator.test.ts
└── unit/
    ├── lib/
    │   ├── nostr-edge-cases.test.ts
    │   └── remix-utils-hooks.test.ts (if React Testing Library is set up)
    └── services/
        └── upload-s3.test.ts
```

## Next Steps

1. **Start with Priority 1** - Action handlers are the easiest wins
2. **Set up React Testing Library** - For remix-utils hooks testing
3. **Create test utilities** - For mocking FormData, window.nostr, etc.
4. **Iterate** - Run coverage after each batch of tests to track progress

## Notes

- Action handlers are typically easy to test because they're pure functions with clear inputs/outputs
- Some services may require mocking external dependencies (AWS, Redis, etc.)
- React hooks testing requires additional setup but is valuable for coverage
- Focus on business logic first, then edge cases

