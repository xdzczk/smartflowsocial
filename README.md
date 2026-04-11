# SmartFlowSocial

Professional Nostr social media management for creators, teams, and communities.  
Schedule, publish, and operate your Nostr presence with hosted or self-hosted deployment.

[![CI](https://github.com/xdzczk/SmartFlowSocial/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/xdzczk/SmartFlowSocial/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/xdzczk/SmartFlowSocial?display_name=tag)](https://github.com/xdzczk/SmartFlowSocial/releases)
[![Node 20+](https://img.shields.io/badge/node-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Try Hosted](https://smartflow.social) • [Quick Start](#quick-start) •
[Documentation](./docs/README.md) • [API Reference](./docs/reference/api.md)

---

## What SmartFlowSocial is

SmartFlowSocial is a Nostr-native publishing and operations platform:

- Manage posting workflows (drafts, queue scheduling, calendar planning, recyclable content).
- Run engagement features (broadcast campaigns, contests, giveaways, multi-account operations).
- Keep signing sovereign (NIP-07 browser extension signing or NIP-46 remote signer flows).
- Choose deployment posture: managed hosted service or self-hosted open source stack.

For complete feature documentation, see the
[Feature Coverage Matrix](./docs/reference/feature-coverage-matrix.md).

---

## Quick Start

### Hosted (fastest path)

1. Open [smartflow.social](https://smartflow.social)
2. Sign in with a NIP-07 extension (Alby / nos2x / Amber) or NIP-46 remote signer
3. Create and schedule your first post

Next: [Hosted quick start](./docs/getting-started/hosted.md)

### Self-hosted (local development)

Prerequisites: Node.js 20+, pnpm, PostgreSQL, Redis, S3-compatible storage.

```bash
git clone https://github.com/xdzczk/SmartFlowSocial.git
cd SmartFlowSocial
pnpm install
cp example.env .env
pnpm docker
pnpm exec prisma generate
pnpm exec prisma db push
pnpm db:seed
pnpm dev
```

Then open `http://localhost:3000`.

Next:

- [Self-host quickstart](./docs/getting-started/quickstart.md)
- [Installation guide](./docs/getting-started/installation.md)
- [Deployment guide](./docs/guides/deployment.md)

---

## Verify in 60 Seconds

After booting locally, confirm the stack is healthy:

```bash
curl -i http://localhost:3000/healthcheck
curl -I http://localhost:3000
curl http://localhost:3010/metrics
```

Expected outcomes:

- `/healthcheck` returns `200 OK`
- Root URL returns an HTTP success or redirect response
- `/metrics` responds with Prometheus-formatted text

Operational details: [Operations guide](./docs/guides/operations.md)

---

## Core Capabilities

### Publishing and planning

- Instant and scheduled posting
- Queue-based and interval scheduling
- Calendar-based planning
- Drafts, templates, and recyclable content
- Long-form article support (NIP-23)

### Engagement and growth

- Engagement feed and triage workflows
- Signed DM broadcast campaigns
- Giveaways and contests with payout tracking
- Multi-account parent/child management

### APIs and automation

- REST APIs for publishing, queue management, media uploads, and engagement workflows
- Session-based authentication for app and API usage
- Admin and telemetry endpoints for operations insight

Full endpoint inventory: [API reference](./docs/reference/api.md)

---

## Architecture at a Glance

- Full-stack app built with [Remix](https://remix.run) and TypeScript
- PostgreSQL + Prisma for durable relational data
- Redis + BullMQ for background jobs and queue orchestration
- Tailwind + shadcn/ui for product interface layer
- Lightning-native payment integrations (NWC and BTCPay configuration support)
- Nostr protocol integration and signer workflows (NIP-07 and NIP-46)

Deep dive: [Architecture documentation](./docs/getting-started/architecture.md)

---

## Compatibility Matrix

| Area            | Requirement / Support                            |
| --------------- | ------------------------------------------------ |
| Node runtime    | `20+`                                            |
| Package manager | `pnpm`                                           |
| Database        | PostgreSQL                                       |
| Queue / cache   | Redis                                            |
| Asset storage   | S3-compatible object storage                     |
| Nostr signing   | NIP-07 browser extensions, NIP-46 remote signers |
| Deploy options  | Hosted service or self-hosted deployment         |

Runtime configuration details: [Configuration reference](./docs/reference/configuration.md)

---

## Operations and Security

- Health, metrics, and reliability runbooks: [Operations guide](./docs/guides/operations.md)
- Deployment patterns and hardening guidance: [Deployment guide](./docs/guides/deployment.md)
- Security model and reporting guidance: [Security guide](./docs/guides/security.md)
- Data and privacy model overview: [Threat model](./docs/reference/threat-model.md)

---

## Quality Gates for Contributors

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Additional test suites (integration, E2E, security, performance) are documented in
[Testing guide](./docs/guides/testing.md).

Contribution workflow: [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Current Scope and Known Limitations

- The project supports both hosted and self-hosted usage, but production operations still require
  explicit environment and observability setup.
- E2E coverage is being modernized toward flow-oriented suites; see
  [Legacy migration map](./tests/e2e/LEGACY_MIGRATION_MAP.md).
- Feature and API documentation coverage is tracked separately from behavioral guarantees; see
  [Feature coverage matrix](./docs/reference/feature-coverage-matrix.md).

Roadmap and changes: [CHANGELOG](./CHANGELOG.md)

---

## Community and Support

- Hosted: [smartflow.social](https://smartflow.social)
- Docs hub: [docs/README.md](./docs/README.md)
- Bug reports: [GitHub Issues](https://github.com/xdzczk/SmartFlowSocial/issues)
- Feature requests: [GitHub Discussions](https://github.com/xdzczk/SmartFlowSocial/discussions)

---

## License

MIT License. See [LICENSE](./LICENSE).
