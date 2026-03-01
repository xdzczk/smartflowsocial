# Queue SLO Dashboard Queries

Use these PromQL queries to create a queue reliability dashboard.

## Timeliness

- `histogram_quantile(0.50, sum(rate(publish_lateness_seconds_bucket[10m])) by (le, post_type))`
- `histogram_quantile(0.95, sum(rate(publish_lateness_seconds_bucket[10m])) by (le, post_type))`
- `histogram_quantile(0.99, sum(rate(publish_lateness_seconds_bucket[10m])) by (le, post_type))`

## Success Rate

- `sum(rate(queue_job_total{queue=~"scheduled-posts|scheduled-longform-posts",status="success"}[10m])) / sum(rate(queue_job_total{queue=~"scheduled-posts|scheduled-longform-posts"}[10m]))`

## Retry + Dead-Letter

- `sum(rate(outbox_events_retried_total[10m])) by (event_type)`
- `sum(rate(outbox_events_dead_lettered_total[10m])) by (event_type, reason)`

## Backlog Health

- `queue_jobs_by_status{queue=~"scheduled-posts|scheduled-longform-posts"}`
- `queue_oldest_waiting_age_seconds{queue=~"scheduled-posts|scheduled-longform-posts"}`
- `outbox_backlog`
- `outbox_oldest_ready_age_seconds`

## Outbox End-to-End Latency

- `histogram_quantile(0.95, sum(rate(outbox_enqueue_to_process_latency_ms_bucket[10m])) by (le, event_type))`
