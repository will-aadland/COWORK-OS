---
name: meeting-sync
description: >
  Pull Outlook meetings into the Promega Project Planner's Meetings/ mount. Always syncs
  every meeting for this workweek (Mon-Fri of the current week) and next workweek. Times
  are converted from UTC to America/Chicago. Cancelled meetings are skipped. Hold events
  (titles starting with "Hold" or "Hold for") are skipped silently. Out-of-office (OOO)
  events don't get folders — they update a single `Meetings/OOO.md` file instead, with
  partial-day OOO logged as a time range. Near-duplicate folder names from older
  sanitization rules (& vs and, : vs -, quotes, em-dash variants) are auto-merged into
  the canonical name. Transcripts pull from Teams via the meeting-transcript:// URI and
  match the right occurrence by the Unix timestamp embedded in the transcript ID. Has
  two modes: scheduled (runs without interaction, pulls transcripts from the last workday
  automatically) and interactive (engineer picks which transcripts to pull). Trigger
  phrases include "sync my meetings," "sync my calendar," "pull my meetings," "grab my
  meetings," "update OOO," "update my meetings." Also runs on schedule when configured
  as a scheduled task.
version: 3.2.0
---

# Promega Project Planner — Meeting Sync

Pulls Outlook calendar events via the Microsoft MCP connector and reconciles them with the engineer's workspace. Every run covers **Monday–Friday of the current workweek + Monday–Friday of next workweek**. Transcript behavior depends on mode.

**Read `PLANNER_SCHEMA.md` at the plugin root before running this skill.** It defines the meeting folder schema, em-dash naming rule, `nameColor` hash algorithm (§ 3.5), and `CLAUDE.md` table layouts. For deeper context (UI behavior, architecture), `PLANNER_REFERENCE.md` is also at the plugin root but not loaded by this skill.

---

## Detect the run mode

Before anything, determine whether this run is **scheduled** or **interactive**.

**Scheduled** — invoked by the scheduled-tasks system (no engineer in the loop). Default assumption:
- If the invocation came from a scheduled task runner, it's scheduled.
- If there's no active conversation thread / no engineer responding to questions, it's scheduled.

**Interactive** — invoked by the engineer directly in chat. They can answer questions.

The behavior branches in two places:
1. **Transcript pulling** — scheduled auto-pulls from last workday; interactive asks.
2. **Cancelled-but-exists meeting folders** — scheduled deletes automatically; interactive asks per folder.

All other behavior is the same across modes.

---

## Prerequisite — Outlook MCP connector

The Microsoft / Outlook MCP must be connected.

**Interactive mode:** if the MCP isn't present, offer to connect it:
> "I need the Microsoft / Outlook connector to pull your calendar. Want me to search for it?"

Then call `search_mcp_registry` / `suggest_connectors`. After the engineer completes auth, retry the sync.

**Scheduled mode:** if the MCP isn't present, log the failure and exit cleanly:
> "Outlook MCP not connected — scheduled sync skipped."

Don't try to prompt (there's nobody to prompt).

---

## Step 1 — Resolve the time window

The window is **always** the same: Monday–Friday of the current workweek + Monday–Friday of next workweek.

Compute with bash (use `date` for this — it handles the calendar math correctly):

```bash
# Today's weekday (1=Mon ... 7=Sun)
DOW=$(date +%u)

# Days to Monday of current workweek
# If today is Sat (6) or Sun (7), "current workweek" means the upcoming Monday's week
if [ "$DOW" -ge 6 ]; then
  DAYS_TO_MONDAY=$((8 - DOW))  # Sat→2, Sun→1
else
  DAYS_TO_MONDAY=$((1 - DOW))  # Mon→0, Tue→-1, etc.
fi

# Monday of current workweek (or upcoming Monday if it's a weekend)
START=$(date -d "$DAYS_TO_MONDAY days" +%Y-%m-%d)
# Friday of next workweek = Monday + 11 days
END=$(date -d "$START +11 days" +%Y-%m-%d)
```

Window = `[START, END]` inclusive. Both bounds are dates in `YYYY-MM-DD` (local time, America/Chicago for Madison WI).

This never gets asked. It's the only window. If the engineer wants a different window, they have to say so explicitly before running the skill — in which case treat it as a one-off override.

