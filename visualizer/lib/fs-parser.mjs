/**
 * lib/fs-parser.mjs
 * Markdown parsing utilities for CLAUDE.md (projects) and context.md (meetings).
 * No external dependencies — pure regex / string splitting.
 */

/**
 * Extract content of a ## Section from markdown.
 * Returns everything between `## sectionHeader` and the next `##` (or EOF), trimmed.
 */
export function parseSectionContent(content, sectionHeader) {
  const escaped = sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^##\\s+${escaped}\\s*$`, 'm');
  const match = re.exec(content);
  if (!match) return '';
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextSection = rest.search(/^##\s/m);
  const raw = nextSection === -1 ? rest : rest.slice(0, nextSection);
  return raw.trim();
}

/**
 * Parse a CLAUDE.md file → project (or meeting) object.
 *
 * Meeting-specific fields (date, startTime, endTime, attendees, agenda,
 * transcriptSummary, …) are extracted when `## Meeting Details` / `## Attendees`
 * / `## Transcript Summary` sections exist in the file. For project CLAUDE.md
 * files those sections are absent, so the meeting fields come back as empty
 * defaults and callers ignore them.
 */
export function parseClaudeMd(content) {
  // -- Title --
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const name = titleMatch ? titleMatch[1].trim() : 'Untitled Project';

  // -- Description (text between # Title and first ##) --
  let description = '';
  if (titleMatch) {
    const afterTitle = content.slice(titleMatch.index + titleMatch[0].length);
    const firstSection = afterTitle.search(/^##\s/m);
    const descRaw = firstSection === -1 ? afterTitle : afterTitle.slice(0, firstSection);
    description = descRaw.trim();
  }

  // -- Planner Metadata --
  const metaRaw = parseSectionContent(content, 'Planner Metadata');
  let status = 'on-track';
  let priority = 'medium';
  let startDate = '';
  let endDate = '';
  let progress = 0;
  let stress = 0;
  let color = '#3b82f6';
  let links = [];
  let isMeeting = false;

  let originalLocation = '';

  if (metaRaw) {
    const lines = metaRaw.split('\n');
    let inLinks = false;
    let currentLink = {};
    for (const line of lines) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) {
        inLinks = false;
        const [, k, v] = kv;
        if (k === 'status') status = v.trim();
        else if (k === 'priority') priority = v.trim();
        else if (k === 'startDate') startDate = v.trim();
        else if (k === 'endDate') endDate = v.trim();
        else if (k === 'progress') progress = parseInt(v.trim(), 10) || 0;
        else if (k === 'stress') stress = parseInt(v.trim(), 10) || 0;
        else if (k === 'color') color = v.trim();
        else if (k === 'originalLocation') originalLocation = v.trim();
        else if (k === 'isMeeting') isMeeting = v.trim().toLowerCase() === 'true';
        else if (k === 'links') inLinks = true;
      } else if (inLinks) {
        const urlMatch = line.match(/^\s+-\s+url:\s*(.+)$/);
        const labelMatch = line.match(/^\s+label:\s*(.+)$/);
        if (urlMatch) {
          if (currentLink.url) links.push(currentLink);
          currentLink = { url: urlMatch[1].trim(), label: '' };
        } else if (labelMatch && currentLink.url) {
          currentLink.label = labelMatch[1].trim();
        }
      }
    }
    if (currentLink.url) links.push(currentLink);
  }

  // -- Notes (legacy) --
  const notes = parseSectionContent(content, 'Notes');

  // -- Questions & Blockers (legacy) --
  const questions = parseSectionContent(content, 'Questions & Blockers');

  // -- Meeting fields (populated only if Meeting Details section exists) --
  const detailsRaw = parseSectionContent(content, 'Meeting Details');
  const details = parseKVTable(detailsRaw);
  const dateRaw = (details['date'] || '').replace(/\*\*/g, '').trim();
  const date = normalizeDate(dateRaw);
  const timeRaw = (details['time'] || '').replace(/\*\*/g, '').trim();
  let startTime = '', endTime = '';
  if (timeRaw) {
    const parts = timeRaw.split(/\s*[–—-]\s*/);
    startTime = normalizeTime(parts[0] || '');
    endTime = normalizeTime(parts[1] || '');
  }
  const mtgLocation = (details['location'] || '').replace(/\*\*/g, '').trim();
  const organizer = (details['organizer'] || '').replace(/\*\*/g, '').trim();
  const recurrenceRaw = (details['recurrence'] || 'One-time').replace(/\*\*/g, '').trim();
  const meetingId = (details['meetingid'] || details['meeting id'] || '').replace(/\*\*/g, '').trim();
  const lastSynced = (details['lastsynced'] || details['last synced'] || '').replace(/\*\*/g, '').trim();
  const { recurrence, isRecurringInstance } = mapRecurrence(recurrenceRaw);
  const attendees = parseAttendeesTable(parseSectionContent(content, 'Attendees'));
  const agenda = parseSectionContent(content, 'Agenda');
  const transcriptSummary = parseSectionContent(content, 'Transcript Summary');

  // Infer isMeeting when the metadata flag is absent but meeting sections are present.
  const hasMeetingSections = !!detailsRaw || !!attendees.length || !!transcriptSummary;
  if (!isMeeting && hasMeetingSections) isMeeting = true;

  // -- Preserve all other sections verbatim --
  const knownSections = [
    'Planner Metadata', 'Notes', 'Questions & Blockers',
    'Meeting Details', 'Attendees', 'Agenda', 'Transcript Summary',
  ];
  const rawOtherSections = extractOtherSections(content, knownSections);

  return {
    name, description,
    status, priority, startDate, endDate, progress, stress, color, originalLocation, links,
    notes, questions,
    // Meeting fields — defaulted for projects, populated for meetings.
    isMeeting,
    date, startTime, endTime,
    location: mtgLocation,
    organizer, recurrence, isRecurringInstance,
    attendees, agenda, transcriptSummary,
    meetingId, lastSynced,
    rawOtherSections,
  };
}

