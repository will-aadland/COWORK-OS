---
name: add-project
description: Create a new project, change control, DS revision, or any other tracked item in the Promega Engineering workspace — scaffolds the folder with the canonical planner schema (CLAUDE.md + ## Planner Metadata block, Notes/, Chat Summaries/, Files/). Asks which project mount to put it in. Does NOT create meetings — those come from the meeting-sync skill only. Trigger phrases include "/add-project", "new project", "start a project", "scaffold a project", "add a CC", "new change control", "start a DS revision", "new folder for [X]".
---

# /add-project — Scaffold a New Planner Item

Creates a new item in any project mount (`Projects/`, `Change Controls/`, `DS Revisions/`, `Commissioning/`, `Documentation/`, or any custom mount). Uses the canonical Promega Project Planner V3 schema.

**Does NOT create meetings.** Meetings come from `meeting-sync` only. If the engineer asks to add a meeting manually, redirect to `meeting-sync` for the relevant window.

**Read `PLANNER_SCHEMA.md` at the plugin root before running this command.** It defines the project folder schema, `## Planner Metadata` field values, and safe-edit rules.

---

## Input (required)

1. **Name** — folder name. Free-form (no forced prefixes).
2. **Description** — one paragraph.
3. **Mount** — which top-level mount.

Defaults for everything else: `status: on-track`, `priority: medium`, `startDate: [today]`, `endDate:` blank, `progress: 0`, `stress: 0`, `color: #d4a935` (medium-priority default). Engineer refines in the Visualizer UI.

## Step 1 — Detect workspace and mounts

```bash
find /sessions/[session-id]/mnt/ -maxdepth 3 -type d -name "Personal Workspace" 2>/dev/null
```

Not found:
> "I don't see a `Personal Workspace/` folder. Run `/begin` first."

Stop.

Found: read `Personal Workspace/CLAUDE.md` → `## MOUNTS`. Parse **project** mounts only — **exclude `Meetings/`** (managed by `meeting-sync`).

If `## MOUNTS` is missing/malformed, fall back: list directories with a `Completed/` subfolder (the project-mount signature). Skip `Chat Summaries/`, `Files/`, `Meetings/`.

## Step 2 — Three required inputs

**Standalone call**: full interview.
**Batch mode from `/begin` Step 4**: name + description pre-filled; skip to mount question.

### 2.1 Name

> "What's the name? Short and descriptive. (Examples: 'P4 Flow Meter Replacement', 'CC11142 - Flow Meter Migration', 'Ferm A Pressure DS Revision')"

Accept literally — no forced prefixes, no case conversion.

If name contains `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`:
> "Filesystems don't allow some characters in folder names. How about '[cleaned]' instead?"

### 2.2 Description

> "One-paragraph description — what's the work, which system, where does it stand today? Plain prose, no headings."

Goes between the title and `## Planner Metadata`.

### 2.3 Mount

**AskUserQuestion** with one option per detected project mount, `Projects/` recommended by default.

**Smart defaults** (if the named mount exists):
- Name contains `CC` followed by digits → `Change Controls/`
- Name contains `DS` / "Design Spec" / "Design Specification" → `DS Revisions/`
- Name contains "commissioning" / "SAT" / "FAT" → `Commissioning/`

Engineer always has the final say. Never include `Meetings/` in the option list.

## Step 3 — Build the folder

Path: `[Personal Workspace]/[Mount]/[Name]/`

**Collision check.** If the folder exists:
> "A folder with that name already exists at `[path]`. Open it instead, pick a different name, or cancel?"

**Create subfolders:**
```bash
mkdir -p "[path]/Notes" "[path]/Chat Summaries" "[path]/Files"
```

**Write CLAUDE.md:**

```markdown
# [Name]

[Description paragraph]

## Planner Metadata
status: on-track
priority: medium
startDate: [today YYYY-MM-DD]
endDate:
progress: 0
stress: 0
color: #d4a935
links:
```

Metadata format rules: header exactly `## Planner Metadata`, one `field: value` per line, no blank lines, no comments inside. `links:` with nothing after is valid. See `PLANNER_SCHEMA.md` § 2 for the full reference.

**Verify** the CLAUDE.md is non-empty and all three subfolders exist.

## Step 4 — Confirm

**Standalone**:
> "Created **[Mount]/[Name]/** — the planner will show it as a card within a couple of seconds."

Done. Don't offer next steps.

**Batch (from `/begin`)**: emit one line per item, then a final summary:
> Created **Change Controls/CC11142 - Flow Meter Migration/**
> Created **Change Controls/CC12301 - Ferm B Pressure/**
> Created **DS Revisions/Pure Water DS Revision/**
>
> Scaffolded **3** projects.

If an item fails, emit `FAILED: [name] — [reason]` in place of the success line and include in the final summary.

---

## Edge Cases

- **Workspace not initialized.** Tell the engineer to run `/begin`; don't bootstrap here.
- **Engineer names a mount that doesn't exist** ("put this in DS Revisions/" when there's no DS Revisions). Ask: *"You don't have a `DS Revisions/` mount yet. Create one, or use an existing mount?"* If yes, scaffold the mount + its `Completed/` and update `## MOUNTS`, then continue.
- **Engineer asks to add a meeting.** Redirect to `meeting-sync`.
- **Nested structure requested** ("inside Projects/Ongoing Support/"). The planner only reads one level deep. Offer: sibling in `Projects/`, or a note inside `Projects/Ongoing Support/Notes/`.
- **Engineer cancels mid-flow.** Clean up any partial folder with `rm -rf "[partial path]" 2>/dev/null`. Be careful not to rm anything else.
