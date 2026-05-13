---
name: add-project
description: Create a new project, change control, DS revision, or any other tracked item in the Promega Engineering workspace — scaffolds the folder with the canonical planner schema (CLAUDE.md + ## Planner Metadata block, Notes/, Chat Summaries/, Files/). Asks which project mount to put it in. Does NOT create meetings — those come from the meeting-sync skill only. Trigger phrases include "/add-project", "new project", "start a project", "scaffold a project", "add a CC", "new change control", "start a DS revision", "new folder for [X]".
---

# /add-project — Scaffold a New Planner Item

Creates a new item in any of the engineer's project mounts (`Projects/`, `Change Controls/`, `DS Revisions/`, `Commissioning/`, `Documentation/`, or any custom mount they've set up). Uses the canonical Promega Project Planner V3 folder structure.

**This command does NOT create meetings.** Meetings are populated exclusively by the `meeting-sync` skill from the engineer's Outlook calendar. If the engineer asks to add a meeting manually, redirect them to run `meeting-sync` for the relevant window.

**Read `PLANNER_REFERENCE.md` at the plugin root before running this command.** It defines the exact templates. This command is a friendly interface over those templates.

---

## Input (required)

Three things from the engineer:

1. **Name** — the folder name. Free-form (no forced prefixes).
2. **Description** — one paragraph describing the work.
3. **Mount** — which top-level mount to put it in.

Everything else in `## Planner Metadata` gets sensible defaults:
- `status: on-track`
- `priority: medium`
- `startDate: [today]`
- `endDate:` (blank — engineer sets later in the planner UI)
- `progress: 0`
- `stress: 0`
- `color:` (based on priority — `#d4a935` for medium)

The engineer can refine metadata in the Visualizer UI (Start menu or desktop shortcut) after the folder is created. The Visualizer's file watcher picks up the new folder within about 200 ms.

---

## Step 1 — Detect the workspace and read available mounts

```bash
# Find Personal Workspace/
find /sessions/[session-id]/mnt/ -maxdepth 3 -type d -name "Personal Workspace" 2>/dev/null
```

If not found:
> "I don't see a `Personal Workspace/` folder. Run `/begin` first to set up the workspace."

Stop.

If found, read `Personal Workspace/CLAUDE.md` and locate the `## MOUNTS` section. Parse out the **project** mount names (`Projects/` plus any add-ons the engineer created in `/begin` like `Change Controls/`, `DS Revisions/`, `Commissioning/`, `Documentation/`).

**Exclude `Meetings/` from the mount list.** `/add-project` never writes to `Meetings/` — meetings are managed by the `meeting-sync` skill only.

If the `## MOUNTS` section is missing or malformed (older workspace that predates this version), fall back to directory listing:

```bash
ls -1d "[Personal Workspace]/"*/
```

Filter to directories that contain a `Completed/` subfolder — that's the signature of a project mount. Skip `Chat Summaries/`, `Files/`, and `Meetings/`.

---

## Step 2 — Ask for the three required inputs

**If this is a standalone `/add-project` call**, run the full interview.

**If called in batch mode from `/begin` Step 4**, the caller has pre-filled the name and description from the engineer's Q5 answer. Skip straight to the mount question.

### 2.1 Name

In chat (skip if pre-filled from batch mode):
> "What's the name for this item? This becomes the folder name — keep it short and descriptive. (Examples: 'P4 Flow Meter Replacement', 'CC11142 - Flow Meter Migration', 'Ferm A Pressure DS Revision')"

Accept the answer literally. No forced prefixes. No case conversion.

**Filesystem-illegal characters** — if the name contains `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, warn and suggest a cleaned version:
> "Filesystems don't allow some characters in folder names. How about '[cleaned version]' instead?"

### 2.2 Description

In chat (skip if pre-filled from batch mode):
> "One-paragraph description — what's the work, which system is affected, where does it stand today? Just plain prose, no headings."

Free text. Goes into the CLAUDE.md as a description paragraph between the title and the `## Planner Metadata` block.

### 2.3 Mount

Use **AskUserQuestion** with one option per detected project mount.

Default (recommended) option is `Projects/`. The others follow in the order they appear in `## MOUNTS`.

**Smart defaults:** If the item name strongly signals a specific mount AND that mount exists in the workspace, suggest it as the default instead of `Projects/`:
- Name contains `CC` followed by digits → `Change Controls/` mount (if exists)
- Name contains `DS` or "Design Spec" or "Design Specification" → `DS Revisions/` mount (if exists)
- Name contains "commissioning" or "SAT" or "FAT" → `Commissioning/` mount (if exists)

