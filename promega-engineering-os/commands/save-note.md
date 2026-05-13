---
name: save-note
description: Save a note to the right project's Notes/ folder in the Promega Engineering workspace. Captures the engineer's words verbatim (when specific) or asks for the content (when vague). Adds a dated entry. Trigger phrases include "/save-note", "save to notes", "save this as a note", "note this", "note that...", "remember this", "don't forget", "log this", "log this fix", "make a note that...", "jot this down". Also offered proactively (once per conversation) when something noteworthy comes up. Replaces the old memory-create and memory-delete skills.
---

# /save-note — Save a Note to a Project

Writes a single markdown file into the right project's `Notes/` folder so the Promega Project Planner V3 surfaces it as a card. Works whether the engineer explicitly invokes the command or says something like "save that to notes on CC11142."

**Read `PLANNER_REFERENCE.md` at the plugin root before running this command.** It defines the `Notes/` filename convention and file format.

---

## When this command runs

**Direct invocation** — engineer types `/save-note` or uses any trigger phrase ("note this", "save to notes", "remember this", "don't forget", "log this", "make a note that", "jot this down", etc.). The trigger may include the project name and/or the content inline:

- *"Save to notes on CC11142 that we agreed to push the meter order to Rovisys."* → project=`CC11142`, content=the rest
- *"Note that P6 EM agitation needs a manual reset before transition."* → project=inferred, content=engineer's words
- *"Remember this."* → project=inferred, content=ask

**Proactive offer** — once per conversation, when Claude notices a non-obvious fix, decision, or insight that the engineer didn't ask to save, prompt:
> "That's a useful find — want me to save it as a note on [inferred project]?"

Limit to one offer per conversation. After the engineer says yes or no, don't ask again.

---

## Rules

**User-triggered or user-confirmed only.** Never write a note silently. Either the engineer explicitly asked, or they said yes to a proactive offer.

**Notes go in `Notes/`, never `Chat Summaries/`.** `Notes/` is for human-curated content. `Chat Summaries/` is for `/save-summary` and `/share-chat`.

**Never touch `## Planner Metadata`.** If a note implies a project's status should change (e.g., "we've decided to put this on hold"), mention it but don't auto-edit:
> "Saved the note. Sounds like the project status might need to change to `on-hold` — update it in the planner UI when you're ready."

**Suggest team sharing for high-value knowledge.** If the note captures broadly useful insight (a non-obvious PLC fix, an equipment behavior insight, a design decision with cross-project impact), mention `/share-chat` or `promote-to-team`. Don't push — one mention.

---

## Step 1 — Determine the target project folder

Inference order:

1. **Explicit name in the trigger.** If the engineer said "note this on CC11142" or "save to notes on the P4 flow meter project", that's the target. Match against actual folders.

2. **Active file context.** If recent Read/Write/Edit activity has been inside a specific project folder (e.g., editing `Change Controls/CC11142 - .../Files/risk-assessment.docx`), that's the target.

3. **Conversation topic.** If the chat has been clearly about a specific project, CC, DS revision, etc., match it.

4. **Ask if ambiguous.** Use **AskUserQuestion** with the 3–5 most likely candidates from the workspace mounts:
   > "Which folder should this note go into?"

   Read `Personal Workspace/CLAUDE.md` → `## MOUNTS` to know what mounts exist. List the most-recently-modified folder from each project mount as candidates. Always include:
   - **Workspace-level** → writes to `Personal Workspace/Notes/` (create if missing). Use for cross-cutting notes that don't tie to one project.

5. **Fall back to workspace-level only if nothing fits.** Don't invent a project folder.

### Meetings as targets — allowed

Notes ON a meeting (post-meeting follow-up, offline observation during the meeting, side-channel comment) are valid. The meeting's `Notes/` is a fine target. The skill never *creates* meeting folders — those come from `meeting-sync` only — but writing into an existing meeting's `Notes/` is fine.

### If the target project doesn't have a folder yet

If the engineer references a CC or project that doesn't have a folder:
> "There's no folder for that yet. Want me to scaffold one with `/add-project` first, then save the note?"

If yes, hand off to `/add-project`. After the folder is created, return to Step 2 here.

If they say no (just save the note somewhere), default to workspace-level `Personal Workspace/Notes/`.

---

## Step 2 — Determine the note content

### If the engineer's request was specific

The engineer said something like *"Note that we agreed to push the flow meter order to Rovisys"* or *"Save to notes on CC11142 that the risk assessment came back medium severity."*

Use their words verbatim as the body of the note. Light cleanup is fine:
- Fix obvious typos.
- Strip filler ("Um," "I think," "Yeah so").
- Convert "we" / "I" to past tense if the note is about a finished action.

Don't paraphrase or expand. The engineer chose those words; preserve their meaning.

### If the engineer's request was vague

If they said something like *"Remember this"* or *"Save that"* without specifying content, ask:
> "What should the note say? You can either give me the content directly, or tell me to pull it from the last few messages."

