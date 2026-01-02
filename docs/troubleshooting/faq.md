# Frequently Asked Questions

**Last updated:** 2026-01-02

Common questions and answers about SmartFlowSocial.

---

## General

### What is SmartFlowSocial?

SmartFlowSocial is a self-hosted, professional-grade social media management platform for the Nostr protocol. It enables you to schedule posts, manage multiple accounts, track engagement, and more.

### Is SmartFlowSocial free?

Yes! SmartFlowSocial is open-source (MIT License) and free to use. Self-hosting is completely free forever. The hosted version offers a free plan with basic features, and paid plans for advanced features.

### Is there a hosted version?

Yes! We offer a hosted instance at [smartflow.social](https://smartflow.social) and [smartflowsocial.com](https://smartflowsocial.com). You can also self-host for full control over your data and infrastructure.

### How do I sign up for the hosted version?

Visit [smartflow.social](https://smartflow.social) and sign up with your Nostr extension. No credit card required for the free plan.

---

## Setup & Installation

### What are the system requirements?

- **Node.js** 20.0.0 or higher
- **PostgreSQL** 14+ (local or managed)
- **Redis** 6+ (for background jobs)
- **S3-compatible storage** (for image uploads)
- **HTTP Nostr Publisher** service

### Do I need to host it myself?

No! You can use our [hosted instance](https://smartflow.social) with no setup required. Alternatively, you can self-host for full control over your data and infrastructure.

### How long does setup take?

- **Quick Start:** 5 minutes (with Docker)
- **Full Installation:** 15-30 minutes
- **Production Deployment:** 1-2 hours

See [Quick Start Guide](../getting-started/quickstart.md) for details.

---

## Authentication & Security

### Is my data private?

Absolutely. Your private keys never leave your browser. All events are signed client-side using NIP-07. We never see or store your private keys.

### What Nostr extensions are supported?

Any NIP-07 compatible extension works:
- [Alby](https://getalby.com/) (recommended)
- [nos2x](https://github.com/fiatjaf/nos2x)
- [Amber](https://amber.app/)
- And others

### How does authentication work?

1. You log in with your Nostr extension
2. Extension signs a challenge
3. Server creates a session cookie
4. Cookie contains your public key (npub)
5. Server validates session on each request

---

## Posting & Scheduling

### How does scheduling work?

Posts are signed with future timestamps and stored in a queue. A background worker process checks the queue and publishes posts to Nostr relays at the specified time.

### Can I edit a scheduled post?

Yes! Go to **Scheduled**, click on a post, and edit it. Changes are saved and will be published at the scheduled time.

### What happens if I delete a scheduled post?

The post is removed from the queue and won't be published. This action cannot be undone.

### Can I use it with multiple Nostr accounts?

Yes! SmartFlowSocial supports parent/child account relationships, allowing you to manage multiple accounts from one interface.

---

## Queues

### What is a queue?

A queue controls how posts are scheduled:
- **Interval Queue** - Post every X hours automatically
- **Fixed Time Slots** - Post at specific times daily
- **Manual** - Schedule posts individually

### How do I create a queue?

1. Go to **Settings** → **Queues**
2. Click **"Create Queue"**
3. Choose queue type
4. Configure settings
5. Save

### Can I override queue scheduling?

Yes! When scheduling a post, you can override the queue and choose a specific time manually.

---

## Storage

### What storage providers are supported?

Any S3-compatible storage:
- **AWS S3**
- **Cloudflare R2**
- **MinIO** (self-hosted)
- **DigitalOcean Spaces**
- **Backblaze B2**

### Do I need storage?

Yes, storage is required for image uploads. You can use any S3-compatible provider.

### How do I set up storage?

See [Installation Guide](../getting-started/installation.md#storage-setup) for detailed instructions.

---

## Troubleshooting

### Post not publishing

1. Check worker process is running: `pnpm start:worker`
2. Verify Redis connection
3. Check post is in "Scheduled" status
4. Review worker logs for errors

See [Common Issues](./common-issues.md#posting-issues) for more solutions.

### Database connection failed

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` format
3. Test connection: `psql $DATABASE_URL`
4. Check firewall rules

See [Common Issues](./common-issues.md#database-issues) for more solutions.

### Image upload failed

1. Check storage credentials
2. Verify bucket exists
3. Check IAM permissions (AWS S3)
4. Test upload manually

See [Common Issues](./common-issues.md#storage-issues) for more solutions.

---

## Development

### How do I contribute?

See [Contributing Guide](../../CONTRIBUTING.md) for:
- Development setup
- Coding standards
- Pull request process
- Code of conduct

### How do I report bugs?

Open an issue on [GitHub](https://github.com/xdzczk/SmartFlowSocial/issues):
- Include clear steps to reproduce
- Specify your environment
- Add screenshots if applicable

### How do I request a feature?

Open a feature request on [GitHub Discussions](https://github.com/xdzczk/SmartFlowSocial/discussions):
- Describe the feature
- Explain the use case
- Suggest implementation if possible

---

## Related Documentation

- [Quick Start Guide](../getting-started/quickstart.md) - Get started fast
- [Common Issues](./common-issues.md) - Common problems and solutions
- [Installation Guide](../getting-started/installation.md) - Complete setup
- [Troubleshooting Guide](./debugging.md) - Debugging techniques

---

**Still have questions?** [Open an issue](https://github.com/xdzczk/SmartFlowSocial/issues) or [start a discussion](https://github.com/xdzczk/SmartFlowSocial/discussions).

