---
name: join-team
description: Set up shared team folders inside the RDC Renovations SharePoint-synced folder for team knowledge sharing
---

# /join-team — Shared Team Folder Setup

Creates the engineer's name folders inside the shared RDC folder (Troubleshooting, Tribal Knowledge, Brainstorming). This command exists separately from `/begin` for two reasons:
1. The RDC SharePoint shortcut might not be available when the engineer first runs `/begin`.
2. It can be run independently if the shared folder structure needs to be recreated.

---

## Tone

Same as `/begin` — professional and efficient. This is a quick setup task, not an onboarding flow.

---

## Flow

### Step 0 — Bail out early if `/begin` wasn't run

```bash
test -f "[Mounted Folder]/Personal Workspace/CLAUDE.md"
```

If the workspace CLAUDE.md doesn't exist, exit immediately without doing anything else:
> "I don't see a `Personal Workspace/CLAUDE.md` yet — run `/begin` first to set up your workspace, then come back to `/join-team` to connect the shared team folder."

Don't try to bootstrap the workspace from this command. `/begin` is the single source of truth for workspace setup.

---

### Step 1 — Discover the shared RDC folder

Run the mounted folder safety protocol:

**1. Map available folders:**
```bash
ls -1 /sessions/[session-id]/mnt/ | grep -v '^\.'
```

**2. Search for the RDC folder:**
For each top-level mount:
```bash
find /sessions/[session-id]/mnt/[MOUNT_NAME] -type d -name "RDC Renovations*" -maxdepth 3
```

**3. Handle results:**

**If not found** — Explain what's needed and exit:
> "I don't see the RDC Renovations shared folder in your mounted directory. To set up team sharing, you need a SharePoint shortcut to 'RDC Renovations - 06 Production Support' inside the folder you've mounted in Cowork. Once that's in place, run `/join-team` again."

**If multiple matches** — Present options with context (parent folder, contents) and let the engineer choose using **AskUserQuestion**.

**If exactly one match** — Store the resolved path and proceed.

### Step 2 — Get the engineer's name

Check for the engineer's name in this order:

1. **Read the workspace CLAUDE.md** at `Personal Workspace/CLAUDE.md`. The title line is `# Promega Engineering Workspace — [USER NAME]` (set by `/begin`). Pull the name from there. The `## Quick Reference` section also lists the role and team — useful for context but not required for this command.
2. **Check Personal Preferences** for the `## About Me` section ("My name is [USER NAME]...").
3. **If neither has a name** — ask:
   > "What's your name? I'll use it to create your folders in the shared team space."

If the engineer's name from CLAUDE.md and Personal Preferences disagree (rare), trust CLAUDE.md — it's workspace-local and reflects what `/begin` was told.

### Step 3 — Create the folder structure

Inside the resolved RDC folder, create the following (if they don't already exist):

```
RDC Renovations - 06 Production Support/
├── Troubleshooting/
│   └── [Engineer Name]/
├── Tribal Knowledge/
│   └── [Engineer Name]/
└── Brainstorming/
    └── [Engineer Name]/
```

**Rules:**
- If the category folders (Troubleshooting, Tribal Knowledge, Brainstorming) don't exist yet, create them. The first engineer to run `/join-team` bootstraps the entire shared structure.
- If the engineer's name folder already exists inside any category, leave it alone (don't overwrite).
- Use `mkdir -p` to create nested paths safely.

### Step 4 — Verify the folders

Check each created folder exists and is writable:
```bash
test -d "[Shared RDC]/Troubleshooting/[Engineer Name]" && \
test -w "[Shared RDC]/Troubleshooting/[Engineer Name]" && \
test -d "[Shared RDC]/Tribal Knowledge/[Engineer Name]" && \
test -w "[Shared RDC]/Tribal Knowledge/[Engineer Name]" && \
test -d "[Shared RDC]/Brainstorming/[Engineer Name]" && \
test -w "[Shared RDC]/Brainstorming/[Engineer Name]"
```

