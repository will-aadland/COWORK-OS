# Promega Project Planner V3 — Schema Kernel

The on-disk contract commands write against. This is the minimum set of rules every command in this plugin must follow when creating or editing planner files.

For background (distribution, architecture, UI behavior, build setup, legacy artifacts, glossary), see `PLANNER_REFERENCE.md` in the same directory. The full reference is what skills like `meeting-sync` load when they need depth; commands should be able to do their job from this file alone.

> **Conflict resolution.** If anything here contradicts `PLANNER_REFERENCE.md` or the planner code itself, the code wins. The filesystem is the schema; everything else is documentation.

---

## 1. Workspace and mounts

### 1.1 Workspace root layout

```
[workspace root]/
├── Projects/                       # always present
│   ├── <Project Name>/
│   └── Completed/                  # auto-managed archive
├── Meetings/                       # always present
│   └── YYYY-MM-DD — <Title>/
├── Change Controls/                # optional mount
│   ├── CC<NNNNN> - <Title>/
│   └── Completed/
├── DS Revisions/                   # optional mount
├── Commissioning/                  # optional mount
├── Documentation/                  # optional mount
├── <Custom>/                       # optional engineer-defined mount
└── CLAUDE.md                       # workspace metadata (see § 1.2)
```

### 1.2 The mount list lives in the workspace `CLAUDE.md`

Authoritative mount list is `[workspace]/CLAUDE.md` → `## MOUNTS` section. **Always read this section first** before deciding where to write. Don't guess; the engineer may have customized.

### 1.3 Completed/ rule

Every **project mount** (`Projects/`, `Change Controls/`, `DS Revisions/`, `Commissioning/`, `Documentation/`, any custom mount) has a `Completed/` subfolder. The Visualizer auto-moves a folder there when its `status` becomes `completed`. **Never write directly into `Completed/`** — change the project's status instead.

`Meetings/` has no `Completed/` (date prefixes handle chronology).

### 1.4 Folder names are free-form inside mounts

Folder naming has no forced prefixes inside a mount. A CC can be `CC11142 - Flow Meter Migration` or just `Flow Meter Migration`. The *mount* the item lives in is the only organizational signal. Every project mount has the same internal schema (§ 2).

---

## 2. Project folder schema

```
<Project Name>/
├── CLAUDE.md            # title + description + ## Planner Metadata
├── Notes/               # one .md per note (human-authored)
├── Chat Summaries/      # one .md per AI-generated summary
└── Files/               # arbitrary attachments
```

### 2.1 `CLAUDE.md`

```markdown
# <Project Name>

<Optional one-paragraph description.>

## Planner Metadata
status: on-track
priority: medium
startDate: 2026-04-23
endDate: 2026-05-15
progress: 0
stress: 0
color: #d46a35
links:
  - url: https://example.com
    label: Display name
```

### 2.2 Field reference

| Field | Valid values |
|---|---|
| `status` | `on-track`, `at-risk`, `behind`, `blocked`, `completed`, `on-hold` |
| `priority` | `high`, `medium`, `low` |
| `startDate`, `endDate` | `YYYY-MM-DD` |
| `progress` | Integer 0–100 |
| `stress` | Integer 0–5 |
| `color` | Hex `#rrggbb` |
| `originalLocation` | Optional. Mount slug (`projects`, `change-controls`, …). Used by auto-archive on un-complete. |
| `isMeeting` | `true` (meetings only — **never** set on projects) |
| `links` | YAML list of `{url, label}` |

### 2.3 Optional sections (pass through verbatim)

`## Notes`, `## Questions & Blockers`, `## Owner`, `## Recent Summaries`, plus any custom section the engineer added. The parser ignores unknown sections.

### 2.4 Safe-edit rules for project `CLAUDE.md`

1. **Read before writing.** Never blind-write a `CLAUDE.md`; you will clobber fields.
2. **Use `Edit`, not `Write`.** Edit one field or one section at a time.
3. **Never rename `## Planner Metadata`.** The parser keys off the heading.
4. **One `field: value` per line, no blank lines, no inline comments inside `## Planner Metadata`.** The parser breaks on them.
5. **Canonical metadata order**: `status, priority, startDate, endDate, progress, stress, color, originalLocation, isMeeting, links`.
6. **Preserve unknown sections.** If the engineer added `## Scope` or `## Decision Log`, leave them alone.

---

## 3. Meeting folder schema

```
YYYY-MM-DD — <Meeting Title>/
├── CLAUDE.md            # ## Planner Metadata + ## Meeting Details + ## Attendees + ## Agenda + ## Transcript Summary
├── Notes/               # human meeting notes
├── Files/               # attachments
└── Transcripts/         # raw .vtt / .docx transcript exports
```

