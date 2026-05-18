---
name: meeting-sync
description: >
  Pull Outlook meetings into the Promega Project Planner's Meetings/ mount using the
  Softserve MS365 connector. Always syncs every meeting for this workweek (Mon-Fri of
  the current week) and next workweek. Times are converted from UTC to America/Chicago.
  Cancelled meetings are skipped. Hold events (titles starting with "Hold" or "Hold for")
  are skipped silently. Out-of-office (OOO) events don't get folders — they update a
  single `Meetings/OOO.md` file instead, with partial-day OOO logged as a time range.
  Near-duplicate folder names from older sanitization rules (& vs and, : vs -, quotes,
  em-dash variants) are auto-merged into the canonical name. Writes a three-column
  Attendees table (Name, Email, Response) using the display names Softserve returns.
  After meetings fire, pulls transcripts and recording links via Softserve. Transcripts
  match the right occurrence by `createdDateTime` (no base64 timestamp decoding). Has
  two modes: scheduled (runs without interaction, pulls post-meeting data from the
  last workday automatically) and interactive (engineer picks what to pull). Trigger
  phrases include "sync my meetings," "sync my calendar," "pull my meetings," "grab my
  meetings," "update OOO," "update my meetings." Also runs on schedule when configured
  as a scheduled task.
version: 4.0.0
---

# Promega Project Planner — Meeting Sync (Softserve)

Pulls Outlook calendar events via the **Softserve MS365 MCP** (`mcp__softserve__*`, Microsoft Graph) and reconciles them with the engineer's workspace. Every run covers **Monday–Friday of the current workweek + Monday–Friday of next workweek**. Post-meeting data (transcript, recording link) is pulled in a separate window after meetings fire.

**Read `PLANNER_SCHEMA.md` at the plugin root before running this skill.** It defines the meeting folder schema, em-dash naming rule, `nameColor` hash (§ 3.5), `## Meeting Details` rows (Date, Time, Location, Organizer, Importance, MeetingId, LastSynced, **Recurrence**, **Recording**), and the `## Attendees` table layout (Name, Email, Response). For deeper context (UI, architecture, build), `PLANNER_REFERENCE.md` is in the plugin root but not loaded by this skill.

---

## Detect the run mode

Before anything, determine whether this run is **scheduled** or **interactive**.

**Scheduled** — invoked by the scheduled-tasks system (no engineer in the loop):
- Invocation came from a scheduled task runner.
- No active conversation thread / no engineer responding to questions.

**Interactive** — invoked by the engineer directly in chat. They can answer questions.

The behavior branches in two places:
1. **Post-meeting enrichment (transcript / recording)** — scheduled auto-pulls from last workday; interactive asks.
2. **Cancelled-but-exists meeting folders** — scheduled deletes automatically; interactive asks per folder.

All other behavior is the same across modes.

---

## Prerequisite — Softserve MS365 MCP

The Softserve MCP must be connected. It exposes Microsoft Graph endpoints used throughout this skill.

**Interactive mode:** if not connected, offer to add it:
> "I need the Softserve Microsoft 365 connector to pull your calendar. Want me to walk you through connecting it?"

Point the engineer at Claude Customize → Connectors → Softserve. After they authenticate, retry the sync.

**Scheduled mode:** if not connected, log the failure and exit cleanly:
> "Softserve MCP not connected — scheduled sync skipped."

Don't try to prompt (nobody to prompt).

---

## Step 1 — Resolve the time window

The window is **always** the same: Monday–Friday of the current workweek + Monday–Friday of next workweek.

```bash
DOW=$(date +%u)  # 1=Mon ... 7=Sun

# If today is Sat/Sun, "current workweek" = upcoming Monday's week
if [ "$DOW" -ge 6 ]; then
  DAYS_TO_MONDAY=$((8 - DOW))   # Sat→2, Sun→1
else
  DAYS_TO_MONDAY=$((1 - DOW))   # Mon→0, Tue→-1, etc.
fi

START=$(date -d "$DAYS_TO_MONDAY days" +%Y-%m-%d)
END=$(date -d "$START +11 days" +%Y-%m-%d)   # Friday of next workweek
```

Window = `[START, END]` inclusive, dates in `YYYY-MM-DD` (America/Chicago for Madison WI).

This never gets asked. If the engineer wants a different window, they say so explicitly — treat as a one-off override.

