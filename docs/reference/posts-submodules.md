# Posts Feature: Internal Submodules

**Last updated:** 2026-03-12

The `app/features/posts/` feature is split into internal submodules so that boundaries stay
meaningful as the product grows. The rest of the app uses `~/features/posts/server` and
`~/features/posts/ui` for **shared** symbols, and **submodule entry points** for submodule-specific
logic; internally, code in one submodule must not import from another submodule's internals—use the
submodule's public API (its `index.ts` or `index.server.ts`).

## Import guide

**Client (UI):**

- Use **`~/features/posts/ui`** for shared types, DTOs, dashboard/flow, shared modals, shared
  mutations, bulk page and its dependencies, and queue/file utilities.
- Use **`~/features/posts/composer`**, **`~/features/posts/calendar`**,
  **`~/features/posts/scheduling`**, **`~/features/posts/publishing`**,
  **`~/features/posts/longform`**, **`~/features/posts/drafts`**, **`~/features/posts/runway`** for
  submodule-specific UI (pages, tables, modals, hooks).

**Server:**

- Use **`~/features/posts/server`** for shared loaders (dashboard, flow, content stats, bulk),
  actions, content utilities, bulk handlers, and types/DTOs.
- Use **`~/features/posts/server/scheduling`**, **`~/features/posts/server/publishing`**,
  **`~/features/posts/server/drafts`**, **`~/features/posts/server/longform`**,
  **`~/features/posts/server/composer`**, **`~/features/posts/server/calendar`**,
  **`~/features/posts/server/runway`** for submodule-specific server logic (loaders, actions, use
  cases).

## Rule

**Code in submodule A must not import from submodule B's internals (e.g.
`posts/calendar/components/...` from `posts/composer`). Use B's public API via `../calendar` (the
sibling's index) or the feature's top-level `server`/`ui`.**

## Submodules

| Submodule      | Responsibility                                         | Public surface (what others may use)                                                                                                  |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **composer**   | Compose UI and create-post use case                    | UnifiedComposer, NewPostPage, BulkComposerModal, create-post use case, newpost actions/loaders, useComposer\* hooks                   |
| **calendar**   | Calendar views and calendar loaders/actions            | CalendarPage, CalendarQueuePage, calendar-action.server, calendar-loader.server, useCalendarQuery, calendar utils                     |
| **scheduling** | Schedule use cases and scheduled list UI               | schedule-post/schedule-longform-post/cancel-schedule use cases, ScheduledPostsPage, queue-schedule.server, schedulers                 |
| **publishing** | Publish/recycle use cases and published/recyclables UI | publish-now, publish-longform-now, recycle-post use cases, published-posts.server, PublishedPostsPage, Recyclables\*, state machines  |
| **longform**   | Longform CRUD and state machine                        | LongForm* components/pages, newlongform-action*, longform-edit-\*, create-longform-post use case, longform-post-state-machine         |
| **drafts**     | Draft list/edit UI and draft persistence               | DraftEditForm, DraftEditPage, DraftsPage, draft-\* services, useDraftsQuery, draft-version.server, draft-group.server, autosave-draft |
| **runway**     | Runway settings and KPI                                | runway.server (getRunwaySettings, updateRunwaySettings, getRunwayLastScheduledAtUtcMs), RunwaySettingsModal                           |

## Shared code

Types, DTOs, and utilities used by **two or more** submodules live in `posts/types.ts`,
`posts/dtos.ts`, `posts/utils/`, or a small `posts/shared/` if needed. Code used by only one
submodule should live inside that submodule once files are moved.

## Migration

**Completed (Track 1):** All seven submodules have had their files moved into their directories.
Each submodule's `index.ts` and `index.server.ts` re-export from local paths.

**Completed (Track 2 – barrel slim):** The top-level **server** is now a directory:
`posts/server/index.ts` exports only **shared** server symbols; submodule-specific server logic is
under `posts/server/scheduling.ts`, `posts/server/publishing.ts`, etc. The top-level **ui.ts**
exports only **shared** client symbols; submodule-specific UI is consumed via
`~/features/posts/composer`, `~/features/posts/calendar`, etc. Routes and features import from the
appropriate entry point (shared barrel or submodule).
