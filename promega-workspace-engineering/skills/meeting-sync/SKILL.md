---
name: meeting-sync
description: >
  Pull Outlook meetings into the Promega Project Planner Meetings/ mount via Microsoft 365 Plus.
  Covers current + next workweek Mon–Fri, UTC→America/Chicago. Skips cancelled/Hold/OOO.
  OOO → Meetings/OOO.md. Two modes: scheduled (auto-pull last-workday enrichment) and
  interactive (ask upfront, then run uninterrupted). Triggers: "sync my meetings," "sync
  my calendar," "pull my meetings," "grab my meetings," "update OOO," "update my meetings."
version: 5.0.0
---

# Promega Project Planner — Meeting Sync (Microsoft 365 Plus)

Pulls Outlook calendar events via `mcp__Microsoft_365_Open_Beta__get-calendar-view` and reconciles them with the engineer's workspace. Every run covers **Monday–Friday of the current workweek + Monday–Friday of next workweek**.

**Read `PLANNER_SCHEMA.md` at the plugin root first.** It defines: folder schema, em-dash naming rule, `nameColor` hash (§ 3.5), `## Meeting Details` rows (Recording, Recurrence), and `## Attendees` layout. `PLANNER_REFERENCE.md` is also at the plugin root for deeper context but not loaded by this skill.

---

## Mode detection

| Mode | When | Enrichment | Cancelled-folder behavior |
|------|------|------------|--------------------------|
| **Scheduled** | Task runner / no engineer in loop | Auto-pull last workday | Auto-delete |
| **Interactive** | Engineer in chat | Ask upfront before sync | Ask per folder |

---

## Prerequisite — Microsoft 365 Plus MCP

**Interactive:** if not connected, offer setup via Claude Customize → Connectors → Microsoft 365 Plus. Retry after auth.

**Scheduled:** log `"Microsoft 365 Plus MCP not connected — scheduled sync skipped."` and exit.

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

Engineer-specified windows are one-off overrides — never store or default to them.

---

## Step 1.5 — Interactive: ask enrichment upfront

**Interactive mode only.** Before syncing, compute last workday and ask once so the rest of the session runs uninterrupted:

```bash
DOW=$(date +%u)
case "$DOW" in 1) O=-3;; 2|3|4|5|6) O=-1;; 7) O=-2;; esac
LAST_WORKDAY=$(date -d "$O days" +%Y-%m-%d)
```

> "Syncing meetings for **[START] → [END]**. After syncing, what should I pull?"

Options (AskUserQuestion):
- **Last workday ([LAST_WORKDAY])** *(recommended)* — pull transcript + recording for every meeting from the most recent weekday
- **A specific meeting or date** — provide name/date after sync completes
- **Skip enrichment this run**

Store the answer; use it in Step 7 without asking again.

---

## Step 2 — Fetch events

```
mcp__Microsoft_365_Open_Beta__get-calendar-view(startDateTime=START_TS, endDateTime=END_TS, $top=50)
```

Paginate via `$skip=50, 100, …` until a short page. Combine all pages before Step 3.

**Large response (MCP saves to file):**
```bash
jq -r '.value[] | "\(.start.dateTime[:10])T\(.start.dateTime[11:16])  cancel=\(.isCancelled)  allDay=\(.isAllDay)  showAs=\(.showAs)  | \(.subject)"' "$FILE"
# Full event: jq '.value[N]' "$FILE"
```
Never paste raw 70K+ chars into context.

### Event fields

| Field | Notes |
|-------|-------|
| `id` | → `MeetingId` |
| `subject` | Title |
| `start.dateTime` / `.timeZone` | `"2026-04-27T13:00:00.0000000"`, typically `"UTC"` — convert to Central |
| `end.dateTime` / `.timeZone` | Same shape |
| `body.{contentType, content}` | HTML body → agenda parsing |
| `location.displayName` | Location row; may be empty |
| `isAllDay` | `true` → use date portion directly; end is midnight-of-day-after (subtract 1 for display) |
| `isCancelled` | Skip; strip `Canceled: ` prefix before folder lookup |
| `importance` | `low` / `normal` / `high` |
| `showAs` | `oof` → OOO classification |
| `type` | `singleInstance` / `occurrence` / `exception` — drives Recurrence row |
| `seriesMasterId` | Non-null on occurrence/exception → fetch master once for Recurrence |
| `recurrence` | Populated only on `seriesMaster`; null on occurrences |
| `organizer.emailAddress.{name, address}` | Write `Name (email)` when name present; email-only otherwise |
| `attendees[i].emailAddress.{name, address}` | Name + Email columns |
| `attendees[i].status.response` | Response column (see mapping in §4.6) |
| `onlineMeeting.joinUrl` | Required for transcript/recording enrichment |

### Timezone conversion

All folder dates and Meeting Details times must be Central (America/Chicago):

```bash
TZ=America/Chicago date -d "2026-04-27T13:00:00Z" "+%Y-%m-%d %H:%M"  # → 2026-04-27 08:00
```

For each event, convert `start` and `end` → `(folder_date, start_time, end_time)` in Central. Carry forward — never display raw UTC. DST is automatic with `TZ=America/Chicago`.

**All-day end exclusive:** e.g., `end: 2026-05-05T00:00` for a vacation ending May 4 → subtract 1 day when displaying ranges.

---

## Step 3 — Classify events (first match wins)

**3a. Cancelled** (`isCancelled === true`) — no folder. Strip `Canceled: ` prefix before folder lookup. Existing folder: scheduled → delete, interactive → queue Step 6. Dedupe by `(date, stripped_title)` before cleanup.

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

