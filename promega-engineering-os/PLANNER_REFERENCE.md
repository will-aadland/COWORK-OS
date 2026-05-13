# Promega Project Planner V3 — Plugin-Wide Reference

This is the canonical reference for the Promega Project Planner V3 (the "Visualizer") and the `promega-engineering-os` plugin that integrates with it. Every skill in this plugin assumes you have read it.

The first half is a human-readable installation and architecture tour. The second half is reference material for Claude (running as Cowork) to use when writing or reading planner data.

> **Conflict resolution.** If anything in this guide contradicts the actual planner code, **the code wins**. The on-disk schema is the contract; the UI is the visualization.

---

## 0. TL;DR

| Question | Answer |
|---|---|
| What is it? | A Windows desktop app that visualizes a folder tree on disk (projects, meetings, notes, files) as a calendar / list / file-browser UI. |
| What's underneath? | Plain markdown plus folders. No database. The filesystem **is** the schema. |
| What is it built on? | Electron, with everything (file I/O, file watcher, UI) running inside the Electron app itself. **No separate localhost server, no HTTP API.** |
| Where do I install it? | Run `Promega Project Planner Setup 3.0.5.exe` (Windows, per-user install). |
| How do I open it? | Desktop shortcut or Start menu shortcut. **There is no localhost URL to visit.** |
| How does Cowork plug in? | Cowork (Claude) reads and writes the same folders directly via the file system. It does not talk to the Visualizer over HTTP. |
| Where does it live on disk? | Source: anywhere. User data: a folder you choose at first launch (typically `Personal Workspace/`). |
| How does it update? | Manual. There is no auto-updater. Distribute a new `.exe`. |

---

## 1. Distribution: how to send the planner to engineers

### 1.1 What you ship

```
dist-app/Promega Project Planner Setup 3.0.5.exe   (~78 MB)
```

That's a self-contained NSIS installer with Electron, Chromium, and the UI all bundled. Recipients don't need Node or any other runtime installed.

### 1.2 How recipients install

1. Save the `.exe` somewhere local (Downloads is fine).
2. Double-click. If Windows SmartScreen complains (the build is unsigned), click **More info**, then **Run anyway**.
3. NSIS installer opens:
   - Choose install location (defaults to `%LOCALAPPDATA%\Programs\Promega Project Planner`).
   - Optionally tick "Create desktop shortcut" or "Create Start menu shortcut".
4. Click Install. Takes about 10 seconds.
5. Launch from the Start menu or desktop shortcut.

### 1.3 First-run setup

The app expects a workspace folder containing `Projects/`, `Meetings/`, etc. Each engineer picks their own.

On first launch, the Visualizer shows a config screen if `config.json` is missing or empty. Steps:

1. Click **Choose folder** (uses the native Windows folder picker).
2. Point it at the workspace root, for example `C:\Users\<you>\OneDrive\Desktop\CoworkOS\Personal Workspace`.
3. The Visualizer auto-detects subfolders matching the canonical layout (`Projects/`, `Change Controls/`, `Meetings/`). Missing folders are created.
4. Click **Save**. The Visualizer reloads against the new root.

> **OneDrive tip.** If the workspace lives in OneDrive, files may be cloud-only. The first read on each file triggers a hydration pause (1 to 2 seconds). Subsequent reads are local-fast.

### 1.4 Distribution channels

| Channel | When to use | Notes |
|---|---|---|
| Email attachment | Small teams (10 or fewer) | 78 MB may bounce off some Outlook policies. |
| OneDrive / SharePoint share | Most reliable internal channel | Drop the `.exe` in a shared folder, send the link. |
| Network share | Office network | Easiest if everyone has access. |
| Teams chat | Quick distribution | Teams allows up to 250 MB attachments. |
| Internal package portal (Software Center, Intune) | Enterprise rollout | Works once IT signs the executable for AppLocker. |

### 1.5 Updating an existing install

There is no auto-updater. To upgrade users from one version to the next:

