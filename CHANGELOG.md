# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/) and this project adheres to
[Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- Blossom (vibe-cdn) upload integration: token-based uploads, commit-batch, quota/usage tracking.
- Web Push notifications: subscribe/unsubscribe, VAPID config, publish success/failure and
  runway-low alerts.
- Media intents and commit API: declare files before upload, commit after upload (S3/Blossom).
- Engagement feed APIs: mark-state, reply-templates; engagement feed UI improvements.
- "Also repost/quote this" in composer and calendar: schedule a repost or quote alongside a main
  post.
- Thread view: load and display Nostr thread (root + replies) from engagement feed.
- Preferred Nostr client for external links: choose which client opens "View on Nostr" (PRIMAL,
  DAMUS, AMETHYST, etc., or CUSTOM URL).
- Random schedule window: post at a random time within ±N minutes of the chosen slot (queue or
  composer).
- Complex giveaways: presets, per-engagement-type winner pools and sats, selection mode, filters.
- Referral system and cron: referral payouts, cron jobs for subscription checks and runway-low
  notifications.
- NIP-46 (remote signer) support and auth signer architecture improvements.
- Additional API endpoints: global-search, zap-profile, profile-display-name, post-stats,
  publish-result, posts/:id, push-subscribe/unsubscribe, primary-signer-profile.

### Changed

- API reference, database schema, and configuration docs updated to match current codebase.
- Documentation: fixed broken links, added user guides for new features, corrected payment-status
  and posts/batch docs.

### Fixed

- (Add fixes as they land.)

---

## [1.0.0] - 2024-01-01

### Added

- User registration and authentication with Nostr (NIP-07).
- Scheduled posting with calendar view and queue types (interval and fixed slots).
- Bulk image upload and bulk scheduling.
- Hashtag presets and automated hashtag handling.
- Giveaway management: track engagement, select random winners, blacklist.
- Dashboard with posts, drafts, calendar, queues, giveaways, settings.
- Long-form articles (NIP-23) with rich text editor.
- Templates and recyclable posts.
- Multi-account (parent/child) support.
- Lightning payments (NWC) and subscription plans.
- REST API for posts, uploads, queue scheduling, user operations.

### Changed

- None.

### Fixed

- None.

---

When releasing: add a new `## [x.y.z] - YYYY-MM-DD` section, move Unreleased items into it, and
clear Unreleased. In PRs, add user-facing or notable changes under Unreleased.

### Format Guide

Each section in this changelog uses the following categories:

- **Added**: For new features.
- **Changed**: For changes in existing functionality.
- **Fixed**: For any bug fixes.
- **Removed**: For any features removed in that version.

---

This changelog should be updated with each release, summarizing what’s new, improved, or fixed to
keep track of all project changes in a clear and organized manner.
