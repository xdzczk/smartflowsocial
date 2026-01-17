# Temporal API Quick Reference

Quick reference for using Temporal in this codebase.

## Import

```typescript
import {
  nowUTC,
  parseDateTimeLocal,
  formatForDateTimeLocal,
  fromDate,
  toDate,
  addHours,
  // ... and more
} from "~/lib/temporal";
```

## Common Operations

### Get Current Time

```typescript
const now = nowUTC(); // ZonedDateTime in UTC
const nowInNY = nowInTimezone("America/New_York");
```

### Parse DateTime String

```typescript
// Parse datetime-local format (YYYY-MM-DDTHH:mm)
const zoned = parseDateTimeLocal("2024-03-15T14:30", "UTC");
```

### Format for Input Fields

```typescript
const formatted = formatForDateTimeLocal(zonedDateTime, "America/New_York");
// Returns: "2024-03-15T10:30"
```

### Convert Date ↔ Temporal

```typescript
// Date → Temporal
const zoned = fromDate(new Date(), "UTC");

// Temporal → Date
const date = toDate(zonedDateTime);
```

### Add Time

```typescript
const later = addHours(zonedDateTime, 2);
const tomorrow = addDays(zonedDateTime, 1);
```

### Unix Timestamps

```typescript
// To Unix (seconds)
const timestamp = toUnixTimestamp(zonedDateTime);

// From Unix (seconds)
const zoned = fromUnixTimestamp(1234567890, "UTC");
```

### Timezone Conversion

```typescript
// Convert datetime-local string between timezones
const utcString = convertTimezone("2024-03-15T14:30", "America/New_York", "UTC");
```

## Type Reference

- `Temporal.ZonedDateTime` - Date/time with timezone (use for scheduling)
- `Temporal.PlainDateTime` - Date/time without timezone (use for calculations)
- `Temporal.Duration` - Time duration (e.g., "2 hours")

## Database Integration

### Writing to Database

```typescript
import { toPrismaDate, parseDateTimeLocal } from "~/lib/temporal";

const zonedDateTime = parseDateTimeLocal("2024-03-15T14:30", userTimezone);
await prisma.post.create({
  data: {
    scheduledAtUtc: toPrismaDate(zonedDateTime), // Temporal → Date
  },
});
```

### Reading from Database

```typescript
import { fromPrismaDate } from "~/lib/temporal";

const post = await prisma.post.findUnique(...);
// Optional: convert to Temporal if you need Temporal operations
const scheduledAtUtc = fromPrismaDate(post.scheduledAtUtc, "UTC");
```

## Best Practices

1. **Always use ZonedDateTime for user-facing times**
2. **Store in UTC, display in user timezone**
3. **Use utility functions instead of direct Temporal API**
4. **Convert to Date at database boundary** (use `toPrismaDate()`)
5. **Use cases accept Temporal**, not Date

## Migration Checklist

When migrating code:

- [ ] Replace `new Date()` with `nowUTC()` or `nowInTimezone()`
- [ ] Replace `new Date(string)` with `parseDateTimeLocal()` or `fromDate()`
- [ ] Replace manual formatting with `formatForDateTimeLocal()`
- [ ] Replace `setHours()` / `setMinutes()` with `addHours()` / `addMinutes()`
- [ ] Replace timezone conversion logic with `convertTimezone()`
- [ ] Update tests to verify Temporal behavior