Options:
- Engineer types the content → use that.
- Engineer says "pull from chat" or similar → look at the last 3–5 substantive exchanges and synthesize a 1–3 paragraph note. Tell the engineer what you pulled and ask them to confirm before writing.

### If the trigger came from a proactive offer

If Claude offered "save that as a note?" and the engineer said yes, use the specific finding/decision/insight that triggered the offer. Don't pull broader context unless asked.

---

## Step 3 — Pick a filename

Format: short lowercase slug with dashes, ending in `.md`.

Examples:
- `p6-agitation-manual-reset.md`
- `cc11142-risk-assessment-medium.md`
- `flow-meter-rovisys-order.md`
- `2026-04-23-session-notes.md` (date-prefix optional, useful for session/dated notes)

Rules:
- Lowercase.
- Spaces → dashes.
- Alphanumerics, dashes, and dots only.
- If a file with that name already exists in `Notes/`, **don't overwrite**:
  - Show the existing note's first line and ask: *"There's already a note here — `[existing filename]`. Append to it, replace it, or create a new one with a `-2` suffix?"*
  - Wait for the engineer to choose.

---

## Step 4 — Write the file

Two templates. Pick whichever fits.

### Standard note (default — use for almost everything)

```markdown
# [Short descriptive title]

[Note body — the engineer's words, lightly cleaned. One paragraph for short notes; bullets or sections for longer ones. Be concise.]

_Logged [YYYY-MM-DD]._
```

The title should be a short noun phrase that describes the topic. Don't make it a sentence.

### Session notes

Use when the engineer says "create session notes", "log what we did", or similar:

```markdown
# Session — [YYYY-MM-DD]

**Worked on**: [high-level summary]

## What was done
- [bullet]
- [bullet]

## Key findings
- [bullet]

## Decisions made
- [bullet]

## Open items
- [ ] [next step]

_Logged [YYYY-MM-DD]._
```

Skip sections that have nothing in them. Don't leave empty `## Decisions made` etc.

### Anything else — freeform

If neither template fits, write freeform markdown. Include the title (`# ...`) and the dated footer (`_Logged YYYY-MM-DD._`). Beyond that, let the content shape itself.

---

## Step 5 — Verify and write

```bash
# Before
test -d "[Notes folder]" && test -w "[Notes folder]"

# Write the file (use the Write tool, not bash)

# After
test -f "[full path]" && test -s "[full path]"
```

If the `Notes/` folder doesn't exist (legacy folder), create it with `mkdir -p`.

---

## Step 6 — Confirm

Brief one-liner. Always state the location:

> "Saved to **[Mount]/[Folder Name]/Notes/[filename]**."

Examples:
> "Saved to **Change Controls/CC11142 - Flow Meter Migration/Notes/risk-assessment-medium.md**."
> "Saved to **Personal Workspace/Notes/2026-04-23-session-notes.md**."

**For high-value knowledge**, optionally add (one-liner, don't push):
> "If the rest of the team should know about this, run `/share-chat` to also push it to the shared folder."

---

## Edge Cases

**Multiple notes at once.** If the engineer mentions multiple distinct things to save ("note A and B and C"), write each as its own file. Confirm once after all are written.

**Workspace not initialized.** If `Personal Workspace/CLAUDE.md` doesn't exist:
> "I don't see a workspace set up yet. Run `/begin` first."

**Legacy MEMORY.md exists.** If the target folder still has a `MEMORY.md` from the old plugin model, leave it alone — don't merge, don't delete. Write the new note to `Notes/` as usual. If the engineer asks about the old file, offer to migrate its entries to individual `Notes/` files (one entry per file).

**Cross-references.** If the note relates to something in another folder (e.g., a CC with a related project), add a brief Related line at the bottom of the body:
```markdown
Related: `Projects/P4 Flow Meter Replacement/`
```

**Equipment behavior that violates a Design Spec.** If the engineer logs behavior that contradicts a DS, mention it once: *"This might be worth opening as a CC. Want help drafting one?"* Don't write the note differently — just flag.

**Engineer said "remember this" but the conversation has been long.** Pulling from chat means picking the most recent substantive thread. Tell the engineer what you pulled before writing:
> "Pulling from the last few exchanges: '[1-line summary of what you'll write].' Save that, or want to write it differently?"

**Engineer wants to delete a note.** Out of scope for this skill. Tell them:
> "To remove a note, delete the file directly: `[path to file]`. Or I can do it if you confirm."

This skill is creation-only.

---

## Mounted Folder Safety

- **ALWAYS** read `## MOUNTS` to know which project mounts exist before listing target options.
- **ALWAYS** verify `Notes/` exists and is writable before attempting the write.
- **ALWAYS** verify the file exists and is non-empty after writing.
- **NEVER** overwrite an existing note — append a `-2` suffix or ask first.
- **NEVER** modify CLAUDE.md from this skill. Notes live as separate files; CLAUDE.md stays untouched.
- **ALWAYS** report the full destination path back to the engineer.
