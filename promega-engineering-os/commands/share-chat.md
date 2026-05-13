---
name: share-chat
description: Summarize the current Cowork conversation, save it to a project, AND push a .txt copy to the shared RDC team folder (Troubleshooting / Tribal Knowledge / Brainstorming). Operates ONLY on the current conversation — for sharing dictated content or an existing note/summary, use `promote-to-team` instead. Wraps /save-summary (project .md file + Chat Summaries/ + ## Recent Summaries pointer in the project CLAUDE.md), then writes the same content as a .txt to the team folder for SharePoint compatibility. Trigger phrases include "/share-chat", "share this chat with the team", "share this conversation", "summarize this for the team".
---

# /share-chat — Save This Conversation to a Project AND Share to Team

`/share-chat` = **`/save-summary` + a team-folder push**. Always operates on the current conversation.

| To share... | Use |
|---|---|
| The current Cowork conversation | **`/share-chat`** (this command) |
| Dictated knowledge ("team should know that...") | **`promote-to-team`** |
| An existing note or chat summary | **`promote-to-team`** |
| Current chat to a project, no team push | **`/save-summary`** |

If the engineer's phrasing fits `promote-to-team` (dictation, existing content), redirect:
> "Sounds like you want `promote-to-team` — it handles dictation and existing notes. `/share-chat` is for the current conversation. Want to switch?"

**File format.** Project copy `.md` (for the planner UI). Team copy `.txt` (SharePoint previews and search-indexes `.txt` better). Identical content; only the extension differs.

**Read `PLANNER_SCHEMA.md` at the plugin root before running this command.** It defines the `Chat Summaries/` filename and file format.

---

## Step 1 — Run /save-summary

Execute the full `/save-summary` workflow (Steps 1–10): target inference, confirm, manual picker, emptiness check, compose, auto-Related, file template, filename, write, pointer in `## Recent Summaries`. Do not skip steps — `/share-chat`'s value is that the project record is identical to what `/save-summary` produces.

**Meeting refusal carries over.** If the chat is about a meeting:
> "For a meeting, summarize the transcript in the meeting's CLAUDE.md (`## Transcript Summary`), not a chat summary. Want me to help with that, or drop a note in the meeting's `Notes/`?"

If the engineer cancels at any point inside `/save-summary` (empty-chat check, picker abort), exit — don't proceed to Step 2.

## Step 2 — Resolve the shared team folder

Read `Personal Workspace/CLAUDE.md` → `## RESOLVED PATHS`. Look for:
- `**Shared Team Folder**: /path/...`
- `**My Troubleshooting Folder**`, `**My Tribal Knowledge Folder**`, `**My Brainstorming Folder**`

**If `Shared Team Folder` is `NOT CONFIGURED`** or the category folders are missing:
> "Team sharing isn't set up yet. Your summary is saved to the project — run `/join-team` to enable team sharing."

The project save already succeeded. Exit cleanly; don't fail loudly.

If stored paths might be stale, re-resolve:
```bash
find /sessions/[current-session]/mnt/ -maxdepth 3 -type d -name "RDC Renovations*"
```

Verify the three category folders exist:
```bash
test -d "[Shared RDC]/Troubleshooting/[Engineer Name]" && \
test -d "[Shared RDC]/Tribal Knowledge/[Engineer Name]" && \
test -d "[Shared RDC]/Brainstorming/[Engineer Name]"
```

Any missing → *"Your team folders look incomplete — run `/join-team` to fix them, then `/share-chat` again."*

## Step 3 — Team category

**AskUserQuestion**: "Which team category should this go into?"

- **Troubleshooting** — solved a problem, debugged, found a fix
- **Tribal Knowledge** — institutional knowledge others should know
- **Brainstorming** — ideas, proposals, improvements
- **Skip — keep it on my project only** — no team push (project save still stands)

If the chat has clear signals (root-cause-and-fix → Troubleshooting; "we should consider" → Brainstorming), put that first and label `(Recommended)`.

If they pick Skip:
> "Saved to your project only. Re-run `/share-chat` if you change your mind."

## Step 4 — Push to the shared folder as .txt

Write to `[Shared RDC]/[Category]/[Engineer Name]/[same filename stem].txt`.

Same content, `.txt` extension. Don't reformat or strip markdown — the bytes are identical to the `.md`, only the extension differs. SharePoint web/Outlook search will show plain text with markdown chars visible (`#`, `**`, `-`); that's intentional.

Simplest implementation:
```bash
cp "[project save path].md" "[Shared RDC]/[Category]/[Engineer Name]/[filename stem].txt"
```

Verify directory writable before, file non-empty after. On failure:
> "Project copy saved successfully, but the team folder write failed (likely a SharePoint sync issue). Run `/share-chat` again later, or copy the file from `[project .md path]` to the team folder manually as a `.txt`."

## Step 5 — Confirm

> "Saved:
> - **Project**: [Mount]/[Project Folder]/Chat Summaries/[filename].md
> - **Team**: [Category]/[Engineer Name]/[filename].txt"

If team push was skipped:
> "Saved to project only: [Mount]/[Project Folder]/Chat Summaries/[filename].md"

---

## Edge Cases

- **Cancelled during `/save-summary`.** No team push, no project copy. Exit silently.
- **Workspace-level summary** (no specific project). Team push still works; the `/save-summary` per-project pointer step is naturally skipped.
- **Filename collision in team folder.** Append `(2)` to the team copy only; project `.md` keeps its original name.
- **Engineer wants multiple categories.** Run `/share-chat` again, pick the second category. Don't support multi-category in one run.
- **Sensitive info.** Already stripped by `/save-summary`; the team copy inherits.

## Safety

- Always complete `/save-summary` first. Team-push failure must not block the project save.
- Resolve paths at runtime (stored paths may have stale session IDs).
- Verify category folders exist before the team write; never overwrite (suffix instead).
- Never modify the project copy after it's saved — the team copy is a snapshot.
- Always report both destination paths in the confirmation.
