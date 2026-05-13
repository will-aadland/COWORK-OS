---
name: save-summary
description: Save a summary of the current conversation to a specific project, change control, DS revision, or any other planner item — creates a dated summary file in Chat Summaries/ AND adds a pointer line to the project's CLAUDE.md under ## Recent Summaries so the context is visible on future sessions. Project-only (does NOT push to the shared team folder — that's /share-chat's job). Trigger phrases include "/save-summary", "/summary", "save this chat to [project]", "summarize this for [project]", "save what we just talked about", "capture this conversation".
---

# /save-summary — Save a Chat Summary to a Project

Summarizes the current conversation, writes it to the right project's `Chat Summaries/`, and registers a pointer in that project's `CLAUDE.md`. **Project-only** — does not push to the shared RDC folder. Use `/share-chat` for team visibility.

**Read `PLANNER_SCHEMA.md` at the plugin root before running this command.** It defines the `Chat Summaries/` filename convention, file format, and the rule that meetings don't have `Chat Summaries/`.

---

## Step 1 — Infer the target project

Signals to scan:
- **Explicit references.** CC numbers (`CC11142`), project names, DS names, equipment names ("P4 flow meter", "Ferm B pressure"), meeting titles.
- **Files Claude has read.** Recent Read/Write/Edit inside a project folder = strong candidate.
- **Conversation topic.** Even without explicit references, a 45-minute deep dive on a Ferm B DS revision is a candidate.

Match candidates to actual folders. Read `Personal Workspace/CLAUDE.md` → `## MOUNTS` for the project mount list.

**Exclude meetings.** `/save-summary` is project-only. Meetings have no `Chat Summaries/` (planner ignores it there — see `PLANNER_SCHEMA.md` § 3.2). If the chat is about a meeting, suggest: write a note into the meeting's `Notes/` via `/save-note`, or update its `## Transcript Summary` section in `CLAUDE.md`.

## Step 2 — Confirm the target

**AskUserQuestion** with the inferred candidate as the recommended option.

**One strong candidate**: "Save this summary on **[candidate]**?" → Yes / Pick different / Workspace-level.

**Multiple plausible candidates**: list each as an option (max 3–4) + Pick different + Workspace-level.

**No clear candidate**: jump to Step 3.

## Step 3 — Manual picker fallback

List the 5–10 most-recently-modified folders across project mounts:

```bash
# For each mount from ## MOUNTS:
find "[Personal Workspace]/[Mount]/" -mindepth 1 -maxdepth 1 -type d \
  -not -name "Completed" -printf "%T@ %p\n" | sort -rn | head -5
```

Combine. Include **Workspace-level** at the end. Present via **AskUserQuestion**.

## Step 4 — Emptiness check

If the conversation is short (~5 substantive turns or fewer) or mostly housekeeping, warn:
> "This conversation doesn't have much to summarize yet — just a few exchanges. Save anyway, or keep going first?"

→ Save anyway / Keep going first (exits).

## Step 5 — Compose the summary

Audience: the engineer reading this in 3 months, or another engineer who wasn't in the chat. **200–800 words**, not a transcript dump.

Cover: what was discussed, what was decided, what was discovered, what actions came out. Include specific technical details (equipment names, CC numbers, tag names, parameter values, PLC routines, phase names, error codes). Strip back-and-forth noise (no "then Will asked…"). Include code/config snippets when modified. **Strip secrets** (credentials, API keys, customer data).

## Step 6 — Auto-populate `## Related`

Scan the chat for references to other workspace items: CC numbers (`CC\d{5}`), DS references, meeting titles, equipment/system names that map to project folders. For each match where a folder exists, add to `## Related`:

```
## Related
- `Change Controls/CC11142 - Flow Meter Migration P1-P3/`
- `Meetings/2026-04-21 — ArC Scrum/`
- `DS Revisions/Ferm B Pressure DS Revision/`
```

Omit the section if nothing found. Don't fabricate links.

## Step 7 — File template

```markdown
# [Concise topic phrase]

_Saved by Claude Cowork on [YYYY-MM-DD HH:MM]_

## Context
[2–3 sentences on what the chat was about and why.]

## Key Decisions
- Decision 1 (with rationale)

## Action Items
- [ ] [Who] to do [what] by [when]

## Open Questions
- [Question 1]

## Notable Quotes / Snippets
> [Direct quote or short code block.]

## Related
- [from Step 6; omit section if empty]
```

Omit any section that would be empty (except title and timestamp). Don't leave empty scaffolding.

## Step 8 — Filename

`YYYY-MM-DD - [Topic phrase].md`. Topic phrase 3–7 words, title case or lowercase. Examples:
- `2026-04-23 - P4 flow meter range debate.md`
- `2026-04-23 - CC11142 risk assessment draft.md`

If the exact name exists in target `Chat Summaries/`, append `(2)`. Never overwrite.

## Step 9 — Write the summary

Path:
- Project: `[Personal Workspace]/[Mount]/[Project Folder]/Chat Summaries/[filename]`
- Workspace-level: `[Personal Workspace]/Chat Summaries/[filename]`

If `Chat Summaries/` doesn't exist (legacy folder), `mkdir -p` it. Verify directory is writable before, file exists and is non-empty after. On either failure, stop and report; don't continue to Step 10.

## Step 10 — Append pointer to project's CLAUDE.md

Read the project's `CLAUDE.md`, find `## Recent Summaries`. Append a new pointer line (chronological, newest at bottom):

```
- YYYY-MM-DD — [Topic phrase] — [Chat Summaries/YYYY-MM-DD - topic.md](Chat Summaries/YYYY-MM-DD - topic.md)
```

If `## Recent Summaries` doesn't exist, add it at the bottom of the file (after all existing sections).

**Safe edit**: Edit (not Write); never touch `## Planner Metadata`; never reorder existing sections; preserve unknown sections. Never trim old pointers — the list grows indefinitely.

**Workspace-level summaries skip Step 10** — no per-project CLAUDE.md to update.

## Step 11 — Confirm

> "Saved to **[Mount]/[Project Folder]/Chat Summaries/[filename]** and added a pointer to the project's CLAUDE.md."

Workspace-level:
> "Saved to **Personal Workspace/Chat Summaries/[filename]**."

Don't repeat the summary content.

---

## Edge Cases

- **Target folder has no `Chat Summaries/`** (legacy). `mkdir -p` and proceed.
- **Target `CLAUDE.md` missing/malformed.** Save the summary anyway, skip the pointer: *"This folder doesn't look like a standard planner project. Save the summary to Chat Summaries/ anyway? (Skipping the pointer.)"*
- **Engineer targets a meeting.** Redirect: *"For meetings, use `/share-chat` (handles meeting folders + team push), or I can drop a note in the meeting's Notes/ instead."*
- **Conversation spans multiple projects.** Ask: save to one, one copy per project, or workspace-level. If one-per-project, run Steps 5–10 per target.
- **Auto-link found a CC without a folder.** Add to Related as plain text (`- CC11142 (no folder yet)`) so the engineer notices.
- **Sensitive info in chat.** Strip and mention in confirmation: "Stripped a credential that appeared in the chat."
- **Run twice on the same chat.** Second file gets `(2)` suffix; two pointers in `## Recent Summaries`.

## Safety

- Resolve paths at runtime (stored paths may have expired session IDs).
- Verify before/after writes; never overwrite (suffix instead).
- Never clobber `## Planner Metadata`; only modify `## Recent Summaries`.
- Always report the full destination path.
