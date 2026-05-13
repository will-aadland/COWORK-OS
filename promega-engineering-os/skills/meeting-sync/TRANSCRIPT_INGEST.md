# meeting-sync — Transcript Ingest Reference

Sub-reference loaded conditionally from `SKILL.md` Step 7 (transcript pull). If a sync run has no transcripts to pull (scheduled run with no last-workday meetings, or the engineer picks "Skip transcripts this run"), this file does not need to be loaded.

For each meeting identified for transcript pull, work through T1–T8 in order. Stop early on `NOT_FOUND` or "no `meetingTranscriptUrl`" without erroring the whole sync.

---

## T1. Check for an existing transcript summary

Read the meeting's CLAUDE.md `## Transcript Summary` section. If it's already populated (not the placeholder `(no transcript yet)`):

- **Scheduled mode:** skip (don't overwrite).
- **Interactive mode:** ask "Transcript already summarized for [meeting]. Re-pull and overwrite?" If no, skip.

## T2. Get the transcript URL from the event

The transcript-fetching path in this MCP is **not obvious** — there is no dedicated transcript tool. Instead:

1. Read the meeting's calendar event with `read_resource` and the URI `calendar:///events/{MeetingId}` (the `MeetingId` is in the meeting's `## Meeting Details` table — it's the `id` field from the original Outlook search).
2. The response includes a field called **`meetingTranscriptUrl`** that is already pre-formatted as a `meeting-transcript:///events/<URL-encoded-joinWebUrl>` URI ready to pass back to `read_resource`. **Use this verbatim.** Do not try to construct it manually from the event body or `webLink` — those are not the same URL.
3. If `meetingTranscriptUrl` is absent or empty, this isn't a Teams meeting (in-person, Zoom, or a calendar block). Skip with reason "no online meeting" — log in scheduled mode, tell the engineer in interactive mode.

**Why not construct the URI manually?** The schema spec says `meeting-transcript:///events/{joinWebUrl}` but the parser is fragile — embedded `:` / `/` / `?` need URL-encoding, and the joinWebUrl in event bodies is sometimes the lite `meet/...` form vs. the full `meetup-join/...` form. Letting `meetingTranscriptUrl` give it to you pre-formatted avoids all of that.

## T3. Fetch the transcript bundle

Call `read_resource` with the `meetingTranscriptUrl` from T2.

**Response shape on success** (verified):

```json
{
  "meeting": {
    "id": "...",
    "subject": "ArC Scrum",
    "startDateTime": "2026-04-20T13:00:00.000Z",
    "endDateTime": "2026-04-20T13:30:00.000Z",
    "joinWebUrl": "https://teams.microsoft.com/l/meetup-join/..."
  },
  "transcripts": [
    { "id": "<base64>", "content": "WEBVTT\r\n\r\n00:00:10.539 --> ..." }
  ]
}
```

**Critical: `meeting.startDateTime` is the series origin**, not the specific occurrence. For a daily-recurring meeting like ArC Scrum, calling this for any instance returns the same `meeting` block referencing the very first occurrence. **Do not use it to identify which transcript belongs to today.**

**Response can be huge** — a recurring meeting with N recorded occurrences accumulates N transcripts on the same join URL. The 4/27 ArC Scrum returned 6 transcripts totaling 176K characters. Fall back to the `jq + fromjson` pattern from SKILL.md Step 2.1 when the response overflows.

**Failure mode: `NOT_FOUND`.** When a meeting has `meetingTranscriptUrl` set but Teams has zero transcripts for the underlying URL:

```json
{"code": "NOT_FOUND", "message": "NOT_FOUND: No transcripts available for meeting: <id>"}
```

This is the most common failure for one-off Teams meetings that weren't recorded. Log "no transcript available — meeting not recorded" and skip to the next meeting. **Do not** retry or error out the whole sync. Don't conflate this with "no `meetingTranscriptUrl` field" (T2 path) — that one means it isn't even a Teams meeting.

## T4. Match the right transcript to the meeting occurrence

Each transcript ID has a Unix timestamp embedded near the end. Decode it:

```python
import base64, re
def extract_timestamp(transcript_id: str) -> int | None:
    padded = transcript_id + '=' * (4 - len(transcript_id) % 4)
    decoded = base64.urlsafe_b64decode(padded.replace('-', '+').replace('_', '/'))
    printable = ''.join(chr(b) if 32 <= b < 127 else '.' for b in decoded)
    m = re.search(r'(177\d{7})-TranscriptV2', printable)
    return int(m.group(1)) if m else None
```

The timestamp is when transcription started — usually within ~2 minutes of the meeting's actual start.

**Matching logic:**

1. Get the meeting's true UTC start from CLAUDE.md (`Date` + `Time` converted from Central back to UTC) or from the calendar event from T2.
2. For each transcript in the response, extract its embedded timestamp.
3. Pick the one whose timestamp is closest to the meeting start, **within 15-minute tolerance**.
4. If nothing falls within tolerance, the meeting wasn't recorded — log "no transcript for this date" and skip. **Do not pick the closest mismatched one.** Wrong day's transcript is worse than no transcript.

The `177xxxxxxx` regex matches Unix timestamps in the `1.77e9` range (Mar 2026 → Aug 2026). Generalize to `\d{10}` for other date ranges, but be aware other 10-digit numbers may be embedded in the ID.

## T5. Save the raw transcript

Write the cleaned transcript to `[meeting folder]/Transcripts/transcript.md`. Filename is `transcript.md` (not `YYYY-MM-DD [Title].vtt`) — the folder name already encodes date and title. One transcript per meeting folder.

**WEBVTT → markdown conversion.** Raw content has cue blocks like:

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
- Strip `WEBVTT` header.
- Drop milliseconds (`HH:MM:SS.mmm` → `HH:MM:SS`).
- Pull speaker from `<v Speaker>...</v>`. Speaker tags can wrap multiple lines — use a tolerant regex.
- No speaker tag → label `(unknown)`.
- One paragraph per cue, blank line between cues.
- Duration = last cue's start time, rounded to nearest minute.

## T6. Generate the summary

300–600 words. Drop empty sections rather than leaving placeholder text. Recommended structure, in order:

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

The summary goes in the meeting's `## Transcript Summary` section in CLAUDE.md (T7), not a separate file. Don't fabricate — if there were no action items, drop the section entirely. Mark paraphrased quotes as paraphrased.

**Speaker disambiguation.** Room cameras (`Arnold-114`, `Arnold-115`) often capture multiple humans through one mic. Don't fabricate per-person attribution — note it: "*Speaker attribution is via the Arnold-114 room mic; multiple in-room speakers are combined.*"

**Sensitive content.** Drop personal/private content (medical, family, off-topic) from Key Topics. Quote them only if directly relevant.

## T7. Write the summary into CLAUDE.md

Edit the meeting's CLAUDE.md to replace only the `## Transcript Summary` section body. Use Edit (not Write). Replace content between `## Transcript Summary` and the next heading (or end of file). Never touch other sections.

## T8. Optional: surface action items as notes

- **Scheduled mode:** skip.
- **Interactive mode:** if there are substantive action items (not just "Will to review next week"), ask: "Want me to drop the action items as separate notes in the meeting's `Notes/`?"

If yes, create one note per action item (filename: `action-YYYY-MM-DD-{slug}.md`), or one combined `action-items.md` if there are >5 items.
