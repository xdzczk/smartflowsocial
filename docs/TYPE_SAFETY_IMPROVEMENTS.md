# Type Safety Improvements

**Date**: 2025-12-26  
**Last Updated**: 2025-12-26

## Overview

This document describes the type safety improvements made to replace `any` types in business logic with proper TypeScript types. This includes both the initial improvements and subsequent incremental updates.

## Changes Made

### 1. ScheduleConfig Type Definitions

**Created**: `app/features/posts/types.ts`

Added proper type definitions for schedule configurations:

```typescript
export interface IntervalScheduleConfig {
    useGlobalInterval?: boolean;
    intervalHours?: number;
}

export interface FixedSlotsScheduleConfig {
    slots: string[];
}

export type ScheduleConfig = IntervalScheduleConfig | FixedSlotsScheduleConfig;
```

**Type Guards Added**:
- `isIntervalScheduleConfig()` - Checks if config is interval type
- `isFixedSlotsScheduleConfig()` - Checks if config is fixed slots type

**Files Updated**:
- ✅ `app/features/posts/types.ts` - Added ScheduleConfig types
- ✅ `app/features/posts/bulkposts.handlers.ts` - Replaced `as any` with type guards
- ✅ `app/features/posts/schedulers.ts` - Replaced `as any` with type guards

### 2. MutedListData Type Definition

**Created**: `app/features/engagement/types.ts`

Added proper type for muted list data stored as Json in Prisma:

```typescript
export interface MutedListData {
  npubs: string[];
  lastSynced: string;
}
```

**Files Updated**:
- ✅ `app/features/engagement/types.ts` - Added MutedListData type
- ✅ `app/features/user/services/user-settings.server.ts` - Replaced `as any` with MutedListData type

### 3. UploadProvider Type Fix

**Fixed**: Legacy "BLOSSOM" value handling

**Files Updated**:
- ✅ `app/features/user/services/user-settings.server.ts` - Removed `as any` for upload provider check

### 4. AccountSwitcher Type Fixes

**Files Updated**:
- ✅ `app/features/user/components/AccountSwitcher.tsx` - Removed `as any` for useOptionalUser
- ✅ `app/features/user/components/AccountSwitcher.tsx` - Added proper NostrEventData type for event

## Remaining `any` Types

The following `any` types remain but are acceptable:

1. **Third-party library integrations** (EditorJS, Nostr libraries)
   - These are external APIs that don't provide full TypeScript types
   - Located in: `app/features/posts/types.ts` (EditorJSAPI), `app/features/nostr/types.ts`

2. **Component code** (less critical)
   - Some component props may still use `any` for flexibility
   - These don't affect business logic

## Impact

### Before
- `scheduleConfig as any` in critical scheduling logic
- `mutedList as any` in user settings
- `useOptionalUser() as any` in components
- No type safety for schedule configurations

### After
- ✅ Proper ScheduleConfig types with type guards
- ✅ MutedListData type for JSON fields
- ✅ Type-safe schedule configuration handling
- ✅ Improved type safety in business logic paths

## Testing

All changes maintain backward compatibility:
- ✅ No breaking changes
- ✅ All existing functionality preserved
- ✅ Type guards provide runtime safety
- ✅ Linter passes with no errors

## Next Steps

1. **Incremental improvements** (ongoing):
   - Replace `any` in third-party integrations as types become available
   - Improve EditorJS API types
   - Add more specific types for Nostr events

2. **Monitor type coverage**:
   - Track `any` usage over time
   - Aim for <50 instances (down from 114)
   - Focus on business logic paths first

## Files Modified

- `app/features/posts/types.ts` - Added ScheduleConfig types
- `app/features/posts/bulkposts.handlers.ts` - Replaced `as any` with type guards
- `app/features/posts/schedulers.ts` - Replaced `as any` with type guards
- `app/features/engagement/types.ts` - Added MutedListData type
- `app/features/user/services/user-settings.server.ts` - Replaced `as any` with proper types
- `app/features/user/components/AccountSwitcher.tsx` - Removed unnecessary `as any`

## References

- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
- [Improvement Plan](./IMPROVEMENT_PLAN.md#4-replace-any-types-in-business-logic)