/**
 * @deprecated — kept for callers that haven't migrated yet. parseClaudeMd now
 * extracts all meeting fields. This wrapper returns the legacy meeting shape
 * (with `title` instead of `name`) so existing code keeps working.
 */
export function parseContextMd(content) {
  const parsed = parseClaudeMd(content);
  return {
    title: parsed.name,
    description: parsed.description,
    date: parsed.date,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    location: parsed.location,
    organizer: parsed.organizer,
    recurrence: parsed.recurrence,
    isRecurringInstance: parsed.isRecurringInstance,
    attendees: parsed.attendees,
    agenda: parsed.agenda,
    notes: parsed.notes,
    transcriptSummary: parsed.transcriptSummary,
    meetingId: parsed.meetingId,
    lastSynced: parsed.lastSynced,
    // Planner metadata fields used by the UI (calendar chip color, status, etc.)
    status: parsed.status,
    priority: parsed.priority,
    color: parsed.color,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    progress: parsed.progress,
    stress: parsed.stress,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parse a `| Field | Value |` markdown table into a lowercased-key object. */
function parseKVTable(raw) {
  const result = {};
  if (!raw) return result;
  for (const line of raw.split('\n')) {
    if (!line.includes('|')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    // Skip separator rows like |---|---|
    if (/^[-:]+$/.test(cells[0])) continue;
    const key = cells[0].replace(/\*\*/g, '').toLowerCase().trim();
    const value = cells[1];
    if (key && value) result[key] = value;
  }
  return result;
}

/** Parse `| Name | Email | Response |` attendees table → array of objects. */
function parseAttendeesTable(raw) {
  const attendees = [];
  if (!raw) return attendees;
  let header = null;
  for (const line of raw.split('\n')) {
    if (!line.includes('|')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    if (/^[-:]+$/.test(cells[0])) continue;
    if (!header) {
      header = cells.map(c => c.toLowerCase());
      continue;
    }
    const nameIdx = header.findIndex(h => h.includes('name'));
    const emailIdx = header.findIndex(h => h.includes('email'));
    const responseIdx = header.findIndex(h => h.includes('response'));
    attendees.push({
      name: (cells[nameIdx] || '').replace(/\*\*/g, '').trim(),
      email: (cells[emailIdx] || '').replace(/\*\*/g, '').trim(),
      response: (cells[responseIdx] || 'None').replace(/\*\*/g, '').trim()
    });
  }
  return attendees;
}

/** Normalize date strings — pad missing leading zeros to produce YYYY-MM-DD */
function normalizeDate(raw) {
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return raw;
}

/** Normalize time strings like "8:00 AM CT" → "08:00" */
function normalizeTime(raw) {
  if (!raw) return '';
  const m = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return raw.trim();
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = (m[3] || '').toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/** Map context.md Recurrence field value to internal enum. */
function mapRecurrence(raw) {
  const lower = raw.toLowerCase();
  if (lower.includes('weekly')) return { recurrence: 'weekly', isRecurringInstance: false };
  if (lower.includes('bi-weekly') || lower.includes('biweekly')) return { recurrence: 'biweekly', isRecurringInstance: false };
  if (lower.includes('daily')) return { recurrence: 'custom', isRecurringInstance: false };
  if (lower.includes('recurring series instance')) return { recurrence: 'none', isRecurringInstance: true };
  return { recurrence: 'none', isRecurringInstance: false };
}

/**
 * Collect all ## sections NOT in the knownSections list, preserving them verbatim.
 * Returns a string of those sections concatenated.
 */
function extractOtherSections(content, knownSections) {
  const knownSet = new Set(knownSections.map(s => s.toLowerCase()));
  // Split by ## headers
  const parts = content.split(/^(##\s+.+)$/m);
  let result = '';
  for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i]; // e.g. "## Some Section"
    const body = parts[i + 1] || '';
    const headerName = header.replace(/^##\s+/, '').trim().toLowerCase();
    if (!knownSet.has(headerName)) {
      result += header + body;
    }
  }
  return result.trim();
}
