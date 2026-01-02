# Coverage Summary: Low/0% Coverage Areas

## Current Coverage: 61.85% statements, 61.6% lines

## Areas with 0% Coverage (Expected - Not Testable)

### Type Definitions & Interfaces
- `models/post.types.ts` - TypeScript interfaces/types only
- `infra/queue/queue-types.ts` - TypeScript interfaces only
- `infra/queue/index.ts` - Re-exports only

### Client-Side Only (React Hooks/DOM)
- `lib/useLocalStorage.ts` - React hook, requires browser environment
- `editorjs-captions.ts` - DOM manipulation utilities
- `editorjs-config.ts` - EditorJS configuration (requires DOM)
- `editorjs-dragdrop.ts` - Drag & drop handlers (requires DOM)

### Example/Reference Files
- `lib/error-handler.example.ts` - Example file, not production code

## Areas with Low Coverage (<30%)

### `remix-utils.ts` - 25.92% coverage
**Status:** Partially tested
- ✅ `safeRedirect` - Fully tested
- ✅ `validateEmail` - Fully tested  
- ❌ `useMatchesData` - React hook, needs React Testing Library
- ❌ `useOptionalUser` - React hook, needs React Testing Library
- ❌ `useUser` - React hook, needs React Testing Library

**Recommendation:** Test React hooks with React Testing Library in component/integration tests, not unit tests.

### `editorjs-content.ts` - 23.52% coverage
**Status:** Partially tested
- ✅ `generateSummaryFromContent` - Fully tested
- ❌ `loadEditorJSContent` - Requires React refs and EditorJS instance
- ❌ `insertAssetsIntoEditor` - Requires React refs and EditorJS instance

**Recommendation:** These functions require React/DOM context. Test in component tests or E2E tests.

### `infra/queue/queue-client.server.ts` - 0% coverage
**Status:** Difficult to test due to module-level initialization
- ❌ `BullMQClient.enqueue` - Module-level Redis/Queue initialization
- ❌ `BullMQClient.cancelByData` - Module-level Redis/Queue initialization
- ❌ `BullMQClient.getJobs` - Module-level Redis/Queue initialization
- ❌ `BullMQClient.removeJob` - Module-level Redis/Queue initialization
- ❌ `getQueueInstance` - Module-level initialization
- ❌ `closeAllQueues` - Module-level initialization

**Note:** `queue-operations.server.ts` (which uses `queueClient`) is already well-tested. The queue client is infrastructure code that's tested indirectly.

**Recommendation:** Consider refactoring to dependency injection for better testability, or accept indirect testing through queue-operations.

## Areas That Can Still Be Tested

### High Impact Areas (from COVERAGE_GAPS_ANALYSIS.md)
1. **User Profile Service** - `app/features/user/services/user-profile.server.ts`
   - `updateUserProfile`, `getUserByNpub`, `createUser`
   - Estimated impact: +1-2%

2. **Hashtag Presets Service** - `app/features/user/services/hashtag-presets.server.ts`
   - CRUD operations, `getEffectiveHashtags`
   - Estimated impact: +1-2%

3. **NWC Service** - `app/features/user/services/nwc.server.ts`
   - Encryption/decryption, validation
   - Estimated impact: +0.5-1%

4. **Draft Sign Service** - `app/features/posts/services/draft-sign.server.ts`
   - `signDraftForScheduling`, timezone calculations
   - Estimated impact: +1-2%

## Summary

**Current Status:**
- ✅ 61.85% coverage (up from 59.23%)
- ✅ Most testable server-side code is covered
- ⚠️ Remaining low coverage is mostly client-side or infrastructure code

**To Reach 70%+:**
- Add tests for User Profile Service (+1-2%)
- Add tests for Hashtag Presets Service (+1-2%)
- Add tests for NWC Service (+0.5-1%)
- Add tests for Draft Sign Service (+1-2%)
- **Total estimated: +3.5-7% → 65-69% coverage**

**Beyond 70%:**
- Would require testing React hooks with React Testing Library
- Would require component/E2E tests for EditorJS utilities
- Would require refactoring infrastructure code for better testability

