# Welcome to Turni di Palco

## How We Use Claude

Based on Claude's usage over the last 30 days (2 sessions — small sample, will sharpen as the team uses it more):

Work Type Breakdown:
  Plan Design     ████████████████████  100%

Top Skills & Commands:
  _None used yet — see "Skills to Know About" below for what's available._

Top MCP Servers:
  github          ████████████████████  6 calls

## Your Setup Checklist

### Codebases
- [ ] turni-di-palco — https://github.com/atcl-lazio/turni-di-palco

### MCP Servers to Activate
- [ ] **github** — Read/write GitHub issues, PRs, comments, branches, files. Used to triage issues like #27 and post operational plans without leaving Claude. Not in the committed `.mcp.json` (which only has `render` and `uptimerobot`); add it to your local Claude Code MCP config — see the [GitHub MCP server docs](https://github.com/github/github-mcp-server) for setup. You'll also need a GitHub account with access to `atcl-lazio/turni-di-palco` — ping the repo owner for an invite.

### Skills to Know About
- `/init` — Generates the initial `CLAUDE.md` file with codebase documentation. Useful when bootstrapping a new repo for Claude.
- `/review` — Reviews a pull request. Drop in a PR number when you want a structured review pass.
- `/security-review` — Runs a security review of pending changes on the current branch. Worth running before opening a PR that touches auth, RLS, or data flow.
- `/simplify` — Reviews changed code for reuse, quality, and efficiency, then fixes issues found.
- `/loop` — Runs a prompt or slash command on a recurring interval (e.g. `/loop 5m /foo`). Handy for polling deploy/CI status.
- `/fewer-permission-prompts` — Scans recent transcripts for safe read-only commands and adds them to `.claude/settings.json` to cut down permission prompts.

## Team Tips

_TODO_

## Get Started

_TODO_

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
