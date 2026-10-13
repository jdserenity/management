# Code style

- Indentation: 2 spaces everywhere (Python and TypeScript).
- Semicolon-separated statements: The owner frequently writes multiple short statements on one line separated by ; (e.g. x = 1; y = 2; return x + y). Preserve this when it appears; do not split it across lines.
- Concise over verbose: Prefer compact expressions. Do not expand single-line constructs into multi-line ones just because a linter would.
- No auto-formatting: Do not reformat code that wasn't changed. Only touch indentation/style in code you are actively editing. Do not impose generic Black/PEP8 reflows on this codebase.
- Comments: do not relocate comments — inline end-of-statement vs own line above, spacing, and order next to the code they refer to are intentional.
- Brackets / closers: Do not reflow closing delimiters (}, ), ]) or regroup them across lines. Preserve compact runs (e.g. },},))) vs stacked closers when the file already uses one style.
- Do not create a CLAUDE.md file. And if you find one, delete it and put whatever was valuable in its proper file.

# Token Hygiene

- NEVER EVER GREP THE ENTIRE CODEBASE IF READING scaffold/CODEMAP-LLM.md WOULD SUFFICE. YOU WASTE MY FUCKING TOKENS LIKE YOU DON'T KNOW THEY COST MONEY. I DON'T EVER WANT TO SEE THAT AGAIN UNLESS ABSOLUTELY NECESSARY.
- Re-read scaffold/AGENT-COMMS.md, scaffold/AGENT-WORKFLOW.md, and the relevant scaffold/ files every so often as context grows.

# Test Driven Development

- Tests are required for every implemented behavior.
- Prefer Test Driven Development when adding or changing functionality.
- Favor simple, inspectable technology choices over unnecessary complexity.

# Git history

- In a Git repository, automatically commit and push completed work as implementation progresses. Do not wait for the maintainer to ask.
- Treat each independent behavior or file-area change as a commit cycle: finish it, verify it, commit it, and push it before starting the next cycle. The end of a turn is never the trigger for the first commit.
- A final commit may contain only one remaining logical unit. It must never combine units that were completed earlier in the turn.
- Follow `scaffold/skills/logical-commits/SKILL.md` for commit boundaries, verification, staging, pushing, and failure handling.
- Never rewrite an existing commit to undo or correct it. Record the change in a new commit.

# Local visual preview

When the work is something the maintainer needs to *see* in a browser (HTML/CSS, a website, UI layout, landing page, frontend styling, or similar visual work):

- Start a local preview server yourself early — do not wait for the maintainer to ask or to run it themselves.
- First check whether a useful server is already running (existing terminals / processes). Reuse it if it is.
- Prefer the project's normal start command when one exists (`npm run dev`, `vite`, whatever README documents, etc.).
- If there is no project start command and the files are static HTML/CSS/JS, start a simple static file server from the directory that should be served (for example `python3 -m http.server 5173`).
- Run the server in the background and tell the maintainer the URL (usually `http://localhost:<port>`).
- After visual edits, leave the server up so they can refresh and check the change.

# Definition of done

A change is done only when:
1. It does what we agreed it should do.
2. Automated tests cover that behavior (new tests for new behavior; changed tests when behavior changes).
3. If facts changed for the product or system, scaffold/CODEMAP-LLM.md is updated (minimal deltas; no padding). Update scaffold/CODEMAP-HUMAN.md when the file map, flows, or state locations changed (see that file's "what belongs here" list).
4. For visual / UI work covered by Local visual preview, a local preview server is running (or already was) and the maintainer has the URL.
How to pick test type (project default):
5. Unit: small pieces of logic with no real database or network.
6. Integration: behavior that really depends on HTTP + DB, or webhooks / OAuth / Stripe — exercise real boundaries with test keys, stubs, or recorded fixtures as appropriate.
7. Browser (e2e): only for stable end-to-end flows; avoid writing a dozen e2e tests while screens are still moving daily.

scaffold version: 2.9.0