The engineer always has the final say — they can pick any mount. The smart default just reduces friction for obvious cases.

Example option list (varies by what project mounts exist in the workspace):
- **Projects/** — general project work
- **Change Controls/** — EtQ change control tracking
- **DS Revisions/** — Design Specification revision work
- **Commissioning/** — SAT/FAT and equipment commissioning
- **Documentation/** — SOP/TSOP drafting and standalone doc work

Never include `Meetings/` in the option list.

---

## Step 3 — Build the folder

### 3.1 Construct the path

```
[Personal Workspace]/[Chosen Mount]/[Name]/
```

### 3.2 Check for collisions

```bash
test -d "[path]"
```

If the folder already exists:
> "A folder with that name already exists at `[path]`. Want me to open it instead, pick a different name, or cancel?"

### 3.3 Create the subfolders

```bash
mkdir -p "[path]/Notes" "[path]/Chat Summaries" "[path]/Files"
```

### 3.4 Write CLAUDE.md

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

**Metadata rules (CRITICAL — if broken, the planner silently stops parsing):**
- Section header exactly `## Planner Metadata`.
- One `field: value` per line.
- No blank lines inside the section. No comments.
- `color` defaults to `#d4a935` (medium priority). If the engineer picks high priority later, they'll update it in the planner UI.
- `links:` with nothing after it is valid — just a placeholder for links they'll add later.

### 3.5 Verify

```bash
test -f "[path]/CLAUDE.md" && test -s "[path]/CLAUDE.md"
test -d "[path]/Notes"
test -d "[path]/Chat Summaries"
test -d "[path]/Files"
```

---

## Step 4 — Confirm

### Standalone mode (engineer ran /add-project directly)

One line:

> "Created **[Mount]/[Name]/** — the planner will show it as a card within a couple of seconds."

Done. Don't offer next steps. Don't suggest follow-ups. Keep it tight.

### Batch mode (called from /begin Step 4)

Emit one short confirmation line for each item as it's created, then a final summary when the batch is done.

Per-item line (one per project):
> Created **[Mount]/[Name]/**

Final summary after all items are processed:
> Scaffolded **N** projects.
> [If any items failed, add: "Failed: [item] — [reason]. Run `/add-project` manually for those."]

So a batch of 4 projects looks like:
> Created **Change Controls/CC11142 - Flow Meter Migration/**
> Created **Change Controls/CC12301 - Ferm B Pressure/**
> Created **DS Revisions/Pure Water DS Revision/**
> Created **Commissioning/CIP Skid 2/**
>
> Scaffolded **4** projects.

---

## Edge Cases

**Workspace not initialized.** If `Personal Workspace/` doesn't exist, tell the engineer to run `/begin` first. Don't try to bootstrap here.

**Engineer names a mount that doesn't exist.** For example, they say "put this in DS Revisions/" but there's no DS Revisions mount. Ask:
> "You don't have a `DS Revisions/` mount yet. Want me to create one, or use an existing mount?"

If they say yes to creating one, scaffold it (create the folder + `Completed/` subfolder) and update `## MOUNTS` in the workspace CLAUDE.md. Then continue.

**Engineer asks to add a meeting.** `/add-project` never creates meetings. Redirect:
> "Meetings come from your Outlook calendar through `meeting-sync`, not `/add-project`. Want me to sync this week's meetings now, or just the specific one?"

**Engineer wants nested structure.** If they say "put this inside Projects/Ongoing Support/", that's not a planner item — that's a sub-item. The planner treats every direct child of a mount as a project. Nested items don't show up. Explain this and offer alternatives:
> "The planner only reads one level deep — items inside a project folder don't show up as cards. Want me to create this as a sibling in Projects/, or add it as a note inside Projects/Ongoing Support/Notes/ instead?"

**Batch mode — one item fails.** If an individual `/add-project` fails inside /begin's batch flow (e.g., illegal folder name, collision), don't abort the batch. Emit a failure line in place of the success line, skip to the next item, and include the failure in the final summary:
> FAILED: **CC11142 / Flow Meter Migration** — folder already exists
> (continue with next items)
>
> Scaffolded **3** projects. Failed: **CC11142 / Flow Meter Migration** (already exists). Run `/add-project` manually for that one.

**Engineer cancels mid-flow.** If they say "never mind" at any point, acknowledge and don't leave a partial folder behind:
```bash
rm -rf "[partial path]" 2>/dev/null
```
(Only if a partial folder was actually created. Be careful not to rm anything else.)