### 3.1 Folder name

`^\d{4}-\d{2}-\d{2}\s+—\s+.+`

- `YYYY-MM-DD`, space, **em-dash `—` (U+2014, NOT hyphen)**, space, title.
- Date is the event's start date in `America/Chicago` (Central).

### 3.2 No `Chat Summaries/` inside meetings

**Never create `Chat Summaries/` under a meeting folder.** The Visualizer's UI does not surface a Chat Summaries sub-tab on meeting detail views, so any folder named that way is invisible. Meeting summaries go in the meeting's `## Transcript Summary` section in `CLAUDE.md`.

If you find an existing `Chat Summaries/` inside a meeting: if empty, delete it; if it has content, move that content to the meeting's `Notes/`.

### 3.3 Meeting `CLAUDE.md` additions

On top of § 2 fields, meetings have:

```markdown
isMeeting: true        # inside ## Planner Metadata

## Meeting Details

| Field      | Value                     |
|------------|---------------------------|
| Date       | 2026-04-21                |
| Time       | 08:00 - 08:30             |
| Location   | Arnold-114                |
| Organizer  | misha.dyskin@promega.com  |
| Importance | Normal                    |
| MeetingId  | AAMkAGE2…                 |
| LastSynced | 2026-04-21T13:14:26Z      |

## Attendees

| Email                     |
|---------------------------|
| claire.moll@promega.com   |

## Agenda
- Topic 1

## Transcript Summary
(markdown summary written by Cowork)
```

- Time format: `HH:MM - HH:MM` (24-hour, Central). All-day events: `All day`.
- Organizer and Attendees are email-only by default (MCP returns email only).
- **No `Recurrence` row.** The MCP doesn't reliably surface recurrence on individual instances.

### 3.4 Safe-edit rules for meeting `CLAUDE.md`

- `## Meeting Details` and `## Attendees` are markdown tables: preserve header + separator rows; rebuild only the body.
- `## Transcript Summary` is free-form; safe to rewrite end-to-end.
- `## Agenda` is a bullet list.
- Don't write Recurrence rows. If an old file has one, remove it on next sync.

### 3.5 Meeting color hash

Same meeting title across instances should share a color. Deterministic hash:

```js
function nameColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) | 0;
  const hue = (Math.abs(h) * 137.508) % 360;
  // HSL(hue, 65%, 52%) → hex
}
```

When scaffolding a meeting via the filesystem, write the computed hex into `color:`.

---

## 4. Subfolder conventions

### 4.1 `Notes/`

Free-form markdown, one file per note. Rendered as cards in the Notes tab (title = first `# heading`, preview = first ~140 non-heading chars).

**Filename**: lowercase slug with dashes (e.g. `p4-flow-meter-decision.md`). Date prefix optional (`2026-04-23-session-notes.md`).

**Template** (default):

```markdown
# Short descriptive title

Body text — the engineer's words, lightly cleaned.

_Logged YYYY-MM-DD._
```

No metadata block. Pure markdown.

### 4.2 `Chat Summaries/` (projects only)

Cowork-authored conversation summaries. **Never write summaries to `Notes/`.** `Notes/` is for human-written content; `Chat Summaries/` is for AI-written.

**Filename**: date-prefixed for chronology — `YYYY-MM-DD - Topic phrase.md`. Example: `2026-04-23 - P4 flow meter range debate.md`.

**Template**:

```markdown
# [Concise topic phrase]

_Saved by Claude Cowork on YYYY-MM-DD HH:MM_

## Context
2–3 sentences on what the chat was about and why.

## Key Decisions
- Decision 1 (with rationale)

## Action Items
- [ ] Owner to do X by [date]

## Open Questions
- Question 1

## Notable Quotes / Snippets
> Direct quote or code block worth remembering.

## Related
- See also: `Notes/p4-flow-meter-decision.md`
- Related meeting: `2026-04-21 — ArC Scrum`
```

**Rules**:
- Never append to an existing summary. Always create a new dated file.
- 200–800 words. Don't paste the whole chat.
- If a summary spans multiple projects, write to `[workspace]/Chat Summaries/` (create if missing) instead of a single project's folder.

### 4.3 `Transcripts/` (meetings only)

Raw Teams or Outlook transcript exports. `.vtt` and `.docx` both work. One transcript per meeting folder; canonical filename `transcript.md` after cleanup.

The summary derived from a transcript goes in the meeting's `## Transcript Summary` section in `CLAUDE.md`, not as a separate file.

### 4.4 `Files/`

Catch-all for attachments: DS PDFs, Excel calcs, screenshots. No naming convention.

