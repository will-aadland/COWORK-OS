# meeting-sync — Post-meeting ingest (Microsoft 365 Plus)

Sub-reference loaded conditionally from `SKILL.md` Step 7 when meetings need post-meeting enrichment. Covers two related operations that happen on the same trigger (after a meeting fires):

- **A. Transcript ingest** — primary purpose; T1–T8.
- **B. Recording link** — when a Teams recording exists; appends to `## Meeting Details`.

All MCP calls below target the **Microsoft 365 Plus connector** (`mcp__Microsoft_365_Open_Beta__*`). All are read-only and auto-allowed; no permission prompts. If the Microsoft 365 Plus connector isn't connected, skip the entire file and log "post-meeting enrichment skipped — Microsoft 365 Plus not connected" in scheduled mode, or offer to connect it in interactive mode.

Skip loading this file entirely when Step 7 has nothing queued (scheduled run found no last-workday meetings, or interactive run chose "Skip enrichment this run").

> **Note on `## Attendees`.** The Attendees table (`Name | Email | Response`) is populated at meeting-scaffold time from the event payload (`event.attendees[i].emailAddress.{name,address}` plus `attendee.status.response`). It is *not* post-meeting data — see `SKILL.md` § 4.6 "Attendees table on create". This file does not touch `## Attendees`.

---

## Quick Tool Reference

| Tool | Key input params | Key return fields |
|------|----------------|-------------------|
| `get-current-user` | _(none)_ | `id`, `displayName`, `mail` |
| `get-calendar-event` | `eventId` | `onlineMeeting.joinUrl` (or `.joinWebUrl`) |
| `parse-teams-url` | `url` | `onlineMeetingId` |
| `list-meeting-transcripts` | `onlineMeetingId` | `[].{id, createdDateTime}` |
| `get-meeting-transcript-content` | `onlineMeetingId`, `transcriptId`, `format` | raw WEBVTT string |
| `list-meeting-recordings` | `onlineMeetingId` | `[].{id, createdDateTime, recordingContentUrl}` |

All calls: prefix `mcp__Microsoft_365_Open_Beta__`. All are read-only; no permission prompts expected.

---

## Section A — Transcript ingest (T0–T8)

For each meeting queued for transcript pull, work through T0–T8 in order. Stop early on "no transcripts" or "not a Teams meeting" — don't fail the whole sync.

### T0. Verify connector

```
mcp__Microsoft_365_Open_Beta__get-current-user()
   → {id, displayName, mail}
```

- **Success** → store `userId` for the session. Continue to T1.
- **Error / not connected** →
  - Scheduled: log `"enrichment skipped — Microsoft 365 Plus not connected"` and exit the entire file.
  - Interactive: "I need Microsoft 365 Plus to pull transcripts. Enable it in Claude Customize → Connectors, then re-run."

Run T0 once per enrichment session, not once per meeting.

### T1. Check for an existing transcript summary

Read the meeting's `CLAUDE.md` `## Transcript Summary` section. If already populated (not the placeholder `(no transcript yet)`):

