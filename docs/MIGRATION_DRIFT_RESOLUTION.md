# Resolving Prisma Migration Drift

**Issue**: Prisma detected that your database schema doesn't match the migration history.

## Understanding the Problem

This happens when:
- The database was created manually or through other means
- Migrations were applied but the `_prisma_migrations` table is out of sync
- The schema was changed directly in the database

## Solution Options

### Option 1: Use `prisma db push` (Recommended for Development)

This will sync your schema (including new indexes) without dealing with migration history:

```bash
npx prisma db push
```

**Pros:**
- Quick and easy
- Perfect for development
- Adds the new indexes immediately

**Cons:**
- Doesn't create a migration file
- Not recommended for production

### Option 2: Create Baseline Migration (Recommended for Production)

This creates a migration that matches your current database state:

```bash
# Step 1: Mark existing migrations as applied (if database already has the structure)
npx prisma migrate resolve --applied 20250910064844_init_with_blosstr_provider
npx prisma migrate resolve --applied 20250911042114_hashtag_presets_system
npx prisma migrate resolve --applied 20250911043852_add_hashtag_preset_to_queue_type
npx prisma migrate resolve --applied 20251002023235_add_subscription_system

# Step 2: Create migration for new indexes
npx prisma migrate dev --name add_query_performance_indexes
```

### Option 3: Reset Database (Development Only - LOSES ALL DATA)

If you don't need the data:

```bash
npx prisma migrate reset
```

This will:
- Drop the database
- Recreate it
- Run all migrations
- Run seed script

## Recommended Approach for Your Situation

Since you're in development and want to add indexes:

**Use Option 1** (`prisma db push`):

```bash
npx prisma db push
```

This will:
- Add the new indexes to your existing database
- Not affect your data
- Sync the schema immediately

Then, if you want a proper migration file for version control:

```bash
# After db push works, create a migration that reflects the current state
npx prisma migrate dev --create-only --name add_query_performance_indexes
# Edit the migration file to only include the index additions
# Then mark it as applied
npx prisma migrate resolve --applied add_query_performance_indexes
```

## Verifying the Fix

After applying the fix, verify indexes were created:

```sql
-- Check Post table indexes
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'Post' 
ORDER BY indexname;

-- Check LongFormPost table indexes
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'LongFormPost' 
ORDER BY indexname;
```

You should see the new indexes:
- `Post_userId_isScheduled_isPosted_idx`
- `Post_userId_isPosted_idx`
- `Post_userId_draft_idx`
- `Post_isScheduled_scheduledFor_idx`
- `Post_userId_scheduledFor_idx`
- And similar for LongFormPost

## Next Steps

1. Run `npx prisma db push` to add indexes
2. Verify indexes were created
3. Test query performance
4. Monitor slow query logs

