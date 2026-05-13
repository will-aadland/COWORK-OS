---
name: promote-to-team
description: >
  Push knowledge the engineer dictates (or points at) to the shared RDC team folder. This skill
  is for content the engineer wants to share that did NOT come from the current Cowork
  conversation — e.g., "team should know that V-401 needs a 30-second delay," "share that fix
  I noted on P6," or "promote my CIP timing tribal knowledge to the team." For sharing the
  current conversation, use `/share-chat` instead. Trigger phrases must include the word
  "team" — e.g., "the team should know," "promote to team," "push to team folder," "team
  knowledge," "share that note with the team." Saves the content as a `.md` Note locally
  AND as a `.txt` to the shared RDC Renovations - 06 Production Support folder on SharePoint,
  organized by category (Troubleshooting, Tribal Knowledge, Brainstorming) and engineer name.
version: 2.0.0
---

# Promote to Team

The dictation-and-existing-content path for sharing engineering knowledge with the wider team. The engineer either types out the knowledge they want to share, or points at an existing local note or chat summary. This skill packages that content with the right category template and pushes it to the shared RDC team folder.

## When to use this skill vs. /share-chat

These two paths are deliberately split:

| If the engineer wants to share... | Use |
|---|---|
| The current Cowork conversation as a summary | **`/share-chat`** |
| Specific knowledge they're dictating right now ("team should know that...") | **`promote-to-team`** |
| An existing note from their workspace ("share that note I wrote on P6 with the team") | **`promote-to-team`** |
| An existing chat summary ("share that summary I saved yesterday with the team") | **`promote-to-team`** |

If the engineer's intent is ambiguous (e.g., they say "share this with the team" without context), ask:
> "Are you sharing the current conversation, or do you have specific content to share? `/share-chat` summarizes our chat; `promote-to-team` works from your dictation or an existing note."

Don't try to summarize the current conversation in this skill. That's `/share-chat`'s job, and doing it here creates an overlap that confuses the engineer about which command to use.

---

## Trigger

This skill activates when the engineer uses a phrase containing the word **"team"**. Examples:
- "Share this with the team"
- "Promote this to the team"
- "The team should know about this"
- "Send this to the team"
- "Team knowledge"
- "Push this to the team folder"

**The word "team" must be present.** Phrases like "capture this," "remember this," "save to notes," or "document this" (without "team") should fire `save-note` (for discrete notes) or `/save-summary` (for chat summaries), NOT this skill.

---

## Workflow

### Step 1 — Gather the knowledge

`promote-to-team` operates on content the engineer provides directly or points at. It does NOT summarize the current conversation — that's `/share-chat`'s job.

Three sources are valid:

1. **Direct dictation.** The engineer types the knowledge inline with the trigger:
   > "Team should know that the CIP skid needs a 30-second delay after V-401 opens before chemical injection — otherwise the lance pressurizes against a closed downstream valve."

   Use their words verbatim, lightly cleaned. Don't paraphrase.

