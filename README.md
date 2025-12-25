# SmartFlowSocial

[![Remix](https://img.shields.io/badge/Built%20with-Remix-blue?logo=remix&logoColor=white)](https://remix.run/)
[![Nostr](https://img.shields.io/badge/Protocol-Nostr-purple?logo=nostr&logoColor=white)](https://nostr.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/Coverage-70%25-brightgreen)](./docs/COVERAGE_REPORTING.md)

> Professional-grade social media management platform for NOSTR. Built with Remix.

---

## ✨ Features

### Post Management

- 📝 **Instant Posting** — Post to NOSTR with one click
- ⏰ **Scheduled Posts** — Schedule content for future publication
- 📤 **Bulk Upload** — Upload multiple images with auto-scheduled intervals
- ♻️ **Recyclable Posts** — Reuse evergreen content
- 📄 **Long-form Articles** — Full NIP-23 article support with rich text editor

### Scheduling & Queues

- 📅 **Calendar View** — Visual drag-and-drop scheduling (weekly/monthly)
- 🔄 **Multiple Queues** — Organize content with different scheduling rules
- ⚡ **Interval Scheduling** — Post every X hours automatically
- 🕐 **Fixed Time Slots** — Post at specific times daily

### Giveaway Tools

- 🎁 **NOSTR Giveaways** — Create native giveaways
- 🎲 **Random Winner Selection** — Fair and transparent
- 🚫 **Blacklist Management** — Block bots and spam accounts

### Media & Storage

- 🖼️ **S3 Storage** — Upload images to S3-compatible storage
- 🌸 **Blossom Support** — Optional Blossom protocol integration
- 🔗 **Multiple Providers** — Choose your preferred upload provider

### Additional Features

- 🔔 **Engagement Feed** — Track replies, mentions, and interactions
- #️⃣ **Hashtag Presets** — Reusable hashtag collections
- 👥 **Multi-Account** — Parent/child account relationships
- ⚡ **Lightning Payments** — Subscription payments via NWC
- 🏠 **Self-Hosted** — Own your infrastructure and keys

---

## ⚙️ Tech Stack

| Layer         | Technology                                                               |
| ------------- | ------------------------------------------------------------------------ |
| Framework     | [Remix](https://remix.run)                                               |
| Database      | [PostgreSQL](https://postgresql.org) + [Prisma](https://prisma.io)       |
| Styling       | [TailwindCSS](https://tailwindcss.com)                                   |
| UI Components | [Headless UI](https://headlessui.com) + [Radix UI](https://radix-ui.com) |
| Queue System  | [BullMQ](https://docs.bullmq.io/) with Redis                             |
| Protocol      | [Nostr](https://nostr.com)                                               |
| Runtime       | Node.js >= 20.0.0                                                        |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20.0.0 or higher
- PostgreSQL database
- Redis

### 1. Clone the Repository

```bash
git clone https://github.com/xdzczk/SmartFlowSocial.git
cd SmartFlowSocial
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp example.env .env
```

Edit `.env` with your configuration:

```dotenv
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/smartflow
SESSION_SECRET=your_random_session_secret
NOSTR_PUBLISHER_URL=https://your-publisher-instance.com
NOSTR_NSEC=nsec1...
PRIMAL_CACHING_URL=wss://your-primal-cache.com
REDIS_URL=redis://localhost:6379

# Storage (for image uploads)
STORAGE_ACCESS_KEY=your_storage_key
STORAGE_SECRET=your_storage_secret
STORAGE_REGION=your_region
STORAGE_BUCKET=your_bucket_name

# Subscription (for lightning payments)
OWNER_NWC=nostr+walletconnect://...
```

See [Environment Setup](./docs/environment-setup.md) for detailed configuration.

### 4. Set up the Database

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Server runs at [http://localhost:3000](http://localhost:3000)
h

### 6. Start Worker (Optional)

For scheduled post processing:

```bash
npm run start:worker
```

---

## 📜 Available Scripts

| Script                     | Description                      |
| -------------------------- | -------------------------------- |
| `npm run dev`              | Start development server         |
| `npm run build`            | Build for production             |
| `npm start`                | Start production server          |
| `npm run start:worker`     | Start background worker          |
| `npm run lint`             | Run ESLint                       |
| `npm run format`           | Format code with Prettier        |
| `npm test`                 | Run all Cypress tests headlessly |
| `npm run test:e2e`         | Run all E2E tests                |
| `npm run test:loaders`     | Run loader integration tests     |
| `npm run test:integration` | Run integration tests            |
| `npm run test:unit`        | Run unit tests only              |
| `npm run test:property`    | Run property-based tests         |
| `npm run test:coverage`    | Run tests with coverage report   |
| `npm run test:coverage:report` | Generate coverage and record trend |
| `npm run test:coverage:trend` | View coverage trend report      |
| `npm run test:open`        | Open Cypress UI                  |
| `npm run test:dev`         | Start dev server + open Cypress  |
| `npm run db:seed`          | Seed database with initial data  |
| `npm run docker`           | Start PostgreSQL via Docker      |
| `npm run precheck`         | Run lint, tests, and type check  |

---

## 🌐 External Services

### Required

| Service                                                                      | Description                      | Environment Variable  |
| ---------------------------------------------------------------------------- | -------------------------------- | --------------------- |
| [HTTP Nostr Publisher](https://github.com/getAlby/http-nostr-publisher)      | Signs and publishes Nostr events | `NOSTR_PUBLISHER_URL` |
| [Primal Caching Service](https://github.com/PrimalHQ/primal-caching-service) | Profile/event lookups            | `PRIMAL_CACHING_URL`  |
| Redis                                                                        | Background job processing        | `REDIS_URL`           |

---

## 📚 Documentation

| Document                                         | Description                |
| ------------------------------------------------ | -------------------------- |
| [Documentation Hub](./docs/README.md)            | Full documentation index   |
| [Environment Setup](./docs/environment-setup.md) | Environment variable guide |
| [Architecture](./docs/architecture.md)           | Project structure          |
| [Database Schema](./docs/database-schema.md)     | Data models                |
| [API Reference](./docs/api-reference.md)         | API endpoints              |
| [Error Handling](./docs/ERROR_HANDLING.md)       | Centralized error handling (includes metrics) |
| [Onboarding](./docs/onboarding.md)               | User getting started       |
| [Posting Workflow](./docs/posting.md)            | How to create posts        |
| [Calendar Feature](./docs/calendar-feature.md)   | Visual scheduling          |
| [Testing Guide](./docs/testing.md)               | How to run tests (includes Vitest, property-based, security, performance) |
| [Test Strategy](./docs/TEST_STRATEGY.md)         | Testing philosophy, strategy, and coverage goals |
| [Testing Patterns](./docs/TESTING_PATTERNS.md)  | Common testing patterns and examples |
| [Mocking Guidelines](./docs/MOCKING_GUIDELINES.md) | How to mock dependencies |
| [Test Database](./docs/TEST_DATABASE.md)         | Database integration testing |
| [Test Troubleshooting](./docs/TEST_TROUBLESHOOTING.md) | Common issues and solutions |
| [CI/CD Guide](./docs/CI_CD.md)                   | CI/CD pipeline and workflows |
| [Contributing](./CONTRIBUTING.md)                | Contribution guidelines    |
| [Roadmap](./ROADMAP.md)                          | Future plans               |

---

## 🧪 Testing

```bash
# Run all tests headlessly
npm test

# Open Cypress UI
npm run test:open

# Run loader tests
npm run test:loaders
```

See [Testing Guide](./docs/testing.md) for detailed testing documentation.

---

## 🙏 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🛡 License

MIT License — free for personal and commercial use.

---

## 💬 Acknowledgements

- Thanks to the NOSTR community for building the future of decentralized communication.
- Powered by Remix, Prisma, and the Bitcoin/Lightning ecosystem.

---

> **SmartFlowSocial** — Tools for Sovereign Creators.
