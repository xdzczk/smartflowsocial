-- Verification Queries for Database Indexes
-- Run these queries to verify the indexes were created successfully

-- Check Post table indexes
SELECT 
    indexname, 
    indexdef,
    tablename
FROM pg_indexes 
WHERE tablename = 'Post' 
ORDER BY indexname;

-- Check LongFormPost table indexes
SELECT 
    indexname, 
    indexdef,
    tablename
FROM pg_indexes 
WHERE tablename = 'LongFormPost' 
ORDER BY indexname;

-- Count indexes on Post table
SELECT COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'Post';

-- Count indexes on LongFormPost table
SELECT COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'LongFormPost';

-- List all indexes with their sizes (useful for monitoring)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename IN ('Post', 'LongFormPost')
ORDER BY tablename, indexname;



