/**
 * lib/fs-writer.mjs
 * Safe section-aware markdown writer.
 * Rewrites only target sections, preserves everything else verbatim.
 */

/**
 * writeClaudeMd(existingContent, updates) → string
 *
 * updates shape (all optional):
 * {
 *   // Project + shared
 *   name, description,
 *   status, priority, startDate, endDate, progress, stress, color, isMeeting,
 *   links: [{ url, label }],
 *   // Meeting-specific
 *   date, startTime, endTime, location, organizer, recurrence, meetingId, lastSynced,
 *   attendees: [{ name, email, response }],
 *   agenda, transcriptSummary,
 *   // Legacy (ignored)
 *   notes, questions
 * }
 */
export function writeClaudeMd(existingContent, updates) {
  let content = existingContent || '';

  // 1. Rewrite # Title + description paragraph
  if (updates.name !== undefined || updates.description !== undefined) {
    const titleMatch = content.match(/^#\s+.+$/m);
    if (titleMatch) {
      const afterTitle = content.slice(titleMatch.index + titleMatch[0].length);
      const firstSection = afterTitle.search(/^##\s/m);
      const descEnd = titleMatch.index + titleMatch[0].length + (firstSection === -1 ? afterTitle.length : firstSection);

      const newTitle = `# ${updates.name !== undefined ? updates.name : titleMatch[0].replace(/^#\s+/, '')}`;
      const newDesc = updates.description !== undefined
        ? (updates.description.trim() ? `\n\n${updates.description.trim()}\n\n` : '\n\n')
        : afterTitle.slice(0, firstSection === -1 ? afterTitle.length : firstSection);
      content = content.slice(0, titleMatch.index) + newTitle + newDesc + content.slice(descEnd);
    } else {
      const name = updates.name || 'Untitled';
      const desc = updates.description || '';
      content = `# ${name}\n\n${desc}\n\n` + content;
    }
  }

  // 2. Rebuild ## Planner Metadata block
  const metadataFields = ['status', 'priority', 'startDate', 'endDate', 'progress', 'stress', 'color', 'links', 'isMeeting'];
  const hasMetaUpdate = metadataFields.some(f => updates[f] !== undefined);
  if (hasMetaUpdate) {
    const existing = readSectionContent(content, 'Planner Metadata');
    const existingParsed = parseExistingMeta(existing);
    const merged = { ...existingParsed, ...pickDefined(updates, metadataFields) };
    const newMetaBody = buildMetaBody(merged);
    content = upsertSection(content, 'Planner Metadata', newMetaBody);
  }

  // 3. Meeting Details table (updated field-by-field so sync doesn't clobber unknown rows).
  if (updates.date !== undefined) content = updateMeetingTableRow(content, 'Date', updates.date);
  if (updates.startTime !== undefined || updates.endTime !== undefined) {
    const start = updates.startTime !== undefined ? updates.startTime : '';
    const end = updates.endTime !== undefined ? updates.endTime : '';
    const timeStr = start && end ? `${start} - ${end}` : (start || end || '');
    content = updateMeetingTableRow(content, 'Time', timeStr);
  }
  if (updates.location !== undefined) content = updateMeetingTableRow(content, 'Location', updates.location);
  if (updates.organizer !== undefined) content = updateMeetingTableRow(content, 'Organizer', updates.organizer);
  if (updates.recurrence !== undefined) content = updateMeetingTableRow(content, 'Recurrence', updates.recurrence);
  if (updates.meetingId !== undefined) content = updateMeetingTableRow(content, 'MeetingId', updates.meetingId);
  if (updates.lastSynced !== undefined) content = updateMeetingTableRow(content, 'LastSynced', updates.lastSynced);

  // 4. Attendees table — rebuild entirely when provided (order matters, duplicates matter, so a
  //    diff-based approach isn't worth it).
  if (updates.attendees !== undefined) {
    const body = buildAttendeesTable(updates.attendees || []);
    content = upsertSection(content, 'Attendees', body);
  }

  // 5. Agenda + Transcript Summary — full-section upserts.
  if (updates.agenda !== undefined) {
    content = upsertSection(content, 'Agenda', updates.agenda || '');
  }
  if (updates.transcriptSummary !== undefined) {
    content = upsertSection(content, 'Transcript Summary', updates.transcriptSummary || '');
  }

  // Legacy: `notes` and `questions` no longer written — live in Notes/*.md files.
  return content;
}

/** Build the `## Attendees` body from an array of {name, email, response}. */
function buildAttendeesTable(attendees) {
  const rows = ['| Name | Email | Response |', '|------|-------|----------|'];
  for (const a of (attendees || [])) {
    const name = String(a.name || '').replace(/\|/g, '\\|');
    const email = String(a.email || '').replace(/\|/g, '\\|');
    const resp = String(a.response || 'None').replace(/\|/g, '\\|');
    rows.push(`| ${name} | ${email} | ${resp} |`);
  }
  return rows.join('\n');
}

/**
 * writeContextMdNotes(existingContent, newNotes) → string
 * Rewrites only the ## Notes section. Preserves everything else verbatim.
 */
export function writeContextMdNotes(existingContent, newNotes) {
  return upsertSection(existingContent || '', 'Notes', newNotes || '');
}

/**
 * writeContextMd(existingContent, updates) → string
 * Updates meeting fields in context.md. Supports:
 *   name, date, startTime, endTime, location, notes
 * Preserves all other content verbatim.
 */
export function writeContextMd(existingContent, updates) {
  let content = existingContent || '';

  // 1. Update # Title
  if (updates.name !== undefined) {
    const titleMatch = content.match(/^#\s+.+$/m);
    if (titleMatch) {
      content = content.slice(0, titleMatch.index) + `# ${updates.name}` + content.slice(titleMatch.index + titleMatch[0].length);
    } else {
      content = `# ${updates.name}\n\n` + content;
    }
  }

  // 2. Update Meeting Details table rows
  if (updates.date !== undefined) {
    content = updateMeetingTableRow(content, 'Date', updates.date);
  }
  if (updates.startTime !== undefined || updates.endTime !== undefined) {
    // Build time string from startTime / endTime (HH:MM 24hr)
    const start = updates.startTime !== undefined ? updates.startTime : '';
    const end = updates.endTime !== undefined ? updates.endTime : '';
    const timeStr = start && end ? `${start} - ${end}` : (start || end || '');
    content = updateMeetingTableRow(content, 'Time', timeStr);
  }
  if (updates.location !== undefined) {
    content = updateMeetingTableRow(content, 'Location', updates.location);
  }

  // Notes now live in Notes/*.md files — ignore updates.notes here.

  return content;
}

/**
 * Update a single row in a Meeting Details markdown table.
 * Matches both `| Field |` and `| **Field** |` formats (case-insensitive).
 * Preserves the field cell, replaces only the value cell.
 */
function updateMeetingTableRow(content, fieldName, value) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(\\|\\s*\\*{0,2}${escaped}\\*{0,2}\\s*\\|)[^|\\n]*\\|`, 'i');
  if (re.test(content)) {
    return content.replace(re, `$1 ${value} |`);
  }
  return content;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read the content of a ## Section (between header and next ## or EOF). */
function readSectionContent(content, sectionHeader) {
  const escaped = sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^##\\s+${escaped}\\s*$`, 'm');
  const match = re.exec(content);
  if (!match) return '';
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextSection = rest.search(/^##\s/m);
  return nextSection === -1 ? rest : rest.slice(0, nextSection);
}

/**
 * Replace the content of `## SectionHeader` in `content`.
 * If the section doesn't exist, append it at the end.
 * Returns the new full content string.
 */
function upsertSection(content, sectionHeader, newBody) {
  const escaped = sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^##\\s+${escaped}\\s*$)([\\s\\S]*?)(?=^##\\s|$(?!\\n))`, 'm');
  // Use a multiline approach: find the header line, then replace through to next ## or EOF
  const headerRe = new RegExp(`^(##\\s+${escaped})\\s*$`, 'm');
  const headerMatch = headerRe.exec(content);

  const bodyBlock = newBody ? `\n\n${newBody.trim()}\n\n` : '\n\n';

  if (!headerMatch) {
    // Section doesn't exist — append
    const trimmed = content.trimEnd();
    return trimmed + `\n\n## ${sectionHeader}\n\n${newBody ? newBody.trim() + '\n' : ''}`;
  }

  const headerEnd = headerMatch.index + headerMatch[0].length;
  const rest = content.slice(headerEnd);
  const nextSection = rest.search(/^##\s/m);
  const sectionBodyEnd = headerEnd + (nextSection === -1 ? rest.length : nextSection);

  return content.slice(0, headerEnd) + bodyBlock + content.slice(sectionBodyEnd);
}

/** Parse existing Planner Metadata section back into an object. */
function parseExistingMeta(raw) {
  const result = { status: 'on-track', priority: 'medium', startDate: '', endDate: '', progress: 0, stress: 0, color: '#3b82f6', originalLocation: '', links: [], isMeeting: false };
  if (!raw) return result;
  const lines = raw.split('\n');
  let inLinks = false;
  let currentLink = {};
  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      inLinks = false;
      const [, k, v] = kv;
      if (k === 'status') result.status = v.trim();
      else if (k === 'priority') result.priority = v.trim();
      else if (k === 'startDate') result.startDate = v.trim();
      else if (k === 'endDate') result.endDate = v.trim();
      else if (k === 'progress') result.progress = parseInt(v.trim(), 10) || 0;
      else if (k === 'stress') result.stress = parseInt(v.trim(), 10) || 0;
      else if (k === 'color') result.color = v.trim();
      else if (k === 'originalLocation') result.originalLocation = v.trim();
      else if (k === 'isMeeting') result.isMeeting = v.trim().toLowerCase() === 'true';
      else if (k === 'links') { result.links = []; inLinks = true; }
    } else if (inLinks) {
      const urlMatch = line.match(/^\s+-\s+url:\s*(.+)$/);
      const labelMatch = line.match(/^\s+label:\s*(.+)$/);
      if (urlMatch) {
        if (currentLink.url) result.links.push(currentLink);
        currentLink = { url: urlMatch[1].trim(), label: '' };
      } else if (labelMatch && currentLink.url) {
        currentLink.label = labelMatch[1].trim();
      }
    }
  }
  if (currentLink.url) result.links.push(currentLink);
  return result;
}

/** Serialize merged metadata back to YAML-style block string. */
function buildMetaBody(meta) {
  let out = `status: ${meta.status || 'on-track'}\n`;
  out += `priority: ${meta.priority || 'medium'}\n`;
  out += `startDate: ${meta.startDate || ''}\n`;
  out += `endDate: ${meta.endDate || ''}\n`;
  out += `progress: ${meta.progress ?? 0}\n`;
  out += `stress: ${meta.stress ?? 0}\n`;
  out += `color: ${meta.color || '#3b82f6'}\n`;
  if (meta.originalLocation) out += `originalLocation: ${meta.originalLocation}\n`;
  if (meta.isMeeting) out += `isMeeting: true\n`;
  out += `links:\n`;
  if (meta.links && meta.links.length > 0) {
    for (const link of meta.links) {
      out += `  - url: ${link.url}\n    label: ${link.label || ''}\n`;
    }
  }
  return out.trimEnd();
}

/** Return a new object with only the specified keys that are defined in source. */
function pickDefined(source, keys) {
  const result = {};
  for (const k of keys) {
    if (source[k] !== undefined) result[k] = source[k];
  }
  return result;
}
