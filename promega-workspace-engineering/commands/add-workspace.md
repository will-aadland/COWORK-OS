---
name: add-workspace
description: >
  Add a new top-level workspace folder to the CoWork Personal Workspace. Creates the
  folder, adds a Completed/ subfolder, and registers it in the Personal Workspace
  CLAUDE.md mounts list. Trigger: "/add-workspace", "add a workspace", "create a
  workspace for [X]", "I need a workspace for [X]", "new workspace".
---

# /add-workspace — Add a New Workspace

Creates a new top-level workspace folder inside Personal Workspace and registers it in CLAUDE.md. This is for top-level workspaces (like Projects, Experiments, Protocols) — not for items inside a workspace. Use `/add-project` to scaffold an item inside an existing workspace.

---

## Step 1 — Get the name

**Inline:** "/add-workspace Experiments" → name = `Experiments`. Use as given.

**Standalone:** Ask:
> "What should the new workspace be called?"

If the name contains any of `/\:*?"<>|`, suggest a cleaned version:
> "Filesystem names can't contain those characters. How about `[cleaned name]`?"

**Reserved names** (`Completed`, `Notes`, `Files`, `Chat Summaries`, `Transcripts`) conflict with item subfolder names. Suggest an alternative:
> "`[name]` is used internally by workspace items. How about `[alternative]`?"

---

## Step 2 — Locate the workspace root

Read `Personal Workspace/CLAUDE.md` → `## MOUNTS` to find the resolved Personal Workspace path.

**Not found:**
> "I don't see a Personal Workspace set up. Run `/begin` first to initialize your workspace."

Stop.

---

## Step 3 — Check for conflicts

If a folder named `[name]` already exists at the workspace root:
> "A workspace called `[name]` already exists at `[path]`. Do you want to open it, pick a different name, or cancel?"

Wait for response before proceeding.

---

## Step 4 — Create the folder

```bash
mkdir -p "[Workspace root]\[Name]\Completed"
```

The `Completed/` subfolder is the workspace signature — it's how the Visualizer identifies a top-level workspace vs. a regular folder.

---

## Step 5 — Update CLAUDE.md

Add a new row to the `## MOUNTS` table in `Personal Workspace/CLAUDE.md`. Use Edit — never rewrite the whole file. Append after the last existing mount row:

```
| [Name] | [full path to [Name]\] |
```

---

## Step 6 — Confirm

> "Created **[Name]/** workspace. It'll appear in the Visualizer within a few seconds. Use `/add-project` to add items to it."
