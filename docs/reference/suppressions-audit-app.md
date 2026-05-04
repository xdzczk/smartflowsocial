# App suppressions audit (Kill the disables campaign)

This document is the single source of truth for **eslint-disable** and **TypeScript suppressions**
in `app/`. Every suppression must be justified (visa standard) and categorized.

## Visa standard

- **Every** `eslint-disable`, `@ts-ignore`, or `@ts-expect-error` in `app/` must have a **trailing
  comment** explaining why.
- **Categories:**
  - **Acceptable** - Documented interop or known-safe escape hatch. One-line comment; no expiry.
  - **Temporary** - Migration/refactor in progress. Comment + `TODO(TICKET-XXX): remove after …`.
  - **Must fix** - Code smell or missing/weak comment. Remove when touching the file or
    re-categorize with proper comment.

Any disable without a trailing comment is treated as **Must fix** until justified or removed.

## Generating the audit list

- **Full TSV (file, line, kind, rule, comment, category, action):**  
  `node scripts/audit-suppressions-app.js`
- **Raw matches (file, line, match):**  
  `./scripts/audit-suppressions.sh app`

Fill the **category** and **action** columns when categorizing. Maintain this doc and the script
output as the backlog.

## Categorization criteria (by rule type)

| Rule / area                                                                       | Typical category               | Action                                                                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-unnecessary-condition` (Remix/runtime guards)              | Acceptable                     | Keep; ensure comment says "Runtime type guard" or "Runtime safety".                                                        |
| `sonarjs/cognitive-complexity`                                                    | Temporary                      | Add TODO linking to UI/file breakup; accept as Acceptable only if file already split and complexity is orchestration-only. |
| `react-hooks/exhaustive-deps`                                                     | Acceptable if comment explains | Comment must state why deps are intentionally limited (e.g. "avoid infinite loop").                                        |
| `react-hooks/incompatible-library`                                                | Acceptable                     | Comment must name library (e.g. TanStack Virtual) and that it is not memoization-safe by design.                           |
| `react/no-array-index-key`                                                        | Acceptable if justified        | Comment must explain no stable id (e.g. "Stable list of tags, no unique ID").                                              |
| `jsx-a11y/*`                                                                      | Acceptable if justified        | Comment must explain wrapper role / keyboard handled inside or drag-only.                                                  |
| `@typescript-eslint/consistent-type-assertions`, `no-explicit-any`, `no-unsafe-*` | Acceptable for interop         | One-line Prisma/BullMQ/Remix/web-push explanation.                                                                         |
| `@ts-ignore`                                                                      | Must fix → Acceptable          | Replace with `@ts-expect-error` and short comment.                                                                         |

## Counts (update when re-auditing)

- Run `node scripts/audit-suppressions-app.js | wc -l` and subtract 1 (header) for total app
  suppressions.
- **Acceptable:** documented interop / runtime guards with comment.
- **Temporary:** cognitive-complexity and similar with TODO + ticket.
- **Must fix:** no comment or weak comment; fix when touching file.

## Maintenance

- When **adding** a suppression: add a row (or ensure script output includes it) and assign
  category; ensure trailing comment.
- When **removing** a suppression: remove from audit or mark resolved.
- **Backlog:** Every "Must fix" and "Temporary" should have a ticket or link to an epic (e.g. UI
  file breakup). Review in planning.

## CI check (optional)

To reject new suppressions in `app/` that lack a trailing comment, run:

`node scripts/check-suppressions-have-comments.js`

Add this to CI or pre-commit to enforce the visa standard on new code.

## See also

- [CONTRIBUTING.md §6 Lint and type suppression policy](../../CONTRIBUTING.md) - visa standard and
  when to fix.
- [CONTRIBUTING.md §10 Type safety](../../CONTRIBUTING.md) - any and unsafe casts.