If any check fails, stop and report which folder couldn't be created or written to. Don't proceed to Step 5 with broken paths in CLAUDE.md.

---

### Step 5 — Update the workspace CLAUDE.md

**Critical: edit `Personal Workspace/CLAUDE.md` surgically. Touch only the `## RESOLVED PATHS` section. Never modify `## Planner Metadata` (if any), `## MOUNTS`, `## PLANNER ARCHITECTURE`, `## TEAM CONTEXT`, `## SHAREPOINT KNOWLEDGE BASE`, `## TEAM KNOWLEDGE SHARING`, `## FILE GENERATION ROUTING`, or `## NOTES VS CHAT SUMMARIES`.** Use the Edit tool, not Write.

The `## RESOLVED PATHS` section that `/begin` wrote looks like one of these two states:

**State A — `/begin` ran without finding the shared folder:**
```markdown
## RESOLVED PATHS
- **Personal Workspace**: /path/to/Personal Workspace
- **Shared Team Folder**: NOT CONFIGURED — run /join-team
```

**State B — `/begin` ran and the shared folder was found:**
```markdown
## RESOLVED PATHS
- **Personal Workspace**: /path/to/Personal Workspace
- **Shared Team Folder**: /path/to/RDC Renovations - 06 Production Support
- **My Troubleshooting Folder**: /path/to/RDC.../Troubleshooting/[Engineer Name]/
- **My Tribal Knowledge Folder**: /path/to/RDC.../Tribal Knowledge/[Engineer Name]/
- **My Brainstorming Folder**: /path/to/RDC.../Brainstorming/[Engineer Name]/
```

After `/join-team` succeeds, the section should always be in **State B**. The transformation is:

- **Keep** the `- **Personal Workspace**:` line exactly as-is. Don't re-resolve or change it.
- **Replace** `Shared Team Folder` value with the full resolved RDC path (no longer `NOT CONFIGURED`).
- **Add or replace** the three `My ... Folder:` lines with the real paths to the engineer's name folders.

Implementation:

1. Read `Personal Workspace/CLAUDE.md` and locate the `## RESOLVED PATHS` heading.
2. Identify the section body — every line from the `## RESOLVED PATHS` line up to (but not including) the next heading or the end of file.
3. Build the new section body using State B's format, preserving the existing `Personal Workspace` value.
4. Use the Edit tool to replace the old section body with the new one. The `## RESOLVED PATHS` heading itself should not change — the `old_string` and `new_string` in the Edit call should both start with that heading line so the section structure stays intact.

If `## RESOLVED PATHS` is missing entirely (older workspace that predates `/begin` v2 — unlikely but possible), insert a fresh State B section directly after the `# [title]` line and before the `## Quick Reference` section. Use Edit with the title line as the `old_string` anchor.

---

### Step 6 — Confirm

Brief one-liner:

> "Your team folders are set up under [Shared RDC path]. Share something with the team using `/share-chat` or `promote-to-team` and it'll land in the right category folder."

## Mounted Folder Safety

This command follows the same safety protocol as all skills that write to the shared RDC folder:

- **NEVER** assume folder names are unique — always check for duplicates with `find`.
- **NEVER** write to the first match found without confirmation — present options via AskUserQuestion if there are multiple.
- **NEVER** search by name at runtime if the path was already resolved during `/begin` or a previous `/join-team` — use the stored path from `## RESOLVED PATHS`.
- **NEVER** modify any section of `Personal Workspace/CLAUDE.md` other than `## RESOLVED PATHS`.
- **NEVER** rewrite `## RESOLVED PATHS` from scratch when an existing `Personal Workspace` line is present — preserve that line exactly and only update the team-folder lines.
- **ALWAYS** verify before writing (folder exists, is writable).
- **ALWAYS** verify after writing (folder exists, has content).
- **ALWAYS** report the full path back to the engineer so they know where to look.
