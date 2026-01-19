# SmartFlowSocial

<div align="center">

[![Remix](https://img.shields.io/badge/Built%20with-Remix-blue?logo=remix&logoColor=white)](https://remix.run/)
[![Nostr](https://img.shields.io/badge/Protocol-Nostr-purple?logo=nostr&logoColor=white)](https://nostr.com/)
[![License: ELv2](https://img.shields.io/badge/License-ELv2-blue.svg)](https://www.elastic.co/licensing/elastic-license)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Professional Nostr social media management platform**

Schedule, manage, and optimize your decentralized social presence.

[🚀 Try Hosted](https://smartflow.social) • [📖 Documentation](./docs/README.md) •
[🔧 Self-Host](#-self-hosted)

</div>

---

## What is SmartFlowSocial?

SmartFlowSocial is a **professional-grade social media management platform** for the Nostr protocol.
Available as a fully managed hosted service or self-hostable open source software, it helps
creators, businesses, and communities manage their decentralized social presence with
enterprise-level features.

**Available at:** [smartflow.social](https://smartflow.social) •
[smartflowsocial.com](https://smartflowsocial.com)

### Why SmartFlowSocial?

- 🔐 **Privacy-first**: Your keys never touch SmartFlow servers (signing via NIP-07 extensions or
  NIP-46 remote signers)
- 📅 **Advanced scheduling**: Calendar view, queues, intervals, and bulk upload
- 🎨 **Beautiful UI**: Modern, intuitive interface built with Remix and TailwindCSS
- 🔓 **Open source**: ELv2 licensed, fully auditable code
- ⚡ **Lightning-native**: Built for the Bitcoin/Lightning ecosystem
- 🔧 **Developer-friendly**: TypeScript, REST API, well-documented, extensible

---

## ✨ Key Features

### 📝 Post Management

- **Instant posting** — Post to Nostr with one click
- **Scheduled posts** — Plan content days, weeks, or months in advance
- **Bulk upload** — Upload multiple images with auto-scheduled intervals
- **Long-form articles** — Full NIP-23 article support with rich text editor
- **Drafts & templates** — Save work-in-progress and reusable post structures
- **Recyclable posts** — Reuse evergreen content efficiently

### 📅 Scheduling & Queues

- **Calendar view** — Visual drag-and-drop scheduling (weekly/monthly views)
- **Multiple queues** — Organize content with different scheduling rules
- **Interval scheduling** — Post every X hours automatically
- **Fixed time slots** — Post at specific times daily
- **Queue override** — Manual scheduling with smart queue integration

### 🎁 Engagement & Tools

- **Engagement feed** — Track replies, mentions, and interactions
- **Nostr giveaways** — Create native giveaways with fair winner selection
- **Blacklist management** — Block bots and spam accounts
- **Hashtag presets** — Reusable hashtag collections
- **Multi-account** — Parent/child account relationships

### 🔌 API & Integrations

- **REST API** — Full programmatic access to all features
- **File upload API** — Upload media programmatically
- **Queue management** — Schedule and manage posts via API
- **Session authentication** — Cookie-based authentication

📖 **[Full API Reference](./docs/reference/api.md)** — Complete API documentation with examples

---

## 🚀 Quick Start

### Hosted (Recommended)

**Start managing your Nostr presence in 30 seconds:**

1. Go to [smartflow.social](https://smartflow.social)
2. Log in with a NIP-07 compatible Nostr extension (Alby / nos2x / Amber) **or** a NIP-46 remote
   signer
3. Create your first scheduled post

**Next steps:**

- [Hosted quick start guide](./docs/getting-started/hosted.md)
- [Posting guide](./docs/guides/user-guides/posting.md)
- [Calendar guide](./docs/guides/user-guides/calendar.md)

### Self-Hosted

**Prerequisites:** Node.js 20+, pnpm, PostgreSQL, Redis, S3-compatible storage

```bash
# Clone and install
git clone https://github.com/xdzczk/SmartFlowSocial.git
cd SmartFlowSocial
pnpm install

# Configure environment
cp example.env .env
# Edit .env with your configuration

# Optional: Feature flags for staged rollout / emergency toggles
# - NOSTR_AUTH_V2_ENABLED (default true): enable /auth/nostr/challenge + /auth/nostr/verify
# - ENFORCE_NOSTR_SESSION_PUBKEY (default true): enforce session pubkey === signed event pubkey

# Start services (Docker)
pnpm docker  # Starts PostgreSQL and Redis

# Set up database
pnpm exec prisma generate
pnpm exec prisma db push
pnpm db:seed

# Start development server
pnpm dev
```

**That's it!** Open [http://localhost:3000](http://localhost:3000) and start managing your Nostr
presence.

**Next steps:**

- [Self-host quickstart](./docs/getting-started/quickstart.md) — 5-minute setup
- [Installation guide](./docs/getting-started/installation.md) — Complete setup
- [Deployment guide](./docs/guides/deployment.md) — Production deployment

---

## 🏗️ Architecture

SmartFlowSocial is built with modern, production-ready technologies:

- **Framework**: [Remix](https://remix.run) — Full-stack React with excellent DX
- **Database**: PostgreSQL + [Prisma](https://prisma.io) — Type-safe database access
- **Queue System**: [BullMQ](https://docs.bullmq.io/) + Redis — Reliable background job processing
- **Styling**: [TailwindCSS](https://tailwindcss.com) — Rapid UI development
- **UI Components**: [Headless UI](https://headlessui.com) + [Radix UI](https://radix-ui.com) —
  Accessible components
- **Payments**: Lightning Network (NWC) — Native Bitcoin payments
- **Protocol**: [Nostr](https://nostr.com) — Decentralized social protocol

See [Architecture Documentation](./docs/getting-started/architecture.md) for detailed information.

---

## 📚 Documentation

### For Hosted Users

- [Hosted quick start](./docs/getting-started/hosted.md) — Get started in 5 minutes
- [Posting guide](./docs/guides/user-guides/posting.md) — Create and schedule posts
- [Calendar guide](./docs/guides/user-guides/calendar.md) — Visual scheduling
- [Payments guide](./docs/guides/user-guides/payments.md) — Subscription management

### For Self-Hosters

- [Quick start](./docs/getting-started/quickstart.md) — 5-minute setup
- [Installation guide](./docs/getting-started/installation.md) — Complete setup
- [Deployment guide](./docs/guides/deployment.md) — Production deployment
- [Operations guide](./docs/guides/operations.md) — Monitoring and maintenance

### For Developers

- [Developer guide](./docs/guides/developer-guide.md) — Development workflow
- [API reference](./docs/reference/api.md) — Complete API documentation
- [Testing guide](./docs/guides/testing.md) — Testing strategies
- [Contributing guide](./CONTRIBUTING.md) — How to contribute

**📖 [Full Documentation Index](./docs/README.md)** — Complete documentation hub

---

## 🔐 Privacy & Security

**Your privacy is protected regardless of hosting choice:**

- 🔐 **Client-side / remote signing** — Private keys never touch SmartFlow servers (NIP-07 / NIP-46)
- 🔒 **No key storage** — We never see or store your private keys
- 🛡️ **Transparent code** — Verify our security practices yourself (ELv2 licensed)
- 🔓 **No vendor lock-in** — Self-host anytime, export your data, stay in control

See [Security Guide](./docs/guides/security.md) for best practices and reporting.

---

## 🧪 Testing

SmartFlowSocial has comprehensive test coverage:

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:unit          # Unit tests
pnpm test:integration   # Integration tests
pnpm test:e2e          # End-to-end tests (Cypress)
pnpm test:security     # Security tests

# With coverage
pnpm test:coverage
```

**Coverage**: 70%+ with comprehensive test suites

See [Testing Guide](./docs/guides/testing.md) for detailed information.

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Run tests** (`pnpm test`)
5. **Commit your changes** (`git commit -m 'feat: add amazing feature'`)
6. **Push to the branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Contribution Areas

- 🐛 **Bug Fixes**: Report and fix issues
- ✨ **Features**: Add new functionality
- 📚 **Documentation**: Improve docs
- 🧪 **Tests**: Increase test coverage
- 🎨 **UI/UX**: Improve user experience
- ⚡ **Performance**: Optimize code

See [Contributing Guide](./CONTRIBUTING.md) for detailed guidelines.

---

## 📊 Project Status

- ✅ **Production Ready**: Stable and battle-tested
- ✅ **Active Development**: Regular updates and improvements
- ✅ **Well Tested**: 70%+ test coverage
- ✅ **Well Documented**: Comprehensive documentation
- ✅ **Community Driven**: Open to contributions
- ✅ **API Available**: Full REST API for automation and integrations

**Current Version**: v1.0.0 — See [CHANGELOG](./CHANGELOG.md) for latest changes.

---

## 💬 Community & Support

- 🌐 **Hosted Instance**: [smartflow.social](https://smartflow.social) |
  [smartflowsocial.com](https://smartflowsocial.com)
- 📖 **Documentation**: [docs/README.md](./docs/README.md)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/xdzczk/SmartFlowSocial/issues)
- 💡 **Feature Requests**:
  [GitHub Discussions](https://github.com/xdzczk/SmartFlowSocial/discussions)
- 📧 **Security Issues**: Report privately (see [Security Guide](./docs/guides/security.md))

---

## 📄 License

Elastic License 2.0 (ELv2) — see [LICENSE](./LICENSE) for full terms.

**Summary:** Free for personal and commercial use, with restrictions on providing the software as a
managed service to third parties. See
[Elastic License 2.0](https://www.elastic.co/licensing/elastic-license) for details.

---

<div align="center">

**SmartFlowSocial** — Tools for Sovereign Creators.

Built with ❤️ for the Nostr community.

[Try Hosted](https://smartflow.social) • [Self-Host](#-self-hosted) •
[API Docs](./docs/reference/api.md) • [Documentation](./docs/README.md) •
[Contributing](./CONTRIBUTING.md)

</div>
