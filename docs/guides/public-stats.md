# Public stats

The hosted app exposes aggregate publishing numbers and opted-in profile pictures for the marketing
site.

## Endpoints

- `GET /api/public/stats` returns counts and up to 48 people who published in the last 30 days.
  Cached for 15 minutes. Set `PUBLIC_STATS_ENABLED=false` to disable it (self-hosted instances
  should, unless they want the same block).
- `GET /api/public/avatar/:npub` serves a 96px copy of that account's public picture. Accounts with
  "Show my picture" turned off get a 404, and the cached image is deleted when they turn it off.

Pictures are shown unless the account turns them off. The first dashboard visit after this ships
shows a notice; Settings has the switch under General.

`LANDING_STATS_ORIGINS` adds extra browser origins allowed to read `/api/public/stats`
(comma-separated). `https://smartflow.social` is allowed by default.

Counts are totals across every account. Nothing in the payload is per account except the public name
and picture of people who have not opted out.
