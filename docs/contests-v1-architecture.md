# Contests v1 Architecture

## Shared vs Separate Contract

- Shared with Giveaways:
  - finalization fee model and lock hash pattern
  - payout progress semantics
  - receipt/public proof style
  - plan-aware entitlements
- Contest-specific:
  - builder model (`source post`, `entry type`, `ranking metric`, `deadline`, `prize structure`,
    `fairness`)
  - ranked resolver with deterministic tie-breaks
  - frozen snapshot, alternates, and winner promotion logic
  - leaderboard-driven live/review UI

## Data Model

- `Contest` is the lifecycle/config root.
- `ContestSnapshot` captures freeze metadata and deadline context.
- `ContestEntry` stores immutable scored rows at snapshot time.
- `ContestWinner` stores winner and alternate sets.
- `ContestEventLog` stores contest lifecycle/audit events.
- `ContestFinalizationPayment` supports paid lock flows when enabled later.

## Lifecycle

- `DRAFT -> LIVE -> ENDED_REVIEW -> LOCKED -> PAYOUT_IN_PROGRESS -> COMPLETED`
- Side terminal path: `CANCELLED` before lock.

## Resolver Rules

- Entries: direct replies to one source note.
- Metrics: `REACTIONS`, `ZAPS`, `SATS_ZAPPED`.
- Deadline policy: ignore post-deadline engagement.
- Tie-break: primary score desc, earlier reply timestamp asc, event id lexicographic asc.
- Freeze policy: review and lock read frozen snapshot rows only.

## Rollout

- UI/routes are available under `dashboard/contests`.
- Navigation exposes `Contests` under Engagement.
- Feature access is plan-gated via `contests` in plan feature maps.
- Future hardening:
  - move route-level Prisma reads behind contest repositories
  - complete finalization invoice UI for non-zero fee plans
  - add notifications and telemetry events for deadline/lock/payout completion
