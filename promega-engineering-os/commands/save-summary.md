---
name: save-summary
description: Save a summary of the current conversation to a specific project, change control, DS revision, or any other planner item — creates a dated summary file in Chat Summaries/ AND adds a pointer line to the project's CLAUDE.md under ## Recent Summaries so the context is visible on future sessions. Project-only (does NOT push to the shared team folder — that's /share-chat's job). Trigger phrases include "/save-summary", "/summary", "save this chat to [project]", "summarize this for [project]", "save what we just talked about", "capture this conversation".
---

# /save-summary — Save a Chat Summary to a Project

Summarizes the current conversation and writes it into the right project's `Chat Summaries/` folder AND registers a pointer in that project's `CLAUDE.md`. This is the **project-only** path — it does not push to the shared RDC team folder. Use `/share-chat` when you want team-wide visibility.

**Read `PLANNER_SCHEMA.md` at the plugin root before running this command.** It defines the `Chat Summaries/` filename convention, file format, and the rule that meetings don't have `Chat Summaries/`.

---

## Workflow

### Step 1 — Infer the target project

Before asking the engineer, analyze the current conversation for signals:

- **Explicit references.** CC numbers (e.g., "CC11142"), project names, DS names, equipment names ("P4 flow meter", "Ferm B pressure"), meeting titles ("this morning's ArC Scrum").
- **Files Claude has read.** If Claude has touched files inside a specific project folder during this session, that folder is a strong candidate.
- **Conversation topic.** Even without explicit references, if the chat is clearly about a specific piece of work (e.g., 45 minutes deep on a Ferm B DS revision), that topic is the candidate.

Match the candidate(s) to actual folders in the workspace. Read the workspace CLAUDE.md's `## MOUNTS` section to get the list of project mounts, then list folders inside each.

**Exclude meetings from candidates.** `/save-summary` targets projects, CCs, DS revisions, and other project-mount items, never meetings. Meetings do not have `Chat Summaries/` (the planner ignores it there, see `PLANNER_SCHEMA.md` § 3.2). If the engineer's conversation was about a meeting, suggest one of: write a note into the meeting's `Notes/` (use `/save-note`), or update the meeting's `## Transcript Summary` section in its `CLAUDE.md`. Don't write a chat summary file into a meeting folder.

### Step 2 — Confirm the target

Use **AskUserQuestion** with the inferred candidate as the recommended option.

**If exactly one strong candidate:**
> "Save this summary on **[candidate project]**?"

Options:
- **Yes — save on [candidate project]** (Recommended)
- **Pick a different project** → show the list from Step 3 below
- **Workspace-level summary** → save to `Personal Workspace/Chat Summaries/` instead (cross-cutting topics)

**If multiple candidates are plausible:**
> "Which project should this go on?"

Options:
- Each candidate as its own option (max 3–4)
- **Pick a different project**
- **Workspace-level summary**

**If no clear candidate** — skip to Step 3 directly.

### Step 3 — Manual picker fallback

If the engineer picks "Pick a different project" or there were no inferred candidates, list the 5–10 most-recently-modified project folders across all project mounts:

```bash
# For each project mount from the ## MOUNTS section:
find "[Personal Workspace]/[Mount]/" -mindepth 1 -maxdepth 1 -type d \
  -not -name "Completed" -printf "%T@ %p\n" | sort -rn | head -5
```

Combine into a single ordered list. Also include a **Workspace-level** option at the end. Present via **AskUserQuestion**.

### Step 4 — Check for emptiness

Look at the conversation so far. If it's very short (≈5 substantive turns or fewer) or mostly housekeeping (no real decisions, actions, or technical substance), warn:

> "This conversation doesn't have much to summarize yet — just a few exchanges. Save what's here anyway, or keep going first?"

Options:
- **Save anyway**
- **Keep going first** (exit /save-summary; engineer can re-run later)

If substantive, proceed without warning.

### Step 5 — Compose the summary

Read back through the whole conversation and produce a structured summary. Audience: the engineer reading this in three months, or another engineer who wasn't in the chat but needs the context.

**Rules:**
- **200–800 words.** Not a transcript dump.
- Focus on **what was discussed**, **what was decided**, **what was discovered**, and **what actions came out of it**.
- Include specific technical details — equipment names, CC numbers, tag names, parameter values, PLC routines, phase names, error codes, alarm descriptions.
- Strip back-and-forth noise — no "then Will asked…" or "Claude suggested…".
- If code or configuration was written or modified, include the relevant snippet or reference it.
- Strip secrets — credentials, API keys, customer-identifying data — if they showed up in the conversation.

### Step 6 — Auto-populate the Related section

Before writing the file, scan the conversation for references to other items in the workspace:

- CC numbers (e.g., `CC\d{5}`)
- DS references (e.g., "Ferm B DS", "SCADA DS")
- Meeting references (e.g., "ArC Scrum", dated meetings)
- Equipment / system names that map to project folders

For each reference found, check if a matching folder exists in the workspace. If yes, add it to the `## Related` section of the summary with the folder path.

Example Related entries:
```
## Related
- `Change Controls/CC11142 - Flow Meter Migration P1-P3/`
- `Meetings/2026-04-21 — ArC Scrum/`
- `DS Revisions/Ferm B Pressure DS Revision/`
```

Omit the section entirely if nothing is found. Don't fabricate links.

### Step 7 — Use the file template

