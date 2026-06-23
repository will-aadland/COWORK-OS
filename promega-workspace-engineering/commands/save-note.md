---
name: save-note
description: Save a note to the right project's Notes/ folder in the Promega Engineering workspace. Captures the engineer's words verbatim (when specific) or asks for the content (when vague). Adds a dated entry. Trigger phrases include "/save-note", "save to notes", "save this as a note", "note this", "note that...", "remember this", "don't forget", "log this", "log this fix", "make a note that...", "jot this down". Also offered proactively (once per conversation) when something noteworthy comes up. Replaces the old memory-create and memory-delete skills.
---

# /save-note — Save a Note to a Project

Writes one markdown file into the right project's `Notes/` so the Promega Project Planner V3 surfaces it as a card. Works for explicit invocation (`/save-note`) and trigger phrases ("save that to notes on CC11142", "note this", etc.).

**Read `PLANNER_SCHEMA.md` at the plugin root before running this command.** It defines the `Notes/` filename convention, file format, and routing rules.

---

## When this command runs

**Direct invocation.** Engineer types `/save-note` or uses a trigger phrase. The phrase may include the project and/or content inline:

- *"Save to notes on CC11142 that we agreed to push the meter order to Rovisys."* → project=`CC11142`, content=the rest.
- *"Note that P6 EM agitation needs a manual reset before transition."* → project inferred, content=engineer's words.
- *"Remember this."* → project inferred, content=ask.

**Proactive offer.** Once per conversation, when Claude notices a non-obvious fix, decision, or insight the engineer didn't ask to save:
> "That's a useful find — want me to save it as a note on [inferred project]?"

Limit to one offer per conversation.

## Rules

- **User-triggered or user-confirmed only.** Never write silently.
- **Notes go in `Notes/`, never `Chat Summaries/`.** Notes is human-curated content; `/save-summary` and `/share-chat` own `Chat Summaries/`.
- **Never touch `## Planner Metadata`.** If the note implies a status change, mention it but don't auto-edit: *"Saved. Sounds like the project status might need to change to `on-hold` — update it in the planner UI."*
- **Suggest saving summaries for high-value knowledge.** A non-obvious PLC fix, equipment-behavior insight, or cross-project decision: mention `/save-summary` once.

---

## Step 1 — Target project folder

Inference order:
1. **Explicit name in trigger** ("note this on CC11142"). Match against actual folders.
2. **Active file context.** Recent Read/Write/Edit inside a project folder.
3. **Conversation topic** clearly about one project/CC/DS.
4. **Ask if ambiguous.** Use **AskUserQuestion** with the 3–5 most-recently-modified folders across mounts (read `Personal Workspace/CLAUDE.md` → `## MOUNTS`). Always include **Workspace-level** → `Personal Workspace/Notes/` for cross-cutting notes.
5. **Default workspace-level only if nothing fits.** Don't invent a project folder.

**Meetings allowed as targets.** Writing into an existing meeting's `Notes/` is fine. Never *create* meeting folders here — those come from `meeting-sync`.

**Referenced project has no folder yet.**
> "There's no folder for that yet. Want me to scaffold one with `/add-project` first, then save the note?"

If yes, hand off to `/add-project`, then return. If no, default to workspace-level.

## Step 2 — Note content

**Engineer was specific** ("Note that we agreed to push the flow meter order to Rovisys"). Use their words verbatim. Light cleanup only: fix typos, strip filler ("Um", "Yeah so"), convert "we"/"I" to past tense if it's about a finished action. Don't paraphrase or expand.

**Engineer was vague** ("Remember this", "Save that"). Ask:
> "What should the note say? Give me the content directly, or tell me to pull it from the last few messages."

If they say "pull from chat", synthesize a 1–3 paragraph note from the last 3–5 substantive exchanges. Tell the engineer what you pulled and confirm before writing.

**From a proactive offer.** Use the specific finding that triggered the offer. Don't pull broader context unless asked.

## Step 3 — Filename

Lowercase slug with dashes, ending `.md`. Alphanumerics, dashes, dots only. Examples: `p6-agitation-manual-reset.md`, `cc11142-risk-assessment-medium.md`, `2026-04-23-session-notes.md` (date prefix optional, useful for dated/session notes).

**Existing file with that name** — don't overwrite. Show the existing note's first line and ask: *"There's already a note here — `[name]`. Append, replace, or create a `-2`?"*

## Step 4 — Write the file

Two templates. Pick whichever fits.

**Standard note** (default for almost everything):

```markdown
# [Short descriptive title]

[Body — engineer's words, lightly cleaned. One paragraph for short notes; bullets/sections for longer.]

_Logged [YYYY-MM-DD]._
```

Title is a short noun phrase, not a sentence.

**Session notes** (engineer said "create session notes", "log what we did"):

```markdown
# Session — [YYYY-MM-DD]

**Worked on**: [summary]

## What was done
- [bullet]

## Key findings
- [bullet]

## Decisions made
- [bullet]

## Open items
- [ ] [next step]

_Logged [YYYY-MM-DD]._
```

Skip sections with nothing in them.

**Anything else — freeform.** Include `# title` and `_Logged YYYY-MM-DD._` footer; let the content shape itself.

## Step 5 — Verify and write

`mkdir -p` the `Notes/` folder if missing (legacy). Write with the Write tool. Verify the file exists and is non-empty after write.

## Step 6 — Confirm

> "Saved to **[Mount]/[Folder Name]/Notes/[filename]**."

For high-value knowledge, optionally add (one line, don't push):
> "If you want to preserve this conversation, run `/save-summary` to save it to the project's Chat Summaries."

---

## Edge Cases

- **Multiple notes at once** ("note A and B and C"). Write each as its own file. Confirm once after all are written.
- **Workspace not initialized** (no `Personal Workspace/CLAUDE.md`). Tell the engineer to run `/begin` first; stop.
- **Legacy `MEMORY.md` present.** Leave it alone. Write the new note to `Notes/` as usual. If asked, offer to migrate its entries to individual `Notes/` files.
- **Cross-references.** If the note relates to another folder, add `Related: \`Projects/P4 Flow Meter Replacement/\`` at the bottom.
- **Equipment behavior contradicts a Design Spec.** Flag once: *"This might be worth opening as a CC. Want help drafting one?"* — don't change how the note is written.
- **"Remember this" mid-long-conversation.** Tell the engineer what you'll pull before writing: *"Pulling from the last few exchanges: '[1-line summary].' Save that, or write differently?"*
- **Engineer asks to delete a note.** Out of scope. Point them at `[path to file]` to delete directly, or offer to delete if they confirm.

## Safety

- Read `## MOUNTS` before listing target options.
- Never overwrite an existing note — `-2` suffix or ask first.
- Never modify `CLAUDE.md` from this command.
- Always report the full destination path back.
