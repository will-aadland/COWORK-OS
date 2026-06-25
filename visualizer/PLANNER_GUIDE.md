# Promega Project Planner V3 — Full Reference

A complete guide to the Promega Project Planner: what it is, how it works, how to install it, and how Claude Cowork (the AI plugin) plugs into it. Pack-everything-in style — read this once and you should know enough to render any view of the app, integrate with the API, write to its filesystem schema, or onboard a teammate.

> **Audience.** This document is dual-purpose. The first half is human-readable installation + tour. The second half is reference material a Claude agent (Cowork) can use to answer questions about the planner, render visual explanations, or write/read planner data correctly.

---

## 0. TL;DR

| Question | Answer |
|---|---|
| What is it? | A localhost desktop app that visualizes a folder tree on disk — projects, meetings, notes, files — as a calendar/list/file-browser UI. |
| What's underneath? | Plain markdown + folders. No database. The filesystem **is** the schema. |
| What language? | Node.js (server) + a single HTML file with inline JS/CSS (UI), wrapped by Electron for distribution. |
| Where do I install it? | Run `Promega Project Planner Setup 3.0.4.exe` (Windows, per-user install). |
| How does Cowork plug in? | Cowork reads/writes files in the same folder tree, or hits the planner's HTTP API on `localhost:3000`. Both paths land at the same files; the planner's filesystem watcher live-reloads the UI. |
| Where does it live on disk? | Source: anywhere. User data: a folder you choose at first launch (the "COWORK" workspace). |
| How does it update? | Manual. There's no auto-updater. Distribute a new `.exe`. |

---

## 1. Distribution — how to send it to everybody

### 1.1 What you ship

The single file:

```
dist-app/Promega Project Planner Setup 3.0.4.exe   (~78 MB)
```

That's a self-contained NSIS installer with Node, Chromium, the server, and the UI all bundled. Recipients don't need Node installed.

### 1.2 How recipients install

1. Save the `.exe` somewhere local (Downloads is fine).
2. Double-click → click **More info → Run anyway** if Windows SmartScreen complains (the build is unsigned).
3. NSIS installer opens:
   - Choose install location (defaults to `%LOCALAPPDATA%\Programs\Promega Project Planner`).
   - Optionally tick "Create desktop shortcut" / "Create Start menu shortcut".
4. Click Install. Takes ~10 seconds.
5. Launch from the Start menu or desktop shortcut.

### 1.3 First-run setup (recipient's responsibility)

The app expects a "COWORK workspace" — a folder containing `Projects/`, `Meetings/`, etc. Each user picks their own.

On first launch, the planner shows a config screen if `config.json` is missing or empty. Steps:

1. Click **Choose folder** (uses the native Windows folder picker).
2. Point it at the workspace root, e.g. `C:\Users\<you>\OneDrive\Desktop\COWORK\Personal Workspace`.
3. The planner auto-detects subfolders matching the canonical layout (`Projects/`, `Change Controls/`, `Meetings/`). If they don't exist, it creates them.
4. Click **Save**. The planner reloads against the new root.

> **OneDrive tip.** If the workspace is in OneDrive, files may be cloud-only. The first read on each file will trigger a hydration pause (~1-2s). Subsequent reads are local-fast.

### 1.4 Distribution channels

Pick whichever fits your team:

| Channel | When to use | Notes |
|---|---|---|
| Email attachment | Small teams (≤10) | 78 MB may bounce off some Outlook policies. |
| OneDrive / SharePoint share | Most reliable internal channel | Drop the `.exe` in a shared folder, send the link. |
| Network share | Office network | Easiest if everyone has access. |
| Teams chat | Quick distribution | Teams allows ≤250 MB attachments. |
| Internal package portal (Software Center, Intune) | Enterprise rollout | Works once IT signs the executable for AppLocker. |

### 1.5 Updating an existing install

There is no auto-updater. To upgrade users from 3.0.3 → 3.0.4:

- Send them the new `.exe`.
- They run it. NSIS detects the previous install, replaces files in place, preserves their `config.json` (it lives in `%APPDATA%\Promega Project Planner\` — outside the install dir).
- No data loss.

### 1.6 Uninstalling

- Settings → Apps → Installed apps → "Promega Project Planner" → Uninstall.
- OR run `%LOCALAPPDATA%\Programs\Promega Project Planner\Uninstall Promega Project Planner.exe`.

User data (the COWORK workspace) is **never** touched by uninstall. `config.json` (in `%APPDATA%`) is also preserved unless the user picks "remove user data" at uninstall.

### 1.7 Bumping version + rebuilding (developer-only)

```powershell
# 1. Edit package.json: bump "version" (semver)
# 2. Build:
npm run dist
# 3. Result lands at dist-app\Promega Project Planner Setup <version>.exe
```

**Why bump the version?** NSIS/Windows treat same-version installers as identical and may shortcut the install. Always bump before redistributing.

---

## 2. What the app actually does

The planner is a **read-write visualizer** of a folder tree. Open the app, see your projects on a calendar, click into one, edit notes, attach files, run summaries. Save — your changes hit the disk.

### 2.1 Six top-level views (tabs across the top)

| Tab | What it shows |
|---|---|
| **Calendar** | Month grid with project bars and meeting chips colored by priority/title hash. |
| **All Projects** | Filterable list of every project in the configured project mounts (active + archived). |
| **All Meetings** | Date-sorted list of every folder in the meetings mount. |
| **Files** | Recursive file browser rooted at the configured "files" mount. Drag-drop, preview, edit. |
| **Summaries** | Time-window summary builder. Pull notes/meetings from a date range, draft a weekly/monthly digest, save it as a markdown file. |
| **Settings** | Configure the workspace root, project mounts, priority colors. |

### 2.2 Detail views

Clicking a project or meeting opens a **detail view** with three sub-tabs:

| Sub-tab | Purpose |
|---|---|
| **Details** | Title, description, status, priority, dates, progress, color, links. Editing any field writes to the project's `CLAUDE.md`. |
| **Notes** | Card grid of all `.md` files in `Notes/`. Click a card to edit inline. |
| **Chat Summaries** *(projects only)* | Card grid of all `.md` files in `Chat Summaries/`. Same UX as Notes but a separate folder so Cowork-written content stays distinct from human notes. |
| **Files** | Sidebar tree + main pane. Browse, edit, preview (md / docx / xlsx / pdf / images / code with syntax highlighting). |

Meetings have a **Transcript Summary** pane on the Details tab instead of a Chat Summaries sub-tab (because chat summaries belong to projects, not meetings).

### 2.3 Three feature highlights (added 2026-05-05)

| Feature | How to use |
|---|---|
| **Show in Folder** | Click the 📁 button next to a project/meeting title (or beside the Refresh button in any Files sidebar) to open Windows Explorer at that folder. Right-click any file or folder in the tree for the same option — files are revealed via `explorer /select,…`. |
| **Spell-check menu** | Right-click any underlined misspelled word to see suggestions, replace inline, or "Add to Dictionary". Native Chromium spellcheck via Electron. |
| **Sidebar drag-drop** | Drag any file from File Explorer / Desktop onto the Files sidebar (anywhere — header, search, footer, body, or onto a specific folder row) and it uploads to that folder. CSV, docx, pdf, images — all binary types supported. |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Electron BrowserWindow                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Promega.Project.Planner.V3.html                     │   │
│  │  - inline CSS + inline JS + inline HTML              │   │
│  │  - fetch() against localhost:3000                    │   │
│  │  - EventSource for live reload (SSE)                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │ HTTP                        │ SSE
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│  server.mjs (Node.js, http core module, no Express)         │
│  - parses CLAUDE.md / context.md via lib/fs-parser.mjs      │
│  - writes section-aware via lib/fs-writer.mjs               │
│  - file ops via lib/fs-ops.mjs                              │
│  - watches the workspace via chokidar, emits SSE on change  │
└─────────────────────────────────────────────────────────────┘
            │ fs                            │ chokidar
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│  COWORK workspace folder (OneDrive, local, or network)      │
│   ├── Projects/           ├── Change Controls/              │
│   │     └── <Name>/...    │     └── <Name>/...              │
│   ├── Meetings/                                             │
│   │     └── YYYY-MM-DD — Title/...                          │
│   └── (any other files browsable from the Files tab)        │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Process model

- **Electron main process** (`electron-main.cjs`) — opens the window, spawns `server.mjs` as a child process, wires the spell-check context menu, and proxies opens of external URLs to the OS browser.
- **Server child process** (`server.mjs`) — Node.js HTTP server on port 3000. Stateless except for the `chokidar` watcher.
- **Renderer** (`Promega.Project.Planner.V3.html`) — single-file UI. No build step. Uses fetch + SSE.

### 3.2 Where the user's data lives in the packaged app

| Path | Purpose |
|---|---|
| `%LOCALAPPDATA%\Programs\Promega Project Planner\` | The app itself (read-only after install). |
| `%APPDATA%\Promega Project Planner\config.json` | Workspace root, port, section paths, priority colors. Survives reinstall. |
| `%APPDATA%\Promega Project Planner\tasks.json` | Reserved for in-app task list (currently unused). |
| `%APPDATA%\Promega Project Planner\ui-state.json` | UI persistence (sidebar widths, last-open tab, etc.). |
| The COWORK workspace folder | All user content. The user picks the path. |

In dev (running `node server.mjs` from source), all three JSON files live next to `server.mjs` instead.

### 3.3 The single-HTML-file UI

`Promega.Project.Planner.V3.html` is ~5,000 lines. It's intentionally one file: no bundler, no build step, easy to ship. Inside:

| Lines (approx) | Section |
|---|---|
| 1 – 1300 | CSS — design tokens, layout, components. |
| 1300 – 2100 | HTML — every view marked up at once, hidden until activated. |
| 2100 – 5050 | JavaScript — view router, state, fetch wrappers, all interaction handlers. |

Functions are namespaced by prefix:
- `wv*` — workspace viewer (the project/meeting/files detail UI shared by all three).
- `pv*` / `mv*` / `gv*` — DOM IDs scoped to project / meeting / global-files views.
- `S.*` — top-level state (`S.projects`, `S.meetings`).

### 3.4 Live reload (SSE)

`GET /api/watch` opens a Server-Sent Events stream. Every chokidar change emits one SSE message:

```
data: {"type":"change","section":"projects|meetings|files","event":"add|change|unlink","path":"..."}
```

The renderer listens, decides whether the change affects the current view, and refetches the relevant data within ~200ms. Result: edit a `.md` file in VS Code, see the change in the planner without refreshing.

---

## 4. Filesystem schema (the source of truth)

The planner has no database. Everything you see in the UI is parsed from these files at request time. Cowork must respect this schema; deviating produces invisible files or breaks parsing.

### 4.1 Workspace root layout

```
[COWORK workspace root]/
├── Projects/                           # one project mount
│   ├── <Project Name>/
│   └── Completed/                      # archive (auto-managed)
├── Change Controls/                    # second project mount (CCs)
│   ├── CC<NNNNN> - <Title>/
│   └── Completed/
├── Meetings/
│   └── YYYY-MM-DD — <Meeting Title>/
└── (any other files / folders — browsable in the Files tab)
```

Mounts are configurable. Defaults are `Projects/` + `Change Controls/`, but a user can add or rename mounts via Settings.

### 4.2 Project folder schema

```
<Project Name>/
├── CLAUDE.md         # title + description + ## Planner Metadata + ## Notes + ## Questions & Blockers + ## Owner
├── Notes/            # one .md per note (free-form)
├── Chat Summaries/   # one .md per AI-generated summary (Cowork's primary write target)
└── Files/            # arbitrary attachments (docx/xlsx/pdf/images)
```

`CLAUDE.md` is the **single source of truth** for everything the planner UI shows about that project. It must contain:

```markdown
# <Project Name>

<Optional one-paragraph description.>

## Planner Metadata
status: on-track          # on-track | at-risk | behind | blocked | completed | on-hold
priority: medium          # high | medium | low
startDate: 2026-04-23
endDate: 2026-05-15
progress: 0               # 0–100
stress: 0                 # 0–5
color: #d46a35            # hex
links:
  - url: https://example.com
    label: Display name
```

Optional sections that pass through verbatim:
- `## Notes` — short bullet list shown on the Details tab.
- `## Questions & Blockers` — bullet list, surfaced in summaries.
- `## Owner` — single line of attribution.

### 4.3 Meeting folder schema

Folder name MUST match `^\d{4}-\d{2}-\d{2}\s+—\s+.+` — `YYYY-MM-DD`, space, **em-dash (U+2014, NOT hyphen)**, space, title.

```
YYYY-MM-DD — <Meeting Title>/
├── CLAUDE.md         # ## Planner Metadata + ## Meeting Details + ## Attendees + ## Agenda + ## Transcript Summary
├── Notes/            # human meeting notes
├── Files/            # attachments
└── Transcripts/      # raw .vtt / .docx transcript exports
```

Meeting `CLAUDE.md` adds these sections on top of the project schema:

```markdown
isMeeting: true        # in ## Planner Metadata

## Meeting Details
| Field      | Value                     |
| Date       | 2026-04-21                |
| Time       | 08:00 - 08:30             |
| Location   | Arnold-114                |
| Organizer  | Misha Dyskin (m@…)        |
| Recurrence | Weekly                    |
| MeetingId  | AAMkAGE2…                 |
| LastSynced | 2026-04-21T13:14:26Z      |

## Attendees
| Name        | Email             | Response |
| Claire Moll | claire.moll@…     | Accepted |

## Agenda
- Topic 1
- Topic 2

## Transcript Summary
(markdown summary of Teams transcript)
```

### 4.4 Color rule for meetings

Same meeting title across instances → same color. The deterministic hash:

```js
function nameColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) | 0;
  const hue = (Math.abs(h) * 137.508) % 360; // golden-angle
  // ...HSL(hue, 65%, 52%) → hex
}
```

`POST /api/meeting/create` applies this automatically.

### 4.5 Auto-archive

When a project's `status` becomes `completed`, the planner moves the entire folder to `<mount>/Completed/`. Reverting the status moves it back. The optional `originalLocation` field records which mount to restore to.

### 4.6 Legacy artifacts

You may see `*.bak` files (`MEMORY.md.bak`, `description.md.bak`, `context.md.bak`, `notes.md.bak`). These are leftover from a one-time migration. Don't read, modify, or delete them — they're a recovery net. The planner ignores `*.bak`.

---

## 5. HTTP API reference

Base: `http://localhost:3000`. JSON in/out. No auth (localhost only). Folder names URL-encode (spaces → `%20`, em-dash → `%E2%80%94`).

### 5.1 Discovery

| Method | Path | Returns |
|---|---|---|
| GET | `/api/config` | `{ files, meetings, projects, priorityColors }` |
| POST | `/api/config` | Update sections / priorityColors. Send only changed fields. |
| GET | `/api/projects` | All projects across all mounts (active + archived). |
| GET | `/api/meetings` | All meetings, sorted desc by date. |
| GET | `/api/watch` | SSE stream. |

### 5.2 Project CRUD

| Method | Path | Body | Effect |
|---|---|---|---|
| POST | `/api/project/create` | `{name, description, mountPath?, priority?, color?, startDate?, endDate?}` | Scaffold folder + subfolders + CLAUDE.md. |
| GET | `/api/project/:folder` | — | Parsed CLAUDE.md as object. |
| POST | `/api/project/:folder` | Subset of fields | Section-aware update. |
| DELETE | `/api/project/:folder` | — | Recursive delete. |

### 5.3 Meeting CRUD

| Method | Path | Body | Effect |
|---|---|---|---|
| POST | `/api/meeting/create` | `{title, date}` | Scaffold + auto-color. |
| GET | `/api/meeting/:folder` | — | Parsed object. |
| POST | `/api/meeting/:folder` | Subset of fields incl. `attendees[]`, `agenda`, `transcriptSummary`, etc. | Section-aware update. |
| DELETE | `/api/meeting/:folder` | — | Recursive delete. |

### 5.4 Per-scope file ops (project + meeting)

`:scope` is `project` or `meeting`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/:scope/:folder/files` | Recursive tree. |
| GET | `/api/:scope/:folder/notes-list` | Card metadata for `Notes/`. |
| GET | `/api/project/:folder/chats-list` | Card metadata for `Chat Summaries/` *(projects only)*. |
| GET | `/api/:scope/:folder/file?path=<rel>` | Read text. |
| POST | `/api/:scope/:folder/file` | `{path, content, encoding?}`. `encoding:"base64"` for binary. |
| DELETE | `/api/:scope/:folder/file?path=<rel>` | Delete. |
| POST | `/api/:scope/:folder/mkdir` | `{path}`. |
| POST | `/api/:scope/:folder/move` | `{from, to}`. |
| POST | `/api/:scope/:folder/rename` | `{path, newName}`. |
| GET | `/api/:scope/:folder/raw?path=<rel>` | Raw bytes (for image/pdf preview). |

### 5.5 Global files (Files tab)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/files` | Tree of the configured `files` mount. |
| GET | `/api/files/content?path=<rel>` | Read. |
| GET | `/api/files/raw?path=<rel>` | Raw stream. |
| POST | `/api/files/file` | `{path, content, encoding?}`. Same shape as scoped. |
| POST | `/api/files/touch` | `{path, content?}` — create or overwrite. |
| POST | `/api/files/mkdir` | `{path}`. |
| POST | `/api/files/move` | `{from, to}`. |
| POST | `/api/files/rename` | `{path, newName}`. |
| DELETE | `/api/files` | `{path}` body or `?path=` query. |

### 5.6 OS / shell helpers

| Method | Path | Effect |
|---|---|---|
| GET | `/api/open-externally?scope=&folder=&path=` | Opens a file in its native Windows app via `cmd /c start`. |
| GET | `/api/show-in-folder?scope=&folder=&path=` | Reveals a path in Windows Explorer. Folder paths open at that folder; file paths open the parent with the file pre-selected (`explorer /select,…`). |
| GET | `/api/browse/folder?initialPath=` | Native PowerShell folder picker. Returns `{path}` or `{path: null}`. |
| POST | `/api/open-claude` | Launches Claude Desktop via the `claude://` URL protocol with file-path fallbacks. |
| POST | `/api/summary/write` | Writes a markdown file into the Time Summaries folder. |

---

## 6. The Cowork plugin integration

"Cowork" = Claude (Sonnet/Opus) running with a custom set of skills/slash-commands inside Claude Code or Claude Desktop, configured to know about this planner. The integration is filesystem-first, with HTTP as a structured fallback.

### 6.1 What Cowork knows

When a user opens a Claude session inside the COWORK workspace, the project's `CLAUDE.md` is automatically loaded as system context. That gives Claude:

- The user's role (Will Aadland, Automation Engineer, RDC).
- The current project's status, priority, dates, notes, blockers, owner.
- Implicit awareness of where to write things (because `CLAUDE.md` is inside a folder with a known structure).

For workspace-level questions ("what meetings do I have today?"), Cowork uses the planner's HTTP API directly.

### 6.2 The two integration paths

| Path | When | How |
|---|---|---|
| **Filesystem direct** | Reading lots of files at once; writing single notes/summaries. | `Read` / `Write` / `Glob` / `Bash` against absolute paths under the workspace root. |
| **HTTP API** | Modifying CLAUDE.md fields; creating projects/meetings; binary uploads where you don't have shell access. | `fetch('http://localhost:3000/api/...')` or `curl`. |

Both end up at the same files. The HTTP path uses **section-aware writes** (`lib/fs-writer.mjs`) — it rewrites only the fields you send and preserves the rest of the file verbatim, including unknown sections. The filesystem path requires Cowork to preserve the full file structure manually.

### 6.3 Cowork's primary write targets

| Target | Folder | Filename pattern | Why |
|---|---|---|---|
| **Chat summary** (per-project) | `<project>/Chat Summaries/` | `YYYY-MM-DD - <slug>.md` | Captures a finished conversation. |
| **Chat summary** (workspace) | `Personal Workspace/Chat Summaries/` | `YYYY-MM-DD - <slug>.md` | When no specific project applies. |
| **Project notes** | `<project>/Notes/` | `<slug>.md` | Human-style note, but Cowork can author them when asked. |
| **Meeting transcript (raw)** | `<meeting>/Transcripts/` | original or `YYYY-MM-DD <Title>.vtt` | Raw transcript export. |
| **Meeting summary** | `<meeting>/CLAUDE.md` `## Transcript Summary` | n/a — section update | Cowork-summarized transcript. |
| **Time summary** | `Personal Workspace/Time Summaries/` | `YYYY-MM-DD weekly.md` | Weekly/monthly digest. |

### 6.4 Cowork skill catalog (suggested)

| Skill | Trigger phrasing | Behavior |
|---|---|---|
| `save-chat-summary` | "save this chat", "summarize this for [project]" | Compose summary → write to `<project>/Chat Summaries/` |
| `sync-meetings` | "sync my calendar", "pull this week's meetings" | Outlook MCP → `POST /api/meeting/create` per event → `POST /api/meeting/<folder>` for metadata |
| `process-transcript` | "summarize the [meeting] transcript" | Read raw transcript → write summary to CLAUDE.md `## Transcript Summary` |
| `project-status-brief` | "what's the status of [project]" | Read CLAUDE.md + last 3 notes + last 2 chat summaries → narrate |
| `weekly-summary-draft` | "draft my weekly summary" | Read all notes + meeting summaries from past 7 days → write to `Time Summaries/` |
| `cc-draft-from-context` | "draft the EtQ change control sections" | Read project's CLAUDE.md + notes → produce 4 standard CC sections |
| `add-quick-meeting` | "log a meeting with [people] about [topic]" | `POST /api/meeting/create` with current date + title |

### 6.5 Cowork DOs and DON'Ts

**DO:**
- Use `POST /api/project/<folder>` and `POST /api/meeting/<folder>` for any CLAUDE.md edit. The section-aware writer prevents clobbering.
- Write chat summaries to `Chat Summaries/` (project-only folder), keeping them distinct from human Notes.
- Use the deterministic `nameColor()` for meeting colors.
- Treat the em-dash literally (`U+2014`, `—`) in meeting folder names.
- Preserve `*.bak` files.
- Use `encoding: "base64"` for any binary upload via HTTP.

**DON'T:**
- Don't append to existing chat summary files — always create a new one.
- Don't write summaries to `Notes/` — that's the human notebook.
- Don't write to `Completed/` directly — change `status: completed` and let the planner archive.
- Don't add `isMeeting: true` to project CLAUDE.md files — only meetings get that.
- Don't create `Chat Summaries/` inside meeting folders — the planner ignores it there.
- Don't manually move files across mounts while the server is running — let chokidar's debounce settle, or stop the server first.

### 6.6 End-to-end example: "Save this chat about the P4 flow meter"

```bash
# 1. Find the project folder
curl -s localhost:3000/api/projects | jq '.[] | select(.folder|startswith("CC11142"))'
# → { folder: "CC11142 - Flow Meter Migration P1-P3", ... }

# 2. Compose the summary (Cowork generates this in the conversation)

# 3. Write it
curl -X POST "localhost:3000/api/project/CC11142%20-%20Flow%20Meter%20Migration%20P1-P3/file" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "Chat Summaries/2026-05-06 - p4-flow-meter-decision.md",
    "content": "# P4 flow meter range decision\n\n_Saved by Claude Cowork on 2026-05-06_\n\n## Context\n…"
  }'
# → {"ok":true}

# 4. The planner's SSE pushes the change to any open browser within 200ms.
```

### 6.7 End-to-end example: "Sync my morning meetings"

```bash
# 1. Cowork pulls Outlook events from 00:00–12:00 today via the Outlook MCP.

# 2. For each event:
curl -X POST localhost:3000/api/meeting/create \
  -H "Content-Type: application/json" \
  -d '{"title":"ArC Scrum","date":"2026-05-06"}'
# → {"ok":true,"folder":"2026-05-06 — ArC Scrum"}

# 3. Populate metadata:
curl -X POST "localhost:3000/api/meeting/2026-05-06%20%E2%80%94%20ArC%20Scrum" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime":"08:00",
    "endTime":"08:30",
    "location":"Arnold-114",
    "organizer":"Misha Dyskin (misha.dyskin@promega.com)",
    "recurrence":"Weekly",
    "meetingId":"<outlook id>",
    "lastSynced":"2026-05-06T13:14:26Z",
    "attendees":[
      {"name":"Claire Moll","email":"claire.moll@promega.com","response":"Accepted"}
    ],
    "agenda":"- Stand-up\n- Blockers"
  }'
```

### 6.8 Reading project context for Q&A

User asks: *"What's the status of CC11142?"*

```bash
# A. Project-level
curl -s localhost:3000/api/project/CC11142%20-%20Flow%20Meter%20Migration%20P1-P3
# → {name, description, status, priority, startDate, endDate, progress, ...}

# B. Recent notes
curl -s localhost:3000/api/project/CC11142%20-%20…/notes-list
# → [{name, path, title, preview, modified, lines}, ...] (sorted by mtime desc)

# C. Recent chat summaries
curl -s localhost:3000/api/project/CC11142%20-%20…/chats-list

# D. Read the latest 2-3 of each via /file?path=… for full context
```

Synthesize: current status, recent decisions, open questions, what's next.

---

## 7. Detailed UI behavior reference

This section is a feature-by-feature breakdown for an HTML rendering pass. Each section names a UI element and what it does.

### 7.1 Calendar tab

- Month grid. Today is highlighted (gold border).
- Each project renders as a horizontal bar spanning its date range. Color = project's `color` field (or priority default).
- Each meeting renders as a chip on its date. Color = `nameColor(title)` hash, so recurring meetings cluster visually.
- Click a project bar / meeting chip → opens the detail view.
- Header arrows step month-by-month. "Today" button jumps back.

### 7.2 All Projects tab

- Grouped by status (On Track / At Risk / Behind / Blocked / On Hold / Completed).
- Each row: title, priority dot, dates, progress bar, color swatch.
- Filter input filters by name. Status pills toggle visibility per group.
- "+ New Project" → modal asks for name + mount → `POST /api/project/create`.
- Clicking a row opens detail.

### 7.3 All Meetings tab

- Reverse chronological list. Today's meetings highlighted.
- Each row: date, time, title, location, organizer, attendee count.
- Filter input.
- "+ New Meeting" → modal asks for title + date → `POST /api/meeting/create`.

### 7.4 Detail view (project or meeting)

- **Sub-tab strip** at top (Details / Notes / Chat Summaries / Files).
- Title row has the **Show in Folder** 📁 button to the left of the editable title input.
- Details fields auto-save with debounce (~400ms after typing stops). Saves go to `POST /api/project/<folder>` or `POST /api/meeting/<folder>`.
- Notes / Chat Summaries: card grid. Click a card to open inline editor. "+ New Note" / "+ New Summary" creates a blank `.md` and opens it for editing.
- Files: 2-pane (sidebar tree + main editor). Tree supports drag-drop (internal moves + OS uploads), right-click context menu (Rename / Delete / Show in Folder), and inline preview for many file types.

### 7.5 Files tab (global)

- Same 2-pane layout as project Files, but rooted at the workspace `files` mount.
- Sidebar header has its own 📁 button to reveal the root in Explorer.
- Drag any external file onto the sidebar (anywhere) → uploads to root.
- Drag onto a specific folder row → uploads to that subfolder.

### 7.6 Summaries tab

- Date range picker (From / To) + quick range buttons (This Week / Last Week / 2 Weeks / This Month).
- Pulls notes + meeting summaries within the range, lays them out as a draftable digest.
- "Save Summary" writes a markdown file to `<workspace>/Time Summaries/`.

### 7.7 Settings

- Workspace root path + a button that triggers `/api/browse/folder` (native picker).
- Per-mount paths editable.
- Priority colors: 4 swatches (high / medium / low / completed), each click opens a color picker. Save → `POST /api/config`.

### 7.8 Right-click menus

| Where | Items |
|---|---|
| File row in tree | 👁 Open · 🔍 Show in folder · ✏ Rename · 🗑 Delete |
| Folder row in tree | 📁 Open folder (expand) · 🔍 Show in folder · ✏ Rename · 🗑 Delete |
| Misspelled word in any text field | <suggestions...> · Add to Dictionary · Cut / Copy / Paste |

### 7.9 Keyboard shortcuts

| Key | Effect |
|---|---|
| F12 | Toggle DevTools (for self-diagnosis) |
| Ctrl+R | Reload ignoring cache |
| Esc | Close modals / popups |

### 7.10 Live reload signaling

Every save triggers an SSE event. The renderer subscribes once and reloads only the views that depend on the changed file. So edits in VS Code, file copies into the tree, or external Cowork writes all show up live.

---

## 8. Build / dev setup

### 8.1 Prerequisites

- Node.js 18+ (only for development; the `.exe` is self-contained).
- Windows for the build (NSIS target).

### 8.2 Run from source (dev)

```powershell
npm install
npm start                # node server.mjs — open http://localhost:3000 in any browser
# OR
npm run app              # boots the Electron wrapper instead
```

### 8.3 Build the installer

```powershell
# Edit package.json: bump "version"
npm run dist
# Output: dist-app\Promega Project Planner Setup <version>.exe
```

### 8.4 File-by-file map

| File | Role |
|---|---|
| `electron-main.cjs` | Electron entry. Boots BrowserWindow, spawns server, handles spell-check context menu. |
| `server.mjs` | Node HTTP server, all routes, chokidar watcher, SSE. |
| `Promega.Project.Planner.V3.html` | The entire UI (CSS/HTML/JS in one file). |
| `bin/launch.cjs` | Cross-shell launcher for `npm run app`. |
| `lib/fs-parser.mjs` | Parses `CLAUDE.md` (project) and meeting `CLAUDE.md` into JS objects. |
| `lib/fs-writer.mjs` | Section-aware write (`upsertSection`) — preserves unknown sections. |
| `lib/fs-ops.mjs` | Tree build, raw stream, move/rename/mkdir/delete with OneDrive-safe fallbacks. |
| `package.json` | npm metadata + electron-builder config (NSIS target). |
| `config.json` / `config.example.json` | Workspace paths + port + priority colors. |
| `tasks.json`, `ui-state.json` | App runtime state (not user data). |

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Empty UI / "Server failed to start" | Port 3000 busy. | Quit other Node processes, or change `port` in config. |
| "No folder yet" on the Show-in-Folder button | Project / meeting folder hasn't been saved yet. | Edit the title (which triggers folder creation) or pick from the list. |
| Spell-check doesn't show suggestions | Old build (≤3.0.3). | Install 3.0.4+. |
| Drag-drop bounces back | OS file drop is being intercepted by the OS dock or the renderer is blocking it. | Drop on a different region inside the sidebar. If still failing, F12 → check console for errors. |
| Folder name with em-dash looks weird | Windows substituted a hyphen. | Use Alt+0151 or paste `—` from this doc. The planner ignores wrong-dash folders. |
| Changes from VS Code not appearing | Watcher missed a file (rare on OneDrive). | Hit the Refresh icon in the sidebar header, or Ctrl+R. |
| Installer skipped install | Same version as already installed. | Bump `version` in `package.json` and rebuild. |
| `EBUSY` on a move | OneDrive lock. | Retry once. The server already retries internally with copy+delete fallback. |
| "Cannot move a folder into itself" toast | Trying to drop a folder onto its own descendant. | Drop somewhere else. |
| Spell-check menu hides custom right-click menu | Both fired on a misspelled word in an editable area. | Click off the misspelled word; the planner's own menu (Rename/Delete/etc.) only opens on tree rows, which aren't editable. |

---

## 10. Versioning & change log

| Version | Date | Highlights |
|---|---|---|
| 3.0.0 | 2026-04 | Initial V3 — single-HTML UI, Electron wrapper, NSIS installer. |
| 3.0.1 – 3.0.2 | 2026-04 | Bug fixes, voice-notes, animation polish. |
| 3.0.3 | 2026-04-28 | Live SSE reload, OneDrive-safe move retries, Time Summaries. |
| 3.0.4 | 2026-05-05 | **Show-in-Folder** button + right-click menu, **native spell-check** suggestions menu, **whole-sidebar OS file drop** for uploads. |

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **COWORK workspace** | The folder containing `Projects/`, `Meetings/`, etc. Each user picks their own. |
| **Mount** | A configured project root. Default: two mounts (Projects + Change Controls). |
| **CC** | Change Control. A regulated engineering project. Folder name pattern: `CC<NNNNN> - <Title>`. |
| **CLAUDE.md** | The single source-of-truth file inside each project / meeting folder. Cowork reads + writes this. |
| **Cowork** | Claude (Sonnet/Opus) running with planner-aware skills inside Claude Code or Claude Desktop. |
| **Planner** | Shorthand for this app — the Promega Project Planner V3. |
| **Section-aware write** | `lib/fs-writer.mjs:upsertSection` — replaces a `## Heading` body without touching other sections. |
| **SSE** | Server-Sent Events. The live-reload channel from server → browser. |
| **Em-dash** | `—` (U+2014). Required in meeting folder names. NOT the same as a hyphen `-`. |

---

## 12. Quick reference card

For Cowork to consult mid-conversation:

```
Workspace root:    [user's COWORK path] (from /api/config)
Project mounts:    [array of paths] (from /api/config)
Meetings folder:   <root>/Meetings/

Project folder:    <mount>/<Project Name>/
  └─ CLAUDE.md          ← read+write via /api/project/<folder>
  └─ Notes/             ← human notes; one .md per
  └─ Chat Summaries/    ← Cowork's primary write target
  └─ Files/             ← attachments

Meeting folder:    Meetings/YYYY-MM-DD — <Title>/
  └─ CLAUDE.md          ← read+write via /api/meeting/<folder>
  └─ Notes/             ← human notes
  └─ Files/             ← attachments
  └─ Transcripts/       ← raw Teams .vtt / .docx

Forbidden:        Chat Summaries/ inside meetings · *.bak files · Completed/ writes

Most useful endpoints:
  GET    /api/projects              → list all
  GET    /api/meetings              → list all
  POST   /api/project/<f>           → field-level update
  POST   /api/meeting/<f>           → field-level update
  POST   /api/project/<f>/file      → write a file in the project
  GET    /api/show-in-folder?…      → reveal in Explorer
  GET    /api/watch                 → SSE live updates
```

---

End of reference. If anything in this guide conflicts with the actual code, **the code wins** — search `Promega.Project.Planner.V3.html`, `server.mjs`, and `lib/*.mjs`. The on-disk schema is the contract; the UI is the visualization.