- **Scheduled mode:** skip (don't overwrite).
- **Interactive mode:** ask "Transcript already summarized for [meeting]. Re-pull and overwrite?" If no, skip.

### T2. Resolve the `onlineMeetingId`

**Step 2a — Get the join URL.**

Check `## Meeting Details` in the meeting's `CLAUDE.md` for a `JoinUrl` row:

- **`JoinUrl` row present and non-empty** → use it directly. Skip the API call below.
- **`JoinUrl` row absent or blank** → fetch it:

  ```
  mcp__Microsoft_365_Open_Beta__get-calendar-event(eventId=<MeetingId from CLAUDE.md>)
      → check .onlineMeeting.joinUrl first, then .onlineMeeting.joinWebUrl
  ```

  If both are null/empty, or `onlineMeeting` is absent entirely → not a Teams meeting (in-person, Zoom, external). Skip with reason `no online meeting`.

The `JoinUrl` fast-path eliminates this API call for any meeting that was scaffolded by meeting-sync (which stores `JoinUrl` at creation time). The fallback handles legacy folders or manual entries.

**Step 2b — Convert join URL → `onlineMeetingId`.**

```
mcp__Microsoft_365_Open_Beta__parse-teams-url(url=<joinUrl>)
    → onlineMeetingId  (also returns tenantId, chatId — not needed here)
```

`parse-teams-url` handles all URL-encoding edge cases (`meet/...` lite form, `meetup-join/...` full form, percent-encoded chars). Never construct the ID by hand from the URL — it will break on encoded characters.

Store `onlineMeetingId`; it's reused in T3, T5, and B1.

### T3. List available transcripts

```
mcp__Microsoft_365_Open_Beta__list-meeting-transcripts(onlineMeetingId=<onlineMeetingId>)
   → array of {id, createdDateTime, transcriptContentUrl, meetingOrganizer, ...}
```

- **Non-empty array** → proceed to T4.
- **Empty array** → meeting wasn't recorded or transcription wasn't enabled. Log `"no transcript — meeting not recorded"` and skip to next meeting. Don't retry.
- **403 Forbidden** → engineer doesn't have transcript access (most common when they weren't the organizer or a presenter). Log `"no transcript access (403)"` and skip.
- **404 Not Found** → `onlineMeetingId` didn't resolve to a real Teams meeting. Log `"meeting not found (404)"` and skip.

Never abort the full sync on a per-meeting failure here.

### T4. Match the right transcript to this occurrence

Each transcript record carries a `createdDateTime` (UTC ISO-8601). Transcription starts within ~2 minutes of the meeting's actual start time.

Matching:

1. Get the meeting's true UTC start from its `CLAUDE.md` (`Date` + `Time`, Central → UTC).
2. For each transcript in the response, compute `abs(transcript.createdDateTime - meeting_utc_start)`.
3. Pick the transcript with the smallest delta **within 15-minute tolerance**.
4. If nothing falls within tolerance → meeting wasn't recorded on this date. Log "no transcript for this date" and skip. **Do not pick the closest mismatched one** — wrong-day transcript is worse than no transcript.

### T5. Fetch the transcript content

```
mcp__Microsoft_365_Open_Beta__get-meeting-transcript-content(
    onlineMeetingId=<onlineMeetingId>,
    transcriptId=<matched id from T4>,
    format="text/vtt"
)
   → raw WEBVTT text
```

If `format` is rejected by the tool, try omitting it — some connector versions return WEBVTT by default.

Save the converted markdown to `[meeting folder]/Transcripts/transcript.md`. One transcript per meeting folder; filename is `transcript.md` (date/title already encoded in the folder name).

**WEBVTT → markdown.** Raw cue blocks:

```
00:00:10.539 --> 00:00:13.259
<v Arnold-114>Um, it was really busy. It was like, I...</v>
```

Convert to:

```markdown
# [Meeting Title] — Transcript
**Date:** YYYY-MM-DD | **Duration:** ~N min

---

**[00:00:10]** **Arnold-114:** Um, it was really busy. It was like, I...
```

Rules:
- Strip the `WEBVTT` header.
- Drop millisecond portion (`HH:MM:SS.mmm` → `HH:MM:SS`).
- Pull speaker from `<v Speaker>...</v>`. Speaker tags can span lines — use a tolerant regex.
- No speaker tag → label `(unknown)`.
- One paragraph per cue, blank line between cues.
- Duration = last cue's start time, rounded to nearest minute.

### T6. Generate the summary

300–600 words. Drop empty sections rather than leaving placeholder text. Recommended structure:

```markdown
### Key Topics Discussed
- [topic — brief summary]

### Decisions Made
- [decision]

### Action Items
- [ ] [Who] — [what] — [by when if mentioned]

### Attendee Contributions
**[Name] ([role/affiliation]):** [what they contributed]

### Key Quotes
> "[quote]" — [Speaker]

### Follow-ups / Open Questions
- [open thread]
```