**Compute TZ-anchored bounds for the MCP call:**

```bash
START_TS=$(TZ=America/Chicago date -d "$START 00:00:00" --iso-8601=seconds)
END_TS=$(TZ=America/Chicago date -d "$END 23:59:59" --iso-8601=seconds)
```

DST is automatic with `TZ=America/Chicago`. Don't hardcode `-05:00`/`-06:00`.

---

## Step 2 — Fetch the events (Softserve)

Call `get-calendar-view` — the Graph endpoint that returns all events in a time range with recurring instances **server-side expanded** into individual occurrences.

```
get-calendar-view(
    startDateTime=START_TS,
    endDateTime=END_TS,
    $top=50
)
```

If the response includes a `@odata.nextLink` (or the MCP returns `hasMore=true` / 50 items), paginate via `$skip` or the equivalent until exhausted.

### 2.1 Event shape (Microsoft Graph)

Each event in `response.value[]` has this structure (verified shape — references to fields below assume this):

| Field | Type | Notes |
|---|---|---|
| `id` | string | Outlook event ID — store as `MeetingId` |
| `subject` | string | Event title |
| `bodyPreview` | string | Plaintext snippet of body (use for cheap agenda parsing) |
| `body` | `{contentType, content}` | Full body; `content` is HTML when `contentType="html"` |
| `start` | `{dateTime, timeZone}` | `dateTime: "2026-04-27T13:00:00.0000000"`, `timeZone: "UTC"` typically — see 2.4 |
| `end` | same shape as `start` | |
| `location` | `{displayName, ...}` | `displayName` is what to write to the `Location` row |
| `isAllDay` | boolean | |
| `isCancelled` | boolean | |
| `isOrganizer` | boolean | |
| `importance` | string | `"low"` / `"normal"` / `"high"` |
| `showAs` | string | `"free"` / `"tentative"` / `"busy"` / `"oof"` / `"workingElsewhere"` |
| `type` | string | `"singleInstance"` / `"occurrence"` / `"exception"` / `"seriesMaster"` |
| `seriesMasterId` | string \| null | Set on `occurrence`/`exception`; null on `singleInstance`/`seriesMaster`. Drives Recurrence row in 4.6. |
| `recurrence` | object \| null | Populated only on `seriesMaster` events. On occurrences this is `null` (fetch the master to read it — see 4.6 Recurrence). |
| `organizer.emailAddress.address` | string | Email |
| `organizer.emailAddress.name` | string | Display name (NEW vs. old MCP — write `Name (email)` to the Organizer row when present) |
| `attendees[i].emailAddress.address` | string | |
| `attendees[i].emailAddress.name` | string | Display name available now |
| `attendees[i].status.response` | string | `"accepted"` / `"tentativelyAccepted"` / `"declined"` / `"none"` / `"organizer"` |
| `attendees[i].type` | string | `"required"` / `"optional"` / `"resource"` |
| `onlineMeeting.joinUrl` | string \| absent | Present only for Teams meetings. Used by post-meeting enrichment (transcript / recording). |
| `webLink` | string | Browser link to the event |
| `categories` | array | Outlook categories |

### 2.2 Response size handling

Large windows can still exceed the conversation budget. If the MCP saves the result to a file and returns its path, process with `jq` instead of inlining:

```bash
FILE="<path from error message>"
# Slim listing for classification (one line per event)
jq -r '.value[] | "\(.start.dateTime[:10])T\(.start.dateTime[11:16])  end=\(.end.dateTime[11:16])  cancel=\(.isCancelled)  allDay=\(.isAllDay)  showAs=\(.showAs)  type=\(.type)  | \(.subject)"' "$FILE"
# Full payload for one event
jq '.value[N]' "$FILE"
```

Never paste raw 70K+ chars into context.

### 2.3 Pagination

If a page returns `$top` (50) events, request the next page. `get-calendar-view` returns `@odata.nextLink` or you can advance manually with `$skip=50`, `$skip=100`, … until a short page comes back. Combine all pages before Step 3.

### 2.4 Time zones in the Graph response

`start.dateTime` is the literal time in `start.timeZone`. With Softserve's default (no `Prefer: outlook.timezone` header), `timeZone` is `"UTC"`. **Always convert to America/Chicago before using a value for folder names or display** — see Step 2.5.

Graph timestamps are not strictly ISO — they have 7-digit fractional seconds and no `Z` suffix:

```
"2026-04-27T13:00:00.0000000"
```

When parsing in Python:

```python
from datetime import datetime
from zoneinfo import ZoneInfo
raw = "2026-04-27T13:00:00.0000000"
# Truncate fractional seconds; assume timeZone field tells us UTC:
utc = datetime.fromisoformat(raw[:19]).replace(tzinfo=ZoneInfo("UTC"))
central = utc.astimezone(ZoneInfo("America/Chicago"))
```

---

## Step 2.5 — Convert to America/Chicago

All folder dates and `## Meeting Details` times must be in Central time so they match the engineer's wall clock in Outlook.

```bash
# Convert UTC ISO timestamp to Central date and time
TZ=America/Chicago date -d "2026-04-27T13:00:00Z" "+%Y-%m-%d %H:%M"
# → 2026-04-27 08:00
```

Or Python:

```python
from datetime import datetime
from zoneinfo import ZoneInfo
utc = datetime.fromisoformat("2026-04-27T13:00:00").replace(tzinfo=ZoneInfo("UTC"))
central = utc.astimezone(ZoneInfo("America/Chicago"))
folder_date = central.strftime("%Y-%m-%d")  # "2026-04-27"
time_str = central.strftime("%H:%M")        # "08:00"
```

For each event:
1. Convert `start.dateTime` (with `start.timeZone`) → Central → `(folder_date, start_time_24h)`
2. Convert `end.dateTime` → Central → `end_time_24h`
3. Carry forward into Steps 3, 4, 5. Never use the raw UTC value for display.

**All-day events** (`isAllDay: true`) — `start.dateTime` is midnight in `start.timeZone`. Use the date portion of `start.dateTime` directly; don't apply timezone conversion (would shift it back a day).

**All-day end is exclusive.** Microsoft Graph returns `end` as midnight-of-the-day-after the last day off. Vacation "Apr 30 through May 4" comes back as `start: 2026-04-30T00:00, end: 2026-05-05T00:00`. **Subtract one day from the end date** when displaying or reasoning about all-day ranges:
- `start: 2026-04-30, end: 2026-05-01` → single-day OOO on `2026-04-30` (end-1 == start, single-day format)
- `start: 2026-04-30, end: 2026-05-05` → multi-day OOO `2026-04-30 → 2026-05-04` (end-1)
- Partial-day events keep the literal `end` — only `isAllDay: true` events need this adjustment.

---

## Step 3 — Classify each event

For every event returned, classify into one of five buckets. **Apply rules in this order** — first match wins.

### 3a. **Cancelled** — skip

If `isCancelled === true`:

- **Don't create a folder.**
- **Strip the `Canceled: ` prefix from `subject` before folder lookup.** Outlook prepends `Canceled: ` to cancelled events, but the existing folder (from a prior sync) was named without it.

  ```python
  title = event["subject"]
  if title.lower().startswith("canceled: "):
      title = title[len("canceled: "):]
  candidate_folder = build_folder_name(date, title)
  ```

- If a folder with the un-prefixed name already exists:
  - **Scheduled mode:** delete automatically (`rm -rf`). Log the deletion.
  - **Interactive mode:** queue for Step 6.

- **Dedupe by `(date, stripped_title)`** — Outlook sometimes returns the same cancelled occurrence 2–3 times.

### 3b. **Hold** — skip entirely

Calendar holds the engineer placed on their own calendar — not real meetings. Skip silently:
- No folder, no OOO entry, no surfaced row in the report (or one collapsed "Skipped N hold events" line).

Detection: `subject` starts with `Hold` or `Hold for` (case-insensitive). Matches:
- `Hold for Packaging Box Folding Support`
- `Hold - Travel time`
- `HOLD: Conference room Q4`

