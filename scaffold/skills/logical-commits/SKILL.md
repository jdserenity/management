---
name: logical-commits
description: >-
  Maintain a trail of small, coherent Git commits and push completed work
  during change and build tasks in a Git repository. Do not use for read-only
  requests or repositories without Git.
---

# Automatic logical commits

Commit and push work without waiting for the maintainer to ask. Treat Git history as part of implementation, not as end-of-task cleanup.

## What counts as one commit

Each commit is one coherent unit of work — something you can describe in one short message (e.g. "add user model", "wire login route to session", "add tests for login validation"). A multi-step feature usually becomes several commits; how many depends on the work, not a fixed count.

Prefer commits that leave the repo in a sensible state (tests passing for what that commit adds). Avoid half-wired broken middles unless you truly cannot avoid them. Prefer coherent chunks over both mega-commits and meaningless one-line typo commits.

Commit a coherent unit soon after it is complete and verified. Do not hold several completed units for one large commit at the end of the task. Keep a behavior and its tests together when separating them would make either commit misleading or broken.

## Commit messages

Write complete sentences: a short subject stating what changed and why it matters (focus on "why" over "what").

## Workflow

1. Before editing, inspect `git status`, the relevant diff, the current branch and upstream, and recent commit messages. Identify pre-existing changes so they are not accidentally included.
2. As each coherent unit is completed, run the checks appropriate to that unit.
3. Stage only that unit. Prefer explicit paths; use patch staging when a file contains both task work and unrelated changes. Review the staged diff before committing.
4. Commit the unit, confirm the commit contains only that unit, then push it to the configured upstream remote. If the branch has no upstream and `origin` exists, establish it with `git push -u origin HEAD`.
5. Repeat throughout the task. At the end, confirm all task changes are committed and pushed while unrelated pre-existing changes remain untouched.

## Safety and failure handling

- Never amend, reset, rebase, squash, or force-push to correct completed work. Make a new corrective or revert commit.
- Never discard, overwrite, stash, or commit unrelated changes belonging to the maintainer or another agent.
- Do not commit likely secrets, credentials, private keys, or local-only configuration.
- If verification fails, fix the unit before committing when practical. If a previously committed change later proves wrong, preserve it and add the fix or reversal as a new commit.
- If committing or pushing fails, keep completed local commits intact, continue safe work when possible, and clearly report what remains uncommitted or unpushed. Do not rewrite history or force-push to recover.
