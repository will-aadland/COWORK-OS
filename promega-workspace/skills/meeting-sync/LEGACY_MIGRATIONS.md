# meeting-sync — Legacy Migration Reference

Sub-reference loaded conditionally from `SKILL.md`. Only relevant when a sync encounters workspaces accumulated across older skill versions. If a sync finds nothing to migrate, this file does not need to be loaded.

The main SKILL.md branches into the algorithms below in two places:
1. **Step 4.3.5** (folder naming + legacy `Chat Summaries/` cleanup) → § 1, § 2
2. **Step 5.3** (legacy OOO.md table format) → § 3

---

## 1. Migrate legacy folder names (near-duplicate canonicalization)

Before checking whether the canonical (newly sanitized) folder exists, look for near-duplicate folders for the **same date + same event** that came from older sanitization rules, and merge them into the canonical name. This handles workspaces accumulated across rule changes (colon → dash, ampersand handling, quote stripping, em-dash variants, etc.).

### 1.1 Algorithm

1. Compute the canonical target folder name (e.g. `2026-04-29 — Misha and Will 1-1`).
2. List every folder under `Meetings/` whose date prefix matches the target's date.
3. For each candidate, compute a normalized comparison key by collapsing common variants:
   - `:` ↔ `-`
   - `&` ↔ ` and `
   - `/` ↔ space (older bug created nested directories; the canonical replaces `/` with space)
   - `"` removed
   - `'` removed
   - Em-dash `—`, en-dash `–`, hyphen `-` all treated as equivalent **inside** the title (the date-title separator stays as em-dash)
   - Trailing punctuation (`!`, `?`, `.`, `,`, `;`, repeats like `!!!`) removed for the comparison only — keep the canonical name's punctuation as-is
   - Multiple spaces collapsed to one
   - Leading/trailing whitespace stripped
   - Lowercased
4. If two candidates normalize to the same key as the target — they're the same event under different sanitization rules. Merge them into the canonical target name.

### 1.2 Nested-directory bug detection

If a folder under `Meetings/` contains a child directory other than the standard three (`Notes`, `Files`, `Transcripts`), it's likely a `/` in the original title that older skill versions used to create a path. The parent + child name concatenated (with space) is the actual canonical title. Treat this as a legacy variant to migrate.

### 1.3 Merge logic

```bash
# Both target and a legacy variant exist → delete legacy (target is canonical)
rm -rf "$LEGACY"

# Only legacy exists → copy contents to target, then delete legacy
mkdir -p "$TARGET"
cp -r "$LEGACY/." "$TARGET/"
rm -rf "$LEGACY"
```

### 1.4 Permission notes for this sandbox

- `rm -rf` on directories under `Personal Workspace/` may error with "Operation not permitted". When that happens, call `mcp__cowork__allow_cowork_file_delete` with the target path; the engineer approves once and deletes work for the rest of the session.
- `mv` of a directory may also fail with "Permission denied" even after the delete permission is granted. Use `mkdir` + `cp -r` + `rm -rf` instead. This is verified to work in Cowork mode.

### 1.5 Conservatism rules

- Only merge when normalized keys match exactly. Don't fuzzy-match on substrings or Levenshtein distance — too risky.
- If the legacy folder has substantive content the target doesn't (`Notes/`, `Files/`, `Transcripts/` all non-empty), don't auto-delete it. Add it to a "manual review" queue and surface in Step 8 instead. Empty scaffolding folders are safe to delete.
- If two legacy variants both have content and conflict, surface both in the manual review queue — let the engineer decide.

### 1.6 Logging

Log every migration in the final report so the engineer knows what happened:

```
Merged: '2026-04-28 — Grounds and Forge' → '2026-04-28 — Grounds & Forge' (canonical)
Renamed: '2026-05-06 — Misha and Will 1:1' → '2026-05-06 — Misha and Will 1-1'
```

---

## 2. Migrate legacy `Chat Summaries/` folders inside meetings

Older versions of `meeting-sync` created `Chat Summaries/` inside meeting folders. The planner ignores it there (see `PLANNER_SCHEMA.md` § 3.2). On any sync, if a meeting folder contains a `Chat Summaries/` subfolder:

- **If it's empty**, delete it: `rm -rf "[folder]/Chat Summaries"`
- **If it has content**, move that content to the meeting's `Notes/` (so the engineer can still see it in the planner) and then delete the empty `Chat Summaries/`. Log the move in the report.
- If `rm -rf` errors with "Operation not permitted", call `mcp__cowork__allow_cowork_file_delete` and retry.

---

## 3. Migrate legacy OOO.md table format

Some workspaces have an older `Meetings/OOO.md` that used a markdown table (`| Date | Who |` columns) instead of the current `## Entries` list format. On first run with the new skill, detect the table format and migrate every existing row to the `## Entries` list format. Pattern:

```python
# If the file has "| Date | Who |" but no "## Entries" header, migrate
import re
text = ooo_md_path.read_text()
if "## Entries" not in text and "| Date | Who |" in text:
    rows = re.findall(r"^\| (.+?) \| (.+?) \|$", text, re.MULTILINE)
    # Skip header and separator rows
    rows = [r for r in rows if r[0] not in ("Date", "------")]
    # Convert each (date_cell, who_cell) to the new format
    # then write a fresh ## Entries block
```

After migration, the file has only one source of truth — the `## Entries` list — and future syncs append to it without going through migration again.

**Never delete old OOO entries** from previous syncs. The file is an accumulating log. If the engineer wants to prune it, they do it manually.
