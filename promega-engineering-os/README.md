# Promega Engineering OS

An engineering workspace plugin tuned to the **Promega Project Planner V3** (the "Visualizer"), a Windows Electron desktop app that visualizes engineering work from plain folders and markdown on disk. The Visualizer is a single-process Electron app: no localhost server, no HTTP API. Cowork (Claude) and the Visualizer both read and write the same folders directly; they never talk to each other over the network.

The plugin creates and maintains the exact folder and file shape the planner expects, so every project, change control, and meeting shows up as a card in the UI with status, priority, dates, and progress. Everything below the surface is just folders and markdown in OneDrive (or any other location), readable with any text editor.

The plugin was built and tested at the Arnold Center (RDC) for the fermentation production support team, but the structure works for any Promega engineering team running the Logix 5000/500 and FactoryTalk Batch (PhaseManager / ISA-88) stack: process, automation, controls/instrumentation, validation, manufacturing, and IT/OT. RDC and fermentation context is the default during onboarding (`/begin` walks you through it), but the workspace shape and skills are general.

## What It Does

**Planner-shaped workspace.** `/begin` scaffolds a `Personal Workspace/` folder with two always-present mounts (`Projects/`, `Meetings/`) plus optional add-on mounts the engineer picks during the interview (`Change Controls/`, `DS Revisions/`, `Commissioning/`, `Documentation/`, or any custom name). Every project mount gets a `Completed/` subfolder for auto-archived work. After scaffolding, `/begin` offers a batch `/add-project` flow to seed a folder for each active piece of work the engineer mentioned. Each item folder has the canonical shape the planner needs:

```
[Project or CC]/
  CLAUDE.md                # Title + description + ## Planner Metadata block
  Notes/                   # One .md per human-written note
  Chat Summaries/          # Cowork-generated conversation summaries
  Files/                   # docx, xlsx, pdf, screenshots, etc.

[Meeting]/                 # YYYY-MM-DD — Title (real em-dash, U+2014)
  CLAUDE.md                # Same metadata block + Meeting Details + Attendees + Agenda + Transcript Summary
  Notes/
  Files/
  Transcripts/             # Raw .vtt or .docx transcript exports
```

Note: meetings do not have a `Chat Summaries/` folder. The planner ignores it on meetings. Cowork-generated meeting summaries go into the meeting's `## Transcript Summary` section in CLAUDE.md.

**Three-tier knowledge search.** When answering Promega-specific questions, the plugin searches the engineer's Personal Workspace first, then the shared RDC team folder (if connected) or SharePoint, then general knowledge.

**Team sharing stays separate.** `/share-chat`, `promote-to-team`, and `/join-team` push knowledge to the shared `RDC Renovations - 06 Production Support/` folder (Troubleshooting / Tribal Knowledge / Brainstorming). That workflow lives alongside the planner model, not inside it. Files written to the shared folder are `.txt` (not `.md`) for SharePoint preview and search compatibility; the local copy in the engineer's planner stays as `.md` so the planner can render it. `/share-chat` summarizes the current Cowork conversation; `promote-to-team` is the dictation-and-existing-content path.

**Meeting ingest.** The `meeting-sync` skill pulls Outlook events into the `Meetings/` mount using the planner's em-dash folder naming rule, populates the Meeting Details, Attendees, and Agenda tables, and handles transcript summarization into `## Transcript Summary`. Every run covers the current workweek plus next workweek (Monday to Friday, 2 weeks). Two modes: scheduled (auto-pulls last-workday transcripts, deletes cancelled-meeting folders silently) and interactive (asks per cancelled folder, asks which transcripts to pull). OOO events update a single `Meetings/OOO.md` file rather than creating folders. **`meeting-sync` does not run automatically during `/begin`; trigger it manually with "sync my meetings" when you're ready.**

**Change control drafting.** `/begin` seeds a folder for each active CC the engineer mentions during onboarding. Other skills know to look for CCs in the `Change Controls/` mount (or wherever the engineer chose to keep them; see `## MOUNTS` in the workspace CLAUDE.md).

