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

The dictation-and-existing-content path for sharing engineering knowledge. The engineer either types out the knowledge they want to share or points at an existing local note/chat summary. This skill packages that content with the category template and pushes it to the shared RDC team folder.

## When to use this vs. /share-chat

| To share... | Use |
|---|---|
| The current Cowork conversation | **`/share-chat`** |
| Dictated knowledge ("team should know that...") | **promote-to-team** |
| An existing note ("share that note I wrote on P6") | **promote-to-team** |
| An existing chat summary ("share that summary from yesterday") | **promote-to-team** |

Ambiguous intent ("share this with the team" without context):
> "Are you sharing the current conversation, or do you have specific content? `/share-chat` summarizes our chat; `promote-to-team` works from your dictation or an existing note."

Don't summarize the current conversation in this skill — that's `/share-chat`'s job.

## Trigger

Phrase must contain the word **"team"** — "share this with the team", "promote to the team", "team should know", "push to the team folder", "team knowledge", etc. Without "team", route to `save-note` (discrete notes) or `/save-summary` (chat summaries) instead.

---

## Step 1 — Gather the knowledge

Three valid sources:

1. **Direct dictation.** Use the engineer's words verbatim, lightly cleaned. Don't paraphrase.
   > "Team should know that the CIP skid needs a 30-second delay after V-401 opens before chemical injection — otherwise the lance pressurizes against a closed downstream valve."

2. **Existing note from their workspace** ("Share that note I wrote on P6 agitation"). Find the file in `Notes/` of the relevant project folder. Read it. The team copy uses the same content (possibly reformatted into the category template — see Step 2).

3. **Existing chat summary** ("Share that summary I saved yesterday on CC11142"). Find the file in `Chat Summaries/` of the named project. Read it.

If the source isn't clear from the trigger:
> "What do you want to share with the team? You can dictate it now, or point me at an existing note or summary."

If they say "share this conversation" — redirect to `/share-chat`.

## Step 2 — Category

| Category | Content | Signal words |
|---|---|---|
| **Troubleshooting** | Solved a problem, debugged, found a fix, root cause analysis | "fixed", "solved", "the issue was", "root cause", "workaround" |
| **Tribal Knowledge** | Institutional knowledge, decision rationale, undocumented procedures | "nobody knows", "the reason we do it this way", "not documented anywhere" |
| **Brainstorming** | Ideas, proposals, things to explore, improvements | "idea", "what if", "we should consider", "proposal" |

If ambiguous, **AskUserQuestion** with all three options. Default to Tribal Knowledge if forced to guess.

## Step 3 — Save locally

Write to the engineer's workspace as a `.md` note:
- Tied to a specific project → `[Mount]/[Project Folder]/Notes/[filename].md`
- Workspace-level (cross-cutting) → `Personal Workspace/Notes/[filename].md` (create folder if missing)

**Filename matches the team copy.** Same `YYYY-MM-DD - Topic phrase` stem, only the extension differs:
- Local: `Notes/2026-03-23 - P6 agitation motor fault recovery.md`
- Team: `Troubleshooting/[Engineer]/2026-03-23 - P6 agitation motor fault recovery.txt`

Engineers can grep across both surfaces knowing matching stems mean matching content.

## Step 4 — Write to the shared folder

Read resolved category path from `Personal Workspace/CLAUDE.md` → `## RESOLVED PATHS`:
- Troubleshooting → `**My Troubleshooting Folder**`
- Tribal Knowledge → `**My Tribal Knowledge Folder**`
- Brainstorming → `**My Brainstorming Folder**`

**Shared folder `NOT CONFIGURED`** → stop:
> "Your team folders aren't set up yet. Run `/join-team` to create them, then try again."

**Filename** — `YYYY-MM-DD - Topic phrase.txt`. Date prefix always. Topic phrase lowercase or sentence case, spaces and dashes (no underscores, no `Title_Case`), 3–7 words after the date. Be specific.

Good: `2026-03-23 - P6 agitation motor fault recovery.txt`, `2026-03-15 - CIP skid V401 timing requirement.txt`.
Bad: `notes.txt`, `2026-03-23 - fix.txt` (what fix?), `troubleshooting.txt`.

**Content** — Use the appropriate template (below). Markdown syntax stays in the file body; the `.txt` extension is for SharePoint preview/search.

**Always `.txt` in the shared folder, never `.md`.** SharePoint previews and indexes `.txt` better. Markdown chars (`#`, `**`, `-`) will be visible as plain text — intentional and acceptable.

Verify the target folder is writable before, file is non-empty after. On failure:
> "The shared folder doesn't seem to be accessible right now. This can happen if the SharePoint sync is paused or the shortcut was moved. Your knowledge was saved locally — you can promote it to the team later."

## Step 5 — Confirm

> "Saved:
> - **Local**: [Mount]/[Project Folder]/Notes/[filename].md
> - **Team**: [Category]/[Engineer Name]/[filename].txt"

Workspace-level local save:
> "Saved:
> - **Local**: Personal Workspace/Notes/[filename].md
> - **Team**: [Category]/[Engineer Name]/[filename].txt"

---

## Templates

Common header, category-specific body. Same content in the local `.md` and team `.txt`.

### Common header

```markdown
# [Descriptive Title]
**Author**: [Engineer Name]
**Date**: [YYYY-MM-DD]
**System**: [System/Equipment — e.g., Ferm B — P6, CIP Skid 2, SCADA]
**Category**: [Troubleshooting | Tribal Knowledge | Brainstorming]
```

### Troubleshooting body

```markdown
## Symptoms
[What was observed — alarms, behavior, process deviations, operator reports]

## Root Cause
[The underlying issue, not just the symptom]

## Fix
[Specific steps, config changes, code changes, parameter adjustments]
```

### Tribal Knowledge body

```markdown
## Knowledge
[Freeform — institutional knowledge being shared: context, history, reasoning, gotchas, tips. Anything that helps another engineer understand something not documented elsewhere.]
```

### Brainstorming body

```markdown
## Problem
[What problem or opportunity is being addressed]

## Proposed Solutions
[Ideas, approaches, concepts — multiple options or a single proposal. Doesn't need to be polished.]
```

---

## Edge Cases

- **Content is too rough.** Help them refine; don't refuse. Even rough capture beats nothing.
- **Doesn't fit a category.** Default to Tribal Knowledge, or ask.
- **Reformatting an existing note.** Source `.md` filename may not match the `YYYY-MM-DD - Topic phrase` convention; pick a fresh dated stem for the team copy.
- **Equipment behavior conflicts with DS.** Valuable. Document clearly, note both DS requirement and actual behavior. Suggest flagging to DS owner or opening a CC.
- **Updating an existing shared doc.** Read existing file, update, save back. Add a note in the relevant `Notes/` describing the update so it's visible from the planner UI.
- **Tried to promote before `/join-team`.** Stop and tell the engineer to run `/join-team` first.
- **Shared folder unavailable mid-session.** Local save succeeds; tell the engineer they can promote later.
- **Duplicate engineer names.** Use full name (first + last). If collision still occurs, append a distinguishing identifier.

## Safety

- Use resolved paths from `## RESOLVED PATHS`. Never search by name at runtime if already resolved.
- `.txt` in the shared folder, `.md` locally. No underscore filenames in the shared folder.
- Never overwrite an existing shared file — append `(2)` suffix.
- Verify before (writable) and after (non-empty). Report the full path back.
- Report any verification failure clearly — don't fail silently.
