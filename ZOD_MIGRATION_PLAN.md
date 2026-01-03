# Zod Migration Plan - Full Codebase

## Overview

This document tracks the migration of all action handlers to use Zod validation across the entire codebase.

## Status: ✅ ALL PHASES COMPLETE

**Settings Actions (8/8)** - ✅ COMPLETE
- All settings action files now use Zod validation

**Post Actions (10/10)** - ✅ COMPLETE
- All post action files now use Zod validation

**Other Feature Actions (4/4)** - ✅ COMPLETE
- All other feature action files now use Zod validation (or don't require it)

## Phase 2: Post Actions - ✅ COMPLETE

### Simple Actions (Priority 1) - ✅ COMPLETE
These actions have straightforward FormData parsing and are good candidates for migration:

1. ✅ **dashboard-action.server.ts** - Delete, bulk delete operations
2. ✅ **scheduled-action.server.ts** - Delete, bulk delete operations  
3. ✅ **drafts-action.server.ts** - Delete, bulk delete, bulk sign & resume
4. ✅ **calendar-action.server.ts** - Reschedule operations
5. ✅ **posted.action.server.ts** - Posted posts actions (delete, repost, quote)
6. ✅ **draft-edit-action.server.ts** - Draft editing

### Complex Actions (Priority 2) - ✅ COMPLETE
These handle file uploads and complex data structures:

7. ✅ **newpost-action.server.ts** - New post creation with file uploads (validated, handlers still use formData for files)
8. ✅ **newlongform-action.server.ts** - Longform post creation (validated, handlers still use formData for files)
9. ✅ **longform-edit-action.server.ts** - Longform editing (validated, handlers still use formData for files)
10. ✅ **bulkposts.action.server.ts** - Bulk post operations (fully validated)

## Phase 3: Other Feature Actions - ✅ COMPLETE

11. ✅ **templates-action.server.ts** - Template operations
12. ✅ **template-edit.server.ts** - Template editing
13. ✅ **search-action.server.ts** - Search operations (route action migrated to Zod)
14. ✅ **plans-action.server.ts** - Payment plan operations

## Migration Pattern

For each action file:

1. **Create Zod schemas** in appropriate schema file
2. **Update action handler** to use `validateFormDataOrRespond()`
3. **Remove manual FormData parsing** (`formData.get()`, type assertions)
4. **Test** the action still works correctly
5. **Verify** no TypeScript errors

## Schema Organization

- `schemas/settings.schemas.ts` - Settings actions
- `schemas/posts-actions.schemas.ts` - Post actions (dashboard, scheduled, drafts, calendar)
- `schemas/posts.schemas.ts` - Post creation/editing (newpost, longform, bulkposts)
- `schemas/templates.schemas.ts` - Template actions ✅
- `schemas/payments.schemas.ts` - Payment actions ✅

## Notes

- **File uploads**: Actions that handle `multipart/form-data` may need special handling
- **Arrays**: Use `formData.getAll()` and ensure schemas handle arrays correctly
- **JSON parsing**: Some actions parse JSON strings - handle in schema transforms
- **Optional fields**: Use `.optional()` or `.nullable()` appropriately

