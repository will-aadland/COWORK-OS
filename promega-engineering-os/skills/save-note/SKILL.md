---
name: save-note
description: Alias for the /save-note slash command. Trigger phrases include "save to notes", "save this as a note", "note this", "note that...", "remember this", "don't forget", "log this", "log this fix", "make a note that...", "jot this down", "log what we did", "create session notes". Also fires when wrapping up troubleshooting, production issues, or batch debugging the engineer wants to persist as a discrete note (not a chat summary). All logic lives in `commands/save-note.md`.
version: 1.0.0
---

# Save Note — alias for `/save-note`

This skill exists only so trigger phrases match without requiring a slash command. **All logic — every step, template, and edge case — lives in `commands/save-note.md` at the plugin root.**

When this skill fires, read `commands/save-note.md` and follow it exactly as if the engineer had typed `/save-note`. There is no separate logic here.