- Send them the new `.exe`.
- They run it. NSIS detects the previous install, replaces files in place, preserves their `config.json` (it lives in `%APPDATA%\Promega Project Planner\`, outside the install dir).
- No data loss.

### 1.6 Uninstalling

- Settings, Apps, Installed apps, Promega Project Planner, Uninstall.
- Or run `%LOCALAPPDATA%\Programs\Promega Project Planner\Uninstall Promega Project Planner.exe`.

User data (the workspace folder) is never touched by uninstall. `config.json` (in `%APPDATA%`) is also preserved unless the user picks "remove user data" at uninstall.

### 1.7 Bumping version and rebuilding (developer-only)

```powershell
# 1. Edit package.json: bump "version" (semver)
# 2. Build:
npm run dist
# 3. Result lands at dist-app\Promega Project Planner Setup <version>.exe
```

**Why bump the version?** NSIS and Windows treat same-version installers as identical and may shortcut the install. Always bump before redistributing.

---

## 2. What the app actually does

The Visualizer is a **read-write visualizer** of a folder tree. Open the app, see your projects on a calendar, click into one, edit notes, attach files, run summaries. Save. Your changes hit the disk.

### 2.1 Six top-level views (tabs across the top)

| Tab | What it shows |
|---|---|
| **Calendar** | Month grid with project bars and meeting chips colored by priority or title hash. |
| **All Projects** | Filterable list of every project in the configured project mounts (active and archived). |
| **All Meetings** | Date-sorted list of every folder in the meetings mount. |
| **Files** | Recursive file browser rooted at the configured "files" mount. Drag-drop, preview, edit. |
| **Summaries** | Time-window summary builder. Pull notes and meetings from a date range, draft a weekly or monthly digest, save it as a markdown file. |
| **Settings** | Configure the workspace root, project mounts, priority colors. |

### 2.2 Detail views

Clicking a project or meeting opens a **detail view** with sub-tabs.

| Sub-tab | Purpose | Available on |
|---|---|---|
| **Details** | Title, description, status, priority, dates, progress, color, links. Editing any field writes to the project's `CLAUDE.md`. | Both |
| **Notes** | Card grid of all `.md` files in `Notes/`. Click a card to edit inline. | Both |
| **Chat Summaries** | Card grid of all `.md` files in `Chat Summaries/`. Same UX as Notes but a separate folder so Cowork-written content stays distinct from human notes. | **Projects only** |
| **Files** | Sidebar tree plus main pane. Browse, edit, preview (md, docx, xlsx, pdf, images, code with syntax highlighting). | Both |

Meetings have a **Transcript Summary** pane on the Details tab instead of a Chat Summaries sub-tab. Chat summaries belong to projects, not meetings.

### 2.3 Three feature highlights

| Feature | How to use |
|---|---|
| **Show in Folder** | Click the folder icon next to a project or meeting title (or beside the Refresh button in any Files sidebar) to open Windows Explorer at that folder. Right-click any file or folder in the tree for the same option. Files are revealed via `explorer /select,…`. |
| **Spell-check menu** | Right-click any underlined misspelled word to see suggestions, replace inline, or "Add to Dictionary". Native Chromium spellcheck via Electron. |
| **Sidebar drag-drop** | Drag any file from File Explorer or Desktop onto the Files sidebar (anywhere: header, search, footer, body, or onto a specific folder row) and it uploads to that folder. CSV, docx, pdf, images: all binary types supported. |

---

## 3. Architecture

The Visualizer is a single-process Electron desktop app. There is no separate Node HTTP server, no localhost URL, no API. Everything lives inside the Electron app.

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron app (single process model)                            │
│                                                                 │
│  Main process                                                   │
│    - Native Windows menu, tray, shortcuts                       │
│    - File system reads and writes (chokidar watcher)            │
│    - Workspace config, ui-state.json                            │
│                                                                 │
│  Renderer process (BrowserWindow)                               │
│    - Promega.Project.Planner.V3.html (single-file UI)           │
│    - Talks to main via Electron IPC, not HTTP                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ direct fs reads/writes
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Workspace folder (OneDrive, local, or network)                 │
│   ├── Projects/           ├── Change Controls/                  │
│   │     └── <Name>/...    │     └── <Name>/...                  │
│   ├── Meetings/                                                 │
│   │     └── YYYY-MM-DD — Title/...                              │
│   └── (any other files browsable from the Files tab)            │
└─────────────────────────────────────────────────────────────────┘
                                ▲
                                │ direct fs reads/writes
                                │
┌─────────────────────────────────────────────────────────────────┐
│  Cowork (Claude desktop / chat)                                 │
│   - Reads the same folders via Read/Glob/Bash                   │
│   - Writes via Write/Edit                                       │
│   - Does NOT talk to the Visualizer; both read the same disk    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Process model

- **Main process**: file I/O, the chokidar file watcher, native menus and shortcuts. Owns `config.json` and `ui-state.json` in `%APPDATA%`.
- **Renderer process**: the BrowserWindow that hosts the UI. Calls into main via `ipcRenderer` for any disk operation.

There is no child Node process. There is no HTTP server. There is no `server.mjs`. Earlier versions (3.0.0 to 3.0.4) shipped with a separate Node HTTP server bound to `localhost:3000`; that has been removed.

### 3.2 Where the user's data lives in the packaged app

| Path | Purpose |
|---|---|
| `%LOCALAPPDATA%\Programs\Promega Project Planner\` | The app itself (read-only after install). |
| `%APPDATA%\Promega Project Planner\config.json` | Workspace root, section paths, priority colors. Survives reinstall. |
| `%APPDATA%\Promega Project Planner\tasks.json` | Reserved for in-app task list (currently unused). |
| `%APPDATA%\Promega Project Planner\ui-state.json` | UI persistence (sidebar widths, last-open tab, etc.). |
| The workspace folder | All user content. The user picks the path. |

### 3.3 The single-HTML-file UI

`Promega.Project.Planner.V3.html` is about 5,000 lines. It is intentionally one file: no bundler, no build step, easy to ship.

| Lines (approx) | Section |
|---|---|
| 1 to 1300 | CSS: design tokens, layout, components. |
| 1300 to 2100 | HTML: every view marked up at once, hidden until activated. |
| 2100 to 5050 | JavaScript: view router, state, IPC wrappers, all interaction handlers. |

Functions are namespaced by prefix:
- `wv*`: workspace viewer (the project / meeting / files detail UI shared by all three).
- `pv*`, `mv*`, `gv*`: DOM IDs scoped to project, meeting, global-files views.
- `S.*`: top-level state (`S.projects`, `S.meetings`).

### 3.4 Live reload

The Electron main process runs a chokidar watcher over the workspace. When a file changes (an external editor, Cowork, OneDrive sync), main forwards the event to the renderer over IPC. The renderer decides whether the change affects the current view and refetches only that data. Result: edit a `.md` file in VS Code or Cowork, see the change in the Visualizer within about 200 ms. No refresh, no reload step.

This live-reload path is the primary integration point between Cowork and the Visualizer. Cowork writes to disk; the watcher picks it up; the UI updates.

---

## 4. Filesystem schema (the source of truth)

The Visualizer has no database. Everything you see in the UI is parsed from these files at request time. Cowork must respect this schema; deviating produces invisible files or breaks parsing.

### 4.1 Workspace root layout

```
[workspace root]/
├── Projects/                           # one project mount
│   ├── <Project Name>/
│   └── Completed/                      # archive (auto-managed)
├── Change Controls/                    # second project mount (CCs)
│   ├── CC<NNNNN> - <Title>/
│   └── Completed/
├── Meetings/
│   └── YYYY-MM-DD — <Meeting Title>/
└── (any other files / folders, browsable in the Files tab)
```

Mounts are configurable. The Visualizer's defaults are `Projects/` plus `Change Controls/`, but a user can add or rename mounts via Settings. The `promega-engineering-os` plugin scaffolds an extended mount model (see Section 5).

### 4.2 Project folder schema

```
<Project Name>/
├── CLAUDE.md         # title + description + ## Planner Metadata
├── Notes/            # one .md per note (free-form)
├── Chat Summaries/   # one .md per AI-generated summary (Cowork's primary write target)
└── Files/            # arbitrary attachments (docx, xlsx, pdf, images)
```

`CLAUDE.md` is the **single source of truth** for everything the Visualizer UI shows about that project. It must contain:

```markdown
# <Project Name>

<Optional one-paragraph description.>

## Planner Metadata
status: on-track          # on-track | at-risk | behind | blocked | completed | on-hold
priority: medium          # high | medium | low
startDate: 2026-04-23
endDate: 2026-05-15
progress: 0               # 0 to 100
stress: 0                 # 0 to 5
color: #d46a35            # hex
links:
  - url: https://example.com
    label: Display name
```

#### Field reference

| Field | Valid values |
|---|---|
| `status` | `on-track`, `at-risk`, `behind`, `blocked`, `completed`, `on-hold` |
| `priority` | `high`, `medium`, `low` |
| `startDate`, `endDate` | `YYYY-MM-DD` |
| `progress` | Integer 0 to 100 |
| `stress` | Integer 0 to 5 |
| `color` | Hex `#rrggbb` |
| `originalLocation` | Optional, mount slug like `projects` or `change-controls`. Used by the auto-archive logic. |
| `isMeeting` | `true` (meetings only, never set on projects) |
| `links` | YAML list of `{url, label}` |

Optional sections that pass through verbatim:
- `## Notes`: short bullet list shown on the Details tab.
- `## Questions & Blockers`: bullet list, surfaced in summaries.
- `## Owner`: single line of attribution.
- `## Recent Summaries`: pointer list maintained by `/save-summary`.
- Any custom section the engineer adds. The parser leaves unknown sections alone.

#### Safety rules when editing CLAUDE.md

- Never rename the `## Planner Metadata` heading.
- Keep one `field: value` per line inside that section. No blank lines, no comments. The parser breaks on them.
- Unknown sections pass through verbatim, so any custom content below `## Planner Metadata` is safe.
- Setting `status: completed` triggers auto-archive into `Completed/`.

### 4.3 Meeting folder schema

Folder name MUST match `^\d{4}-\d{2}-\d{2}\s+—\s+.+`: `YYYY-MM-DD`, space, **em-dash (U+2014, NOT hyphen)**, space, title.

```
YYYY-MM-DD — <Meeting Title>/
├── CLAUDE.md         # ## Planner Metadata + ## Meeting Details + ## Attendees + ## Agenda + ## Transcript Summary
├── Notes/            # human meeting notes
├── Files/            # attachments
└── Transcripts/      # raw .vtt or .docx transcript exports
```

**No `Chat Summaries/` folder inside meetings.** The Visualizer does not surface a Chat Summaries sub-tab on meeting detail views; any folder named that way under a meeting is invisible to the UI. Cowork-generated meeting summaries live in the meeting's `## Transcript Summary` section instead.

Meeting `CLAUDE.md` adds these sections on top of the project schema:

```markdown
isMeeting: true        # in ## Planner Metadata

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

| Email                    |
|--------------------------|
| claire.moll@promega.com  |
| akim.nilausen@promega.com|

## Agenda
- Topic 1
- Topic 2

## Transcript Summary
(markdown summary of Teams transcript, written by Cowork)
```

#### Notes on meeting metadata

- **No Recurrence row.** The Microsoft / Outlook MCP does not reliably return recurrence info on individual instances (`recurrence: null` is common even for true recurring meetings). The `meeting-sync` skill writes no Recurrence row. If a future MCP version surfaces this reliably, it can be re-added.
- **Organizer** is email-only by default. The MCP returns email only, so the skill never invents a display name. If a name lookup is available (for example by joining against the attendees list), the skill may write `Name (email)`. Email-only is correct.
- **Attendees** are returned as email strings only by the MCP. The skill does not invent display names or response statuses. If a name column is added later (from a different source), it is one extra column appended to the email column, never a replacement.
- **Time format** in Meeting Details: `HH:MM - HH:MM` (24-hour, Central time for an Arnold Center engineer). For all-day events, write `All day`.

### 4.4 Color rule for meetings

Same meeting title across instances should share a color. The deterministic hash:

```js
function nameColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) | 0;
  const hue = (Math.abs(h) * 137.508) % 360; // golden-angle
  // ...HSL(hue, 65%, 52%) → hex
}
```

The Visualizer applies this hash automatically when rendering. Skills that scaffold meetings via the filesystem run the same hash directly when writing the `color:` field in `## Planner Metadata`.

### 4.5 Auto-archive

When a project's `status` becomes `completed`, the Visualizer moves the entire folder to `<mount>/Completed/`. Reverting the status moves it back. The optional `originalLocation` field records which mount to restore to.

### 4.6 Legacy artifacts

You may see `*.bak` files (`MEMORY.md.bak`, `description.md.bak`, `context.md.bak`, `notes.md.bak`). These are leftovers from a one-time migration. Do not read, modify, or delete them. They are a recovery net. The Visualizer ignores `*.bak`.

---

## 5. The plugin's workspace mount model

The Visualizer accepts any number of project mounts. The `promega-engineering-os` plugin extends the Visualizer's defaults with an opt-in mount picker during `/begin`.

### 5.1 Always present

| Mount | Default path | Purpose |
|---|---|---|
| **Projects** | `[workspace]/Projects/` | General project work. Default mount for anything without a more specific home. |
| **Meetings** | `[workspace]/Meetings/` | One folder per Outlook meeting (managed by `meeting-sync`). |

### 5.2 Optional add-on mounts (chosen during `/begin`)

| Mount | Default path | Purpose |
|---|---|---|
| **Change Controls** | `[workspace]/Change Controls/` | EtQ change controls. Useful if the engineer works on many CCs. |
| **DS Revisions** | `[workspace]/DS Revisions/` | Design Specification work. |
| **Commissioning** | `[workspace]/Commissioning/` | SAT or FAT, equipment commissioning, handover. |
| **Documentation** | `[workspace]/Documentation/` | SOP, TSOP, or QSOP drafting and standalone doc work. |
| **Custom** | `[workspace]/[Custom Name]/` | Engineer-defined mount. Anything they want. |

### 5.3 Catch-all (not a planner mount, but lives at the workspace root)

| Location | Path | Purpose |
|---|---|---|
| **Workspace files** | `[workspace]/` | Generic browsable file tree, plus workspace-level `Chat Summaries/`, `Notes/`, `Files/`, `Time Summaries/`. |

### 5.4 Completed/ subfolder rule

**Every project mount has a `Completed/` subfolder.** That includes `Projects/`, `Change Controls/`, `DS Revisions/`, `Commissioning/`, `Documentation/`, and any custom mount the engineer creates. The Visualizer auto-moves folders in when a project's `status` becomes `completed`. Never write directly into `Completed/`. Change the project's status instead.

`Meetings/` does not need a `Completed/` subfolder. Meetings are date-prefixed and naturally age down the list.

### 5.5 The mount list lives in workspace CLAUDE.md

The authoritative list of mounts for a given workspace is in `[workspace]/CLAUDE.md` under the `## MOUNTS` section. Skills should read that section to know which mounts exist before suggesting where to put something.

### 5.6 Folder names are free-form

Inside any mount, folder names have no forced prefixes. A change control can be named `CC11142 - Flow Meter Migration` (most engineers' preference) or `Flow Meter Migration` (the CC number lives in the description or links instead). The Visualizer doesn't care. The *mount* the item lives in (`Change Controls/` versus `Projects/`) is the only organizational signal it uses.

This means every project mount has the same internal schema. A skill that knows how to scaffold something in `Projects/` knows how to scaffold something in `Change Controls/` or any custom mount. The shape is identical.

---

## 6. Subfolders inside every project (and meeting where applicable)

### 6.1 `Notes/`

Free-form markdown notes, one file per note. The Visualizer's Notes tab renders them as cards: title from the first `# heading`, preview from the first 140 non-heading characters.

**Filename convention.** Lowercase-slug with dashes: `p4-flow-meter-decision.md`.

**Template:**
```markdown
# Note Title

Body text.

## Optional sub-heading

More body.
```

No metadata block. Pure markdown.

### 6.2 `Chat Summaries/` (projects only)

Same shape as `Notes/`. Cowork writes conversation summaries here, never to `Notes/`, which is for human-written content.

**Filename convention.** Date-prefixed for chronology:
```
YYYY-MM-DD - Topic phrase.md
```
Example: `2026-04-23 - P4 flow meter range debate.md`

**Template:**
```markdown
# [Concise topic phrase]

_Saved by Claude Cowork on 2026-04-23 14:32_

## Context
2 to 3 sentences on what the chat was about and why.

## Key Decisions
- Decision 1 (with rationale)
- Decision 2

## Action Items
- [ ] Will to do X by [date]
- [ ] Stephen to follow up on Y

## Open Questions
- Question 1
- Question 2

## Notable Quotes / Snippets
> Direct quote or code block worth remembering.

## Related
- See also: `Notes/p4-flow-meter-decision.md`
- Related meeting: `2026-04-21 — ArC Scrum`
```

If a summary belongs clearly to a project, write it to that project's `Chat Summaries/`. If it spans multiple projects or is general, write it to `[workspace]/Chat Summaries/` (create if missing).

**Rules.** Never append to an existing summary file. Always create a new dated one. Keep summaries to 200 to 800 words; do not paste the whole chat.

**Meetings do not have `Chat Summaries/`.** See Section 4.3.

### 6.3 `Transcripts/` (meetings only)

Raw Teams or Outlook transcript exports. Both `.vtt` and `.docx` work.

**Workflow.**
1. Drop the raw file: `Transcripts/2026-04-21 ArC Scrum.docx`.
2. Generate a summary (300 to 600 words covering topics, decisions, action items, open questions, notable quotes).
3. Write the summary into the meeting's `CLAUDE.md` `## Transcript Summary` section.

### 6.4 `Files/`

Catch-all for misc attachments: DS PDFs, Excel calcs, screenshots, etc. No naming convention. The Visualizer previews most file types inline.

### 6.5 `Time Summaries/` (workspace-level only)

Lives at `[workspace]/Time Summaries/`. The Visualizer's Summaries tab writes weekly and monthly digests here through its own internal write path. Filename pattern: `YYYY-MM-DD weekly.md`. This is not a per-project folder.

---

## 7. The Cowork plugin integration

Cowork is Claude (Sonnet or Opus) running with the `promega-engineering-os` skill set inside Claude Cowork or Claude Desktop. The integration is **filesystem-only**. Cowork and the Visualizer never talk to each other. Both read and write the same folders on disk. The Visualizer's internal file watcher makes Cowork's writes appear in the UI within about 200 ms.

### 7.1 What Cowork knows

When a user opens a Claude session inside the workspace, the project's `CLAUDE.md` is automatically loaded as system context. That gives Claude:

- The user's role and team.
- The current project's status, priority, dates, notes, blockers, owner.
- Implicit awareness of where to write things, because `CLAUDE.md` lives inside a folder with a known structure.

For workspace-level questions ("what meetings do I have today?"), Cowork lists the relevant folders directly with `Glob` or `Bash`.

### 7.2 The single integration path

Skills in this plugin read and write files directly using the standard tools:

| Operation | Tool |
|---|---|
| Read a single file | `Read` |
| Find files by pattern | `Glob` |
| Search file contents | `Grep` |
| Create or overwrite a file | `Write` |
| Edit a single field or section | `Edit` (preferred for `CLAUDE.md`) |
| Create directories, move files, list contents | `Bash` |

Skills never use HTTP, never call `curl`, never reference `localhost`. The Visualizer's internal app does not expose any network endpoint.

### 7.3 Cowork's primary write targets

| Target | Folder | Filename pattern | Why |
|---|---|---|---|
| **Chat summary (per-project)** | `<project>/Chat Summaries/` | `YYYY-MM-DD - <slug>.md` | Captures a finished conversation. |
| **Chat summary (workspace)** | `[workspace]/Chat Summaries/` | `YYYY-MM-DD - <slug>.md` | When no specific project applies. |
| **Project notes** | `<project>/Notes/` | `<slug>.md` | Human-style note, but Cowork can author them when asked. |
| **Meeting transcript (raw)** | `<meeting>/Transcripts/` | original or `YYYY-MM-DD <Title>.vtt` | Raw transcript export. |
| **Meeting summary** | `<meeting>/CLAUDE.md`, `## Transcript Summary` section | n/a (section update) | Cowork-summarized transcript. |
| **Time summary** | `[workspace]/Time Summaries/` | `YYYY-MM-DD weekly.md` | Weekly or monthly digest. |

### 7.4 Cowork DOs and DON'Ts

**DO:**
- Use `Edit` (not `Write`) for any change to an existing `CLAUDE.md`. Edit a single field or section at a time. Never rewrite a whole `CLAUDE.md`; you'll clobber unknown sections the engineer added.
- Write chat summaries to `Chat Summaries/` (project-only folder), keeping them distinct from human Notes.
- Use the deterministic `nameColor()` for meeting colors when scaffolding meetings.
- Treat the em-dash literally (`U+2014`, `—`) in meeting folder names.
- Preserve `*.bak` files.
- Trust the live-reload watcher. Write the file; the Visualizer picks it up. No refresh, no signal, no notify step.

**DON'T:**
- Don't try to call any HTTP endpoint. There isn't one. There's no localhost server, no `/api/*`, no fetch, no curl.
- Don't append to existing chat summary files. Always create a new one.
- Don't write summaries to `Notes/`. That's the human notebook.
- Don't write to `Completed/` directly. Change `status: completed` and let the Visualizer archive.
- Don't add `isMeeting: true` to project CLAUDE.md files. Only meetings get that.
- **Don't create `Chat Summaries/` inside meeting folders.** The Visualizer ignores it there. Meeting summaries go in the meeting's `## Transcript Summary` section instead.
- Don't manually move files across mounts while the Visualizer is running. Let chokidar's debounce settle, or close the Visualizer first.

### 7.5 End-to-end example: "Save this chat about the P4 flow meter"

1. Find the project folder by listing project mounts:
   ```bash
   ls -1d "[workspace]/Change Controls/"*/ | grep -i "CC11142"
   # → Change Controls/CC11142 - Flow Meter Migration P1-P3/
   ```

2. Compose the summary in the conversation (see template in Section 6.2).

3. Write it with the `Write` tool:
   ```
   path: [workspace]/Change Controls/CC11142 - Flow Meter Migration P1-P3/Chat Summaries/2026-05-06 - p4-flow-meter-decision.md
   content: <markdown body>
   ```

4. Append a pointer to the project's `## Recent Summaries` section using `Edit`.

5. The Visualizer's file watcher picks up the new file within about 200 ms; the card grid refreshes automatically. No user action required.

### 7.6 End-to-end example: "Sync my morning meetings"

1. Cowork pulls Outlook events for the workweek window via the Microsoft / Outlook MCP.

2. For each event, build the canonical folder name `YYYY-MM-DD — <Title>` (Central time, real em-dash) and check whether it exists with `Bash`:
   ```bash
   test -d "[workspace]/Meetings/2026-05-06 — ArC Scrum"
   ```

3. If new, create the meeting folder with `Bash`:
   ```bash
   mkdir -p "[workspace]/Meetings/2026-05-06 — ArC Scrum/Notes" \
            "[workspace]/Meetings/2026-05-06 — ArC Scrum/Files" \
            "[workspace]/Meetings/2026-05-06 — ArC Scrum/Transcripts"
   ```
   (Note: no `Chat Summaries/` for meetings.)

4. Write `CLAUDE.md` with the meeting metadata (template in Section 4.3) using `Write`.

5. If the meeting already existed, use `Edit` to refresh the time-varying rows (`LastSynced`, attendee list, agenda) without touching engineer-added sections.

6. The watcher picks everything up; the calendar shows the meetings within about 200 ms.

### 7.7 Reading project context for Q&A

User asks: *"What's the status of CC11142?"*

```bash
# A. List candidate folders
ls -1d "[workspace]/Change Controls/"*/ | grep -i "CC11142"

# B. Read the project's CLAUDE.md
# (use the Read tool on the matching folder's CLAUDE.md)

# C. List recent notes by mtime
ls -t "[workspace]/Change Controls/CC11142 .../Notes/" | head -3

# D. List recent chat summaries by mtime
ls -t "[workspace]/Change Controls/CC11142 .../Chat Summaries/" | head -3
```

Read the most recent files of each type to get current status, recent decisions, open questions, what's next. Synthesize and answer.

---

## 8. Writing files safely

This plugin writes files directly to disk. The Visualizer's file watcher picks up any change within about 200 ms.

### 8.1 Safe-edit rules for project `CLAUDE.md`

Because the `## Planner Metadata` section has a rigid format, always edit `CLAUDE.md` with care.

1. **Read the whole file first.** Never blind-write. You will clobber existing fields.
2. **Use section-scoped edits.** When changing a metadata field (for example `status: completed`), use the `Edit` tool on that single line. Don't rewrite the whole file.
3. **Preserve unknown sections.** If the engineer added custom sections (`## Scope`, `## Decision Log`), leave them alone.
4. **Don't reorder metadata fields.** Canonical order: `status, priority, startDate, endDate, progress, stress, color, originalLocation, isMeeting, links`.

### 8.2 Safe-edit rules for meeting `CLAUDE.md`

- `## Meeting Details` is a markdown table. Preserve the header row and separator row exactly.
- `## Attendees` is a markdown table. Rebuild the whole body when the attendee list changes, but keep the header and separator intact.
- `## Transcript Summary` is a free-form markdown block. Safe to rewrite end-to-end.
- `## Agenda` is a bullet list.
- Do not write Recurrence rows (see Section 4.3). If an old file has one, remove it during the next sync.

### 8.3 Live reload

The Electron main process watches the workspace with chokidar and forwards events to the renderer over IPC. Any file you write appears in the UI within about 200 ms. No refresh needed. No "tell the app" step. No HTTP call.

---

## 9. Detailed UI behavior reference

This section is a feature-by-feature breakdown for skills that need to know how the UI behaves.

### 9.1 Calendar tab

- Month grid. Today is highlighted (gold border).
- Each project renders as a horizontal bar spanning its date range. Color is the project's `color` field (or priority default).
- Each meeting renders as a chip on its date. Color is `nameColor(title)` hash, so recurring meetings cluster visually.
- Click a project bar or meeting chip to open the detail view.
- Header arrows step month-by-month. "Today" button jumps back.

### 9.2 All Projects tab

- Grouped by status (On Track, At Risk, Behind, Blocked, On Hold, Completed).
- Each row: title, priority dot, dates, progress bar, color swatch.
- Filter input filters by name. Status pills toggle visibility per group.
- "+ New Project" opens a modal asking for name plus mount; the Visualizer scaffolds the folder directly on disk.
- Clicking a row opens detail.

### 9.3 All Meetings tab

- Reverse chronological list. Today's meetings highlighted.
- Each row: date, time, title, location, organizer, attendee count.
- Filter input.
- "+ New Meeting" opens a modal asking for title plus date; the Visualizer scaffolds the folder directly on disk.

### 9.4 Detail view (project or meeting)

- **Sub-tab strip** at top (Details, Notes, Chat Summaries on projects only, Files).
- Title row has the **Show in Folder** folder icon to the left of the editable title input.
- Details fields auto-save with debounce (about 400 ms after typing stops). Saves go straight to disk through the Electron main process.
- Notes and Chat Summaries: card grid. Click a card to open the inline editor. "+ New Note" or "+ New Summary" creates a blank `.md` and opens it for editing.
- Files: 2-pane (sidebar tree plus main editor). Tree supports drag-drop (internal moves plus OS uploads), right-click context menu (Rename, Delete, Show in Folder), and inline preview for many file types.

### 9.5 Files tab (global)

- Same 2-pane layout as project Files, but rooted at the workspace `files` mount.
- Sidebar header has its own folder icon to reveal the root in Explorer.
- Drag any external file onto the sidebar (anywhere) to upload to root.
- Drag onto a specific folder row to upload to that subfolder.

### 9.6 Summaries tab

- Date range picker (From, To) plus quick range buttons (This Week, Last Week, 2 Weeks, This Month).
- Pulls notes and meeting summaries within the range, lays them out as a draftable digest.
- "Save Summary" writes a markdown file to `[workspace]/Time Summaries/`.

### 9.7 Settings

- Workspace root path plus a button that opens the native folder picker.
- Per-mount paths editable.
- Priority colors: 4 swatches (high, medium, low, completed). Each click opens a color picker. Save persists to `config.json`.

### 9.8 Right-click menus

| Where | Items |
|---|---|
| File row in tree | Open, Show in folder, Rename, Delete |
| Folder row in tree | Open folder (expand), Show in folder, Rename, Delete |
| Misspelled word in any text field | (suggestions), Add to Dictionary, Cut, Copy, Paste |

### 9.9 Keyboard shortcuts

| Key | Effect |
|---|---|
| F12 | Toggle DevTools (for self-diagnosis) |
| Ctrl+R | Reload ignoring cache |
| Esc | Close modals or popups |

### 9.10 Live reload signaling

Every save (from the UI itself or from any external writer) goes through the file watcher. The renderer subscribes once and reloads only the views that depend on the changed file. So edits in VS Code, file copies into the tree, or Cowork writes all show up live without any user action.

---

## 10. Build / dev setup (Visualizer internals)

### 10.1 Prerequisites

- Node.js 18+ for development. The packaged `.exe` is self-contained; end users do not need Node.
- Windows for the build (NSIS target).

### 10.2 Run from source (dev)

```powershell
npm install
npm start                # boots the Electron app from source
```

There is no separate "server only" mode. The app is single-process Electron.

### 10.3 Build the installer

```powershell
# Edit package.json: bump "version"
npm run dist
# Output: dist-app\Promega Project Planner Setup <version>.exe
```

### 10.4 File-by-file map

| File | Role |
|---|---|
| `electron-main.cjs` | Electron main process. Boots BrowserWindow, owns the chokidar watcher and all file I/O, handles spell-check context menu. |
| `Promega.Project.Planner.V3.html` | The entire UI (CSS, HTML, JS in one file). Talks to main via IPC. |
| `bin/launch.cjs` | Cross-shell launcher for `npm start`. |
| `lib/fs-parser.mjs` | Parses project and meeting `CLAUDE.md` into JS objects. Called from main. |
| `lib/fs-writer.mjs` | Section-aware write (`upsertSection`). Preserves unknown sections. Called from main. |
| `lib/fs-ops.mjs` | Tree build, raw stream, move, rename, mkdir, delete with OneDrive-safe fallbacks. Called from main. |
| `package.json` | npm metadata plus electron-builder config (NSIS target). |
| `config.json`, `config.example.json` | Workspace paths plus priority colors. |
| `tasks.json`, `ui-state.json` | App runtime state (not user data). |

---

## 11. Don't-touch list

- Anything in `Completed/`. Change the project's `status` and let the Visualizer archive it.
- `*.bak` files anywhere.
- `tasks.json`, `ui-state.json` at the Visualizer's `%APPDATA%` directory. Runtime state, not user data.
- The Visualizer's own source code directory unless the engineer explicitly asks.

---

## 12. File routing cheat sheet

The mount depends on what mounts exist in the engineer's workspace. Read `[workspace]/CLAUDE.md`'s `## MOUNTS` section first to find the right one. `[mount]` below is a placeholder. It could be `Projects/`, `Change Controls/`, `DS Revisions/`, or any other project mount.

| What the engineer produced | Write to |
|---|---|
| Chat summary about a specific project, CC, DS, etc. | `[mount]/[folder]/Chat Summaries/YYYY-MM-DD - topic.md` |
| Workspace-level chat summary (cross-cutting) | `[workspace]/Chat Summaries/YYYY-MM-DD - topic.md` |
| Human-written note on an item | `[mount]/[folder]/Notes/topic-slug.md` |
| Human-written note on a meeting | `Meetings/[YYYY-MM-DD — title]/Notes/topic-slug.md` |
| Raw meeting transcript | `Meetings/[folder]/Transcripts/` |
| Summarized transcript | Meeting's `CLAUDE.md`, `## Transcript Summary` section |
| Conversation summary about a meeting | Meeting's `CLAUDE.md`, `## Transcript Summary` section. **Not** `Chat Summaries/` (the Visualizer ignores that under meetings). |
| DS draft, xlsx calc, report | The relevant item's `Files/` |
| New item (via `/add-project`) | `[mount]/[Name]/`. Scaffolds CLAUDE.md plus Notes/ plus Chat Summaries/ plus Files/ |
| New meeting | `Meetings/YYYY-MM-DD — [Title]/` (em-dash). Scaffolds CLAUDE.md plus Notes/ plus Files/ plus Transcripts/. **No `Chat Summaries/`.** |
| Weekly or monthly digest | `[workspace]/Time Summaries/YYYY-MM-DD weekly.md` |

### 12.1 Default mount picker

When a skill has to guess which mount to use (the engineer said "save this to the flow meter project" and there are multiple mounts), fall back rules:

1. Look for a folder with a matching name across all mounts. Pick whichever mount contains it.
2. If no match: ask the engineer.
3. Never default blindly. Picking the wrong mount silently misfiles the content.

---

## 13. Team sharing (RDC shared folder)

The `/join-team`, `/share-chat`, and `promote-to-team` skills push knowledge to the shared SharePoint folder at `RDC Renovations - 06 Production Support/` under Troubleshooting, Tribal Knowledge, or Brainstorming. That workflow is unchanged. It lives alongside the planner model, not inside it.

When a chat summary or note is worth sharing, write it to the planner location first (as the primary save), then ask the engineer if it should also be promoted to the team folder. Files written to the shared folder are `.txt` (for SharePoint preview and search compatibility); the local copy in the engineer's workspace stays as `.md` so the Visualizer can render it.

---

## 14. Versioning and change log (Visualizer)

| Version | Date | Highlights |
|---|---|---|
| 3.0.0 | 2026-04 | Initial V3. Single-HTML UI, Electron wrapper plus separate Node HTTP server on `localhost:3000`. |
| 3.0.1 to 3.0.2 | 2026-04 | Bug fixes, voice-notes, animation polish. |
| 3.0.3 | 2026-04-28 | Live SSE reload, OneDrive-safe move retries, Time Summaries. |
| 3.0.4 | 2026-05-05 | Show-in-Folder button plus right-click menu, native spell-check suggestions menu, whole-sidebar OS file drop for uploads. |
| 3.0.5 | 2026-05-06 | **Architecture change.** Removed the Node HTTP server. The app is now single-process Electron with all file I/O in the main process and IPC between main and renderer. No more `localhost:3000`, no more `/api/*` endpoints. The Cowork integration is filesystem-only. |

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **Workspace** | The folder containing `Projects/`, `Meetings/`, etc. Each user picks their own. The plugin scaffolds a `Personal Workspace/` folder by convention; the Visualizer accepts any name. |
| **Mount** | A configured project root. Default in the Visualizer: two mounts (Projects, Change Controls). Plugin default: Projects plus Meetings, with optional add-ons. |
| **CC** | Change Control. A regulated engineering project. Folder name pattern: `CC<NNNNN> - <Title>`. |
| **CLAUDE.md** | The single source-of-truth file inside each project or meeting folder. Cowork reads and writes this. |
| **Cowork** | Claude (Sonnet or Opus) running with planner-aware skills inside Claude Cowork or Claude Desktop. |
| **Visualizer** | Shorthand for this app. The Promega Project Planner V3 desktop application. Earlier docs called this "the planner". |
| **Section-aware write** | `lib/fs-writer.mjs:upsertSection`. Replaces a `## Heading` body without touching other sections. |
| **IPC** | Inter-process communication between Electron's main process and renderer. Replaces what used to be HTTP fetch. |
| **Em-dash** | `—` (U+2014). Required in meeting folder names. NOT the same as a hyphen `-`. |

---

## 16. Quick reference card

For Cowork to consult mid-conversation:

```
Workspace root:    [user's workspace path] (from [workspace]/CLAUDE.md ## RESOLVED PATHS)
Project mounts:    [from [workspace]/CLAUDE.md ## MOUNTS]
Meetings folder:   <root>/Meetings/

Project folder:    <mount>/<Project Name>/
  └─ CLAUDE.md          ← read with Read, edit with Edit (single field/section at a time)
  └─ Notes/             ← human notes; one .md per
  └─ Chat Summaries/    ← Cowork's primary write target
  └─ Files/             ← attachments

Meeting folder:    Meetings/YYYY-MM-DD — <Title>/
  └─ CLAUDE.md          ← read with Read, edit with Edit
  └─ Notes/             ← human notes
  └─ Files/             ← attachments
  └─ Transcripts/       ← raw Teams .vtt or .docx
  (NO Chat Summaries/ here; meetings use ## Transcript Summary instead)

Workspace-level:   <root>/Chat Summaries/, Notes/, Files/, Time Summaries/

Forbidden:        Chat Summaries/ inside meetings; *.bak files; Completed/ writes;
                  Recurrence row in meeting CLAUDE.md;
                  any HTTP/curl/fetch/localhost call (the Visualizer has no API).

How Cowork writes:
  Read     → Read tool (single file)
  Edit     → Edit tool (single field or section in CLAUDE.md, NEVER full rewrite)
  Write    → Write tool (new files like notes, chat summaries, transcripts)
  List     → Glob or Bash (ls)
  Search   → Grep
  mkdir/mv → Bash

How the Visualizer sees Cowork's writes:
  Cowork writes file → Electron main's chokidar watcher fires →
  IPC notifies renderer → renderer refetches affected view (~200 ms).
  No user action, no refresh, no HTTP signal.
```

---

End of reference.