```markdown
# [Concise topic phrase]

_Saved by Claude Cowork on [YYYY-MM-DD HH:MM]_

## Context
[2–3 sentences on what the chat was about and why.]

## Key Decisions
- Decision 1 (with rationale)
- Decision 2

## Action Items
- [ ] [Who] to do [what] by [when]
- [ ] [Who] to follow up on [what]

## Open Questions
- [Question 1]
- [Question 2]

## Notable Quotes / Snippets
> [Direct quote or short code block worth remembering.]

## Related
- [Auto-populated from Step 6. Omit section if nothing to link.]
```

Omit any section that would be empty (except `# title` and the timestamp). Don't leave empty scaffolding.

### Step 8 — Pick the filename

Format: `YYYY-MM-DD - [Topic phrase].md`

Topic phrase: title case OR lowercase — either is fine. Keep it short (3–7 words) and specific. Examples:
- `2026-04-23 - P4 flow meter range debate.md`
- `2026-04-23 - CIP skid 2 chemical lance sizing.md`
- `2026-04-23 - CC11142 risk assessment draft.md`

If a file with that exact name already exists in the target `Chat Summaries/`, append a suffix: `YYYY-MM-DD - [topic] (2).md`. Never overwrite.

### Step 9 — Write the summary file

Write to:

```
[Personal Workspace]/[Mount]/[Project Folder]/Chat Summaries/[filename]
```

Or for workspace-level summaries:

```
[Personal Workspace]/Chat Summaries/[filename]
```

If `Chat Summaries/` doesn't exist in the target folder (e.g., older folder without the canonical subfolders), create it with `mkdir -p`.

**Verify before writing:**
```bash
test -d "[Chat Summaries folder]" && test -w "[Chat Summaries folder]"
```

**Verify after writing:**
```bash
test -f "[full path]" && test -s "[full path]"
```

If either fails, stop and report clearly — don't continue to Step 10.

### Step 10 — Append pointer to project's CLAUDE.md

Read the project's `CLAUDE.md` and find the `## Recent Summaries` section.

**If the section exists:** append a new pointer line to the bottom of the section (newest at the bottom, so chronological order is preserved):

```
- YYYY-MM-DD — [Topic phrase] — [Chat Summaries/YYYY-MM-DD - topic.md](Chat Summaries/YYYY-MM-DD - topic.md)
```

**If the section doesn't exist yet:** append the section to the bottom of the file — after all existing sections. Use the Edit tool to add:

```
## Recent Summaries
- YYYY-MM-DD — [Topic phrase] — [Chat Summaries/YYYY-MM-DD - topic.md](Chat Summaries/YYYY-MM-DD - topic.md)
```

**Safe-edit rules (CRITICAL):**
- Never touch the `## Planner Metadata` section.
- Never reorder existing sections.
- Use Edit, not Write. Edit a small, targeted change — don't rewrite the whole file.
- Preserve unknown sections verbatim.

**Keep-all rule:** never trim old pointers. The list grows indefinitely. If the engineer wants to prune, they can do it manually.

**Workspace-level summaries:** skip Step 10. The workspace-level `Personal Workspace/CLAUDE.md` doesn't track a per-project summary list — the summaries just live in `Personal Workspace/Chat Summaries/`.

### Step 11 — Confirm

One clean line:

> "Saved to **[Mount]/[Project Folder]/Chat Summaries/[filename]** and added a pointer to the project's CLAUDE.md."

For workspace-level summaries:
> "Saved to **Personal Workspace/Chat Summaries/[filename]**."

Don't repeat the summary content. The engineer can open the file.

---

## Edge Cases

**Target folder doesn't have a Chat Summaries/ subfolder.** Create it with `mkdir -p`. This is a legacy folder from before the canonical schema — fine to fix in place.

**Target project's CLAUDE.md is missing or malformed.** If the `## Planner Metadata` block is absent or broken, the folder isn't really a planner-shaped project. Ask:
> "This folder doesn't look like a standard planner project. Save the summary to Chat Summaries/ anyway? (I'll skip the pointer update since there's nowhere to put it.)"

**Engineer targets a meeting.** `/save-summary` is project-only. If they explicitly say "save this to [meeting name]", redirect:
> "For meetings, use `/share-chat` — it knows how to handle meeting folders and can also push a copy to the team. Or I can drop a note in the meeting's Notes/ instead. Which do you want?"

**Conversation spans multiple projects.** If inference finds 2+ strong candidates and they're unrelated (e.g., the chat jumped between a CC and an unrelated commissioning item), ask:
> "This conversation touched a few things — save to one project, save one copy per project, or use the workspace-level summary folder?"

Let the engineer decide. If they choose "one copy per project", run Steps 5–10 once per target.

**Auto-link found a CC number that doesn't have a folder yet.** Don't create the folder silently. Add the reference to the Related section as plain text (`- CC11142 (no folder yet)`) so the engineer notices it. If the engineer wants to create the CC folder after, they can run `/add-project`.

**Sensitive info in the conversation.** Strip credentials, API keys, customer-identifying data, patient data. Mention briefly at the end of the confirmation: "Stripped a credential that appeared in the chat."

**Engineer runs /save-summary twice on the same conversation.** The second file gets a `(2)` suffix. Two pointers appear in `## Recent Summaries`. That's fine — the engineer may have refined the summary between runs.

---

## Mounted Folder Safety

- **ALWAYS** resolve paths at runtime — stored paths in CLAUDE.md may point to expired session IDs.
- **ALWAYS** verify before writing (directory exists, is writable).
- **ALWAYS** verify after writing (file exists, is non-empty).
- **NEVER** overwrite an existing summary — append a suffix.
- **NEVER** clobber `## Planner Metadata` in the project CLAUDE.md. Only modify `## Recent Summaries`.
- **ALWAYS** report the full destination path back to the engineer.
