-- Database index governance check for CI/staging.
-- Fails with non-zero exit (via RAISE EXCEPTION) if critical index coverage regresses.

\echo '=== Post index inventory ==='
SELECT
  indexname,
  indexdef,
  tablename
FROM pg_indexes
WHERE tablename = 'Post'
ORDER BY indexname;

\echo '=== LongFormPost index inventory ==='
SELECT
  indexname,
  indexdef,
  tablename
FROM pg_indexes
WHERE tablename = 'LongFormPost'
ORDER BY indexname;

\echo '=== Index size snapshot ==='
-- pg_stat_user_indexes exposes relname/indexrelname (not tablename/indexname).
SELECT
  schemaname,
  relname AS tablename,
  indexrelname AS indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE relname IN ('Post', 'LongFormPost')
ORDER BY relname, indexrelname;

DO $$
DECLARE
  post_index_count INTEGER;
  longform_index_count INTEGER;
  has_post_user_state_sched BOOLEAN;
  has_post_dep_state_sched BOOLEAN;
  has_post_signing_state BOOLEAN;
  has_longform_user_state_sched BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO post_index_count
  FROM pg_indexes
  WHERE tablename = 'Post';

  SELECT COUNT(*) INTO longform_index_count
  FROM pg_indexes
  WHERE tablename = 'LongFormPost';

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'Post'
      AND indexdef ILIKE '%(%"userId"%, %"currentState"%, %"scheduledAtUtc"%)%'
  ) INTO has_post_user_state_sched;

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'Post'
      AND indexdef ILIKE '%(%"dependencyMode"%, %"currentState"%, %"scheduledAtUtc"%)%'
  ) INTO has_post_dep_state_sched;

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'Post'
      AND indexdef ILIKE '%(%"signingState"%, %"currentState"%)%'
  ) INTO has_post_signing_state;

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'LongFormPost'
      AND indexdef ILIKE '%(%"userId"%, %"currentState"%, %"scheduledAtUtc"%)%'
  ) INTO has_longform_user_state_sched;

  IF post_index_count < 10 THEN
    RAISE EXCEPTION 'Post index count too low: % (expected >= 10)', post_index_count;
  END IF;

  IF longform_index_count < 5 THEN
    RAISE EXCEPTION 'LongFormPost index count too low: % (expected >= 5)', longform_index_count;
  END IF;

  IF NOT has_post_user_state_sched THEN
    RAISE EXCEPTION 'Missing critical Post index on (userId, currentState, scheduledAtUtc)';
  END IF;

  IF NOT has_post_dep_state_sched THEN
    RAISE EXCEPTION 'Missing critical Post index on (dependencyMode, currentState, scheduledAtUtc)';
  END IF;

  IF NOT has_post_signing_state THEN
    RAISE EXCEPTION 'Missing critical Post index on (signingState, currentState)';
  END IF;

  IF NOT has_longform_user_state_sched THEN
    RAISE EXCEPTION 'Missing critical LongFormPost index on (userId, currentState, scheduledAtUtc)';
  END IF;

  RAISE NOTICE 'Index governance checks passed (Post: %, LongFormPost: %)', post_index_count, longform_index_count;
END $$;