### 4.5 `Time Summaries/` (workspace-level only)

`[workspace]/Time Summaries/`. Weekly/monthly digests written by the Visualizer itself. Filename pattern: `YYYY-MM-DD weekly.md`. Not a per-project folder.

---

## 5. File routing cheat sheet

`[mount]` is whichever project mount applies (read `[workspace]/CLAUDE.md` → `## MOUNTS` to know what exists).

| What the engineer produced | Write to |
|---|---|
| Chat summary about a specific project/CC/DS | `[mount]/[folder]/Chat Summaries/YYYY-MM-DD - topic.md` |
| Workspace-level chat summary (cross-cutting) | `[workspace]/Chat Summaries/YYYY-MM-DD - topic.md` |
| Human-written note on a project | `[mount]/[folder]/Notes/topic-slug.md` |
| Human-written note on a meeting | `Meetings/[YYYY-MM-DD — title]/Notes/topic-slug.md` |
| Raw meeting transcript | `Meetings/[folder]/Transcripts/` |
| Summarized transcript | Meeting's `CLAUDE.md` → `## Transcript Summary` |
| Conversation summary about a meeting | Meeting's `CLAUDE.md` → `## Transcript Summary` (**not** `Chat Summaries/` — invisible there) |
| DS draft, xlsx calc, report | `[mount]/[folder]/Files/` |
| New project/CC/DS item | `[mount]/[Name]/` — scaffold `CLAUDE.md`, `Notes/`, `Chat Summaries/`, `Files/` |
| New meeting | `Meetings/YYYY-MM-DD — [Title]/` (em-dash) — scaffold `CLAUDE.md`, `Notes/`, `Files/`, `Transcripts/`. **No `Chat Summaries/`.** |

### 5.1 Mount picker fallback

When you have to guess which mount a folder lives in:
1. Look for a folder with a matching name across all mounts. Pick that mount.
2. If no match, ask the engineer.
3. **Never default blindly.** A wrong mount silently misfiles content.

---

## 6. DOs and DON'Ts

**DO**:
- Use `Edit` (not `Write`) for changes to existing `CLAUDE.md`. One field or section at a time.
- Read `[workspace]/CLAUDE.md` → `## MOUNTS` before deciding where to write.
- Write Chat Summaries to `Chat Summaries/` so they stay distinct from human Notes.
- Use the em-dash literal (`U+2014`, `—`) in meeting folder names.
- Use the deterministic `nameColor` hash for meeting colors.
- Preserve `*.bak` files anywhere — they're a one-time migration safety net.
- Trust the file watcher. Write the file; the Visualizer picks it up in ~200 ms.

**DON'T**:
- Don't call any HTTP endpoint. There is no localhost server, no `/api/*`, no fetch/curl path.
- Don't append to existing chat summary files. Always create a new dated one.
- Don't write summaries to `Notes/`. That's for human content.
- Don't write into `Completed/`. Change `status` and let the Visualizer archive.
- Don't add `isMeeting: true` to a project's `CLAUDE.md`. Only meetings get that flag.
- **Don't create `Chat Summaries/` inside meeting folders.** Invisible to the UI.
- Don't write Recurrence rows in meeting `CLAUDE.md`. Field is retired.
- Don't rewrite a whole `CLAUDE.md`. Edit one section.

---

## 7. Quick reference

```
Workspace root:    read [workspace]/CLAUDE.md → ## RESOLVED PATHS
Project mounts:    read [workspace]/CLAUDE.md → ## MOUNTS
Meetings folder:   <root>/Meetings/

Project folder:    <mount>/<Name>/
  ├─ CLAUDE.md           Read/Edit (one field/section at a time)
  ├─ Notes/              human notes — `slug.md`
  ├─ Chat Summaries/     AI summaries — `YYYY-MM-DD - topic.md`
  └─ Files/              attachments

Meeting folder:    Meetings/YYYY-MM-DD — <Title>/
  ├─ CLAUDE.md           Read/Edit
  ├─ Notes/              human notes
  ├─ Files/              attachments
  └─ Transcripts/        raw .vtt or .docx
  (NO Chat Summaries/ — use ## Transcript Summary instead)

Workspace-level:   <root>/Chat Summaries/, Notes/, Files/, Time Summaries/

Tools:
  Read   → Read         (single file)
  List   → Glob or Bash (ls)
  Search → Grep
  Write  → Write        (new files: notes, summaries, transcripts)
  Edit   → Edit         (single field/section in CLAUDE.md)
  mkdir / mv → Bash
```

For anything not covered here — distribution, build setup, full UI behavior, glossary, version history, legacy artifacts — see `PLANNER_REFERENCE.md`.