2. **Existing note from their workspace.** The engineer points at one:
   > "Share that note I wrote on P6 agitation with the team."

   Find the matching note in `Notes/` of the relevant project folder. Read it. The team copy uses the same content (possibly reformatted into the category template if it doesn't already match — see Step 2).

3. **Existing chat summary from a project.** The engineer points at one:
   > "Share that summary I saved yesterday on CC11142."

   Find the matching summary in `Chat Summaries/` of the named project. Read it.

If the source isn't clear from the trigger phrase, ask:
> "What do you want to share with the team? You can dictate it now, or point me at an existing note or summary."

If the engineer says "share this conversation" or similar — that's `/share-chat`'s territory. Redirect:
> "For sharing the current conversation, run `/share-chat` — it'll summarize the chat and push it to the team folder. `promote-to-team` is for content you dictate or have already written."

### Step 2 — Determine the category

Based on the content, decide which shared folder it belongs in:

| Category | Content Type | Signal Words |
|----------|-------------|--------------|
| **Troubleshooting** | Solved a problem, debugged an issue, found a fix, root cause analysis | "fixed," "solved," "the issue was," "root cause," "workaround" |
| **Tribal Knowledge** | Institutional knowledge, process insights, decision rationale, "things only I know," undocumented procedures | "nobody knows," "the reason we do it this way," "important to know," "not documented anywhere" |
| **Brainstorming** | Ideas, proposals, things to explore, potential improvements, "what if" scenarios | "idea," "what if," "we should consider," "brainstorm," "proposal," "could we" |

If the content is ambiguous, **ask the engineer** which category it belongs in using **AskUserQuestion**:
> "Which category fits best?"

Options:
- **Troubleshooting** — I solved a problem or found a fix
- **Tribal Knowledge** — This is institutional knowledge others should know
- **Brainstorming** — This is an idea or proposal to explore

### Step 3 — Save locally

Write the knowledge to the engineer's personal workspace as a note in the relevant planner folder's `Notes/`:

- If the content ties clearly to a specific project (any project mount — Projects/, Change Controls/, DS Revisions/, etc.), save to `[that folder]/Notes/[filename].md`.
- If the content is workspace-level (cross-cutting), save to `Personal Workspace/Notes/[filename].md` (create the folder if missing).

**Filename matches the shared-folder copy.** Use the same `YYYY-MM-DD - Topic phrase` stem for both — only the extension differs:
- Local: `Notes/2026-03-23 - P6 agitation motor fault recovery.md`
- Team:  `Troubleshooting/[Engineer]/2026-03-23 - P6 agitation motor fault recovery.txt`

Same content, same stem, two extensions. Engineers can grep across both surfaces with confidence that matching filenames mean matching content.

### Step 4 — Write to the shared folder

**4a. Read resolved paths from CLAUDE.md.**

Look for the `## RESOLVED PATHS` section. Get the path for the appropriate category folder:
- Troubleshooting → **My Troubleshooting Folder**
- Tribal Knowledge → **My Tribal Knowledge Folder**
- Brainstorming → **My Brainstorming Folder**

**If shared folder is NOT CONFIGURED** — Stop and tell the engineer:
> "Your team folders aren't set up yet. Run `/join-team` to create them, then try again."

Don't attempt to write to an unresolved path.

**4b. Determine the file name.**

Format: `YYYY-MM-DD - Topic phrase.[ext]` (matches `/share-chat`'s convention).

Rules:
- Date prefix is always the date the entry was created.
- Topic phrase: lowercase or sentence case — both fine. Spaces and dashes are allowed (do NOT use underscores or Title_Case — that conflicts with /share-chat's output).
- Be specific — include the system, equipment, or topic.
- 3–7 words after the date.

The same stem is used for both the local `.md` and the team `.txt` (see Step 3).

Good examples:
- `2026-03-23 - P6 agitation motor fault recovery.txt`
- `2026-03-15 - CIP skid V401 timing requirement.txt`
- `2026-03-22 - Automated CIP scheduling idea.txt`
- `2026-01-10 - Batch recipe parameter inheritance.txt`

Bad examples:
- `notes.txt` (not specific)
- `2026-03-23 - fix.txt` (what fix?)
- `2026-03-23_P6_Agitation.txt` (underscores — old convention)
- `troubleshooting.txt` (no date, no specificity)

**4c. Generate the file content using the appropriate template (see Templates below). Use markdown syntax internally — the file is `.txt`, but the bytes contain markdown formatting (headings, bullets, etc.) for readability when SharePoint previews it as plain text.**

**4d. Before writing — verify the target folder exists and is writable:**
```bash
test -d "[Shared RDC]/[Category]/[Engineer Name]" && \
test -w "[Shared RDC]/[Category]/[Engineer Name]"
```

If not, warn the engineer and explain how to fix it (run `/join-team`, check SharePoint shortcut).

**4e. Write the file** to `[Shared RDC]/[Category]/[Engineer Name]/[filename].txt`.

**Always `.txt`, never `.md`, in the shared folder.** SharePoint previews and search-indexes `.txt` better than markdown, and the Promega team consumes shared folder content through OneDrive/SharePoint web. Markdown syntax stays in the file content (engineers see `#` headings, `**bold**`, `-` bullets visible as plain text); that's intentional and acceptable.

**4f. After writing — verify the file landed:**
```bash
test -f "[full path to .txt file]" && test -s "[full path to .txt file]"
```

If verification fails, report clearly:
> "The shared folder doesn't seem to be accessible right now. This can happen if the SharePoint sync is paused or the shortcut was moved. Your knowledge was saved locally — you can promote it to the team later."

### Step 5 — Confirm

Two-line confirmation showing both file paths with their respective extensions:

> "Saved:
> - **Local**: [Mount]/[Project Folder]/Notes/[filename].md
> - **Team**: [Category]/[Engineer Name]/[filename].txt"

If the local save was workspace-level (cross-cutting):
> "Saved:
> - **Local**: Personal Workspace/Notes/[filename].md
> - **Team**: [Category]/[Engineer Name]/[filename].txt"

---

## Templates

Every file written uses a structured template. The header is the same across all categories; the body differs by category. Same content goes into the local `.md` and the team `.txt` — only the extension changes.

### Common Header (all categories)

```markdown
# [Descriptive Title]
**Author**: [Engineer Name]
**Date**: [YYYY-MM-DD]
**System**: [System/Equipment — e.g., Ferm B — P6, CIP Skid 2, SCADA, etc.]
**Category**: [Troubleshooting | Tribal Knowledge | Brainstorming]
```

### Troubleshooting Body

```markdown
## Symptoms
[What was observed — alarms, unexpected behavior, process deviations, operator reports]

## Root Cause
[What was actually wrong — the underlying issue, not just the symptom]

## Fix
[What was done to resolve it — specific steps, configuration changes, code changes, parameter adjustments]
```

### Tribal Knowledge Body

```markdown
## Knowledge
[Freeform — the actual institutional knowledge being shared. Can include context, history, reasoning, gotchas, tips, or anything that would help another engineer understand something that isn't documented elsewhere.]
```

### Brainstorming Body

```markdown
## Problem
[What problem or opportunity is being addressed]

## Proposed Solutions
[Ideas, approaches, concepts — can be multiple options, rough sketches, or a single proposal. Doesn't need to be polished.]
```

---

## Mounted Folder Safety

This skill follows the mandatory safety protocol for all writes to the shared RDC folder:

- **NEVER** assume folder names are unique — always use resolved paths from `## RESOLVED PATHS` in the workspace CLAUDE.md.
- **NEVER** search by name at runtime if the path was already resolved — use the stored path.
- **NEVER** write `.md` to the shared folder — always `.txt`. The local `Notes/` copy stays `.md` so the planner can render it.
- **NEVER** use underscore_Title_Case filenames in the shared folder — match `/share-chat`'s `YYYY-MM-DD - Topic phrase` convention (spaces, dashes, sentence case).
- **NEVER** overwrite an existing file in the shared folder — check for collision and append a `(2)` suffix.
- **ALWAYS** verify before writing (folder exists, is writable).
- **ALWAYS** verify after writing (file exists, has content).
- **ALWAYS** report the full path back to the engineer so they know where to look.
- **If verification fails**, report clearly. Don't fail silently.

---

## Edge Cases

**Content is too rough**: Help them refine it. Don't refuse — the goal is reducing friction in knowledge sharing. Even a rough capture is better than nothing.

**Content doesn't fit a category**: Don't force it. Default to Tribal Knowledge if ambiguous, or ask the engineer.

**User wants to share an existing note from their workspace**: Read the note from `Notes/` in the relevant planner folder, expand it (or reformat it) into the shared-folder template, then follow the normal flow. The team `.txt` may end up with a different filename than the source `.md` since the source note may not follow the `YYYY-MM-DD - Topic phrase` convention; that's fine — pick a fresh dated stem for the team copy.

**Equipment behavior conflicts with Design Spec**: This is extremely valuable knowledge. Help them document it clearly, noting both the DS requirement and actual behavior. Suggest flagging it to the DS owner or opening a CC if needed.

**User wants to update an existing shared doc**: Read the existing file from the shared folder, make the updates, and save it back. Add a note to the relevant planner folder's `Notes/` describing the update so it's visible from the planner UI.

**User tries to promote before `/join-team`**: Check CLAUDE.md for resolved shared folder paths. If not configured, tell them to run `/join-team` first.

**Shared folder becomes unavailable mid-session**: If a write verification fails, explain that the shared folder isn't accessible. Save locally and tell the engineer they can promote later.

**Multiple engineers with the same name**: Use full name (first and last) for folder naming. If collision still occurs, append a distinguishing identifier.
