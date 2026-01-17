# Time Semantics & Scheduling Behavior

**Last Updated:** 2025-01-02  
**Status:** Active

This document defines what scheduled times mean, how timezone changes are handled, and what happens
when users travel.

---

## Core Principle

**Scheduled times are immutable user intent, converted to UTC for execution.** Once scheduled, the
UTC time is fixed, regardless of timezone changes.

---

## Scheduled Time Model

### User Intent Time

**Definition:** The time the user specified when scheduling, in their configured timezone.

**Example:**

- User timezone: `America/New_York`
- User schedules: "2025-01-15 9:00 AM"
- User intent: 9:00 AM in New York time

**Storage:**

- Stored as `scheduledAtUtc` in database (UTC)
- Converted from user's timezone at scheduling time
- Immutable once scheduled

---

### Execution Time

**Definition:** The UTC time when the post will actually publish.

**Example:**

- User intent: "2025-01-15 9:00 AM" (New York time)
- Execution time: "2025-01-15 14:00:00 UTC" (5 hours later, EST is UTC-5)

**Storage:**

- `scheduledAtUtc` field in database
- Used by queue system to schedule jobs
- Immutable (doesn't change if user changes timezone)

---

## Timezone Handling

### At Scheduling Time

**Process:**

1. User specifies time in their configured timezone
2. System converts to UTC using Temporal API
3. UTC time stored in `scheduledAtUtc`
4. Job scheduled in queue with UTC time

**Example:**

```typescript
// User in America/New_York schedules "2025-01-15 9:00 AM"
const userIntent = parseDateTimeLocal("2025-01-15T09:00", "America/New_York");
const executionTime = userIntent.withTimeZone("UTC"); // 2025-01-15 14:00:00 UTC
// Stored in database as scheduledAtUtc: 2025-01-15 14:00:00 UTC
```

---

### After Scheduling (Timezone Changes)

**Behavior:** Scheduled times do NOT change if user changes timezone.

**Rationale:**

- User scheduled for a specific moment in time
- Changing timezone shouldn't change when post publishes
- UTC time is fixed and immutable

**Example:**

1. User in `America/New_York` schedules "2025-01-15 9:00 AM" → stored as `2025-01-15 14:00:00 UTC`
2. User changes timezone to `America/Los_Angeles`
3. Post still publishes at `2025-01-15 14:00:00 UTC`
4. In new timezone, this appears as "2025-01-15 6:00 AM" (PST is UTC-8)
5. But original intent was 9:00 AM New York time, so it publishes at that moment

**Display:**

- When displaying scheduled posts, convert `scheduledAtUtc` to user's current timezone
- User sees: "Scheduled for 2025-01-15 6:00 AM" (in their new timezone)
- But actual publish time is still `2025-01-15 14:00:00 UTC`

---

### User Travel Scenario

**Scenario:** User schedules post, then travels to different timezone.

**Question:** "What does 'at 9am' mean if user travels?"

**Answer:** It means "9am in the timezone where you were when you scheduled it."

**Example:**

1. User in `America/New_York` schedules "2025-01-15 9:00 AM"
   - Stored as: `2025-01-15 14:00:00 UTC`
2. User travels to `Europe/London` (UTC+0)
3. Post still publishes at `2025-01-15 14:00:00 UTC`
4. In London, this is "2025-01-15 2:00 PM"
5. Original intent (9:00 AM New York) is preserved

**Rationale:**

- User's intent was "9:00 AM in New York"
- Traveling shouldn't change when post publishes
- UTC time is fixed and immutable

---

## "Schedule for Tomorrow" Semantics

**Question:** "What does 'schedule for tomorrow' mean?"

**Answer:** It means "tomorrow in your current timezone at the time you specify."

**Process:**

1. User selects "tomorrow" → system calculates tomorrow's date in user's timezone
2. User specifies time (e.g., "9:00 AM")
3. System combines: tomorrow + 9:00 AM in user's timezone
4. Converts to UTC and stores

**Example:**

- Today: 2025-01-14 (in `America/New_York`)
- User schedules "tomorrow at 9:00 AM"
- System calculates: 2025-01-15 9:00 AM New York time
- Converts to UTC: 2025-01-15 14:00:00 UTC
- Stored as `scheduledAtUtc: 2025-01-15 14:00:00 UTC`

**Edge case:** If user changes timezone after scheduling, "tomorrow" is still the original date
(doesn't recalculate).

---

## System Clock Drift

**Question:** "What happens if system clock drifts?"

**Answer:** System should use NTP (Network Time Protocol) to keep clock synchronized.

**Behavior:**

- Queue system uses system clock to determine when to publish
- If clock drifts, posts may publish early or late
- Clock drift is a system administration issue, not application logic

**Mitigation:**

- Use NTP for clock synchronization
- Monitor clock drift
- Alert if drift exceeds threshold (e.g., ±1 second)

**What we cannot prevent:**

- System clock drift (requires NTP)
- Time server issues (requires backup time servers)

---

## DST (Daylight Saving Time) Transitions

**Question:** "What happens during DST transitions?"

**Answer:** Temporal API handles DST correctly, but scheduled times are fixed in UTC.

**Behavior:**

1. User schedules "2025-03-09 2:00 AM" (DST transition day in US)
2. System converts to UTC (handles DST correctly)
3. Stored as UTC time (no DST ambiguity)
4. Publishes at that UTC time

**Example:**

- User in `America/New_York` schedules "2025-03-09 2:00 AM"
- DST starts at 2:00 AM (clock jumps to 3:00 AM)
- System converts: "2025-03-09 2:00 AM EST" → "2025-03-09 7:00:00 UTC"
- Stored as: `scheduledAtUtc: 2025-03-09 7:00:00 UTC`
- Publishes at that UTC time

**Note:** Temporal API correctly handles ambiguous times (e.g., 2:00 AM during DST transition).

---

## Display Semantics

### Showing Scheduled Times to Users

**Rule:** Always display scheduled times in user's current timezone.

**Process:**

1. Read `scheduledAtUtc` from database
2. Convert to user's current timezone using Temporal
3. Display in user's timezone

**Example:**

```typescript
// Database: scheduledAtUtc = 2025-01-15 14:00:00 UTC
// User's current timezone: America/Los_Angeles
const zonedDateTime = fromPrismaDate(scheduledAtUtc, "UTC");
const inUserTz = zonedDateTime.withTimeZone("America/Los_Angeles");
// Display: "2025-01-15 6:00 AM" (PST is UTC-8)
```

**Rationale:**

- Users think in their local timezone
- Displaying UTC would be confusing
- Always show times in user's current timezone

---

### Showing "Time Until Publish"

**Rule:** Calculate time until publish using current time and scheduled UTC time.

**Process:**

1. Get current time in UTC
2. Get `scheduledAtUtc` from database
3. Calculate difference
4. Display as "in X hours" or "in X minutes"

**Example:**

```typescript
const now = nowUTC();
const scheduled = fromPrismaDate(post.scheduledAtUtc, "UTC");
const diff = scheduled.since(now);
// Display: "in 2 hours" or "in 30 minutes"
```

**Note:** Time until publish is always calculated in UTC (not affected by user's timezone).

---

## Immutable Intent vs Mutable Display

### Immutable Intent

**What:** The UTC time when post will publish.

**Storage:** `scheduledAtUtc` field in database.

**Behavior:**

- Set once at scheduling time
- Never changes (even if user changes timezone)
- Used by queue system to schedule jobs

---

### Mutable Display

**What:** How the scheduled time is displayed to the user.

**Behavior:**

- Always converted to user's current timezone
- Changes if user changes timezone (display only)
- Does not affect actual publish time

**Example:**

1. User schedules "9:00 AM" in New York → stored as `14:00:00 UTC`
2. Display shows: "Scheduled for 9:00 AM" (in New York timezone)
3. User changes timezone to Los Angeles
4. Display now shows: "Scheduled for 6:00 AM" (in Los Angeles timezone)
5. But actual publish time is still `14:00:00 UTC` (unchanged)

---

## Edge Cases

### Edge Case 1: User Changes Timezone Mid-Scheduling

**Scenario:** User starts scheduling in one timezone, changes timezone, then completes scheduling.

**Behavior:**

- Uses timezone at time of scheduling completion
- If user changes timezone during scheduling, uses new timezone
- Once scheduled, UTC time is fixed

---

### Edge Case 2: Invalid Timezone

**Scenario:** User has invalid timezone configured.

**Behavior:**

- Default to UTC if timezone is invalid
- Log warning about invalid timezone
- User should fix timezone in settings

---

### Edge Case 3: Timezone Database Updates

**Scenario:** IANA timezone database is updated (e.g., new timezone rules).

**Behavior:**

- Temporal API uses latest timezone data
- Existing scheduled times are not recalculated (UTC is fixed)
- New schedules use updated timezone data

---

## Operational Guarantees

### What We Guarantee

1. **Scheduled times are immutable** - Once scheduled, UTC time doesn't change
2. **Timezone conversions are accurate** - Uses Temporal API (handles DST correctly)
3. **Display is always in user's timezone** - Users see times in their local timezone
4. **UTC storage prevents ambiguity** - No DST or timezone ambiguity in storage

### What We Don't Guarantee

1. **System clock accuracy** - Depends on NTP synchronization
2. **Timezone database updates** - Depends on Temporal polyfill updates
3. **User timezone changes** - We don't prevent users from changing timezone

---

## Best Practices

### For Users

1. **Set correct timezone** - Ensure timezone is accurate in settings
2. **Understand travel behavior** - Scheduled times don't change when you travel
3. **Check scheduled times** - Verify times are correct before scheduling

### For Developers

1. **Always use Temporal API** - Never use Date for timezone operations
2. **Store in UTC** - Always store scheduled times in UTC
3. **Display in user timezone** - Always convert to user's timezone for display
4. **Never recalculate** - Don't recalculate scheduled times based on timezone changes

---

## Future Improvements

### Consider Adding

1. **Timezone change warnings** - Warn users if changing timezone affects scheduled posts
2. **Timezone history** - Track timezone changes for audit trail
3. **Scheduled time display** - Show both local time and UTC time (for power users)
4. **Timezone validation** - Validate timezone on user input

---

## Revision History

- **2025-01-02**: Initial time semantics document created

---

**This is a living document. Update it as time handling evolves.**