[Description — stripped HTML body; omit entirely if empty or Teams-join boilerplate]

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
| **Location** | [displayName, omit row if empty] |
| **Organizer** | Name (email) |
| **Importance** | Normal |
| **MeetingId** | [event.id] |
| **JoinUrl** | [onlineMeeting.joinUrl — omit row if null/absent] |
| **LastSynced** | [UTC ISO-8601 now] |
| **Recurrence** | [phrase — see below; omit for singleInstance] |

## Attendees

| Name | Email | Response |
|------|-------|----------|
| [name or —] | [email] | [response] |

## Agenda

- [parsed bullets from body; omit section if empty or Teams boilerplate only]

## Transcript Summary

(no transcript yet)
```

**Recurrence row** (occurrence/exception only). Fetch series master once per series, cache by `seriesMasterId`:
```
mcp__Microsoft_365_Open_Beta__get-calendar-event(seriesMasterId) → .recurrence.{pattern, range}
```

| pattern.type | interval | Example phrase |
|---|---|---|
| `weekly` | 1 | `Weekly on Mon, Wed, Fri` |
| `weekly` | 2 | `Every 2 weeks on Tuesday` |
| `daily` | 1 | `Daily` |
| `absoluteMonthly` | 1 | `Monthly on the 15th` |

Append ` until YYYY-MM-DD` (endDate) or ` (N occurrences)` (numbered) if bounded; omit suffix for noEnd. If fetch fails, skip the row — don't abort.

**Attendees** — one row per `attendees[i]`. Response mapping: `tentativelyAccepted` → `tentative`; `accepted / declined / none / organizer` → lowercase as-is. Never fabricate a name — use `—` if `emailAddress.name` is absent. If organizer is missing from the array, add a row with `Response = organizer`. Truncate >30 attendees to first 20 + `...and N more.`

**Agenda** — strip HTML tags, entities, signature/disclaimer blocks. Bullet-shaped text → markdown bullets; prose → 1–2 paragraphs. Omit section if empty or Teams-join boilerplate only. Truncate >2000 chars with `...and more in Outlook.`

### 4.7 Update (existing folder)

Use Edit section-by-section — never full rewrite.

**Preserve:** title, description paragraph, `status`/`priority`/`stress`/`progress`, custom sections (`## Notes`, `## Decision Log`, `## Recent Summaries`), populated `## Transcript Summary`, existing `Recording` row, existing `JoinUrl` row.

**Replace:** all `## Meeting Details` body (refresh LastSynced, Date, Time, Location, Organizer, Importance, Recurrence), `## Attendees` body, `## Agenda` body.

**Upgrade** legacy attendee layouts (single `Email` column or old 4-column layout) to `Name | Email | Response`.

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

Name = `organizer.emailAddress.name`. Reason stripped from subject (e.g., `Will Aadland - PTO Tomorrow` → `PTO`). If title is just `OOO`/`Out of Office`, reason = `OOO`.

**Update logic:** match existing entries on (dates + name + reason), not literal line. Append if absent. Re-sort chronologically after all events. Update `_Last updated:_`. Never delete entries. Create file from template if absent.

**Legacy `| Date | Who |` table:** load `LEGACY_MIGRATIONS.md` § 3 for one-time migration.

---

## Step 6 — Cancelled-but-exists folders

**Scheduled:** `rm -rf "[folder]"` and log.

**Interactive:** per folder — "**[name]** was cancelled in Outlook but folder exists. Delete the folder / Mark cancelled (`status: on-hold`) / Keep as-is?"

---

## Step 7 — Post-meeting enrichment

### Scheduled — automatic

Queue all meetings in Meetings mount with `Date == LAST_WORKDAY` (computed in Step 1.5 bash). Then follow `TRANSCRIPT_INGEST.md` for each.

### Interactive — use upfront answer (Step 1.5)

Based on the stored answer:
- **Last workday** → queue all meetings with `Date == LAST_WORKDAY`
- **Specific meeting or date** → ask follow-up free-text now, queue matching meetings
- **Skip** → go to Step 8

For queued meetings, follow `TRANSCRIPT_INGEST.md` (sibling file): section A (T1–T8, transcript via `mcp__Microsoft_365_Open_Beta__list-meeting-transcripts`, match by `createdDateTime`) and section B (recording link → `| Recording | <url> |` in Meeting Details).

Skip loading `TRANSCRIPT_INGEST.md` entirely when the queue is empty.

---

## Step 8 — Report

**Scheduled** (log to task runner, omit zero-count lines):
```
Meeting sync complete.
Created: N  Updated: N  Cancelled skipped: N  Deleted: N  OOO: N  Transcripts: N  Recordings: N
```

**Interactive** (chat summary, omit zero-count lines):
> "Synced. **N new**, **N updated**, N cancelled. OOO.md: N entries. N transcripts, N recordings."

---

## Edge Cases

- **No events:** "Nothing on your calendar for [START–END]." No file ops.
- **Declined/tentative:** create folder regardless; Response column reflects it.
- **All-day non-OOO** (training, off-site): regular meeting, `Time = All day`.
- **Attendee list >30:** first 20 + `...and N more.`
- **OOO no recognizable name:** `organizer.emailAddress.name` → address → `(unknown)` with warning.
- **Recurring series:** every occurrence in window gets its own folder. Fetch series master once.
- **MCP disconnect mid-sync:** skip affected meeting, log, continue — don't abort.
- **Series master fetch fails:** skip Recurrence row for that instance only.
- **One-off window:** use engineer's window for that run only — don't store.