**EM and batch context.** The workspace CLAUDE.md has an `## EQUIPMENT MODULES (EM) REFERENCE` section listing the 8 core EMs (AIR, OXYGEN, PRESSURE, AGITATION, TEMPERATURE, XFER_IN, XFER_OUT, pH) and where EM Phase Summary spreadsheets live. For deeper batch control reference (Phase state machine, CM tag naming, recipe types, FERMB-specific terminology), use the `isa88-guide` skill. For Design Spec work, use `sharepoint-search` to locate the right document.

## Components

### Commands

| Command | What it does |
|---|---|
| `/begin` | One-time workspace onboarding (about 15 minutes). Walks through the planner architecture, runs a 6-phase interview, asks which optional mounts to add (Change Controls/, DS Revisions/, Commissioning/, Documentation/, or custom), scaffolds `Personal Workspace/` with all chosen mounts (each with a `Completed/` subfolder), runs a batch `/add-project` flow over the active work the engineer mentioned, and generates a Personal Preferences block. Does **not** auto-run meeting-sync; trigger that manually after onboarding. |
| `/add-project` | Scaffolds a new project, change control, DS revision, or any item in any project mount with the canonical planner schema (`CLAUDE.md` plus `## Planner Metadata` block, `Notes/`, `Chat Summaries/`, `Files/`). Asks for name, description, and which mount. Does NOT create meetings; those come from `meeting-sync` only. |
| `/save-summary` | Saves a summary of the current Cowork conversation into the right project's `Chat Summaries/` folder AND appends a pointer to a `## Recent Summaries` section in the project's `CLAUDE.md` so the context is visible on future sessions. Project-only, no team push. |
| `/save-note` | Saves a discrete note into the right project's `Notes/` folder. Captures the engineer's words verbatim when specific, asks when vague. Also available as the `save-note` skill on trigger phrases like "save to notes", "note that...", "remember this", "log this fix", "create session notes". |
| `/share-chat` | Wraps `/save-summary`, then pushes a `.txt` copy of the same content to the engineer's category folder in the shared RDC team folder (Troubleshooting / Tribal Knowledge / Brainstorming). Operates ONLY on the current conversation. For dictation or sharing existing notes/summaries, use `promote-to-team`. |
| `/join-team` | Connects the shared RDC SharePoint-synced folder for team knowledge sharing. Run after `/begin` if the shared folder wasn't available during initial setup. Updates the `## RESOLVED PATHS` section of the workspace CLAUDE.md surgically. |

### Skills

| Skill | What it does |
|---|---|
| `meeting-sync` | Pulls Outlook events for this workweek plus next workweek into `Meetings/`. Two modes: scheduled (auto-pulls last-workday transcripts, deletes cancelled folders silently) and interactive (asks per cancelled folder, asks which transcripts to pull). OOO events update `Meetings/OOO.md` rather than creating folders. Does **not** create `Chat Summaries/` inside meeting folders. |
| `save-note` | Skill counterpart to the `/save-note` command. Triggers on natural-language phrases like "save to notes", "remember this", "note that...", "log this fix", "create session notes". Delegates to the same logic as `/save-note`. |
| `sharepoint-search` | Three-tier knowledge search: Personal Workspace first, then shared team folder (searches both `.md` and `.txt` files), then SharePoint, then general knowledge. Cites sources. Refers to `/save-note`, `/share-chat`, and `promote-to-team` as capture options when the engineer wants to add knowledge for next time. |
| `promote-to-team` | Pushes engineer-dictated knowledge or existing notes/summaries to the shared RDC team folder under Troubleshooting, Tribal Knowledge, or Brainstorming. Saves a `.md` Note locally AND a `.txt` copy to the shared folder (filename convention matches `/share-chat`). For sharing the current conversation, use `/share-chat`. |
| `isa88-guide` | ISA-88 batch model reference tuned to Promega's FactoryTalk Batch / PhaseManager implementation. Promega-specific terminology (Recipe / UP / OP / Phase / EM / CM), the Phase state machine, CM tag naming (`_LLLL_TYPE_NNN`), recipe types, FERMB P6 example. Includes the full `ISA88_AI_Reference_FERMB_v3.docx` reference file. |

## The on-disk schema (the contract)

Every skill in this plugin follows the schema in `PLANNER_REFERENCE.md` at the plugin root. Highlights:

- **Always-present mounts**: `Personal Workspace/Projects/` and `Personal Workspace/Meetings/`.
- **Optional add-on mounts** (chosen during `/begin`): `Change Controls/`, `DS Revisions/`, `Commissioning/`, `Documentation/`, or any custom name the engineer types. Each gets its own `Completed/` subfolder.
- The authoritative list of mounts for a given workspace lives in the workspace `CLAUDE.md`'s `## MOUNTS` section. Skills read it before suggesting where to put something.
- **Meetings** live under `Personal Workspace/Meetings/` with folder names like `2026-04-21 — ArC Scrum`, with the real **em-dash** (U+2014), not a hyphen. Meeting folders have `Notes/`, `Files/`, and `Transcripts/`. **No `Chat Summaries/` on meetings.**
- Every project item folder (project, CC, DS revision, anything in a project mount) has `CLAUDE.md`, `Notes/`, `Chat Summaries/`, and `Files/`.
- `CLAUDE.md` has a `## Planner Metadata` block with `status`, `priority`, `startDate`, `endDate`, `progress`, `stress`, `color`. This block is parsed strictly. Skills preserve it surgically. Meetings add `isMeeting: true`.
- Setting `status: completed` triggers the planner's auto-archive into `[mount]/Completed/`.
- Live reload: the planner watches the filesystem, so changes appear in the UI within about 200 ms.
- Files written to the **shared RDC team folder** are `.txt` (for SharePoint compatibility); local copies in the engineer's planner stay as `.md`.

## Setup

### Prerequisites

1. **Microsoft / SharePoint connector**: enable in Claude Cowork for SharePoint search and Outlook meeting ingest.
2. **SharePoint sites** the plugin commonly references during onboarding and search. The list below is a starting point, the engineer can add or remove during `/begin`:
   - `RDC Renovations`
   - `RDC Renovations - 06 Production Support`
   - `Process Engineering 2`
   - `IVD Production and Engineering`
   - `QA Audit`
   - `EMS Audit`

### Getting Started

1. Install the plugin in Claude Cowork.
2. Mount a folder that contains (or will contain) a SharePoint shortcut to `RDC Renovations - 06 Production Support`. The shortcut is optional during initial setup. `/begin` works without it, and `/join-team` can be run later to wire it up.
3. Type `/begin` to run onboarding (about 15 minutes). It walks through the planner architecture, runs the interview, asks which optional mounts you want, scaffolds `Personal Workspace/`, runs a batch `/add-project` flow over the active work you mention, and generates a Personal Preferences block.
4. If the shared RDC folder wasn't available during setup, add the SharePoint shortcut and run `/join-team`.
5. Open the Visualizer from the Start menu or desktop shortcut. (See the Getting Started guide for installing the Visualizer `.exe` and pointing it at your `Personal Workspace/` folder.) Your cards appear once it's launched.
6. When you're ready, say "sync my meetings" to trigger `meeting-sync` and pull this workweek plus next workweek's Outlook events.
7. Start working. Say "save to notes on CC11142" (or `/save-note`) to drop a note onto that CC. Say "save this chat on the P4 flow meter project" (or `/save-summary`) to write a project summary card. Say "share this with the team" (or `/share-chat`) to also push a `.txt` to the shared RDC folder.

## Daily usage