---

## Step 2 — Fetch the events

Call the Outlook calendar search MCP (`outlook_calendar_search`) with the resolved range:
- `query: "*"` (wildcard — return everything)
- `afterDateTime: "[START]T00:00:00-05:00"` (or `-06:00` during CST — but using a local-time ISO with offset is safer than a bare date string)
- `beforeDateTime: "[END+1]T00:00:00-05:00"` (note: `beforeDateTime` is exclusive — pass midnight of the day **after** the last day you want)
- `limit: 50` (max per call; paginate with `offset` if needed)

**Why a TZ-anchored timestamp instead of a bare date.** The MCP interprets bare `YYYY-MM-DD` strings as UTC midnight. For a Madison engineer, that means the search window is actually `Sun 19:00 Central → Fri 19:00 Central` instead of `Mon 00:00 → Fri 23:59 Central` — Friday-evening events past ~7pm get cut off, and Sunday-evening events from the prior week sneak in. Passing a Central-anchored ISO timestamp fixes both edges. DST is automatic if you compute the offset using `TZ=America/Chicago` rather than hardcoding `-05:00`:

```bash
START_TS=$(TZ=America/Chicago date -d "$START 00:00:00" --iso-8601=seconds)
END_TS=$(TZ=America/Chicago date -d "$END 23:59:59" --iso-8601=seconds)
```

Then pass `START_TS` and `END_TS` directly. This guarantees the search window matches the engineer's wall-clock workweek.

The MCP doesn't accept field selectors — it always returns the full event payload. Each item in the response array is `{type: "text", text: "<stringified JSON event>"}`. The stringified JSON has these fields (verified shape, do not assume nested objects like `event.start.dateTime`):

| Field | Type | Notes |
|---|---|---|
| `uri` | string | `calendar:///events/...` URI for `read_resource` |
| `id` | string | Outlook event ID — use as `MeetingId` |
| `subject` | string | Event title |
| `organizer` | string | Email only (NOT name+email) |
| `attendees` | array | Flat list of **email strings** (not objects). Response status and display name are NOT exposed by this MCP — don't pretend they are. |
| `start` | string | **ISO-8601 UTC** — e.g. `"2026-04-27T13:00:00.000Z"`. NOT `{dateTime, timeZone}`. |
| `end` | string | Same shape as `start`. |
| `location` | string | May be empty |
| `summary` | string | The body/description (for agenda parsing) |
| `importance` | string | `"low"` / `"normal"` / `"high"` |
| `showAs` | string | `"free"` / `"tentative"` / `"busy"` / `"oof"` / `"workingElsewhere"` |
| `isAllDay` | boolean | |
| `isCancelled` | boolean | |
| `isOrganizer` | boolean | |
| `recurrence` | object\|null | Often `null` even for recurring instances — do NOT rely on this field |
| `webLink` | string | Browser link to the event |
| `categories` | array | Outlook categories |

### 2.1 Response size handling

MCP responses can exceed the conversation budget (74K+ chars for ~40 events is normal). On "result exceeds maximum allowed tokens", the result is saved to a file — path is in the error message. Process with `jq`:

```bash
FILE="<path from error message>"
# Slim listing for classification (one line per event)
jq -r '.[] | .text | fromjson | "\(.start[:10])T\(.start[11:16])  end=\(.end[11:16])  cancel=\(.isCancelled)  allDay=\(.isAllDay)  showAs=\(.showAs)  | \(.subject)"' "$FILE"
# One event's full payload
jq '.[N].text | fromjson' "$FILE"
```

`.text` is a stringified JSON value, hence `| fromjson`. Never paste the raw 70K+ chars into context.

### 2.2 Pagination

If a page returns exactly `limit` events (50), re-call with `offset: 50`, `100`, … until a page returns fewer. Pagination check applies even after the file-fallback path — a 50-event file means there may be more.

---

## Step 2.5 — Convert UTC to America/Chicago

Every timestamp from the MCP is UTC. The engineer is in Madison WI (Central). **All folder dates and Meeting Details times must be in Central time** so they match what the engineer sees in Outlook on their wall clock.

Conversion pattern:

