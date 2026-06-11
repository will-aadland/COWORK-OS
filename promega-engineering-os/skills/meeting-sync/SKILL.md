---
name: meeting-sync
description: >
  Pull Outlook meetings into the Promega Project Planner Meetings/ mount via Microsoft 365 MCP.
  Covers current + next workweek Mon–Fri, UTC→America/Chicago. Skips cancelled/Hold/OOO.
  OOO → Meetings/OOO.md. Two modes: scheduled (auto-pull last-workday transcripts) and
  interactive (ask upfront, then run uninterrupted). Triggers: "sync my meetings," "sync
  my calendar," "pull my meetings," "grab my meetings," "update OOO," "update my meetings."
version: 3.3.0
---

# Promega Project Planner — Meeting Sync

Pulls Outlook calendar events via `mcp__Microsoft_365__outlook_calendar_search` and reconciles them with the engineer's workspace. Every run covers **Monday–Friday of the current workweek + Monday–Friday of next workweek**.

**Read `PLANNER_SCHEMA.md` at the plugin root first.** It defines: folder schema, em-dash naming rule, `nameColor` hash (§ 3.5), and `## Meeting Details`/`## Attendees` layouts. `PLANNER_REFERENCE.md` is also at the plugin root for deeper context but not loaded by this skill.

---

## Mode detection

| Mode | When | Transcript pull | Cancelled-folder behavior |
|------|------|-----------------|--------------------------|
| **Scheduled** | Task runner / no engineer in loop | Auto-pull last workday | Auto-delete |
| **Interactive** | Engineer in chat | Ask upfront before sync | Ask per folder |

---

## Prerequisite — Microsoft 365 MCP

**Interactive:** if not connected, offer to find it via `search_mcp_registry` / `suggest_connectors`. Retry after auth.

**Scheduled:** log `"Outlook MCP not connected — scheduled sync skipped."` and exit.

---

## Step 1 — Time window

```bash
DOW=$(date +%u)
[ "$DOW" -ge 6 ] && D=$((8-DOW)) || D=$((1-DOW))
START=$(date -d "$D days" +%Y-%m-%d)
END=$(date -d "$START +11 days" +%Y-%m-%d)
START_TS=$(TZ=America/Chicago date -d "$START 00:00:00" --iso-8601=seconds)
END_TS=$(TZ=America/Chicago date -d "$END 23:59:59" --iso-8601=seconds)
```

Pass `START_TS`/`END_TS` directly — bare `YYYY-MM-DD` strings are interpreted as UTC midnight, which cuts off Friday-evening events. Engineer-specified windows are one-off overrides.

---

## Step 1.5 — Interactive: ask transcript pull upfront

**Interactive mode only.** Compute last workday and ask once before syncing so the rest of the session runs uninterrupted:

```bash
DOW=$(date +%u)
case "$DOW" in 1) O=-3;; 2|3|4|5|6) O=-1;; 7) O=-2;; esac
LAST_WORKDAY=$(date -d "$O days" +%Y-%m-%d)
```

> "Syncing meetings for **[START] → [END]**. After syncing, what transcripts should I pull?"

Options (AskUserQuestion):
- **Last workday ([LAST_WORKDAY])** *(recommended)* — pull every transcript from the most recent weekday
- **A specific meeting or date** — provide name/date after sync completes
- **Skip transcripts this run**

Store the answer; use it in Step 7 without asking again.

---

## Step 2 — Fetch events

```
outlook_calendar_search(query="*", afterDateTime=START_TS, beforeDateTime=END_TS, limit=50)
```

Paginate with `offset: 50, 100, …` until a page returns fewer than 50. Each item is `{type: "text", text: "<stringified JSON>"}`.

**Large response (MCP saves to file):**
```bash
jq -r '.[] | .text | fromjson | "\(.start[:10])T\(.start[11:16])  cancel=\(.isCancelled)  allDay=\(.isAllDay)  showAs=\(.showAs)  | \(.subject)"' "$FILE"
# Full event: jq '.[N].text | fromjson' "$FILE"
```
Never paste raw 70K+ chars into context.

### Event fields

| Field | Notes |
|-------|-------|
| `id` | → `MeetingId` |
| `subject` | Title |
| `start` / `end` | ISO-8601 UTC string `"2026-04-27T13:00:00.000Z"` — convert to Central |
| `organizer` | Email string only (no display name in this MCP) |
| `attendees` | Flat array of email strings — no names or response status |
| `summary` | Event body / description (for agenda parsing) |
| `location` | May be empty |
| `isAllDay` | `true` → use date portion directly; end is exclusive (midnight-of-day-after — subtract 1 for display) |
| `isCancelled` | Skip; strip `Canceled: ` prefix before folder lookup |
| `importance` | `low` / `normal` / `high` |
| `showAs` | `oof` → OOO classification |

