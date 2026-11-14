# Commit metadata and pseudonymity

An audit on 14 November 2026 found a large number of commits whose author email is an iCloud
address, with author names that include Ivan and xdzczk. That links the public Git history to a
personal mailbox.

This note does not repeat the email address.

## What to do from now on

Use a GitHub noreply address for new commits in every repository you push publicly:

```bash
git config user.name "xdzczk"
git config user.email "<id>+<username>@users.noreply.github.com"
```

Set that in each clone, or set it globally if every public repo should use it. Do not put the
personal mailbox in `user.email`.

GitHub's noreply form is under Settings → Emails. New commits after the change are the part you can
fix without rewriting history.

## Historical commits

Rewriting author email with `git filter-repo` or BFG changes every commit hash from the first
affected commit onward. That requires a force push. Open pull requests, forks, and anyone who cloned
the repository have to reset. Tags, if you create them later, must be recreated. GitHub will still
have the old commits cached until support clears them, and forks can keep the old address forever.

Do not rewrite history unless the owner explicitly wants that tradeoff. A noreply address going
forward does not remove the address from existing commits.

The same pattern should be checked in the publisher, Blastr, Blossom, and cache-worker repositories
before any rewrite. A rewrite of one repository does not clean the others.

## Tracked diagnostics

`.cursor/debug-995736.log`, `test-results/results.json`, and `test-results/junit.xml` were tracked.
They are removed from the index in this working tree and ignored. That does not purge them from
older commits. Purging them is the same history-rewrite decision as the email.