- **Engineering questions**: Claude searches the workspace first, then the team folder, then SharePoint, then general knowledge (via `sharepoint-search`).
- **"What EM handles pressure?"**: falls back to the workspace CLAUDE.md's `## EQUIPMENT MODULES (EM) REFERENCE` for the 8 core EMs, then to `isa88-guide` for deeper batch model context.
- **"Add a CC for the flow meter migration"** (or `/add-project`): creates a new folder in your `Change Controls/` mount (or `Projects/` if you don't have a Change Controls mount) with the canonical `CLAUDE.md` plus `Notes/` plus `Chat Summaries/` plus `Files/`.
- **"Save to notes on [project]"** (or `/save-note`): drops a note into that folder's `Notes/`.
- **"Save this chat on [project]"** (or `/save-summary`): writes a conversation summary to that folder's `Chat Summaries/` and adds a pointer in its CLAUDE.md.
- **"Share this with the team"** (or `/share-chat`): does everything `/save-summary` does AND pushes a `.txt` copy to the shared RDC folder under the right category.
- **"Team should know that..."** (or `promote-to-team`): engineer dictates content directly to the team folder.
- **"Sync my meetings"**: pulls this workweek plus next workweek's Outlook events. Add "and pull yesterday's transcripts" or similar to drive transcript ingest in interactive mode.
- **"Summarize the [meeting] transcript"**: drop a .vtt or .docx into the meeting's `Transcripts/` and `meeting-sync` writes the summary into `## Transcript Summary`.

## Team Context

The plugin ships with Arnold Center (RDC) production support context loaded by default during `/begin`. If you're at a different Promega site or work in a different product area, the workspace CLAUDE.md is fully editable after onboarding; trim, replace, or extend any section to match your reality. The structure does not assume RDC.

### Arnold Center (RDC) Production Systems (the plugin's default context)

- **Production process**: seed stocks, fermentation, centrifuging, cell paste.
- **Fermentation**: Ferm A (P1, P2, P3, P4, P5 vessels), Ferm B (P6 vessel), Large Scale (two 3000L automated mixing tanks).
- **Additional equipment**: centrifuges, CIP skids, nano filtration, pure water skid, biokill / waste neutralization, autoclaves, parts washers, boilers, compressed air.
- **Control platform**: Logix 5000, Logix 500.
- **Batch system**: FactoryTalk Batch with PhaseManager (ISA-88).
- **SCADA / HMI**: FactoryTalk View SE, FactoryTalk View ME.
- **FactoryTalk Suite**: FT Directory, FT Alarms and Events.
- **Data and reporting**: Power BI (Historian), SQL, SSRS.
- **Infrastructure**: Remote Desktop, ESXI, VMWare, Stratix managed switches (5400, 5410, 5700).
- **Equipment Modules**: AIR, OXYGEN, PRESSURE, AGITATION, TEMPERATURE, XFER_IN, XFER_OUT, pH, plus hundreds of system-specific EMs.
- **Design Specs**: `[PROJECT#]-DS-PRO-[SYSTEM]-001` (FERMA, FERMB, LS, SCADA, MISC, UFNF, Utilities).
- **Vendors**: CRB (engineering), Rovisys (system integration), Alfa Laval (filtration), and others.

### Document and Quality Systems (Promega-wide)

- **MasterControl** (QMS): SOPs (SOP-XXX-##), Work Instructions (WI-XXX-##), Specifications (SPEC-XXX-##), Test Methods (TM-XXX-##), Forms (FORM-XXX-##), Validation Protocols (VP-XXX), Validation Reports (VR-XXX).
- **EtQ**: Change controls (CC#####), Deviations (DEV-####), CAPAs (CAPA-####).
- **VelocityEHS**: EHS incidents, Job Safety Analyses (JSAs), Process Hazard Analyses (PHAs), Safety Data Sheets (SDS).
- **TSOPs**: Technical SOPs (e.g., TSOP000709, Preparation and Operation of Fermentor P1).
- **QSOPs**: Quality SOPs.
- **SharePoint**: Working documents, project files, team knowledge. Not authoritative for controlled documents.

### Manufacturing Classifications (Promega-wide)

Promega manufactures across multiple product classifications, each with different change control rigor: Research (RUO, standard rigor), IVD (FDA 21 CFR 820, ISO 13485, enhanced), cGMP Reagent (FDA 21 CFR 211, enhanced), API (FDA 21 CFR 211, ICH Q7/Q9, full GMP), Drug Product (FDA 21 CFR 211, ICH Q8/Q9/Q10, full GMP). When a change touches equipment shared across classifications, apply the most stringent.

### IT Infrastructure Coordination (Promega-wide)

- **ITOT** (Operational Technology): Jira project at `https://promega.atlassian.net/jira/software/projects/ITOT`.
- **ITNET** (Networking): Jira project at `https://promega.atlassian.net/jira/software/projects/ITNET`. SharePoint docs at `https://promega.sharepoint.com/sites/ITNET`.
- **IT Service Portal**: `https://servicedesk.promega.com/support/home`.
- Network changes need advance notice for change control and scheduling.

## Author

Will Aadland, Promega Corporation.
