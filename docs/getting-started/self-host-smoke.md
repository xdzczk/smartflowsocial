# Self-host smoke test

**Estimated time:** 30–60 minutes the first time, a few minutes after Postgres and Redis are up  
**Last updated:** 2026-11-14

This is the check that a clean checkout can schedule a signed Nostr note and hand it to a publisher.
It does not use the hosted service, a paid account, or a production relay.

## What you are starting

| Piece                                    | Required for the scheduler?       | How it starts                                                                                                                        |
| ---------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| This app and its worker                  | Yes                               | `pnpm dev` starts both. Do not also run `pnpm start:worker`.                                                                         |
| PostgreSQL and Redis                     | Yes                               | `pnpm docker`                                                                                                                        |
| HTTP publisher                           | Yes, or posts never leave the app | Real worker: [smartflowsocial-publisher](https://github.com/xdzczk/smartflowsocial-publisher). Laptop stand-in: `pnpm publisher:local` |
| S3-compatible storage                    | Only for uploads                  | Environment variables in `example.env`                                                                                               |
| Blossom, Blastr, cache worker, NostrMash | No                                | Separate repositories. Leave their variables empty.                                                                                  |
| Lightning, NWC, referral payouts         | No                                | Leave `REFERRAL_PAYOUTS_ENABLED=false`. The payout routes stay closed.                                                               |

`pnpm publisher:local` checks Nostr signatures and returns success. It does not connect to relays. Use
the Cloudflare publisher when you want events on the network. For that process set
`ALLOW_PRIVATE_RELAYS=true` only if the relay is on your own machine.

Production is different. Run `pnpm start` and `pnpm start:worker` as two processes after
`pnpm build`. Do not point either of them at the same Redis as a `pnpm dev` session.

## Steps

1. Install Node.js 20 or newer. CI and `.nvmrc` use Node 22. Enable Corepack and activate pnpm
   10.27.0 (`package.json` `packageManager`).
2. Clone the repository and install:

```bash
git clone https://github.com/xdzczk/smartflowsocial.git
cd smartflowsocial
corepack enable
corepack prepare pnpm@10.27.0 --activate
pnpm install
cp example.env .env
```

3. In `.env`, set at least:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
REDIS_URL=redis://localhost:6379
SESSION_SECRET=replace-with-32-or-more-random-characters
LOCAL_PUBLISHER_TOKEN=local-dev-publisher-token
NOSTR_PUBLISHER_URL=http://127.0.0.1:8787/publish
NOSTR_PUBLISHER_API_TOKEN=local-dev-publisher-token
```

Generate `SESSION_SECRET` with `openssl rand -base64 32`. Leave storage, Blastr, Blossom, and
`OWNER_NWC` empty until you need those features.

4. Start data stores, apply the schema, and start the local publisher in another terminal:

```bash
pnpm docker
pnpm exec prisma generate
pnpm exec prisma db push
pnpm publisher:local
```

5. Prove the scheduled-publish path. This creates an ephemeral key, inserts one due post, runs the
   same job the worker runs, and deletes that user. The key is not a personal Nostr identity.

```bash
pnpm smoke:publish
```

Expected last line:

```text
self-host publish smoke passed post=<id> state=PUBLISHED publisher=local
```

6. Start the app:

```bash
pnpm dev
```

`pnpm dev` already includes the worker. A second `pnpm start:worker` will process the same Redis
jobs twice.

7. Check the process, then sign in with a NIP-07 extension or a NIP-46 remote signer at
   `http://localhost:3000`. Create a post and schedule it. The worker sends the event you signed to
   `NOSTR_PUBLISHER_URL`. With the local publisher, the note is accepted and not broadcast. Point
   `NOSTR_PUBLISHER_URL` at the real publisher, with `ALLOW_PRIVATE_RELAYS` if needed, to reach a
   relay.

```bash
curl -fsS http://localhost:3000/healthcheck
```

A 200 means the app reached Postgres. It does not mean storage, Lightning, or a public relay is
configured.

## What this does not prove

- A browser extension signed the smoke event. The smoke signs with `nostr-tools` so the job path can
  run without a person clicking a signer. Browser login is covered by `pnpm test:e2e:smoke` when
  Cypress is installed.
- The note reached a public relay. The local publisher stops before that.
- Uploads, Blossom, Blastr, analytics, or Lightning work. Those stay off until their variables are
  set. Missing payout and cron secrets do not open those routes.
