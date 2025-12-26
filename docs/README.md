# SmartFlowSocial Documentation

Welcome to the SmartFlowSocial documentation hub! This guide will help you understand, set up, and contribute to the project.

## 🚀 Quick Start

**New to SmartFlowSocial?** Start here:

1. **[Environment Setup](./getting-started/environment-setup.md)** - Configure your development environment
2. **[Onboarding Guide](./getting-started/onboarding.md)** - First-time user guide
3. **[Architecture Overview](./getting-started/architecture.md)** - Understand the system structure

**Want to contribute?**
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute
- [Development Setup](./development/testing.md) - Testing and development workflow
- [Documentation Style Guide](./documentation-style-guide.md) - How to write documentation

## 📚 Table of Contents

### Getting Started
- [Environment Setup](./getting-started/environment-setup.md) - Configure all required environment variables
- [Onboarding](./getting-started/onboarding.md) - First-time user guide
- [Architecture](./getting-started/architecture.md) - Project structure and code organization

### Core Features
- [Posting Workflow](./features/posting.md) - How to create and schedule posts
- [Calendar Feature](./features/calendar-feature.md) - Visual post scheduling with drag-and-drop
- [Lightning Payments](./features/lightning-payments.md) - Subscription payment system

### Development
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute to the project
- [Documentation Style Guide](./documentation-style-guide.md) - How to write and maintain documentation
- [Testing Guide](./development/testing.md) - Complete testing guide (Vitest setup, Cypress, property-based, security, performance)
- [Test Strategy](./development/test-strategy.md) - Testing philosophy, strategy, coverage goals, and reporting
- [Testing Patterns](./development/testing-patterns.md) - Common testing patterns and mocking guidelines
- [Test Troubleshooting](./development/test-troubleshooting.md) - Common testing issues and solutions
- [Test Database](./development/test-database.md) - Database integration testing guide
- [Error Handling](./error-handling.md) - Centralized error handling (includes implementation and metrics)
- [CI/CD Guide](./ci-cd.md) - Continuous integration and deployment
- [Migration Plan](./migration-plan.md) - Database migration guide
- [Migration Drift Resolution](./migration-drift-resolution.md) - Resolving migration drift issues

### Operations & Deployment
- [Deployment Guide](./operations/deployment.md) - Production deployment guide (Fly.io, Railway, Docker, AWS)
- [Operations Guide](./operations/operations.md) - Monitoring, logging, alerting, and maintenance
- [Queue System](./operations/queue-system.md) - BullMQ/Redis queue system documentation
- [Backup & Recovery](./operations/backup-recovery.md) - Backup procedures and disaster recovery
- [Troubleshooting Guide](./operations/troubleshooting.md) - Common issues and solutions

### Security
- [Security Guide](./security/security.md) - Security best practices and guidelines
- [Sentry Setup](./security/sentry-setup.md) - Error tracking and monitoring setup

### Integration
- [Nostr Integration](./integration/nostr-integration.md) - Nostr protocol integration and NIP implementations
- [Component Library](./integration/components.md) - UI component documentation and usage guide

### Reference
- [API Reference](./reference/api-reference.md) - API endpoints and usage
- [Database Schema](./reference/database-schema.md) - Data models and relationships
- [Performance Guide](./reference/performance.md) - Performance optimization strategies

## 🔗 Quick Links

### Essential Resources
| Resource | Description |
|----------|-------------|
| [Project README](../README.md) | Project overview and quick start |
| [example.env](../example.env) | Environment variable template |
| [schema.prisma](../prisma/schema.prisma) | Database schema definition |
| [Contributing Guide](../CONTRIBUTING.md) | How to contribute to the project |

### Common Tasks
- **Setting up**: [Environment Setup](./getting-started/environment-setup.md)
- **Creating posts**: [Posting Workflow](./features/posting.md)
- **Deploying**: [Deployment Guide](./operations/deployment.md)
- **Testing**: [Testing Guide](./development/testing.md)
- **Troubleshooting**: [Troubleshooting Guide](./operations/troubleshooting.md)

### Documentation
- [Documentation Style Guide](./documentation-style-guide.md) - How to write and maintain documentation
- [Archive](./archive/README.md) - Historical documentation

## 📋 Documentation Categories

### By Role
- **👨‍💻 Developers**: [Development](./development/) - Testing, CI/CD, error handling
- **🚀 DevOps**: [Operations](./operations/) - Deployment, monitoring, troubleshooting
- **🔒 Security**: [Security](./security/) - Security practices, Sentry setup
- **👤 Users**: [Getting Started](./getting-started/) - Setup, onboarding, features

### By Topic
- **🏗️ Architecture**: [Architecture](./getting-started/architecture.md), [Database Schema](./reference/database-schema.md)
- **🧪 Testing**: [Testing Guide](./development/testing.md), [Test Strategy](./development/test-strategy.md)
- **🔌 Integration**: [Nostr Integration](./integration/nostr-integration.md), [Components](./integration/components.md)
- **📊 Reference**: [API Reference](./reference/api-reference.md), [Performance](./reference/performance.md)

## 🆘 Need Help?

1. **Check the relevant documentation** file above
2. **Review the [Contributing Guide](../CONTRIBUTING.md)** for development questions
3. **Check [Troubleshooting Guide](./operations/troubleshooting.md)** for common issues
4. **Open an issue on GitHub** for bugs or feature requests

## 📝 Contributing to Documentation

See our [Documentation Style Guide](./documentation-style-guide.md) for:
- Writing standards and conventions
- Documentation templates
- Review process
- Best practices
