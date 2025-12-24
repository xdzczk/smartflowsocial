# Calendar Feature Documentation

## Overview

The calendar feature provides a Notion-style visual interface for managing scheduled posts with drag-and-drop functionality and smart queue override logic.

## Features

### 📅 Calendar Views

- **Weekly View**: Horizontal day layout (Mon-Sun) with hourly time slots (00:00-23:59)
- **Monthly View**: Standard calendar grid with post cards under each date
- **Navigation**: Previous/next navigation and "Today" button
- **Current Time Indicator**: Red line showing current time in weekly view

### 🧱 Post Blocks

- **Visual Representation**: Shows post preview, type icons, and scheduling time
- **Image Thumbnails**: Displays image previews for posts with media (supports various formats)
- **Status Indicators**:
  - Blue gear icon for auto-scheduled posts
  - Green checkmark for signed posts
  - Color-coded backgrounds based on scheduling type
- **Drag and Drop**: Full drag-and-drop support with visual feedback
- **Responsive Thumbnails**: Different thumbnail sizes for different views (minimal, compact, full)

### 🖱 Drag & Drop Logic

The system intelligently handles two types of scheduled posts:

#### Manual Posts (Simple Flow)

```
User drags post → Simple confirmation modal → Update time
```

#### Auto-Scheduled Posts (Advanced Flow)

```
User drags post → Advanced modal with options:
- "Cancel" - No changes
- "Keep Queue Rule" - Update time but keep auto-scheduling
- "Convert to Manual" - Update time and disable auto-scheduling
```

### ⚙️ Queue Override System

- **`manual_override` field**: New boolean field in Post model
- **Queue Integration**: Automatically cancels old scheduled jobs when rescheduling
- **Event Re-signing**: Clears signed events when time changes (requires client re-signing)
- **Smart Detection**: Automatically detects if posts were auto-scheduled

## Database Changes

### New Field Added

```prisma
model Post {
  // ... existing fields
  manual_override Boolean @default(false)
}
```

### Migration

```bash
npx prisma db push
```

## API Endpoints

### POST /dashboard/calendar

Handles post rescheduling with the following form data:

- `action`: "reschedule"
- `postId`: ID of the post to reschedule
- `newTime`: New timestamp in Unix seconds
- `overrideQueue`: "true" or "false"

## File Structure

```
app/components/calendar/
├── Calendar.jsx           # Main calendar container
├── WeeklyView.jsx        # Weekly view implementation
├── MonthlyView.jsx       # Monthly view implementation
├── PostBlock.jsx         # Draggable post components
├── RescheduleModal.jsx   # Confirmation modals
├── calendar.css          # Calendar-specific styles
└── index.js              # Component exports

app/routes/
└── dashboard.calendar.jsx # Main calendar route
```

## Usage

1. Navigate to `/dashboard/calendar`
2. Switch between Week/Month views using the toggle
3. Drag posts to new time slots
4. Confirm changes in the modal that appears
5. Posts will need to be re-signed after rescheduling

## Technical Notes

### Signing Behavior

- **User-Required Signing**: All scheduled posts must be signed by the user client-side before scheduling
- **No Server-Side Signing**: The server does not sign events; users must approve each post with their Nostr key
- **Re-signing on Reschedule**: When a post is rescheduled, it must be re-signed with the new timestamp
- **Content Preservation**: Uses the exact same content and tags from the original signed event
- **Only Timestamp Changes**: Only the `created_at` field is updated, everything else remains identical
- **Client-side Signing**: Uses the same `signEventFn` as regular post creation
- **Nostr Event Integrity**: Maintains proper nostr event structure with correct timestamp
- **Job Scheduling**: Posts are only scheduled in the queue system after successful user signing
- **Unsigned Post Protection**: Prevents scheduling of posts that don't have signed events

### Queue Integration

- Auto-scheduled posts are detected by checking `manual_override` field
- Original queue jobs are cancelled when posts are rescheduled
- New jobs are scheduled only after posts are properly signed

### Performance Considerations

- Calendar renders efficiently with virtualized time slots
- Drag operations use requestAnimationFrame for smooth performance
- Posts are grouped by date/time for optimal rendering
- **Image Loading**: Lazy loading for thumbnails to improve performance
- **Smart Image Parsing**: Handles both JSON array and direct URL formats
- **Error Handling**: Graceful fallbacks when images fail to load
