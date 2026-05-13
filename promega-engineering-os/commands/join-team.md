---
name: join-team
description: Set up shared team folders inside the RDC Renovations SharePoint-synced folder for team knowledge sharing
---

# /join-team — Shared Team Folder Setup

Creates the engineer's name folders inside the shared RDC folder (Troubleshooting, Tribal Knowledge, Brainstorming). Separate from `/begin` because the SharePoint shortcut may not be available at first run, and because this command can be re-run to recreate the structure.

## Step 0 — Require `/begin` first

```bash
test -f "[Mounted Folder]/Personal Workspace/CLAUDE.md"
```

Missing:
> "I don't see a `Personal Workspace/CLAUDE.md` yet — run `/begin` first to set up your workspace, then come back to `/join-team`."

Stop. Don't bootstrap from this command — `/begin` is the single source of truth.

## Step 1 — Discover the shared RDC folder

```bash
ls -1 /sessions/[session-id]/mnt/ | grep -v '^\.'
# For each top-level mount:
find /sessions/[session-id]/mnt/[MOUNT_NAME] -type d -name "RDC Renovations*" -maxdepth 3
```

- **None found** — exit: *"I don't see the RDC Renovations shared folder in your mounted directory. To set up team sharing, you need a SharePoint shortcut to 'RDC Renovations - 06 Production Support' inside the folder you've mounted in Cowork. Once that's in place, run `/join-team` again."*
- **Multiple matches** — present options via **AskUserQuestion** with parent-folder context.
- **One match** — store and proceed.

## Step 2 — Engineer's name

Check in order:
1. `Personal Workspace/CLAUDE.md` title line (`# Promega Engineering Workspace, [USER NAME]`).
2. Personal Preferences `## About Me`.
3. Ask: *"What's your name? I'll use it to create your folders in the shared team space."*

If CLAUDE.md and Personal Preferences disagree (rare), trust CLAUDE.md — it's workspace-local.

## Step 3 — Create the folder structure

Inside the resolved RDC folder:

```
RDC Renovations - 06 Production Support/
├── Troubleshooting/[Engineer Name]/
├── Tribal Knowledge/[Engineer Name]/
└── Brainstorming/[Engineer Name]/
```

Rules:
- If category folders (Troubleshooting, Tribal Knowledge, Brainstorming) don't exist, create them — the first engineer to run `/join-team` bootstraps the shared structure.
- If the engineer's name folder already exists in any category, leave it alone.
- Use `mkdir -p`.

## Step 4 — Verify

`test -d` and `test -w` each of the three name folders. Any failure → stop and report which folder broke. Don't proceed to Step 5 with broken paths in CLAUDE.md.

## Step 5 — Update workspace `CLAUDE.md` (surgically)

Edit (not Write). Touch **only** the `## RESOLVED PATHS` section. Don't modify any other section.

`/begin` left `## RESOLVED PATHS` in one of two states:

**State A** — shared folder not yet found:
```markdown
## RESOLVED PATHS
- **Personal Workspace**: /path/to/Personal Workspace
- **Shared Team Folder**: NOT CONFIGURED — run /join-team
```

**State B** — shared folder already found by `/begin`:
```markdown
## RESOLVED PATHS
- **Personal Workspace**: /path/to/Personal Workspace
- **Shared Team Folder**: /path/to/RDC Renovations - 06 Production Support
- **My Troubleshooting Folder**: /path/.../Troubleshooting/[Engineer Name]/
- **My Tribal Knowledge Folder**: /path/.../Tribal Knowledge/[Engineer Name]/
- **My Brainstorming Folder**: /path/.../Brainstorming/[Engineer Name]/
```

After `/join-team` succeeds, the section must be in **State B**:
- **Keep** the `- **Personal Workspace**:` line exactly. Don't re-resolve.
- **Replace** `Shared Team Folder` value with the resolved RDC path.
- **Add or replace** the three `My ... Folder:` lines with real paths.

Implementation: read CLAUDE.md, locate the `## RESOLVED PATHS` heading and its body (up to the next heading or EOF), build the new State B body preserving the Personal Workspace value, and Edit-replace.

If `## RESOLVED PATHS` is missing entirely (predates `/begin` v2 — unlikely), insert a fresh State B block after the `# [title]` line, before `## Quick Reference`, using the title line as the Edit anchor.

## Step 6 — Confirm

> "Your team folders are set up under [Shared RDC path]. Share something with the team using `/share-chat` or `promote-to-team` and it'll land in the right category folder."

## Safety

- Never write to the first match found without confirmation when multiple shared folders match.
- Never search by name at runtime if `## RESOLVED PATHS` already has the path.
- Never modify any section of `Personal Workspace/CLAUDE.md` other than `## RESOLVED PATHS`.
- Preserve the `Personal Workspace` line verbatim — don't re-resolve it.
- Verify before/after writes; always report the resolved RDC path back.
