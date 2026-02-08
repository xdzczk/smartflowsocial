# Icon semantics

One concept = one icon across the app. This map is the source of truth for Lucide icon choice so
sidebar, dashboard, and future features stay consistent.

## Rules

1. **Dashboard** = status & action only (e.g. Scheduled = clock, Published = check, Compose = plus).
2. **Sidebar** = domains + content types; use state-style icons for state (e.g. Drafts =
   FilePenLine), not content-type icons.
3. **No duplicate metaphors** for the same concept (e.g. Create is always Plus, not Upload).
4. **Parent vs child** in nav: parent = domain (e.g. Flame for Engagement), child = representation
   (e.g. Rss for Engagement Feed), not the same icon twice.

## Concept → icon map

| Concept                      | Icon             | Allowed contexts                   |
| ---------------------------- | ---------------- | ---------------------------------- |
| Create                       | Plus             | Sidebar Create, dashboard Compose  |
| New post (note)              | MessageSquare    | Sidebar “New Post”                 |
| New long-form                | FileText         | Sidebar “New Long-form”            |
| Drafts (state)               | FilePenLine      | Sidebar “Drafts”                   |
| Templates                    | Copy             | Sidebar “Templates”                |
| Bulk / batch                 | LayoutGrid       | Sidebar “Bulk Posts”               |
| Engagement (domain)          | Flame            | Sidebar “Engagement”               |
| Feed                         | Rss              | Sidebar “Engagement Feed”          |
| Giveaway                     | Gift             | Sidebar “Giveaway”                 |
| Dashboard home               | Home             | Sidebar “Dashboard”                |
| Calendar                     | CalendarDays     | Sidebar “Calendar”                 |
| Scheduled                    | Calendar / Clock | Sidebar, dashboard                 |
| Published / time             | Clock            | Sidebar “Published”                |
| Published / done             | Check            | Dashboard status                   |
| Runway / time span           | Calendar         | Dashboard                          |
| Settings                     | Settings         | Sidebar “Settings”                 |
| Lock (restricted)            | Lock             | Nav when feature gated             |
| Assets / media library       | FolderOpen       | Browse assets, asset browser       |
| Replies / comments           | MessageCircle    | Engagement, reply counts           |
| Zaps (sats)                  | Zap              | Zaps, lightning                    |
| Likes                        | Heart            | Likes, favorites                   |
| Reposts                      | Repeat           | Reposts                            |
| Share                        | Share2           | Share badge, share action          |
| Quoted post                  | Quote            | Quoted badge                       |
| Notifications (empty / bell) | Bell             | Empty state, notification list     |
| Auto / unscheduled           | Settings         | Settings/cog where appropriate     |
| Signed / done                | Check            | Signed, completed (already in map) |
| Search                       | Search           | Search inputs, search results      |
| Close / dismiss              | X                | Close, dismiss (already in nav)    |
| Copy / share link            | Copy or Link     | Copy vs link as appropriate        |

## Styling

- **Nav**: 18px, stroke 2.25. Implemented in `DashboardHeader` and `ExpandableNavigationSection`; do
  not change here — keep nav constants in those components.
- **Inline/button/table icons**: Default `h-4 w-4` (16px), `strokeWidth={2}` for Lucide. Use
  `h-3 w-3` only for small badges (e.g. table cell badges). Do not use stroke 1.5; use 2 for
  consistency.
- Use shared constants from `app/lib/icon-constants.ts` for non-nav icons (`INLINE_ICON_SIZE_CLASS`,
  `INLINE_ICON_STROKE`, `SMALL_ICON_SIZE_CLASS`).

## When adding features

- New **domain** or **content type** in sidebar → pick one icon from this map or add a new row with
  a single, clear metaphor.
- New **state** (e.g. “Archived”, “Pending”) → use a state-style icon (e.g. pen, clock, outline),
  not a content-type icon.
- New **action** on dashboard → use the same icon as elsewhere for that concept (e.g. create = Plus
  everywhere).
