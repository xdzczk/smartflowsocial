# Tier 3 Implementation Plan

## Overview

Tier 3 focuses on **Completing Remaining Tier 2 Items** and **Advanced Resilience Features**. These improvements complete the production-ready infrastructure and add advanced capabilities for handling edge cases and system evolution.

## Tier 3 Items

### 1. Job Payload Versioning ✅ (Complete)
- ✅ `schemaVersion` in outbox payloads
- ✅ **Version handling in workers** - Complete
- ✅ **Backward compatibility checks** - Complete
- ✅ **Version migration utilities** - Complete

### 2. Advanced Retry Strategies ✅ (Complete)
- ✅ Exponential backoff with jitter
- ✅ Configurable retry policies per job type
- ✅ Dead letter queue for permanently failed jobs
- ✅ Retry metrics and monitoring

### 3. Database Constraints & Validation ✅ (Complete)
- ✅ Add database-level constraints for invariants
- ✅ Check constraints for state transitions
- ✅ Foreign key constraints where appropriate (already in place)
- ✅ Unique constraints for idempotency keys (already in place)

### 4. Recurring/Recycling Post Model ⏭️ (Skipped)
- ⏭️ Create RecurringPost model - **SKIPPED** (Complexity vs. value analysis determined manual recycling is sufficient)
- ⏭️ Timezone handling for recurring posts - **SKIPPED**
- ⏭️ Recurrence pattern validation - **SKIPPED**
- ⏭️ Integration with scheduling system - **SKIPPED**

### 5. Enhanced Error Handling ✅ (Complete)
- ✅ Retryable vs non-retryable error classification
- ✅ Error recovery strategies
- ✅ Error context preservation
- ✅ Error aggregation and reporting

## Implementation Order

### Phase 1: Job Payload Versioning (High Priority) ✅ **COMPLETE**
1. ✅ Add version handling in queue workers
2. ✅ Implement backward compatibility checks
3. ✅ Add version migration utilities
4. ⏳ Test with multiple schema versions (manual testing recommended)

### Phase 2: Advanced Retry Strategies (High Priority) ✅ **COMPLETE**
1. ✅ Implement exponential backoff with jitter
2. ✅ Add configurable retry policies
3. ✅ Create dead letter queue
4. ✅ Add retry metrics

### Phase 3: Database Constraints (Medium Priority) ✅ **COMPLETE**
1. ✅ Add check constraints for state transitions
2. ✅ Foreign key constraints (already in place)
3. ✅ Unique constraints for idempotency (already in place)
4. ✅ Validate constraints don't break existing data

### Phase 4: Recurring/Recycling Model (Medium Priority) ⏭️ **SKIPPED**
1. ⏭️ Create RecurringPost model - **SKIPPED** (Complexity analysis showed high complexity for moderate value)
2. ⏭️ Implement timezone handling - **SKIPPED**
3. ⏭️ Add recurrence pattern validation - **SKIPPED**
4. ⏭️ Integrate with scheduling - **SKIPPED**

**Reason for Skipping:** After analysis, the complexity of implementing automatic recurring posts (especially handling "one by one" post additions) was deemed too high relative to the value provided. Current manual recycling functionality is sufficient for user needs.

### Phase 5: Enhanced Error Handling (Low Priority) ✅ **COMPLETE**
1. ✅ Classify retryable vs non-retryable errors
2. ✅ Implement error recovery strategies
3. ✅ Preserve error context
4. ✅ Add error aggregation

## Detailed Implementation

### 1. Job Payload Versioning

#### 1.1 Version Handling in Workers
- Check `schemaVersion` in job payload
- Route to appropriate handler based on version
- Log version mismatches
- Support multiple versions simultaneously

#### 1.2 Backward Compatibility
- Maintain handlers for old versions
- Migrate old payloads to new format
- Deprecation warnings for old versions
- Version upgrade utilities

#### 1.3 Version Migration
- Automatic migration for compatible versions
- Manual migration for breaking changes
- Migration scripts and utilities
- Version compatibility matrix

### 2. Advanced Retry Strategies