Does NOT match (don't false-positive on substrings):
- `Holding pattern review`
- `Withholding tax meeting`

### 3c. **OOO (Out-of-Office)** — update OOO.md, no folder

OOO if ANY of these:
- `subject` contains any of these as a **whole word** (case-insensitive): `OOO`, `Out of Office`, `Out-of-Office`, `PTO`, `Vacation`, `Sick`, `Holiday`. Whole-word match catches `Misha OOO`, `OOO - Misha`, `Will Aadland - PTO Tomorrow`, but NOT `Vacation planning kickoff`.
- `showAs === "oof"`.

If detected:
- No folder.
- Queue for OOO.md update (Step 5).
- Partial vs. full-day from `isAllDay`.

### 3d. **Regular meeting** — scaffold/update folder

Anything not Cancelled, Hold, or OOO. Queue for Step 4.

### 3e. **Ambiguous** — default to regular meeting

If unclear, treat as regular. Better to create a folder the engineer can delete than to silently drop it.

---

## Step 4 — Create or update meeting folders

For every regular meeting:

### 4.1 Resolve the Meetings mount

Read `Personal Workspace/CLAUDE.md` → `## MOUNTS` → find `Meetings/`. If stale or missing:

```bash
find /sessions/[current-session]/mnt/ -maxdepth 4 -type d -name "Meetings"
```

### 4.2 Build the folder name

```
YYYY-MM-DD — [Title]
```

Rules (CRITICAL):
- `YYYY-MM-DD` = event's start date in America/Chicago (from Step 2.5).
- Real **em-dash `—` (U+2014)** between date and title. Not a hyphen.
- Sanitize the title:
  - `:` → `-` (so `Misha and Will 1:1` becomes `Misha and Will 1-1`)
  - `/`, `\`, `*`, `?`, `"`, `<`, `>`, `|` → replace with space
  - Strip `Canceled: ` prefix (belt-and-suspenders).
- Collapse multiple spaces. Trim.

Examples: `2026-04-21 — ArC Scrum`, `2026-04-29 — Misha and Will 1-1`.

### 4.3 Handle collisions

Two meetings on the same date with the same title → differentiate by start time:

```
2026-04-21 — ArC Scrum (0800)
2026-04-21 — ArC Scrum (1400)
```

Em-dash stays after date; time suffix is plain parens.

### 4.3.5 Migrate legacy folder names (load conditionally)

For each canonical target folder, list other folders under `Meetings/` whose date prefix matches. If any differ only in colons/ampersands/quotes/dashes, or if a folder has unexpected child directories beyond `Notes/`, `Files/`, `Transcripts/` (nested-directory bug), load `LEGACY_MIGRATIONS.md` (sibling file) for the merge algorithm, conservatism rules, permission fallbacks, and logging.

**Also: legacy `Chat Summaries/` inside meeting folders.** If any meeting folder contains a `Chat Summaries/`, follow `LEGACY_MIGRATIONS.md` § 2 (empty → delete; content → move to `Notes/`, then delete).

If neither condition fires for any folder in the current window, don't load `LEGACY_MIGRATIONS.md`.

### 4.4 Check if the folder exists

```bash
test -d "[Meetings mount]/YYYY-MM-DD — [Title]"
```

- **Exists** → update (4.7).
- **New** → create (4.5–4.6).

### 4.5 New meeting: create subfolders

```bash
mkdir -p "[folder]/Notes" "[folder]/Files" "[folder]/Transcripts"
```

**Do NOT create `Chat Summaries/` here.** Meeting folders intentionally have no `Chat Summaries/` — the planner's UI ignores it under meetings. Cowork-generated meeting summaries go in `## Transcript Summary` in `CLAUDE.md` (see T7 in `TRANSCRIPT_INGEST.md`). See `PLANNER_SCHEMA.md` § 3.2.

### 4.6 New meeting: write `CLAUDE.md`

Template — fill in real values; omit rows for fields the event doesn't provide:

```markdown
# [Meeting Title]

[Description paragraph — from event.body. Omit entirely if empty or just Teams-join boilerplate.]

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
| **Organizer** | Misha Dyskin (misha.dyskin@promega.com) |
| **Importance** | Normal |
| **MeetingId** | AAMkAGE2... |
| **LastSynced** | 2026-04-23T13:14:26Z |
| **Recurrence** | Weekly on Mon, Wed, Fri until 2026-12-31 |

## Attendees

| Name              | Email                     | Response  |
|-------------------|---------------------------|-----------|
| Claire Moll       | claire.moll@promega.com   | accepted  |
| Akim Nilausen     | akim.nilausen@promega.com | tentative |

## Agenda

- [parsed bullet from event.body]

## Transcript Summary

(no transcript yet)
```

**Format rules.** Follow `PLANNER_SCHEMA.md` § 3 for the schema. Meeting-specific values from the Softserve response:

- `Date` — Central, `YYYY-MM-DD` (Step 2.5).
- `Time` — `HH:MM - HH:MM` 24-hr, Central. All-day events: `All day`.
- `Location` — `event.location.displayName` (may be empty).
- `Organizer` — `Name (email)` when `organizer.emailAddress.name` is present; email-only when only address is returned. Don't fabricate names.
- `Importance` — `event.importance` (title-cased: Normal / Low / High).
- `MeetingId` — `event.id` verbatim.
- `LastSynced` — current UTC ISO-8601.
- `Recurrence` — see "Recurrence row" below.
- Attendees table — see "Attendees table on create" below.

#### Recurrence row

Only present on instances of a recurring series.

- `event.type === "occurrence"` or `"exception"`: the event has `seriesMasterId`. Fetch the series master **once per series per sync run** (cache by `seriesMasterId` to avoid N+1):

  ```
  get-calendar-event(eventId=seriesMasterId)
     → response.recurrence
        .pattern.type        "daily" | "weekly" | "absoluteMonthly" | "relativeMonthly" | "absoluteYearly" | "relativeYearly"
        .pattern.interval    integer (e.g., 1 = every week, 2 = every other)
        .pattern.daysOfWeek  for weekly types: array of weekday names
        .range.type          "endDate" | "noEnd" | "numbered"
        .range.endDate       YYYY-MM-DD when range.type === "endDate"
        .range.numberOfOccurrences  integer when range.type === "numbered"
  ```

  Format the row as a short human phrase. Examples (deterministic mapping):
  - `pattern.type=weekly, interval=1, daysOfWeek=[Monday]` → `Weekly on Monday`
  - `pattern.type=weekly, interval=1, daysOfWeek=[Monday,Wednesday,Friday]` → `Weekly on Mon, Wed, Fri`
  - `pattern.type=weekly, interval=2, daysOfWeek=[Tuesday]` → `Every 2 weeks on Tuesday`
  - `pattern.type=daily, interval=1` → `Daily`
  - `pattern.type=absoluteMonthly, interval=1, dayOfMonth=15` → `Monthly on the 15th`
  - Suffix with the range when bounded: `... until 2026-12-31` or `... (12 occurrences)`. Omit when `range.type === "noEnd"`.

- `event.type === "singleInstance"` or `"seriesMaster"`: **omit the Recurrence row entirely.** `seriesMaster` shouldn't appear here anyway (`get-calendar-view` returns expanded occurrences, not the master).

If `get-calendar-event(seriesMasterId)` fails (permission, deleted master, race) — log once per sync and skip the row. Don't fail the whole sync.

#### Attendees table on create

Three columns: `Name`, `Email`, `Response`. Build one row per `event.attendees[i]`:

| Column | Source |
|---|---|
| `Name` | `attendee.emailAddress.name` (display name). If absent, fall back to `—`. **Never fabricate a name from the email local-part** — leave `—` instead. |
| `Email` | `attendee.emailAddress.address` (lowercased canonical form). |
| `Response` | mapped from `attendee.status.response` (see mapping below). |

Response value mapping:
- `accepted` → `accepted`
- `tentativelyAccepted` → `tentative`
- `declined` → `declined`
- `none` → `None`
- `organizer` → `organizer`

The organizer is also typically returned in `event.attendees`; if not, include them as a row using `organizer.emailAddress.name` / `.address` with Response = `organizer`.

#### Agenda parsing

Read `event.body.content`. Strip HTML (tags, entities, signature/disclaimer blocks). Bullet-shaped text → markdown bullets; prose → one or two paragraphs. Omit `## Agenda` if body is empty or just Teams-join boilerplate (`<link>Click here to join...</link>`, phone numbers, "Microsoft Teams meeting" headers). Truncate >2000 chars of substance with `...and more in Outlook.`

### 4.7 Update path (folder already exists)

Use Edit, section by section (never full rewrite).

**Preserve verbatim:** title line; description paragraph; `status`, `priority`, `stress`, `progress` in `## Planner Metadata`; any custom sections (`## Notes`, `## Decision Log`, `## Recent Summaries`); `## Transcript Summary` body if already populated.

**Replace:** `## Meeting Details` body (rebuild fully; refresh `LastSynced`, `Date`, `Time`, `Location`, `Organizer`, `Importance`, and `Recurrence` row in case series rules changed). Keep `Recording` row if it already exists; don't strip it here. `## Attendees` body — rebuild the three-column table (Name, Email, Response) from the event payload. `## Agenda` body.

`color`, `isMeeting`, `MeetingId` are stable across syncs — don't change them.

If a previous version of this skill wrote an Attendees table with a different column layout (single `Email` column, or the four-column Email/Response/Attended/Minutes layout from earlier soft-serve drafts), upgrade it in place: rebuild the body with the canonical `Name | Email | Response` columns and the current event data.

### 4.8 Reconciliation pass (every-meeting guarantee)

After 4.1–4.7 finish for every regular event, verify every expected folder exists and every existing folder maps to a known event:

```python
expected = {build_folder_name(get_central_date(e), strip_canceled_prefix(e["subject"]))
            for e in regular_events}
actual = {entry.name for entry in meetings_root.iterdir()
          if entry.is_dir() and entry.name[:10] in window_dates}
missing = expected - actual
extra   = actual - expected
extra -= {build_folder_name(get_central_date(e), strip_canceled_prefix(e["subject"]))
          for e in cancelled_events}
```

**`missing`** = classification dropped a regular event. Surface in Step 8 as a warning. Likely a classification bug or a `mkdir`/permission failure.

**`extra`** = folder exists, no event justifies it. Causes: cancelled-with-`Canceled:`-prefix lookup miss, event deleted from Outlook entirely, manually created by engineer, unmerged legacy sanitization variant.

Before treating any extra as deletable, do a deep content check (not just `ls`):

```python
def folder_has_content(p: Path) -> bool:
    for sub in ["Notes", "Files", "Transcripts"]:
        d = p / sub
        if d.exists() and any(d.iterdir()):
            return True
    return any(f.is_file() and f.name != "CLAUDE.md" for f in p.iterdir())
```

**Interactive mode:** ask per folder — "Folder X has no matching event; contains {summary}. Delete, mark stale, or keep?"
**Scheduled mode:** **never auto-delete extras** even when `folder_has_content` is false. Log and let the engineer review later.

---

## Step 5 — Update `Meetings/OOO.md`

Simple human-readable log — one line per OOO entry, chronological.

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
  - **Partial-day** (`isAllDay: false`): `YYYY-MM-DD HH:MM–HH:MM — Name (reason)` — Central time, en-dash (–) between times, em-dash (—) before the name
- Reason from `subject`. Strip the name and OOO keyword:
  - `Misha OOO` → reason = `OOO`, name = `Misha Dyskin`
  - `Vacation - Claire` → reason = `vacation`, name = `Claire Moll`
  - `Will Aadland - PTO Tomorrow` → reason = `PTO`, name = `Will Aadland`
  - Just `Out of Office` or `OOO` with no name → use `organizer.emailAddress.name` (Softserve gives us this directly now). Reason = `OOO`.
- **Sort chronologically** by start date (ascending); partial-day entries sort by start time within their day.

### 5.3 Update logic (idempotent)

For each OOO event from Step 3c:

1. Construct the entry line per §5.2 based on `isAllDay` and date span.
2. Match against existing `## Entries` on **(dates, name, reason)** — not the literal line.
3. If absent, append.
4. After all events, re-sort `## Entries`.
5. Update `_Last updated:_` to current UTC.

If the file doesn't exist, create with the template above and the current entries.

**Legacy table format migration.** If an existing `OOO.md` uses the old `| Date | Who |` markdown table and lacks `## Entries`, load `LEGACY_MIGRATIONS.md` § 3 for the one-time migration. Otherwise skip.

**Never delete old OOO entries.** Accumulating log. Engineer prunes manually if wanted.

---

## Step 6 — Resolve cancelled-but-exists folders

Only relevant when Step 3a found cancelled events with pre-existing folders.

### Scheduled mode

```bash
rm -rf "[Meetings mount]/YYYY-MM-DD — Title"
```

Log the deletion. Move on.

### Interactive mode

For each cancelled-but-exists folder:

> "**[folder name]** was cancelled in Outlook, but the folder still exists. What should I do?"

Options:
- **Delete the folder** — removes it entirely (notes, files, transcripts all gone)
- **Mark cancelled** — sets `status: on-hold` in the meeting's CLAUDE.md so it shows differently in the planner
- **Keep as-is** — leave untouched

Apply the choice.

---

## Step 7 — Post-meeting enrichment (transcripts + recordings)

After folders are scaffolded and OOO.md is updated, pull post-meeting data: transcript and recording link.

### Scheduled mode — automatic

1. Compute last workday:

   ```bash
   DOW=$(date +%u)
   case "$DOW" in
     1) OFFSET=-3;;            # Monday → Friday
     2|3|4|5) OFFSET=-1;;      # Tue–Fri → previous day
     6) OFFSET=-1;;            # Saturday → Friday
     7) OFFSET=-2;;            # Sunday → Friday
   esac
   LAST_WORKDAY=$(date -d "$OFFSET days" +%Y-%m-%d)
   ```

2. For every meeting in the Meetings mount whose `## Meeting Details` `Date` matches `$LAST_WORKDAY`, queue it for enrichment.

3. Run enrichment per meeting: see `TRANSCRIPT_INGEST.md` (sibling file).

### Interactive mode — ask

> "Meetings synced. What should I pull?"

Options (**AskUserQuestion**):
- **Last workday ([date])** — pull transcript + recording for every meeting from the most recent weekday before today (recommended)
- **A specific meeting** — engineer picks one from a list of the last 10 synced
- **A specific date or range** — engineer provides date(s) in their reply
- **Skip post-meeting pull this run**

Based on the answer:
- "Last workday" → queue every last-workday meeting.
- "A specific meeting" → list the last 10 meetings via a second **AskUserQuestion**, then queue only that one.
- "A specific date or range" → ask follow-up free-text, then queue matching meetings.
- "Skip" → Step 8.

### Per-meeting enrichment

For every queued meeting, follow `TRANSCRIPT_INGEST.md`:

- **Section A (T1–T8)** — transcript ingest. Uses Softserve `get-calendar-event`, `parse-teams-url`, `list-meeting-transcripts`, `get-meeting-transcript-content`. Matches transcripts by `createdDateTime` (no base64 timestamp decoding).
- **Section B** — recording link. Uses `list-meeting-recordings`. Appends `| Recording | <url> |` to `## Meeting Details` when a recording exists.

Don't load `TRANSCRIPT_INGEST.md` when the queue is empty (engineer chose Skip, or no last-workday meetings).

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
Recording links added: 3
```

Omit lines where the count is 0.

### Interactive mode

Concise summary to the engineer:

> "Synced. Here's what happened:
>
> - **[N] new meetings** scaffolded
> - **[N] existing meetings** updated
> - **[N] cancelled** meetings skipped (or resolved per your choice)
> - **OOO.md** updated with [N] entries
> - **[N] transcripts** pulled and summarized
> - **[N] recordings** linked
>
> Open the Visualizer from your Start menu or desktop shortcut to see the new cards."

Omit zero-count lines. Keep it terse.

---

## Edge Cases

- **No events in window.** Report "Nothing on your calendar for [START, END]." No file ops.
- **Event has no body.** Skip the description paragraph and `## Agenda`. Not every meeting has one.
- **Declined/tentative.** Still create the folder. Don't change `status` based on the engineer's response — that's reflected in the Attendees Response column instead.
- **All-day non-OOO** (off-site, training). Treat as regular meeting; write `| **Time** | All day |`.
- **Recurring series with many occurrences.** Every occurrence in `[START, END]` gets its own folder. `get-calendar-view` server-side-expands them. `nameColor` ensures they share a color. Fetch the series master ONCE per series for the Recurrence row.
- **Attendee list >30.** Truncate to first 20 with footer row: `...and N more attendees (truncated).` in the table (use a single cell that spans visually — the planner just shows the cell content). Full list remains in Outlook.
- **OOO event with no recognizable name.** Use `organizer.emailAddress.name` from Softserve; fall back to `organizer.emailAddress.address`; finally `(unknown)` with a warning.
- **OOO.md entry same dates, different reason.** Keep the existing entry — the engineer may have edited the reason.
- **Weekend run.** Step 1 and last-workday math already handle Sat/Sun.
- **Engineer requests a one-off window** ("sync next month only"). Skip Step 1's auto window for that run only — don't make it configurable.
- **Softserve disconnects mid-sync.** Individual MCP calls return errors. Treat each independently — skip the affected meeting, log, continue. Never abort the whole sync because one call failed.
- **Series master fetch fails for a recurring instance.** Skip the Recurrence row for that instance only. Other instances of the same series may succeed if cached, or also fail — either way, don't abort.
