# Property-Based Testing Integration

**Date**: 2025-12-25  
**Status**: ✅ Integrated

## Overview

Property-based testing has been integrated into the test suite using [fast-check](https://github.com/dubzzz/fast-check), a powerful property-based testing framework for JavaScript/TypeScript.

## Installation

To use property-based tests, install fast-check:

```bash
npm install --save-dev fast-check
```

## What is Property-Based Testing?

Property-based testing generates random inputs to test functions, automatically discovering edge cases that manual tests might miss. Instead of writing specific test cases, you define **properties** that should always hold true.

### Example

Instead of:
```typescript
it("should format dates correctly", () => {
  expect(formatDate(new Date("2024-01-15"))).toBe("01/15/2024");
});
```

Property-based testing:
```typescript
it("should always return a string for valid date inputs", () => {
  fc.assert(
    fc.property(
      fc.date({ min: new Date("1900-01-01"), max: new Date("2100-12-31") }),
      (date) => {
        const result = formatDate(date);
        return typeof result === "string" && result.length > 0;
      },
    ),
    { numRuns: 100 },
  );
});
```

## Test Files Created

### 1. `tests/property/helpers-property.test.ts`
Property-based tests for helper functions:
- **getTimeRemaining**: Tests time formatting with random dates
- **formatDate**: Tests date formatting with various inputs
- **getImageUrls**: Tests URL array parsing
- **isVideoFile**: Tests video file detection with random URLs

**Properties Tested:**
- Functions always return expected types
- Functions handle edge cases correctly
- Functions are consistent with different input formats
- Functions maintain invariants (e.g., never return past dates)

### 2. `tests/property/nostr-conversion-property.test.ts`
Property-based tests for Nostr key conversion:
- **convertToHex**: Tests npub to hex conversion
- **convertHexToNpub**: Tests hex to npub conversion
- **Round-trip conversion**: Tests consistency of conversions

**Properties Tested:**
- Functions return null or valid strings
- Functions handle invalid inputs gracefully
- Round-trip conversions maintain consistency

### 3. `tests/property/scheduling-property.test.ts`
Property-based tests for scheduling algorithms:
- **calculateNextScheduleTime (INTERVAL)**: Tests interval-based scheduling
- **calculateNextScheduleTime (FIXED_SLOTS)**: Tests slot-based scheduling
- **Timezone handling**: Tests various timezone inputs

**Properties Tested:**
- Always returns valid Date objects
- Never returns dates in the past
- Handles various interval hours correctly
- Handles various slot configurations correctly
- Handles different timezones correctly

## Running Property-Based Tests

```bash
# Run all property-based tests
npm run test:property

# Run specific property test file
npm run test tests/property/helpers-property.test.ts

# Run with watch mode
npm run test:watch tests/property
```

## Benefits

1. **Automatic Edge Case Discovery**: Finds bugs you didn't think to test
2. **Comprehensive Coverage**: Tests thousands of input combinations
3. **Regression Prevention**: Catches regressions when properties are violated
4. **Documentation**: Properties serve as executable documentation

## Best Practices

1. **Start with Simple Properties**: Test basic invariants first
2. **Use Appropriate Generators**: Choose generators that match your domain
3. **Adjust numRuns**: More runs = more thorough but slower
4. **Combine with Unit Tests**: Property-based tests complement, don't replace, unit tests
5. **Shrink Failing Cases**: fast-check automatically shrinks failing inputs to minimal examples

## Example Properties

### Time Functions
- ✅ Always return non-empty strings
- ✅ Never return negative time
- ✅ Handle date strings and Date objects consistently

### Conversion Functions
- ✅ Return null or valid strings
- ✅ Handle invalid inputs gracefully
- ✅ Round-trip conversions maintain consistency

### Scheduling Functions
- ✅ Always return valid Date objects
- ✅ Never return dates in the past
- ✅ Handle various configurations correctly

## Future Enhancements

Consider adding property-based tests for:
- Markdown sanitization (test XSS prevention with random HTML)
- Array operations (test sorting, filtering properties)
- String manipulation (test URL parsing, hashtag extraction)
- Business logic (test invariants in content combining)

## Resources

- [fast-check Documentation](https://github.com/dubzzz/fast-check)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
- [QuickCheck Paper](https://www.cs.tufts.edu/~nr/cs257/archive/john-hughes/quick.pdf)