**Note:** `recurrence` is often `null` even for recurring instances — do not rely on it. This connector does not expose `onlineMeeting.joinUrl` or attendee response status.

### Timezone conversion

All folder dates and Meeting Details times must be Central (America/Chicago):

```bash
TZ=America/Chicago date -d "2026-04-27T13:00:00.000Z" "+%Y-%m-%d %H:%M"  # → 2026-04-27 08:00
```

For each event, convert `start` and `end` → `(folder_date, start_time, end_time)` Central. Never display raw UTC.

**All-day end exclusive:** e.g., `end: 2026-05-05T00:00Z` for vacation ending May 4 → subtract 1 day when displaying ranges.

---

## Step 3 — Classify events (first match wins)

**3a. Cancelled** (`isCancelled === true`) — no folder. Strip `Canceled: ` before folder lookup. Existing folder: scheduled → delete, interactive → queue Step 6. Dedupe by `(date, stripped_title)` before cleanup.

**3b. Hold** — subject starts with `Hold` or `Hold for` (case-insensitive). Skip entirely — no folder, no OOO, not in report. Matches `Hold for…`, `Hold -…`, `HOLD:…`. Does NOT match `Holding…`, `Withholding…`.

**3c. OOO** — subject contains whole-word (case-insensitive): `OOO`, `Out of Office`, `Out-of-Office`, `PTO`, `Vacation`, `Sick`, `Holiday`; OR `showAs === "oof"`. No folder → queue Step 5.

**3d. Regular** — everything else, including ambiguous. Create/update folder.

---

## Step 4 — Create or update meeting folders

### 4.1 Meetings mount

`Personal Workspace/CLAUDE.md` → `## MOUNTS` → `Meetings/`. If stale:
```bash
find /sessions/[current-session]/mnt/ -maxdepth 4 -type d -name "Meetings"
```

### 4.2 Folder name

`YYYY-MM-DD — [Title]` — **em-dash U+2014**, not a hyphen. Central date (Step 2).

Sanitize title: `:` → `-`, `/\*?"<>|` → space, strip `Canceled: `, collapse spaces, trim.

Two meetings same date + title → append `(HHMM)` to both.

### 4.3.5 Legacy migration (conditional)

For each canonical target, check for near-duplicate folders (same date, differing only in `:`/`&`/quotes/dashes) or unexpected nested subdirs beyond `Notes/`, `Files/`, `Transcripts/`. Also check for `Chat Summaries/` inside any meeting folder. If either condition found, load `LEGACY_MIGRATIONS.md` (sibling). Skip loading if neither applies to any folder in this window.

### 4.5 New folder — subfolders

```bash
mkdir -p "[folder]/Notes" "[folder]/Files" "[folder]/Transcripts"
```

Do NOT create `Chat Summaries/` — meeting summaries go in `## Transcript Summary` in `CLAUDE.md`.

### 4.6 New folder — CLAUDE.md

```markdown
# [Meeting Title]

[Description — from `summary`, stripped HTML; omit entirely if empty or Teams-join boilerplate]

## Planner Metadata
status: on-track
priority: medium
startDate: YYYY-MM-DD
endDate: YYYY-MM-DD
progress: 0
stress: 0
color: [nameColor hash of title — see PLANNER_SCHEMA.md § 3.5]
isMeeting: true
links:

## Meeting Details

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Time** | HH:MM - HH:MM |
| **Location** | [location, omit row if empty] |
| **Organizer** | organizer@email.com |
| **Importance** | Normal |
| **MeetingId** | [event.id] |
| **LastSynced** | [UTC ISO-8601 now] |

## Attendees

| Email |
|-------|
| attendee@email.com |

## Agenda

- [parsed bullets from summary; omit section if empty or boilerplate only]

## Transcript Summary

(no transcript yet)
```

**Agenda** — strip HTML tags, entities, signature/disclaimer blocks. Bullet-shaped text → markdown bullets; prose → 1–2 paragraphs. Omit section if empty or Teams-join boilerplate only. Truncate >2000 chars with `...and more in Outlook.`

**Attendees** — one row per email in `event.attendees`. Truncate >30 to first 20 + `...and N more.` Preserve `| Email |` / `|-------|` header even if body is empty.

