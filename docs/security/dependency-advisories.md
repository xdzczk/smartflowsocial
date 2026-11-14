# Dependency advisories

Refreshed on 14 November 2026 with pnpm 10.27.0, the version pinned by `packageManager`.
`pnpm audit` and `pnpm audit --prod` were run in each repository. Companion development trees pull
in Vite, Wrangler, and Vitest, so a full audit is noisy. The production audit is the one that
describes what a deployment installs.

## Main application, production

| Package             | Installed                                     | Severity            | Reachable?                                                                                                                                                                             | Decision                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | --------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zod`               | 4.6.7 only, after `@nostrify/nostrify` 0.55.1 | Was high on 3.25.76 | The vulnerable release is Zod 3. The only runtime import of nostrify is the Blossom uploader, and 0.55.1 still exports that uploader with the same `servers` and `signer` constructor. | Upgraded. `pnpm why zod` shows 4.6.7 and no Zod 3 copy.                                                                                                                                                                                                                                                                                                                   |
| `react-router`      | 6.30.6, pinned                                | Moderate            | Two advisories. The patched release is 7.18.0. There is no 6.x fix. Remix 2 is built on 6.x, so 7.18 is a framework migration, not a patch.                                            | Stay on 6.30.6. `safeInternalPath` rejects protocol-relative and backslash targets before `redirect()`, `navigate()`, and `location.assign()`. The SSR `deserializeErrors` issue needs the attacker to supply the hydration payload. Same-origin error HTML is produced by the server. `pnpm audit --prod --audit-level high` stays green because these two are moderate. |
| `body-parser`       | 1.20.9 via `@remix-run/dev`, 2.4.0 in the app | Was high on 1.20.8  | Development server for the 1.x copy.                                                                                                                                                   | Override applied.                                                                                                                                                                                                                                                                                                                                                         |
| `happy-dom`         | 20.14.6                                       | High                | Test runner only. The fix is 21.0.4, a major bump.                                                                                                                                     | Leave it. Do not load untrusted HTML in tests that use this version.                                                                                                                                                                                                                                                                                                      |
| `glob`, `minimatch` | tooling                                       | Moderate            | ESLint and Remix's dev CLI.                                                                                                                                                            | Leave them. Overriding those majors breaks the tools that import them.                                                                                                                                                                                                                                                                                                    |

## Publisher, production

`valibot` 1.2.0 had a moderate advisory: `record()` issue paths can make `flatten()` throw when a
property name is inherited. The publisher schemas use `object`, `array`, and `pipe`, not
`record().flatten()`. It is now on 1.5.0. `pnpm audit --prod` in the publisher reports no known
vulnerabilities.

The rest of the publisher audit is the Wrangler and Vitest development tree. Those packages are not
in the worker bundle. Do not treat that list as production exposure.

## Blastr, Blossom, cache worker

`pnpm audit --prod` reported no advisories in Blastr, Blossom, or the cache worker on 14
November 2026. Their full audits report the same class of development-tool findings as the
publisher.

## What this does not do

A React Router 7 migration is a separate project. It is not part of this change.