```bash
# Convert UTC ISO timestamp to Central date and time
TZ=America/Chicago date -d "2026-04-27T13:00:00.000Z" "+%Y-%m-%d %H:%M"
# → 2026-04-27 08:00
```

Or in Python:

```python
from datetime import datetime
from zoneinfo import ZoneInfo
utc = datetime.fromisoformat("2026-04-27T13:00:00.000Z".replace("Z", "+00:00"))
central = utc.astimezone(ZoneInfo("America/Chicago"))
folder_date = central.strftime("%Y-%m-%d")  # "2026-04-27"
time_str = central.strftime("%H:%M")        # "08:00"
```

For each event in the slim listing:
1. Convert `start` → Central → `(folder_date, start_time_24h)`
2. Convert `end` → Central → `end_time_24h`
3. Carry these forward into Steps 3, 4, and 5. Never use the raw UTC value for display.

**DST is automatic** when you use `TZ=America/Chicago` or `ZoneInfo("America/Chicago")`. Don't hardcode `-05:00` or `-06:00`.

For all-day events (`isAllDay: true`), `start` and `end` are at UTC midnight but represent a calendar date in the engineer's TZ. Use the date portion of `start` directly — don't convert (conversion would shift it back a day).

**All-day end is exclusive.** Outlook returns `end` as midnight-of-the-day-after the last day off. A vacation "Apr 30 through May 4" comes back as `start: 2026-04-30T00:00Z, end: 2026-05-05T00:00Z`. **Subtract one day from the end date** when displaying or reasoning about all-day ranges. Examples:
- `start: 2026-04-30, end: 2026-05-01` → single day OOO on `2026-04-30` (end-1 == start, single-day format)
- `start: 2026-04-30, end: 2026-05-05` → multi-day OOO `2026-04-30 → 2026-05-04` (end-1)
- A partial-day event keeps the literal `end` time — only `isAllDay: true` events need this adjustment.

---

## Step 3 — Classify each event

For every event returned, classify into one of five buckets. **Apply rules in this order** — first match wins.

### 3a. **Cancelled** — skip
If `isCancelled === true`:
- **Don't create a folder.**
- **Strip the `Canceled: ` prefix from the title before looking up the folder.** Outlook prepends `Canceled: ` to cancelled events, but the existing folder (created by a prior sync when the event was still live) was named without the prefix. Looking up `2026-04-28 — Canceled: ArC Scrum` will never find `2026-04-28 — ArC Scrum` — the lookup must use the un-prefixed title to find the orphan.

  ```python
  title = event["subject"]
  if title.lower().startswith("canceled: "):
      title = title[len("canceled: "):]  # case-insensitive
  candidate_folder = build_folder_name(date, title)
  ```

- If a folder with the un-prefixed name already exists:
  - **Scheduled mode:** delete the folder automatically (`rm -rf`). Log the deletion.
  - **Interactive mode:** add to the "cancelled-but-exists" queue to be resolved in Step 6.