The summary goes in the meeting's `## Transcript Summary` section (T7), not a separate file. Don't fabricate — if there were no action items, drop the section entirely. Mark paraphrased quotes as paraphrased.

**Speaker disambiguation.** Room cameras (`Arnold-114`, `Arnold-115`) often capture multiple humans through one mic. Don't fabricate per-person attribution — note it: "*Speaker attribution is via the Arnold-114 room mic; multiple in-room speakers are combined.*"

**Sensitive content.** Drop personal/private content (medical, family, off-topic) from Key Topics. Quote only if directly relevant.

### T7. Write the summary into `CLAUDE.md`

Use Edit (not Write) to replace the `## Transcript Summary` section with the generated summary. Including the heading in both `old_string` and `new_string` makes the match unambiguous and avoids partial-match failures.

**Construct the Edit call as follows:**

`old_string` — the heading line plus everything currently in the section body. For a fresh scaffold this is:
```
## Transcript Summary

(no transcript yet)
```
If the section already has content (overwrite case cleared by T1), read the file first and capture the exact text from `## Transcript Summary` through the next `##`-level heading or EOF, whichever comes first. Use that exact text as `old_string`.

`new_string` — the heading line, a blank line, then the summary body from T6:
```
## Transcript Summary

### Key Topics Discussed
- …

### Decisions Made
- …

### Action Items
- [ ] …

### Attendee Contributions
**Name (role):** …

### Key Quotes
> "…" — Speaker

### Follow-ups / Open Questions
- …
```
Omit any `###` subsection that has no content rather than leaving it empty. Always keep a blank line between `## Transcript Summary` and the first `###` subsection.

If the Edit call fails (whitespace difference, placeholder text differs), read the meeting's `CLAUDE.md` again, extract the exact bytes from `## Transcript Summary` to the next `##` heading or EOF, and retry with that as `old_string`.

Never touch `## Meeting Details`, `## Attendees`, `## Agenda`, `## Planner Metadata`, or any custom engineer-added sections.

### T8. Optional: surface action items as notes

- **Scheduled mode:** skip.
- **Interactive mode:** if there are substantive action items (not just "Will to review next week"), ask: "Want me to drop the action items as separate notes in the meeting's `Notes/`?"

If yes, create one note per action item (filename `action-YYYY-MM-DD-{slug}.md`), or one combined `action-items.md` if there are >5 items.

---

## Section B — Recording link

When a Teams recording exists for the meeting, append a `Recording` row to `## Meeting Details` so the engineer can click straight from the planner UI.

### B1. List recordings

```
mcp__Microsoft_365_Open_Beta__list-meeting-recordings(onlineMeetingId=...)
   → array of {id, createdDateTime, recordingContentUrl, meetingOrganizer}
```

For recurring meetings, multiple recordings exist (one per occurrence). Match by `createdDateTime` against this occurrence's UTC start within 15-minute tolerance (same as T4).

If empty or no match → no recording for this occurrence. Skip (don't write a Recording row).

### B2. Write the Recording row

Update the meeting's `## Meeting Details` table to include:

```markdown
| Recording | https://promega.sharepoint.com/.../recording.mp4 |
```

The URL goes verbatim from `recording.recordingContentUrl`. Don't try to download the binary — the URL is what the engineer wants for one-click playback in Teams/SharePoint.

**Placement in the table.** Append after `LastSynced` (last row). Use Edit, not Write — preserve header/separator and other rows.

**Don't update on every sync.** If the row already exists with a non-empty URL, leave it. Only write when first detected.

---

## Skip-everything behavior

If the Microsoft 365 Plus connector is unavailable mid-run (network blip, MCP disconnected), individual MCP calls return errors. Treat each call independently:

- T2/T3 fail → skip transcript for that meeting; log; move on.
- B1 fail → skip recording; no row written.

Never abort the whole sync because one MCP call to one meeting fails.
