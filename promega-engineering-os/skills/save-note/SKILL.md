---
name: save-note
description: >
  Write a note into the right project's Notes/ folder in the Promega Engineering workspace.
  Trigger phrases include "save to notes," "save this as a note," "note this," "note that...,"
  "remember this," "don't forget," "log this," "log this fix," "make a note that...,"
  "jot this down," "log what we did," "create session notes," or any variation. Also
  triggers when wrapping up troubleshooting, production issues, batch debugging, or any
  engineering work the engineer wants to persist as a discrete note (not a chat summary).
  This skill replaces the old memory-create and memory-delete skills.
version: 1.0.0
---

# Save Note Skill

Saves a single markdown note to the right project's `Notes/` folder so the Promega Project Planner V3 surfaces it as a card.

**This skill shares its full logic with the `/save-note` slash command.** Read `commands/save-note.md` at the plugin root for the complete spec — every step, every template, every edge case is documented there. This file exists so trigger phrases ("save to notes", "remember this", "note that...", etc.) match the skill matcher without requiring the engineer to type a slash command.

When this skill fires, follow the instructions in `commands/save-note.md` exactly as if the engineer had typed `/save-note`. There is no separate logic here.
