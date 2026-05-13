---
name: share-chat
description: Summarize the current Cowork conversation, save it to a project, AND push a .txt copy to the shared RDC team folder (Troubleshooting / Tribal Knowledge / Brainstorming). Operates ONLY on the current conversation — for sharing dictated content or an existing note/summary, use `promote-to-team` instead. Wraps /save-summary (project .md file + Chat Summaries/ + ## Recent Summaries pointer in the project CLAUDE.md), then writes the same content as a .txt to the team folder for SharePoint compatibility. Trigger phrases include "/share-chat", "share this chat with the team", "share this conversation", "summarize this for the team".
---

# /share-chat — Save This Conversation to a Project AND Share to Team

`/share-chat` is **`/save-summary` + a team-folder push**. It always operates on the current Cowork conversation. Use it when you want both your own project record AND team-wide visibility in the shared RDC folder.

**For other team-sharing scenarios, use a different command:**

| If you want to share... | Use |
|---|---|
| The current Cowork conversation as a summary | **`/share-chat`** (this command) |
| Specific knowledge you're dictating ("team should know that...") | **`promote-to-team`** |
| An existing note or chat summary from your workspace | **`promote-to-team`** |
| Just save the current chat to a project (no team push) | **`/save-summary`** |

If the engineer's phrasing suggests they want to share dictated or existing content (e.g., "team should know X" or "share that note I wrote on P6"), don't run `/share-chat` — redirect:
> "Sounds like you want `promote-to-team` — that handles dictation and existing notes. `/share-chat` is for summarizing the current conversation. Want to switch?"

**File format note.** The project copy is written as `.md` (markdown — for the planner UI). The team copy is written as `.txt` (plain text — for SharePoint, which previews and search-indexes `.txt` better than `.md`). The content is identical — only the extension differs.

**Read `PLANNER_SCHEMA.md` at the plugin root before running this command.** It defines the `Chat Summaries/` filename and file format.

---

## How this command relates to /save-summary

This command **wraps `/save-summary`** rather than duplicating its logic. The flow is:

1. Run the entire `/save-summary` workflow — pick target project, compose summary, write to `Chat Summaries/`, append a pointer to `## Recent Summaries` in the project's CLAUDE.md.
2. Then add one extra step: ask which team category, push a copy to the shared RDC folder.

If `/save-summary`'s behavior changes, `/share-chat` inherits the change. There's no parallel implementation.

---

## Workflow

### Step 1 — Run /save-summary

Execute the full `/save-summary` workflow. The engineer goes through:

- Step 1 (Infer the target project)
- Step 2 (Confirm the target via AskUserQuestion)
- Step 3 (Manual picker fallback if needed)
- Step 4 (Check for emptiness)
- Step 5 (Compose the summary)
- Step 6 (Auto-populate Related section)
- Step 7 (Use the file template)
- Step 8 (Pick the filename)
- Step 9 (Write the summary file)
- Step 10 (Append pointer to project's CLAUDE.md)

**Do not skip any of these steps.** The `/share-chat` command's value is that the project record is identical to what `/save-summary` would produce — same file, same pointer.

**One difference at Step 1 (Target inference):** `/share-chat` is project-only, just like `/save-summary`. If the engineer has been talking about a meeting, refuse and redirect:

> "For a meeting, you'd want to summarize the transcript directly in the meeting's CLAUDE.md (`## Transcript Summary` section), not save a chat summary. Want me to help with that instead, or drop a note in the meeting's `Notes/`?"

If the engineer cancels at any point during `/save-summary` (e.g., picks "Keep going first" on the empty-chat check, or aborts the target picker), exit immediately — don't proceed to Step 2 below.

### Step 2 — Resolve the shared team folder

Read `Personal Workspace/CLAUDE.md` → `## RESOLVED PATHS` section. Look for these lines:

```markdown
- **Shared Team Folder**: /path/to/RDC Renovations - 06 Production Support
- **My Troubleshooting Folder**: /path/.../Troubleshooting/[Engineer Name]/
- **My Tribal Knowledge Folder**: /path/.../Tribal Knowledge/[Engineer Name]/
- **My Brainstorming Folder**: /path/.../Brainstorming/[Engineer Name]/
```

If `Shared Team Folder` is `NOT CONFIGURED` or the three category folder paths are missing:

> "Team sharing isn't set up yet. Your summary is saved to the project — run `/join-team` to enable team sharing."

Don't fail loudly. The project save already succeeded — that's the more important half. Just exit cleanly.

If the stored paths might be stale (old session ID), re-resolve at runtime:
```bash
find /sessions/[current-session]/mnt/ -maxdepth 3 -type d -name "RDC Renovations*"
```

Verify the engineer's category folders actually exist on disk:
```bash
test -d "[Shared RDC]/Troubleshooting/[Engineer Name]" && \
test -d "[Shared RDC]/Tribal Knowledge/[Engineer Name]" && \
test -d "[Shared RDC]/Brainstorming/[Engineer Name]"
```

If any are missing, tell the engineer: *"Your team folders look incomplete — run `/join-team` to fix them, then `/share-chat` again."*

### Step 3 — Ask which team category

Use **AskUserQuestion**:

> "Which team category should this go into?"

Options:
- **Troubleshooting** — we solved a problem, debugged an issue, or found a fix
- **Tribal Knowledge** — institutional knowledge others should know
- **Brainstorming** — ideas, proposals, improvements
- **Skip — keep it on my project only** — no team push (engineer changed their mind; project save still stands)

If the conversation has clear signals for a specific category (e.g., a clear root-cause-and-fix structure → Troubleshooting; a "we should consider" pattern → Brainstorming), put that option first and label it `(Recommended)`.

If they pick "Skip", exit cleanly:
> "Saved to your project only. Re-run `/share-chat` if you change your mind."

### Step 4 — Push the file to the shared folder as .txt

Write the team copy to the engineer's category folder, **changing the extension from `.md` to `.txt`**:

```
[Shared RDC]/[Category]/[Engineer Name]/[same filename stem].txt
```

For example, if the project save wrote `2026-04-23 - P4 flow meter range debate.md` to `Projects/P4 Flow Meter Replacement/Chat Summaries/`, the team copy is `2026-04-23 - P4 flow meter range debate.txt` in `Troubleshooting/[Engineer Name]/`.

**Same content, .txt extension.** Don't reformat. Don't add headers. Don't strip markdown syntax — just write the same bytes the `.md` file has, with the `.txt` extension so SharePoint can preview and search-index it cleanly. Engineers viewing the file in SharePoint web or Outlook search will see plain text with markdown characters visible (`#`, `**`, `-`); that's intentional and acceptable.

The simplest implementation is to read the project `.md` file and write its content out to the `.txt` path:

```bash
# Read the just-written project .md file
cp "[project save path].md" "[Shared RDC]/[Category]/[Engineer Name]/[filename stem].txt"
```

(Or the equivalent in your language of choice. The point is: the bytes are identical, only the extension differs.)

**Verify before:**
```bash
test -d "[Shared RDC]/[Category]/[Engineer Name]" && \
test -w "[Shared RDC]/[Category]/[Engineer Name]"
```

**Verify after:**
```bash
test -f "[full destination .txt path]" && test -s "[full destination .txt path]"
```

If either verification fails, report clearly:
> "Project copy saved successfully, but the team folder write failed (likely a SharePoint sync issue). Run `/share-chat` again later, or copy the file from `[project .md path]` to the team folder manually as a `.txt`."

### Step 5 — Confirm

Two-line confirmation, showing both file paths with their respective extensions:

> "Saved:
> - **Project**: [Mount]/[Project Folder]/Chat Summaries/[filename].md
> - **Team**: [Category]/[Engineer Name]/[filename].txt"

Don't repeat the summary content. Engineer can open either file.

If the team push was skipped (Step 3 = Skip):
> "Saved to project only: [Mount]/[Project Folder]/Chat Summaries/[filename].md"

---

## Edge Cases

**Engineer cancelled during /save-summary.** The team push never happens. The project copy doesn't exist either. Exit silently.

**Workspace-level summary.** If `/save-summary` saved to `Personal Workspace/Chat Summaries/` (cross-cutting summary, no specific project), the team push still works — pick a category, push to the engineer's category folder. The "project pointer" step from `/save-summary` is naturally skipped for workspace-level saves (there's no per-project CLAUDE.md to update).

**Filename collision in the team folder.** If a `.txt` file with the same stem already exists in `[Shared RDC]/[Category]/[Engineer Name]/`, append a `(2)` suffix to the team copy only — `2026-04-23 - topic (2).txt`. The project `.md` copy keeps its original filename. Both files now exist with slightly different names.

**Engineer wants to push to multiple categories.** Rare. If they really want this, run `/share-chat` again and pick the second category — the project copy stays the same, two team copies result. Don't try to support multi-category in a single run.

**Sensitive info in the summary.** Already handled by `/save-summary`'s sensitive-info stripping. The team copy inherits the same stripped content.

**Engineer picked the wrong category and notices afterward.** They can manually move the file in the shared folder (or ask Claude to). This command doesn't track team-folder file history.

---

## Mounted Folder Safety

- **ALWAYS** complete the `/save-summary` flow first. The project save is the priority — never let a team-push failure prevent the project save from succeeding.
- **ALWAYS** resolve paths at runtime — stored paths in CLAUDE.md may point to expired session IDs.
- **ALWAYS** verify the engineer's category folders exist before attempting the team write. Missing folders mean `/join-team` was never run or didn't finish — surface that and stop.
- **ALWAYS** verify after writing (file exists, is non-empty).
- **NEVER** modify the project copy after it's saved. The team copy is a snapshot.
- **NEVER** overwrite an existing file in the team folder — append a `(2)` suffix instead.
- **ALWAYS** report both destination paths in the confirmation.
