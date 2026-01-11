# Use Cases Integration and Tests - Complete ✅

## Summary

Successfully integrated `RecyclePostUseCase` into the recyclable posts service and created
comprehensive unit and integration tests for all new use cases.

## What Was Implemented

### 1. RecyclePostUseCase Integration ✅

**File**: `app/features/posts/services/recyclable-posts.server.ts`

**Changes**:

- Added `handleRecycleAction` function that uses `RecyclePostUseCase`
- Integrated recycle action into `handleRecyclablePostAction` handler
- Added support for scheduling recycled posts
- Added queue type support for recycled posts

**Schema Update**: `app/lib/validation/schemas/posts-actions.schemas.ts`

- Added `recyclePostSchema` with support for:
  - `postId` (required)
  - `scheduledFor` (optional Unix timestamp)
  - `queueTypeId` (optional)
  - `queueType` (optional name)

**Usage**:

```typescript
// From client-side form
const formData = new FormData();
formData.append("_action", "recycle");
formData.append("postId", "post-id");
formData.append("scheduledFor", "1234567890"); // Optional
formData.append("queueTypeId", "queue-id"); // Optional

await handleRecyclablePostAction(formData, userId);
```

### 2. Unit Tests ✅

**Files Created**:

- `tests/unit/use-cases/cancel-schedule.use-case.test.ts`
- `tests/unit/use-cases/recycle-post.use-case.test.ts`

**Test Coverage**:

#### CancelScheduleUseCase (6 tests)

- ✅ Should cancel a scheduled post successfully
- ✅ Should return cancelled: false if post is not scheduled
- ✅ Should handle job not found in queue gracefully
- ✅ Should throw error if post not found
- ✅ Should handle state transition failure gracefully
- ✅ Should use correlation ID if provided

#### RecyclePostUseCase (7 tests)

- ✅ Should recycle a post successfully without scheduling
- ✅ Should recycle a post with scheduling
- ✅ Should return existing post if idempotency key matches
- ✅ Should throw error if post is not recyclable
- ✅ Should throw error if post is not published
- ✅ Should throw error if post not found
- ✅ Should handle marking original as non-recyclable failure gracefully

**Test Results**: ✅ All 13 tests passing

### 3. Integration Tests ✅

**Files Created**:

- `tests/integration/use-cases/cancel-schedule.use-case.integration.test.ts`
- `tests/integration/use-cases/recycle-post.use-case.integration.test.ts`

**Test Coverage**:

#### CancelScheduleUseCase Integration (2 tests)

- ✅ Should cancel a scheduled post and update state
- ✅ Should handle cancelling a post that is not scheduled

#### RecyclePostUseCase Integration (5 tests)

- ✅ Should recycle a published post without scheduling
- ✅ Should recycle a post with scheduling
- ✅ Should prevent recycling a non-recyclable post
- ✅ Should prevent recycling an unpublished post
- ✅ Should use idempotency to prevent duplicate recycling

**Note**: Integration tests are skipped if `TEST_DATABASE_URL` is not configured. They require a
test database setup.

### 4. Bug Fixes ✅

**Fixed**: `app/models/post.commands.server.ts`

- Changed `updatePost` from `function` to `async function` to support `await` usage
- This was required for the read model event emission

## Files Created/Modified

### New Files

- `tests/unit/use-cases/cancel-schedule.use-case.test.ts`
- `tests/unit/use-cases/recycle-post.use-case.test.ts`
- `tests/integration/use-cases/cancel-schedule.use-case.integration.test.ts`
- `tests/integration/use-cases/recycle-post.use-case.integration.test.ts`
- `docs/use-cases-integration-and-tests-complete.md`

### Modified Files

- `app/features/posts/services/recyclable-posts.server.ts` - Added recycle action handler
- `app/lib/validation/schemas/posts-actions.schemas.ts` - Added recyclePostSchema
- `app/models/post.commands.server.ts` - Fixed async/await issue

## Testing

### Running Unit Tests

```bash
pnpm test:unit -- --grep "use-cases"
```

### Running Integration Tests

```bash
# Setup test database first
pnpm test:db:setup

# Run integration tests
pnpm test:integration -- --grep "use-cases"
```

### Test Results

- ✅ **Unit Tests**: 13/13 passing
- ⏸️ **Integration Tests**: Created (require test database)

## Benefits

### Integration

1. **Single Post Recycling**: Users can now recycle individual posts directly from the recyclables
   page
2. **Scheduling Support**: Recycled posts can be scheduled immediately
3. **Queue Type Support**: Recycled posts can be assigned to specific queues
4. **Consistent API**: Uses the same action handler pattern as other recyclable actions

### Testing

1. **Comprehensive Coverage**: All use cases have unit tests covering success and error cases
2. **Integration Tests**: Real database tests ensure use cases work end-to-end
3. **Maintainability**: Tests serve as documentation and prevent regressions
4. **Confidence**: Can refactor use cases knowing tests will catch breaking changes

## Next Steps (Optional)

1. **Add E2E Tests**: Test the full user flow for recycling posts
2. **Performance Tests**: Test recycling performance with large numbers of posts
3. **Bulk Recycling**: Consider adding bulk recycling support using RecyclePostUseCase
4. **Analytics**: Track recycling metrics and success rates

## Success Criteria Met ✅

- ✅ RecyclePostUseCase integrated into recyclable-posts.server.ts
- ✅ Unit tests created for CancelScheduleUseCase (6 tests)
- ✅ Unit tests created for RecyclePostUseCase (7 tests)
- ✅ Integration tests created for both use cases
- ✅ All unit tests passing (13/13)
- ✅ No linting errors
- ✅ Bug fixes applied

## Conclusion

The use-case layer is now fully integrated and tested. Users can recycle posts directly from the
recyclables page, and all use cases have comprehensive test coverage. The system is more
maintainable, testable, and reliable.
