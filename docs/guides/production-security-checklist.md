# Production security checklist

Operator checklist for a SmartFlowSocial deployment. This is configuration, not a code audit. Do not
probe live payment or cron routes with real invoices while working through it.

Confirm each item in the host that actually serves traffic. A secure default in the repository does
not prove the running process has the variable set.

## Edge and reverse proxy

- The app is reachable only over HTTPS.
- `/cron/` is not linked from the browser app. `robots.txt` disallows it. Prefer blocking `/cron/`
  and `/api/referral/manual-payout` at the proxy so they are reachable only from the scheduler.
- `/metrics` requires `METRICS_TOKEN` or `METRICS_ALLOWED_IPS`.
- Request body size limits at the proxy are at least as strict as the app.

## Cron and internal credentials

- `CRON_SECRET` is set, at least 32 characters, and stored as a secret. `openssl rand -base64 32`.
- Every external cron call sends `X-Cron-Secret` or `Authorization: Bearer`. POST is preferred.
- The secret is not in a query string, a shell history file, or a repository.
- `REFERRAL_MANUAL_PAYOUT_SECRET` is set the same way, and is different from `CRON_SECRET`.
- `BLOSSOM_INTERNAL_SECRET` matches the Blossom server, and is not the upload-token secret unless
  you have chosen that fallback on purpose.
- `BLASTR_ADMIN_API_TOKEN` matches Blastr `API_TOKEN` when Blastr sync is enabled.
- Production boot refuses to start when `CRON_SECRET`, `REFERRAL_MANUAL_PAYOUT_SECRET`, or the
  publisher token is missing. A process that is already running was started before that check and
  must be restarted after the variables are set.

## Blastr administration

- Blastr `API_TOKEN` is set in the worker that serves production.
- Admin routes (`/admin/entitlements`, `/admin/users/...`) return 401 without that token. Ordinary
  `POST /event` does not use the admin token. It checks the signed event and the pubkey entitlement.
- The token is rotated when an operator who had it leaves, and the app's `BLASTR_ADMIN_API_TOKEN` is
  updated in the same change.

## Publisher access

- The publisher is private infrastructure. `API_TOKEN` is set, and the app's
  `NOSTR_PUBLISHER_API_TOKEN` is the same value.
- `ALLOW_UNAUTHENTICATED_PUBLISH` is unset. Set it only for a publisher you intend to expose as a
  public relay proxy, and then keep rate limits, signature checks, and relay host checks on.
- `ALLOW_PRIVATE_RELAYS` is unset in production so the worker will not open relay URLs on loopback,
  link-local, or private addresses.
- `ENVIRONMENT=production` is set on the production worker so a missing token fails startup when
  public mode is off.

## NWC wallet

- `OWNER_NWC` is a connection string for a wallet whose permissions are pay-invoice only, with a
  budget at or below the referral caps.
- `REFERRAL_PAYOUT_MAX_SATS` and `REFERRAL_PAYOUT_DAILY_CAP_SATS` are set to amounts you can afford
  to lose if a bug or a bad invoice gets through the app checks.
- The code rejects amountless invoices and any invoice whose decoded amount differs from the
  declared amount. The wallet budget is the second control, not a substitute.
- Campaign autopay spends the creator's own NWC connection, not `OWNER_NWC`.
- No test, monitor, or agent is pointed at a production payout route with a real invoice.

## Rotation and monitoring

- Rotate `CRON_SECRET`, `REFERRAL_MANUAL_PAYOUT_SECRET`, `SESSION_SECRET`, publisher `API_TOKEN`,
  and Blastr `API_TOKEN` on a schedule you can actually keep, and immediately after a suspected
  leak.
- Alert on HTTP 401 bursts to `/cron/` and `/api/referral/manual-payout`.
- Alert on referral audit rows whose status is `failed` or that stay `started`. A `started` row
  means the wallet may have been called. Do not resubmit that invoice until the wallet history is
  checked.
- Keep dependency audit and secret scanning in CI. A clean historical scan is not a permanent state.

## What this checklist does not prove

- It does not prove Cloudflare or the reverse proxy is configured. Check the live host.
- It does not prove the NWC wallet budget inside the wallet provider. Check that provider.
- It does not rotate secrets by itself.
