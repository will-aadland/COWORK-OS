# meeting-sync — Post-meeting ingest (Microsoft 365 Plus)

Sub-reference loaded conditionally from `SKILL.md` Step 7 when meetings need post-meeting enrichment. Covers two related operations that happen on the same trigger (after a meeting fires):

- **A. Transcript ingest** — primary purpose; T1–T8.
- **B. Recording link** — when a Teams recording exists; appends to `## Meeting Details`.

All MCP calls below target the **Microsoft 365 Plus connector** (`mcp__Microsoft_365_Open_Beta__*`). All are read-only and auto-allowed; no permission prompts. If the Microsoft 365 Plus connector isn't connected, skip the entire file and log "post-meeting enrichment skipped — Microsoft 365 Plus not connected" in scheduled mode, or offer to connect it in interactive mode.

Skip loading this file entirely when Step 7 has nothing queued (scheduled run found no last-workday meetings, or interactive run chose "Skip enrichment this run").

> **Note on `## Attendees`.** The Attendees table (`Name | Email | Response`) is populated at meeting-scaffold time from the event payload (`event.attendees[i].emailAddress.{name,address}` plus `attendee.status.response`). It is *not* post-meeting data — see `SKILL.md` § 4.6 "Attendees table on create". This file does not touch `## Attendees`.

---

## Section A — Transcript ingest (T1–T8)

For each meeting queued for transcript pull, work through T1–T8 in order. Stop early on "no transcripts" or "not a Teams meeting" — don't fail the whole sync.

### T1. Check for an existing transcript summary

Read the meeting's `CLAUDE.md` `## Transcript Summary` section. If already populated (not the placeholder `(no transcript yet)`):

- **Scheduled mode:** skip (don't overwrite).
- **Interactive mode:** ask "Transcript already summarized for [meeting]. Re-pull and overwrite?" If no, skip.

### T2. Resolve the `onlineMeetingId`

The meeting's `CLAUDE.md` `## Meeting Details` table has a `MeetingId` row — that's the Outlook event ID, not the Teams online-meeting ID. They're different. Convert:

```
mcp__Microsoft_365_Open_Beta__get-calendar-event(eventId=MeetingId)
   → response.onlineMeeting.joinUrl       (or .joinWebUrl on some Graph versions)
```

- If `onlineMeeting` is absent or `joinUrl` is empty/null → not a Teams meeting (in-person, Zoom, external). Skip with reason `no online meeting`.

Then convert the join URL to the canonical online-meeting ID:

```
mcp__Microsoft_365_Open_Beta__parse-teams-url(url=joinUrl)
   → returns onlineMeetingId (and tenantId, chatId, etc.)
```

`parse-teams-url` handles all the URL-encoding edge cases (lite `meet/...` vs full `meetup-join/...` form, percent-encoded chars). Don't construct the URI manually.

### T3. List available transcripts

```
mcp__Microsoft_365_Open_Beta__list-meeting-transcripts(onlineMeetingId)
   → array of {id, createdDateTime, transcriptContentUrl, meetingOrganizer, ...}
```

- **Empty array** → meeting wasn't recorded. Log "no transcript available — meeting not recorded" and skip to the next meeting. Don't retry; don't error the whole sync.
- **Permission error** (403/404) → engineer doesn't have access (most common when they didn't organize and weren't a presenter). Log "no transcript access" and skip.

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
    onlineMeetingId=...,
    transcriptId=<matched id from T4>,
    format="text/vtt"
)
   → raw WEBVTT text
```

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

Edit the meeting's `CLAUDE.md` to replace only the `## Transcript Summary` section body. Use Edit (not Write). Replace content between `## Transcript Summary` and the next heading (or EOF). Never touch other sections.

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
