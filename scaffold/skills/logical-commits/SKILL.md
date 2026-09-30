---
name: logical-commits
description: >-
  Maintain a trail of small, coherent Git commits and push completed work
  during change and build tasks in a Git repository. Do not use for read-only
  requests or repositories without Git.
---

# Automatic logical commits

Commit and push work without waiting for the maintainer to ask. Treat Git history as part of implementation, not as end-of-task cleanup. A broad user request does not authorize one broad end-of-turn commit.

## What counts as one commit

Each commit is one coherent unit of work — something you can describe in one short message (e.g. "add user model", "wire login route to session", "add tests for login validation"). A multi-step feature usually becomes several commits; how many depends on the work, not a fixed count.

Prefer commits that leave the repo in a sensible state (tests passing for what that commit adds). Avoid half-wired broken middles unless you truly cannot avoid them. Prefer coherent chunks over both mega-commits and meaningless one-line typo commits.

Commit a coherent unit as soon as it is complete and verified. Do not hold several completed units for one large commit at the end of the task. Keep a behavior and its tests together when separating them would make either commit misleading or broken.

## Commit cycles

For a request with multiple independent changes, identify the smallest sensible commit cycles before editing. Work on one cycle at a time.

After completing a cycle, run its checks, stage it, review the staged diff, commit it, and push it **before investigating or implementing the next cycle**. Do not keep working because the user requested several changes in one turn.

If the working tree contains changes from two completed cycles, stop immediately and split, commit, and push the first cycle. The end of a turn is only allowed to commit one remaining cycle; it must never be the first time several completed cycles are committed together.

Use one commit only when the changes are genuinely inseparable: splitting them would make a commit misleading or broken. Do not call changes inseparable merely because they were requested together, edited in the same file, or completed in the same turn.

## Example: one turn with three independent changes

If the request is “add CSV export, improve the empty state, and document the new environment variable,” the turn should look like this:

1. Implement CSV export and its tests. Run the export checks. Commit and push `Add CSV export for reports.`
2. Only after that push succeeds, implement the empty-state change and its tests. Run the UI checks. Commit and push `Improve the empty state for empty reports.`
3. Only after that push succeeds, update the environment-variable documentation. Run the documentation check. Commit and push `Document the reports environment variable.`

The resulting history has three commits, even though the user asked for all three changes in one turn. It must not end with one commit containing export, UI, and documentation work just because the agent completed them during the same pass.

## Commit messages

Write complete sentences: a short subject stating what changed and why it matters (focus on "why" over "what").

## Workflow

1. Before editing, inspect `git status`, the relevant diff, the current branch and upstream, and recent commit messages. Identify pre-existing changes so they are not accidentally included.
2. Identify the first commit cycle and work only on it. Do not start a second cycle while the first is uncommitted.
3. As that cycle is completed, run the checks appropriate to it. Then stage only that cycle. Prefer explicit paths; use patch staging when a file contains both task work and unrelated changes. Review the staged diff before committing.
4. Commit the cycle, confirm the commit contains only that cycle, then push it to the configured upstream remote. If the branch has no upstream and `origin` exists, establish it with `git push -u origin HEAD`.
5. Only after the push succeeds—or is safely recorded as a failure—begin the next cycle. At the end, confirm all task changes are committed and pushed while unrelated pre-existing changes remain untouched.

## Safety and failure handling

- Never amend, reset, rebase, squash, or force-push to correct completed work. Make a new corrective or revert commit.
- Never discard, overwrite, stash, or commit unrelated changes belonging to the maintainer or another agent.
- Do not commit likely secrets, credentials, private keys, or local-only configuration.
- If verification fails, fix the unit before committing when practical. If a previously committed change later proves wrong, preserve it and add the fix or reversal as a new commit.
- If committing or pushing fails, keep completed local commits intact, continue safe work when possible, and clearly report what remains uncommitted or unpushed. Do not rewrite history or force-push to recover.
