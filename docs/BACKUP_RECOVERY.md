# Backup & Recovery Guide

This guide covers backup strategies and recovery procedures for SmartFlowSocial.

## Table of Contents

- [Overview](#overview)
- [Backup Strategy](#backup-strategy)
- [Database Backups](#database-backups)
- [Redis Backups](#redis-backups)
- [File Storage Backups](#file-storage-backups)
- [Automated Backups](#automated-backups)
- [Recovery Procedures](#recovery-procedures)
- [Disaster Recovery](#disaster-recovery)
- [Data Retention](#data-retention)
- [Testing Backups](#testing-backups)

---

## Overview

SmartFlowSocial requires backups for:

- **PostgreSQL Database**: User data, posts, settings
- **Redis**: Queue jobs, cached data
- **File Storage**: Uploaded images and assets
- **Configuration**: Environment variables, secrets

### Backup Principles

1. **3-2-1 Rule**: 3 copies, 2 different media, 1 off-site
2. **Regular Backups**: Daily at minimum
3. **Test Restores**: Regularly test backup restoration
4. **Documentation**: Document all backup procedures
5. **Automation**: Automate backup processes

---

## Backup Strategy

### Backup Frequency

| Data Type | Frequency | Retention |
|-----------|-----------|-----------|
| Database | Daily | 30 days |
| Redis | Daily (optional) | 7 days |
| File Storage | Daily | 30 days |
| Configuration | On change | 90 days |

### Backup Types

1. **Full Backup**: Complete database dump
2. **Incremental Backup**: Changes since last backup
3. **Point-in-Time Recovery**: Continuous WAL archiving

---

## Database Backups

### Manual Backup

#### PostgreSQL Backup

```bash
# Full database backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup specific schema
pg_dump $DATABASE_URL --schema=public > backup-schema.sql

# Backup with custom format (faster restore)
pg_dump -Fc $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).dump
```

#### Prisma Backup

```bash
# Using Prisma Studio (export data)
npx prisma studio
# Manually export data through UI

# Using Prisma Migrate (schema only)
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --script > backup-schema.sql
```

### Automated Backup Script

Create `scripts/backup-database.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/backups/database"
DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/backup-$DATE.sql.gz"

# Remove old backups
find $BACKUP_DIR -name "backup-*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Verify backup
if [ -f "$BACKUP_DIR/backup-$DATE.sql.gz" ]; then
  echo "✅ Backup created: backup-$DATE.sql.gz"
  
  # Optional: Upload to S3
  # aws s3 cp "$BACKUP_DIR/backup-$DATE.sql.gz" s3://your-backup-bucket/
else
  echo "❌ Backup failed!"
  exit 1
fi
```

### Cron Job

```bash
# Add to crontab (crontab -e)
# Daily backup at 2 AM
0 2 * * * /path/to/scripts/backup-database.sh >> /var/log/backup.log 2>&1
```

### Managed Database Backups

#### AWS RDS

- Automatic backups enabled by default
- Retention: 7-35 days
- Point-in-time recovery available

#### Railway

- Automatic daily backups
- 7-day retention
- Manual backups available

#### Fly.io

- Manual backups via `fly postgres backup create`
- Or use external backup service

### Continuous WAL Archiving

For point-in-time recovery:

```bash
# Configure PostgreSQL for WAL archiving
# In postgresql.conf:
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backups/wal/%f'
```

---

## Redis Backups

### Manual Backup

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# Save data
SAVE

# Or use BGSAVE (background save)
BGSAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /backups/redis/redis-$(date +%Y%m%d-%H%M%S).rdb
```

### Automated Backup Script

```bash
#!/bin/bash

BACKUP_DIR="/backups/redis"
DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=7

mkdir -p $BACKUP_DIR

# Trigger save
redis-cli -u $REDIS_URL BGSAVE

# Wait for save to complete
while [ "$(redis-cli -u $REDIS_URL LASTSAVE)" = "$(redis-cli -u $REDIS_URL LASTSAVE)" ]; do
  sleep 1
done

# Copy RDB file
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis-$DATE.rdb"

# Compress
gzip "$BACKUP_DIR/redis-$DATE.rdb"

# Remove old backups
find $BACKUP_DIR -name "redis-*.rdb.gz" -mtime +$RETENTION_DAYS -delete
```

### Redis Persistence

Configure Redis persistence:

```conf
# redis.conf
save 900 1      # Save after 900 sec if at least 1 key changed
save 300 10     # Save after 300 sec if at least 10 keys changed
save 60 10000   # Save after 60 sec if at least 10000 keys changed

# AOF (Append Only File) - more durable
appendonly yes
appendfsync everysec
```

---

## File Storage Backups

### S3-Compatible Storage

#### AWS S3

Enable versioning and lifecycle policies:

```json
{
  "Rules": [
    {
      "Id": "BackupRule",
      "Status": "Enabled",
      "Prefix": "",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

#### Manual Backup

```bash
# Sync to backup bucket
aws s3 sync s3://your-bucket s3://your-backup-bucket --delete
```

### Blossom Storage

Backup Blossom URLs and metadata in database. Files are stored on Blossom servers.

---

## Automated Backups

### Using GitHub Actions

Create `.github/workflows/backup.yml`:

```yaml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Backup Database
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          pg_dump $DATABASE_URL | gzip > backup.sql.gz
      
      - name: Upload to S3
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Upload Backup
        run: |
          aws s3 cp backup.sql.gz s3://your-backup-bucket/backup-$(date +%Y%m%d).sql.gz
```

### Using Docker

```dockerfile
# Dockerfile.backup
FROM postgres:15

RUN apt-get update && apt-get install -y awscli

COPY backup.sh /backup.sh
RUN chmod +x /backup.sh

CMD ["/backup.sh"]
```

---

## Recovery Procedures

### Database Recovery

#### From SQL Dump

```bash
# Restore from SQL file
psql $DATABASE_URL < backup-20240101.sql

# Restore from compressed file
gunzip -c backup-20240101.sql.gz | psql $DATABASE_URL

# Restore from custom format
pg_restore -d $DATABASE_URL backup-20240101.dump
```

#### Partial Recovery

```bash
# Restore specific table
pg_restore -d $DATABASE_URL -t posts backup-20240101.dump

# Restore specific schema
pg_restore -d $DATABASE_URL -n public backup-20240101.dump
```

#### Point-in-Time Recovery

```bash
# Stop application
pm2 stop smartflow

# Restore base backup
pg_restore -d $DATABASE_URL backup-20240101.dump

# Replay WAL logs to specific time
pg_receivewal --target-time="2024-01-01 12:00:00" /backups/wal/

# Start application
pm2 start smartflow
```

### Redis Recovery

```bash
# Stop Redis
redis-cli -u $REDIS_URL SHUTDOWN

# Copy backup file
cp /backups/redis/redis-20240101.rdb /var/lib/redis/dump.rdb

# Start Redis
redis-server

# Verify
redis-cli -u $REDIS_URL PING
```

### File Storage Recovery

```bash
# Restore from S3 backup
aws s3 sync s3://your-backup-bucket s3://your-bucket --delete
```

---

## Disaster Recovery

### Recovery Time Objectives (RTO)

- **Database**: 1 hour
- **Application**: 30 minutes
- **Full System**: 4 hours

### Recovery Point Objectives (RPO)

- **Database**: 24 hours (daily backups)
- **File Storage**: 24 hours
- **Configuration**: Real-time (version controlled)

### Disaster Recovery Plan

1. **Identify Critical Systems**
   - Database
   - Application servers
   - File storage
   - Queue system

2. **Document Recovery Steps**
   - Database restoration
   - Application deployment
   - Configuration restoration
   - Verification procedures

3. **Test Recovery**
   - Quarterly disaster recovery drills
   - Document test results
   - Update procedures based on tests

4. **Communication Plan**
   - Notify stakeholders
   - Status updates
   - Post-mortem review

### Recovery Checklist

- [ ] Identify failure point
- [ ] Stop affected services
- [ ] Restore from latest backup
- [ ] Verify data integrity
- [ ] Restart services
- [ ] Monitor for issues
- [ ] Document incident
- [ ] Post-mortem review

---

## Data Retention

### Retention Policies

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| Database Backups | 30 days | Daily recovery needs |
| Redis Backups | 7 days | Queue data is ephemeral |
| File Storage | 30 days | User content recovery |
| Application Logs | 90 days | Debugging and audit |
| Error Logs | 180 days | Security and compliance |

### Automated Cleanup

```bash
#!/bin/bash

# Clean old database backups
find /backups/database -name "*.sql.gz" -mtime +30 -delete

# Clean old Redis backups
find /backups/redis -name "*.rdb.gz" -mtime +7 -delete

# Clean old logs
find /var/log/smartflow -name "*.log" -mtime +90 -delete
```

---

## Testing Backups

### Regular Testing

Test backups monthly:

1. **Restore to Test Environment**
   ```bash
   # Create test database
   createdb smartflow_test
   
   # Restore backup
   psql smartflow_test < backup-20240101.sql
   
   # Verify data
   psql smartflow_test -c "SELECT COUNT(*) FROM posts;"
   ```

2. **Verify Data Integrity**
   - Check record counts
   - Verify relationships
   - Test application functionality

3. **Document Results**
   - Backup date tested
   - Issues found
   - Recovery time
   - Data completeness

### Backup Verification Script

```bash
#!/bin/bash

BACKUP_FILE=$1

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Check file size
SIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
if [ "$SIZE" -lt 1000 ]; then
  echo "❌ Backup file too small: $SIZE bytes"
  exit 1
fi

# Verify SQL syntax (for SQL dumps)
if [[ "$BACKUP_FILE" == *.sql ]]; then
  head -n 100 "$BACKUP_FILE" | grep -q "PostgreSQL database dump" || {
    echo "❌ Invalid SQL dump format"
    exit 1
  }
fi

echo "✅ Backup file verified: $BACKUP_FILE"
```

---

## Backup Monitoring

### Monitor Backup Success

```bash
# Check backup logs
tail -f /var/log/backup.log

# Verify latest backup
ls -lh /backups/database/ | tail -5

# Check backup age
find /backups/database -name "*.sql.gz" -mtime -1
```

### Alerting

Set up alerts for:

- Backup failures
- Backup age > 25 hours
- Backup size anomalies
- Disk space low

---

## Additional Resources

- [Deployment Guide](./DEPLOYMENT.md) - Production setup
- [Operations Guide](./OPERATIONS.md) - Monitoring and maintenance
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues

---

## Backup Checklist

### Daily

- [ ] Verify daily backup completed
- [ ] Check backup file size
- [ ] Verify backup location accessible

### Weekly

- [ ] Review backup logs
- [ ] Check disk space
- [ ] Verify retention policies

### Monthly

- [ ] Test backup restoration
- [ ] Review backup procedures
- [ ] Update documentation if needed

### Quarterly

- [ ] Disaster recovery drill
- [ ] Review RTO/RPO
- [ ] Update disaster recovery plan