### 4.7 Update (existing folder)

Use Edit section-by-section — never full rewrite.

**Preserve:** title, description paragraph, `status`/`priority`/`stress`/`progress`, custom sections (`## Notes`, `## Decision Log`, `## Recent Summaries`), populated `## Transcript Summary`.

**Replace:** all `## Meeting Details` body (refresh LastSynced, Date, Time, Location, Organizer, Importance; remove any legacy Recurrence row), `## Attendees` body, `## Agenda` body.

Stable across syncs — don't change: `color`, `isMeeting`, `MeetingId`.

### 4.8 Reconciliation

After all folders processed:

- **`missing`** = expected folder not created → surface as warning in Step 8
- **`extra`** = folder in window date range with no matching event → check for content (non-empty `Notes/`, `Files/`, `Transcripts/`, or non-CLAUDE.md files in root)
  - **Interactive:** "Folder **[name]** has no matching event; contains [summary]. Delete / Mark stale (`status: on-hold`) / Keep?"
  - **Scheduled:** never delete extras; log for review

---

## Step 5 — OOO.md

Path: `Personal Workspace/Meetings/OOO.md`

```markdown
# Out of Office

_Last updated: 2026-04-23T14:30Z_

## Entries
- 2026-04-14 → 2026-04-18 — Claire Moll (vacation)
- 2026-04-21 — Akim Nilausen (sick)
- 2026-04-27 14:15–15:30 — Misha Dyskin (OOO)
```

Entry formats by `isAllDay` and span:
- Full single-day: `YYYY-MM-DD — Name (reason)`
- Full multi-day: `YYYY-MM-DD → YYYY-MM-DD — Name (reason)`
- Partial-day: `YYYY-MM-DD HH:MM–HH:MM — Name (reason)` — Central, en-dash between times, em-dash before name

Name comes from the event title when recognizable (e.g., `Misha OOO` → `Misha Dyskin`). If title is just `OOO`/`Out of Office`, use the organizer email local-part as a best-effort name (e.g., `misha.dyskin@promega.com` → `Misha Dyskin`). Reason stripped from subject. If unclear, reason = `OOO`.

**Update logic:** match existing entries on (dates + name + reason), not literal line. Append if absent. Re-sort chronologically after all events. Update `_Last updated:_`. Never delete entries. Create file from template if absent.

**Legacy `| Date | Who |` table:** load `LEGACY_MIGRATIONS.md` § 3 for one-time migration.

---

## Step 6 — Cancelled-but-exists folders

**Scheduled:** `rm -rf "[folder]"` and log.

**Interactive:** per folder — "**[name]** was cancelled in Outlook but folder exists. Delete the folder / Mark cancelled (`status: on-hold`) / Keep as-is?"

---

## Step 7 — Pull transcripts

### Scheduled — automatic

Queue all meetings in Meetings mount with `Date == LAST_WORKDAY` (computed in Step 1.5 bash). Then follow `TRANSCRIPT_INGEST.md` for each queued meeting.

### Interactive — use upfront answer (Step 1.5)

Based on the stored answer:
- **Last workday** → queue all meetings with `Date == LAST_WORKDAY`
- **Specific meeting or date** → ask follow-up free-text now, queue matching meetings
- **Skip** → go to Step 8

For queued meetings, follow `TRANSCRIPT_INGEST.md` (sibling file, steps T1–T8). Transcripts match the right occurrence by the Unix timestamp embedded in the transcript ID.

Skip loading `TRANSCRIPT_INGEST.md` entirely when the queue is empty.

---

## Step 8 — Report

**Scheduled** (log to task runner, omit zero-count lines):
```
Meeting sync complete.
Created: N  Updated: N  Cancelled skipped: N  Deleted: N  OOO: N  Transcripts: N
```

**Interactive** (chat summary, omit zero-count lines):
> "Synced. **N new**, **N updated**, N cancelled. OOO.md: N entries. N transcripts."

---

## Edge Cases

- **No events:** "Nothing on your calendar for [START–END]." No file ops.
- **Declined/tentative:** create folder regardless.
- **All-day non-OOO** (training, off-site): regular meeting, `Time = All day`.
- **Attendee list >30:** first 20 + `...and N more.`
- **OOO no recognizable name:** organizer email local-part heuristic, or `(unknown)` with warning.
- **MCP disconnect mid-sync:** skip affected meeting, log, continue — don't abort.
- **One-off window:** use engineer's window for that run only — don't store.