#### 2.1 Exponential Backoff
- Base delay configuration
- Maximum delay cap
- Jitter to prevent thundering herd
- Per-job-type configuration

#### 2.2 Retry Policies
- Max retry attempts per job type
- Retryable error classification
- Custom retry logic per use case
- Retry policy registry

#### 2.3 Dead Letter Queue
- Failed job storage
- Manual retry capability
- Error analysis and debugging
- Cleanup policies

### 3. Database Constraints

#### 3.1 State Transition Constraints
- Check constraints for valid states
- Prevent invalid transitions at DB level
- State validation on insert/update
- Migration strategy for existing data

#### 3.2 Foreign Key Constraints
- Ensure referential integrity
- Cascade delete policies
- Foreign key indexes
- Constraint validation

#### 3.3 Unique Constraints
- Idempotency key uniqueness
- Composite unique constraints
- Constraint violation handling
- Migration for existing duplicates

### 4. Recurring/Recycling Model

#### 4.1 RecurringPost Model
- Recurrence pattern (daily, weekly, monthly)
- Timezone handling
- Next occurrence calculation
- Recurrence end conditions

#### 4.2 Timezone Support
- User timezone storage
- UTC conversion utilities
- Daylight saving time handling
- Timezone-aware scheduling

#### 4.3 Integration
- Create recurring posts
- Schedule next occurrence
- Handle recurrence end
- Recurrence metrics

### 5. Enhanced Error Handling

#### 5.1 Error Classification
- Retryable errors (network, temporary)
- Non-retryable errors (validation, permanent)
- Error type registry
- Classification logic

#### 5.2 Error Recovery
- Automatic recovery strategies
- Manual intervention points
- Error context preservation
- Recovery metrics

## Files to Create/Modify

### New Files
- ✅ `app/infra/queue/version-handler.server.ts` - Version handling logic
- ✅ `app/infra/queue/retry-policy.server.ts` - Retry policy configuration
- ✅ `app/infra/queue/dead-letter-queue.server.ts` - Dead letter queue
- ✅ `app/lib/error-classification.server.ts` - Error classification system
- ✅ `app/lib/error-recovery.server.ts` - Error recovery strategies
- ✅ `app/lib/error-aggregation.server.ts` - Error aggregation and reporting

### Modified Files
- ✅ `app/features/posts/queues.server.ts` - Add retry handling and dead letter queue
- ✅ `app/infra/outbox/outbox-worker.server.ts` - Version checks
- ✅ `app/infra/queue/queue-client.server.ts` - Add retry configuration
- ✅ `app/lib/queue-metrics.server.ts` - Add dead letter metrics
- ✅ `prisma/schema.prisma` - Add DeadLetterJob model
- ✅ `prisma/migrations/20250102000000_add_database_constraints/migration.sql` - Database constraints
- ✅ `scripts/apply-database-constraints.ts` - Constraint application script
- ⏳ `prisma/schema.prisma` - Add RecurringPost model (Phase 4)
- ✅ `app/lib/error-logger.server.ts` - Enhanced with error classification
- ✅ `app/infra/queue/retry-policy.server.ts` - Updated to use enhanced classification

## Success Criteria

1. ✅ Workers handle multiple payload versions - **COMPLETE**
2. ✅ Backward compatibility maintained - **COMPLETE**
3. ✅ Retry strategies configurable per job type - **COMPLETE**
4. ✅ Dead letter queue for failed jobs - **COMPLETE**
5. ✅ Database constraints enforce invariants - **COMPLETE** (Phase 3)
6. ⏭️ Recurring posts model implemented - **SKIPPED** (Phase 4 - Complexity vs. value analysis)

## Estimated Effort

- **Phase 1 (Versioning)**: 1-2 days
- **Phase 2 (Retry Strategies)**: 2-3 days
- **Phase 3 (Database Constraints)**: 1-2 days
- **Phase 4 (Recurring Model)**: 2-3 days - **SKIPPED**
- **Phase 5 (Error Handling)**: 1-2 days

**Total**: 7-12 days
