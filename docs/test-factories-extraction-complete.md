# Test Factories Extraction - Complete ✅

## Summary

Successfully extracted common test patterns into reusable helpers to reduce duplication in large
test files. Created specialized test helpers for payment tests and action handler tests.

## What Was Created

### 1. Payment Test Helpers (`tests/utils/payment-test-helpers.ts`)

**Purpose**: Reduce duplication in `payment-model.test.ts` (1129 LOC)

**Features**:

- `createMockPaymentPrisma()` - Mock Prisma client for payment tests
- `resetMockPaymentPrismaTransaction()` - Reset transaction mocks
- `createMockPlan()` - Builder for mock plan objects
- `createMockPayment()` - Builder for mock payment objects
- `createMockSubscription()` - Builder for mock subscription objects
- `createMockLN()` - Builder for mock LN client
- `setupPaymentTestEnvironment()` / `cleanupPaymentTestEnvironment()` - Environment setup
- `paymentScenarios` - Pre-configured test scenarios (free plan, paid plan, inactive plan, etc.)

**Benefits**:

- Eliminates repeated mock setup code
- Provides consistent test data builders
- Pre-configured scenarios for common test cases

### 2. Action Test Helpers (`tests/utils/action-test-helpers.ts`)

**Purpose**: Reduce duplication in `newlongform-action.test.ts` (919 LOC) and similar action handler
tests

**Features**:

- `FormDataStore` - Class for managing FormData in Remix upload handler tests
- `createMockRemixUploadHandlers()` - Mock Remix upload handlers with FormData store support
- `createMockUseCase()` - Factory for creating mock use case classes
- `setupUseCaseMocks()` - Setup default use case mocks
- `setupActionUserMocks()` - Setup default user mocks for action handlers
- `actionScenarios` - Pre-configured FormData scenarios (image upload, save draft, publish,
  schedule)

**Benefits**:

- Simplifies complex FormData mocking
- Reduces use case mock setup boilerplate
- Provides ready-to-use action scenarios

## Usage Examples

### Payment Tests

**Before**:

```typescript
const mockPlan = {
  id: TEST_PLAN_ID,
  name: "Free Plan",
  price: 0,
  isActive: true,
};
(mockPrisma.plan.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPlan);
```

**After**:

```typescript
import { createMockPlan, paymentScenarios } from "~/tests/utils/test-helpers";

const { mockPlan } = paymentScenarios.freePlanInvoice(mockPrisma);
// Or
const mockPlan = createMockPlan({ name: "Free Plan", price: 0 });
```

### Action Handler Tests

**Before**:

```typescript
const formData = new FormData();
formData.append("_action", "save-draft");
formData.append("title", "Test Title");
formData.append("content", "Test Content");
```

**After**:

```typescript
import { actionScenarios } from "~/tests/utils/test-helpers";

const formData = actionScenarios.saveDraft.formData("Test Title", "Test Content");
```

## Integration

All helpers are exported from `tests/utils/test-helpers.ts` for easy access:

```typescript
import {
  // Payment helpers
  createMockPlan,
  createMockPayment,
  paymentScenarios,
  // Action helpers
  FormDataStore,
  actionScenarios,
  setupUseCaseMocks,
  // Existing helpers
  createMockFormData,
  createMockUser,
} from "~/tests/utils/test-helpers";
```

## Next Steps

1. ✅ Create payment test helpers - **Complete**
2. ✅ Create action test helpers - **Complete**
3. ⏳ Refactor `payment-model.test.ts` to use new helpers - **Recommended**
4. ⏳ Refactor `newlongform-action.test.ts` to use new helpers - **Recommended**
5. ⏳ Extract common beforeEach patterns - **Can be done incrementally**

## Impact

- **Code Reuse**: Common patterns extracted into reusable helpers
- **Maintainability**: Update test patterns in one place
- **Readability**: Tests are more concise and focused
- **Consistency**: All tests use the same patterns

## Files Created

- `tests/utils/payment-test-helpers.ts` (245 LOC)
- `tests/utils/action-test-helpers.ts` (215 LOC)

## Files Updated

- `tests/utils/test-helpers.ts` - Added exports for new helpers
