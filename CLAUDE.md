# Make it Pour

A canvas arcade game in a single self-contained `index.html`: no dependencies, no build step.
The README covers the rules, controls and scoring.

## Tests

`npm test` runs the Playwright suite in `tests/` against `index.html` in Chromium. Run
`npx playwright install chromium` first if the browser is missing. In a managed environment
that already has browsers, match the pinned `@playwright/test` version to them instead of
downloading. Most tests were real bugs at some point, so a failing test is a regression to
fix, never a test to loosen or skip.

Add a test for any bug you fix that the suite could have caught.

## Getting changes into main

`main` is protected: pushes straight to it are rejected, and a pull request can only merge
once the `playwright` check (`.github/workflows/test.yml`) passes. The owner still wants
finished work to land on `main` without waiting on them, so:

1. Branch from the latest `origin/main`, commit, and push the branch.
2. Open a pull request into `main` and watch its checks.
3. If `playwright` fails, read the job log, fix the cause, and push to the same branch.
   Repeat until it is green.
4. Once it is green and mergeable, merge it with **rebase** (or squash). Never use a merge
   commit. Rebase is preferred because each commit's message survives in `main`'s history.
   Then say it has been merged.

## Commits

- One commit per distinct fix or change, with a message that says what was wrong, how it
  was confirmed, and why the change matters. The history is read as the record.
- Only make changes that arguably improve the code or the player's experience. Do not
  change things just to change them.