- **Watch for duplicate cancellation entries.** Outlook sometimes returns the same cancelled occurrence twice (we've seen 2-3 duplicates on some days). After collecting all cancelled events, dedupe by `(date, stripped_title)` before driving cleanup logic — otherwise Step 6 may try to delete the same folder twice (harmless), or worse, ask the engineer the same question twice in interactive mode.

### 3b. **Hold** — skip entirely
Calendar holds are time-blocking events the engineer placed on their own calendar — they're not real meetings. Skip them silently:
- Don't create a folder.
- Don't log to OOO.md.
- Don't surface in the final report (or surface as a single "Skipped N hold events" line).

Detection: the event title starts with `Hold` or `Hold for` (case-insensitive). Examples that match:
- `Hold for Packaging Box Folding Support`
- `Hold - Travel time`
- `HOLD: Conference room Q4`

Examples that do NOT match (don't false-positive on substrings):
- `Holding pattern review` — doesn't start with the keyword
- `Withholding tax meeting` — doesn't start with the keyword

### 3c. **OOO (Out-of-Office)** — update OOO.md, don't create a folder
An event is OOO if ANY of these are true:
- The title contains any of these tokens as a **whole word** (case-insensitive): `OOO`, `Out of Office`, `Out-of-Office`, `PTO`, `Vacation`, `Sick`, `Holiday`. Whole-word match catches `Misha OOO`, `OOO - Misha`, `Will Aadland - PTO Tomorrow`, but NOT `Vacation planning kickoff`.
- `showAs === "oof"`.

This handles "Name first, OOO second" (`Misha OOO`, `Brian A OOO`, `Ethan OOO`) and partial-day OOO regardless of `isAllDay`.

If detected:
- **Don't create a folder.**
- Queue the event for OOO.md update (Step 5).
- Determine partial vs. full-day from `isAllDay` and pass through to Step 5.

### 3d. **Regular meeting** — scaffold/update folder
Anything that's not Cancelled, Hold, or OOO. Queue for folder creation/update (Step 4).

### 3e. **Ambiguous** — default to regular meeting
If you can't tell what kind of event it is, treat it as a regular meeting. Better to create a folder the engineer can delete than to silently drop it.

---

## Step 4 — Create or update meeting folders

For every event classified as a regular meeting:

### 4.1 Resolve the Meetings mount

Read `Personal Workspace/CLAUDE.md` → `## MOUNTS` section → find `Meetings/`.

If the path is stale (old session ID) or `## MOUNTS` is missing, re-resolve:
```bash
find /sessions/[current-session]/mnt/ -maxdepth 4 -type d -name "Meetings"
```

### 4.2 Build the folder name

```
YYYY-MM-DD — [Title]
```

Rules (CRITICAL):
- `YYYY-MM-DD` is the event's start date in **America/Chicago** (already converted in Step 2.5).
- Real **em-dash `—` (U+2014)** between date and title. Not a hyphen.
- Sanitize the title:
  - `:` → `-` (so `Misha and Will 1:1` becomes `Misha and Will 1-1`)
  - `/`, `\`, `*`, `?`, `"`, `<`, `>`, `|` → replace with space
  - Strip the `Canceled: ` prefix Outlook adds (we already filtered cancelled events; this is belt-and-suspenders for any edge cases)
- Collapse multiple spaces to one. Trim leading/trailing whitespace.

Example: `2026-04-21 — ArC Scrum`
Example: `2026-04-29 — Misha and Will 1-1`

### 4.3 Handle collisions

If two meetings on the same date share a title (common for occurrence + instance split), differentiate by start time:
```
2026-04-21 — ArC Scrum (0800)
2026-04-21 — ArC Scrum (1400)
```
Em-dash stays after date; time suffix is plain parens.

### 4.3.5 Migrate legacy folder names (one-time cleanup per sync target)

Before checking if the new (sanitized) folder exists, look for **near-duplicate folders for the same date+event** that came from older sanitization rules and merge them. This handles workspaces accumulated across rule changes (colon → dash, ampersand handling, quote stripping, em-dash variants, etc.).

**Trigger.** For each canonical target folder, list other folders under `Meetings/` whose date prefix matches. If any of them differ only in colons/ampersands/quotes/dashes — or if a folder for this date has unexpected child directories beyond `Notes/`, `Files/`, `Transcripts/` (the nested-directory bug) — load `LEGACY_MIGRATIONS.md` (in this skill directory) for the merge algorithm, conservatism rules, permission fallbacks, and logging format.

**Also: legacy `Chat Summaries/` inside meeting folders.** If any meeting folder contains a `Chat Summaries/` subfolder, follow `LEGACY_MIGRATIONS.md` § 2 to clean it up (empty → delete; content → move to `Notes/`, then delete).

If neither condition fires for any folder in the current sync window, do not load `LEGACY_MIGRATIONS.md`.

### 4.4 Check if the folder already exists

```bash
test -d "[Meetings mount]/YYYY-MM-DD — [Title]"
```

- **Exists** → update path (Step 4.7).
- **New** → create path (Step 4.5–4.6).

### 4.5 New meeting: create subfolders

```bash
mkdir -p "[folder]/Notes" "[folder]/Files" "[folder]/Transcripts"
```

**Do not create `Chat Summaries/` here.** Meeting folders intentionally have no `Chat Summaries/` subfolder — the planner's UI ignores it under meetings. Cowork-generated meeting summaries go in the meeting's `## Transcript Summary` section in `CLAUDE.md` (see Step T7 in `TRANSCRIPT_INGEST.md`). See `PLANNER_SCHEMA.md` § 3.2 for the schema rule.

### 4.6 New meeting: write CLAUDE.md

Template — fill in real values, omit rows for fields the event doesn't provide:

```markdown
# [Meeting Title]

[Description paragraph — use the event's body text if present and substantive. Omit the paragraph entirely if there's no description or the body is just boilerplate.]

## Planner Metadata
status: on-track
priority: medium
startDate: 2026-04-21
endDate: 2026-04-21
progress: 0
stress: 0
color: [nameColor hash of title]
isMeeting: true
links:

## Meeting Details

| Field | Value |
|-------|-------|
| **Date** | 2026-04-21 |
| **Time** | 08:00 - 08:30 |
| **Location** | Arnold-114 |
| **Organizer** | misha.dyskin@promega.com |
| **Importance** | Normal |
| **MeetingId** | AAMkAGE2... |
| **LastSynced** | 2026-04-23T13:14:26Z |

## Attendees

| Email |
|-------|
| claire.moll@promega.com |
| akim.nilausen@promega.com |

## Agenda

- [parsed bullet from body]

## Transcript Summary

(no transcript yet)
```

**Format rules.** Follow `PLANNER_SCHEMA.md` § 3 for the schema (em-dash, `isMeeting: true`, no Recurrence row, `nameColor` hash in § 3.5, table header preservation). Meeting-specific values from the MCP response:
- `Date` — Central, `YYYY-MM-DD`. `Time` — `HH:MM - HH:MM` 24-hr, or `All day` for `isAllDay`.
- `Organizer` — email only (MCP doesn't return display name). If a name lookup is available elsewhere, write `Name (email)`; never fabricate.
- `MeetingId` — Outlook `id` field verbatim. `LastSynced` — current UTC ISO-8601.
- Attendees table: one row per email; preserve `| Email |` / `|-------|` header even when body is empty.

**Agenda parsing.** Read the event's `summary` (body). Strip HTML (tags, entities, signature/disclaimer blocks). Bullet-shaped text → markdown bullets; prose → one or two paragraphs. Omit `## Agenda` entirely if `summary` is empty or just Teams-join boilerplate. Truncate >2000 chars of substance with `...and more in Outlook.`

### 4.7 Update path (folder already exists)

Use Edit, section by section (never full rewrite).

**Preserve verbatim:** title line, description paragraph, `status`/`priority`/`stress`/`progress` in `## Planner Metadata`, any custom sections (`## Notes`, `## Decision Log`, `## Recent Summaries`), and `## Transcript Summary` body if already populated.

**Replace:** `## Meeting Details` body (rebuild full table; remove any legacy Recurrence row), `## Attendees` body, `## Agenda` body. `color`, `isMeeting`, `MeetingId` are stable — don't change them.

### 4.8 Reconciliation pass (every-meeting guarantee)

After 4.1–4.7 finish for every regular event, verify every expected folder exists and every existing folder corresponds to a known event:

```python
expected = {build_folder_name(get_central_date(e), strip_canceled_prefix(e["subject"]))
            for e in regular_events}
actual = {entry.name for entry in meetings_root.iterdir()
          if entry.is_dir() and entry.name[:10] in window_dates}
missing = expected - actual
extra   = actual - expected
# Subtract folders that match cancelled events (Step 6 should have deleted them)
extra -= {build_folder_name(get_central_date(e), strip_canceled_prefix(e["subject"]))
          for e in cancelled_events}
```

**`missing`** = classification dropped a regular event. Surface in Step 8 as a warning ("Expected to scaffold X — got skipped"). Likely a classification bug or a `mkdir`/permission failure.

**`extra`** = folder exists, no event justifies it. Causes: cancelled-with-`Canceled:`-prefix lookup miss (3a bug), event deleted from Outlook entirely, manually created by engineer, or unmerged legacy sanitization variant (4.3.5 should have caught it).

Before treating any extra as deletable, do a deep content check (not just `ls`) — folders may have `Notes/notes.md`, `context.md`, or `*.bak` files:

```python
def folder_has_content(p: Path) -> bool:
    for sub in ["Notes", "Files", "Transcripts"]:
        d = p / sub
        if d.exists() and any(d.iterdir()):
            return True
    return any(f.is_file() and f.name != "CLAUDE.md" for f in p.iterdir())
```

**Interactive mode**: ask per folder — "Folder X has no matching event; contains {summary}. Delete, mark stale, or keep?"
**Scheduled mode**: **never auto-delete extras** even when `folder_has_content` is false. Log and let the engineer review later.

---

## Step 5 — Update Meetings/OOO.md

The OOO file is a simple, human-readable log — one line per OOO entry, chronological.

### 5.1 File location

```
Personal Workspace/Meetings/OOO.md
```

### 5.2 File format

```markdown
# Out of Office

_Last updated: 2026-04-23T14:30Z_

## Entries
- 2026-04-14 → 2026-04-18 — Claire Moll (vacation)
- 2026-04-21 — Akim Nilausen (sick)
- 2026-04-23 — Misha Dyskin (PTO)
- 2026-04-27 14:15–15:30 — Misha Dyskin (OOO)
- 2026-04-28 → 2026-04-29 — Stephen Vogt (OOO)
```

Rules:
- Entries are under `## Entries` only.
- One entry per line.
- Three formats based on duration:
  - **Full single-day** (`isAllDay: true`, single date): `YYYY-MM-DD — Name (reason)`
  - **Full multi-day** (`isAllDay: true`, spans multiple dates): `YYYY-MM-DD → YYYY-MM-DD — Name (reason)`
  - **Partial-day** (`isAllDay: false`): `YYYY-MM-DD HH:MM–HH:MM — Name (reason)` — use Central time, en-dash (–) between times, em-dash (—) before the name
- Reason comes from the event title. Strip the name and OOO keyword to get the reason. Examples:
  - "Misha OOO" → reason = `OOO`, name = `Misha Dyskin`
  - "Vacation - Claire" → reason = `vacation`, name = `Claire Moll`
  - "Will Aadland - PTO Tomorrow" → reason = `PTO`, name = `Will Aadland`
  - If the title is just "Out of Office" or "OOO" with no name, use the **organizer's** name and reason = `OOO`.
- **Sort chronologically** by start date (ascending), with partial-day entries sorted within their day by start time after every update.

### 5.3 Update logic (idempotent)

For each OOO event from Step 3c:

1. Construct the entry line from event data, picking the right format from §5.2 based on `isAllDay` and date span.
2. Check if a matching entry already exists under `## Entries` — match on **date(s) + name + reason**, not the exact line. This way an entry stays idempotent even if the format changes (e.g., reason was edited manually).
3. If not present, append to `## Entries`.
4. After processing all events, **re-sort `## Entries`** by start date (ascending). Within the same date, sort by start time for partial-day entries; sort full-day entries before partial-day entries on the same date.
5. Update the `_Last updated:_` line at the top to the current UTC timestamp.

**If the file doesn't exist yet,** create it with the template above and the current entries.

**Legacy table format migration.** If an existing `Meetings/OOO.md` uses the old markdown-table layout (`| Date | Who |` columns) and lacks the `## Entries` header, load `LEGACY_MIGRATIONS.md` § 3 in this skill directory for the one-time migration pattern. Otherwise skip — the file is already in the current format.

**Never delete old OOO entries** from previous syncs. The file is an accumulating log. If the engineer wants to prune it, they do it manually.

---

## Step 6 — Resolve cancelled-but-exists folders

Only relevant if any meetings from Step 3a had pre-existing folders.

### Scheduled mode

Delete each matching folder:
```bash
rm -rf "[Meetings mount]/YYYY-MM-DD — Title"
```

Log the deletion. Move on.

### Interactive mode

For each cancelled-but-exists folder, ask the engineer:

> "**[folder name]** was cancelled in Outlook, but the folder still exists. What should I do?"

Options:
- **Delete the folder** — removes it entirely (notes, files, transcripts all gone)
- **Mark cancelled** — sets `status: on-hold` in the meeting's CLAUDE.md so it shows up differently in the planner
- **Keep as-is** — leave the folder untouched

Process each the engineer's choice.

---

## Step 7 — Pull transcripts

### Scheduled mode — automatic

1. Compute the last workday:
   ```bash
   DOW=$(date +%u)
   case "$DOW" in
     1) OFFSET=-3;;   # Monday → Friday
     2|3|4|5) OFFSET=-1;;  # Tue–Fri → previous day
     6) OFFSET=-1;;   # Saturday → Friday
     7) OFFSET=-2;;   # Sunday → Friday
   esac
   LAST_WORKDAY=$(date -d "$OFFSET days" +%Y-%m-%d)
   ```

2. For every meeting in the Meetings mount whose `## Meeting Details` date matches `$LAST_WORKDAY`, attempt to pull its transcript.

3. Transcript pull per meeting: see the **Transcript ingest** section below.

### Interactive mode — ask

After meetings are scaffolded and OOO.md is updated, ask the engineer what to pull. **AskUserQuestion caps at 4 options**, so combine "specific date / date range" into one free-text option:

> "Meetings synced. What transcripts should I pull?"

Options (**AskUserQuestion**):
- **Last workday ([date])** — pull every transcript from the most recent weekday before today (recommended in most cases)
- **A specific meeting** — engineer picks one meeting from a list of the last 10 synced
- **A specific date or range** — engineer provides the date(s) in their reply
- **Skip transcripts this run**

Based on their answer:
- "Last workday" → pull every meeting whose `## Meeting Details` date matches the last workday.
- "A specific meeting" → list the last 10 meetings via a second **AskUserQuestion**, then pull only that one.
- "A specific date or range" → ask follow-up via free-text, then pull transcripts for matching meetings.
- "Skip" → go to Step 8.

---

## Transcript ingest (called from Step 7)

For every meeting queued for transcript pull, follow steps T1–T8 in `TRANSCRIPT_INGEST.md` (sibling file). Steps cover existing-summary check (T1), transcript URL lookup via `meetingTranscriptUrl` (T2), bundle fetch and `NOT_FOUND` handling (T3), occurrence matching by embedded timestamp with 15-min tolerance (T4), WEBVTT → markdown raw save (T5), 300–600-word summary generation (T6), `## Transcript Summary` write via Edit (T7), and optional action-item notes in interactive mode (T8). Stop at the first hard failure for a given meeting and move to the next.

If nothing was queued in Step 7 (engineer skipped, scheduled run found no last-workday meetings), don't load `TRANSCRIPT_INGEST.md`.

---

## Step 8 — Report

### Scheduled mode

Log silently to the scheduled-tasks runner (no chat output):
```
Meeting sync complete.
Created: 5 meetings
Updated: 12 meetings
Skipped (cancelled new): 2
Deleted (cancelled existing): 1
OOO entries added: 3
Transcripts pulled: 4
Transcripts skipped (already summarized): 1
```

### Interactive mode

Concise summary to the engineer:

> "Synced. Here's what happened:
>
> - **[N] new meetings** scaffolded
> - **[N] existing meetings** updated
> - **[N] cancelled** meetings skipped (or resolved per your choice)
> - **OOO.md** updated with [N] entries
> - **[N] transcripts** pulled and summarized
>
> Open the Visualizer from your Start menu or desktop shortcut to see the new cards."

Omit lines where the count is 0. Keep it terse.

---

## Edge Cases

- **No events in window.** Report "Nothing on your calendar for [START, END]." No file ops.
- **Event has no body.** Skip the description paragraph and `## Agenda`. Not every meeting has one.
- **Declined/tentative.** Still create the folder. Don't change `status` based on the engineer's response.
- **All-day non-OOO** (off-site, training). Treat as regular meeting; write `| **Time** | All day |`.
- **Recurring series with many occurrences.** Every occurrence in `[START, END]` gets its own folder; `nameColor` ensures they share a color.
- **Attendee list >30.** Truncate to first 20 with footer `...and N more attendees (truncated).`
- **OOO event with no recognizable name.** Fall back to organizer's name, then `(unknown)` with a warning.
- **OOO.md entry same dates, different reason.** Keep the existing entry — the engineer may have edited the reason.
- **Weekend run.** Step 1 and last-workday math already handle Sat/Sun.
- **Engineer requests a one-off window** ("sync next month only"). Skip Step 1's auto window for that run only — don't make it configurable.
