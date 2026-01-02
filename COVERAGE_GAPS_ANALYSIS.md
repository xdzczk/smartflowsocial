# Coverage Gaps Analysis

Based on the latest coverage report (59.23% overall), here are the **crucial areas missing tests**:

## 🔴 High Priority - Critical Business Logic

### 1. **Queue Type Handler - FIXED_SLOTS Logic** (69.69% coverage)
**File:** `app/features/posts/handlers/queue-type.handler.ts`
**Uncovered Lines:** 211, 229-283
**Impact:** High - This is the fixed slots scheduling algorithm
- Line 211: `useGlobalInterval` logic
- Lines 229-283: Complete FIXED_SLOTS scheduling calculation
  - Slot sorting and indexing
  - Day calculation for multi-day schedules
  - Time slot assignment logic

### 2. **Payment Model - Core Payment Functions** (Likely 0% coverage)
**File:** `app/models/payment.server.ts`
**Missing Tests:**
- `handlePaymentCompleted` - Updates payment status and subscription
- `handlePaymentTimeout` - Marks payments as expired
- `updateUserSubscription` - Complex subscription update logic with transactions
- `createPlanInvoice` - Invoice creation with Bitcoin rate conversion
- `getAllPlans` - Plan retrieval

### 3. **User Queries** (Likely 0% coverage)
**File:** `app/features/user/queries/user-queries.server.ts`
**Missing Tests:**
- `getUserBasicInfo` - Gets npub, isChild, parentNpub
- `getUsersByNpubs` - Batch user lookup by npubs
- `getUserByNpubWithProfile` - User lookup with profile
- `getUserIdByNpub` - ID lookup by npub
- `countUsers` - User count for healthcheck
- `getEnabledUsersWithSubscriptions` - For cron jobs
- `disableUserAccount` - Account disabling

### 4. **User Settings** (Likely 0% coverage)
**File:** `app/features/user/services/user-settings.server.ts`
**Missing Tests:**
- `updateUserTimezone` / `getUserTimezone`
- `updateUserRelays` / `getUserRelays` (includes blastrRelay logic for Premium/Founder)
- `updateGiveawayBlacklist` / `getGiveawayBlacklist`
- `updateScheduleInterval` / `getScheduleInterval`
- `updateUserUploadProvider` / `getUserUploadProvider`
- `getUserEnableMirrorBlossom` / `updateUserEnableMirrorBlossom`
- `getUserMirrorUploadUrls` / `updateUserMirrorUploadUrls`
- `updateUserMutedList` / `getUserMutedList`
- `updateUserFilterMuted` / `getUserFilterMuted`
- `updateUserHidePostsFromLowTrustUsers` / `getUserHidePostsFromLowTrustUsers`

### 5. **Queue Types Service** (Likely 0% coverage)
**File:** `app/features/user/services/queue-types.server.ts`
**Missing Tests:**
- `createDefaultQueueTypes` - Creates default queue for new users
- `updateQueueType` - Create/update queue types with hashtag presets
- `deleteQueueType` - Queue type deletion
- `getQueueTypes` - Queue type retrieval (calls createDefaultQueueTypes)
- `getQueueType` - Legacy function (deprecated)
- `getQueueTypeByIdForUser` - Queue type lookup by ID
- `getQueueTypeByNameForUser` - Queue type lookup by name

### 6. **Recyclable Handler** (70% coverage, 57.14% lines)
**File:** `app/features/posts/handlers/recyclable.handler.ts`
**Uncovered Lines:** 17-19
**Missing Tests:**
- `handleIsRecyclableChange` - Individual post recyclable toggle
- `handleBulkRecyclableToggle` - Bulk recyclable toggle

## 🟡 Medium Priority - Important Utilities

### 7. **User Profile Service** (Likely 0% coverage)
**File:** `app/features/user/services/user-profile.server.ts`
**Missing Tests:**
- `updateUserProfile` - Profile updates
- `getUserById` - Already tested? (check)
- `getUserByNpub` - User lookup by npub
- `createUser` - User creation

### 8. **Hashtag Presets Service** (Likely 0% coverage)
**File:** `app/features/user/services/hashtag-presets.server.ts`
**Missing Tests:**
- `createHashTagPreset` / `updateHashTagPreset` / `deleteHashTagPreset`
- `getUserHashTagPresets` / `getHashTagPresetById`
- `hashTagPresetExistsForUser`
- `updateUserHashTags` / `getUserHashTags`
- `updateShowHashTagsInPosts` / `getShowHashTagsInPosts`
- `getEffectiveHashtags` - Complex logic for hashtag resolution

### 9. **NWC Service** (Likely 0% coverage)
**File:** `app/features/user/services/nwc.server.ts`
**Missing Tests:**
- `updateUserNWC` - NWC URI updates
- `updateUserNWCEnabled` - Enable/disable NWC
- `clearUserNWC` - Clear NWC data
- `getUserNWC` - Get NWC info (masked)
- `getDecryptedUserNWC` - Get decrypted NWC

### 10. **Draft Sign Service** (Likely 0% coverage)
**File:** `app/features/posts/services/draft-sign.server.ts`
**Missing Tests:**
- `signDraftForScheduling` - Main signing function
- `getEffectiveHashtags` - Hashtag resolution logic
- `getImageUrls` - Image URL extraction
- `calculateScheduledTime` - Timezone-aware time calculation

## 🟢 Lower Priority - Client-Side or Example Files

### 11. **Remix Utils** (22.22% coverage)
**File:** `app/lib/remix-utils.ts`
**Note:** Low coverage is because `useMatchesData`, `useOptionalUser`, `useUser` are React hooks (client-side). `safeRedirect` is already tested.

### 12. **EditorJS Utils** (0% coverage)
**Files:** `app/features/posts/utils/editorjs-*.ts`
**Note:** These are client-side utilities, not included in server-side coverage.

### 13. **Queue Index/Types** (0% coverage)
**Files:** `app/infra/queue/index.ts`, `app/infra/queue/queue-types.ts`
**Note:** These are just exports/type definitions. Actual implementations are tested.

## 📊 Estimated Impact

Adding tests for the **High Priority** items (1-6) should increase coverage by approximately **8-12%**, bringing us to **67-71%** coverage.

Adding tests for **Medium Priority** items (7-10) should add another **3-5%**, potentially reaching **70-76%** coverage.

## 🎯 Recommended Testing Order

1. **Queue Type Handler - FIXED_SLOTS** (highest impact, complex logic)
2. **Payment Model Functions** (critical business logic)
3. **User Queries** (foundational, used everywhere)
4. **User Settings** (many small functions, easy wins)
5. **Queue Types Service** (used by many features)
6. **Recyclable Handler** (quick win, simple functions)
7. **User Profile Service** (foundational)
8. **Hashtag Presets Service** (moderate complexity)
9. **NWC Service** (security-sensitive)
10. **Draft Sign Service** (complex timezone logic)

