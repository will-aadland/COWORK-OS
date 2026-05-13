---
name: begin
description: One-time setup for the Promega Engineering OS workspace. Builds the planner-shaped folder structure (Projects/, Meetings/, and optional add-on mounts), runs a full interview to generate a Personal Preferences block, and offers to scaffold folders for the engineer's active work. Does NOT auto-run meeting-sync; the engineer triggers that manually after onboarding.
---

# /begin: Promega Engineering OS Setup

One-time onboarding for Promega's process and automation engineering teams. The plugin's defaults are tuned to the Arnold Center (RDC) production support team running fermentation, but the structure works for any Promega engineering team running the Logix 5000/500 and FactoryTalk Batch / PhaseManager (ISA-88) stack: process, automation, controls/instrumentation, validation, manufacturing, IT/OT.

The output is a workspace shaped for the **Promega Project Planner V3** (the Visualizer, a Windows Electron desktop app) plus a Personal Preferences block to paste into Claude Settings. The Visualizer has no localhost server and no HTTP API; Cowork and the Visualizer both read the same folders directly.

**This command runs once.** It doesn't have an update mode. If something needs to change later, edit files directly, use `/add-project` for new work, or update Personal Preferences in Claude Settings.

**`/begin` does NOT run meeting-sync.** The engineer triggers it manually with "sync my meetings" after onboarding completes. This avoids creating meeting folders before the workspace is settled.

**Read `PLANNER_SCHEMA.md` at the plugin root before running this command.** It defines the on-disk schema every skill in this plugin follows (mounts, project/meeting folder layouts, filename conventions, safe-edit rules). For background — distribution, architecture, full UI behavior — `PLANNER_REFERENCE.md` is also available but not required for this command.

---

## Tone

Professional and efficient. Engineers who work with PLCs, batch systems, and regulated processes. No emojis in questions, no theatrical framing, no fluff. Think "sharp colleague helping you set up a new tool", not onboarding chatbot.

---

## Step 0: One-time architecture explanation

Before any questions, lay out the model in one message. Keep it simple and short, four paragraphs, not a wall of text. Use roughly this phrasing, but adapt to the engineer's prior responses if any.

> **What we're building.** Your workspace will be a folder called `Personal Workspace/` inside the folder you've mounted. Inside it are a few subfolders the Promega Project Planner reads, each one acts as a bucket for a kind of work. `Projects/` and `Meetings/` always exist. You can optionally add more buckets during setup: `Change Controls/`, `DS Revisions/`, `Commissioning/`, etc.
>
> **How items are stored.** Inside every bucket, each item is its own folder. Projects, change controls, and other items get four parts: `CLAUDE.md` (the planner metadata: status, priority, dates, progress), `Notes/` (your own notes, one file per note), `Chat Summaries/` (where Cowork saves summaries of our chats), and `Files/` (docx, xlsx, pdf, anything else). Meetings get `CLAUDE.md`, `Notes/`, `Files/`, and `Transcripts/`. Meetings do not have `Chat Summaries/`; the planner ignores it on meetings, so meeting summaries go into the meeting's `## Transcript Summary` section instead.
>
> **The Visualizer.** The Visualizer is a Windows Electron desktop app you launch from the Start menu or desktop shortcut. It reads these folders directly from disk and shows each one as a card with its status and dates. You never edit the Visualizer's database; there isn't one. The folders on disk *are* the data. The Visualizer has no localhost server, no API. I (Cowork) write to the same folders directly, and the Visualizer's file watcher picks up the changes within about 200 ms.
>
> **What /begin does.** I'll ask you about your role, work, tools, and how you like to operate, about 15 minutes. At the end, I'll create the folder structure, give you a Personal Preferences block to paste into Claude Settings, and offer to scaffold folders for the work you mentioned. Meeting sync is a separate step you'll trigger when you're ready, not part of `/begin`.

Then **AskUserQuestion**:
- **Ready, start the interview**
- **Wait, I have questions first** (then answer them, return here)

---

## Step 0.5: Mounted Folder Discovery

Run before the interview. Low-pressure. The RDC shared folder is optional for setup.

### 1. Identify the mounted workspace

```bash
ls -1 /sessions/[session-id]/mnt/ | grep -v '^\.'
```

The engineer's mounted folder is where `Personal Workspace/` will live.

### 2. Look for the shared RDC folder (optional)

```bash
find /sessions/[session-id]/mnt/[MOUNT_NAME] -type d -name "RDC Renovations*" -maxdepth 3
```

- **One match**: store the path, mention it briefly: *"Found the RDC shared folder. I'll use it when you share things with the team."*
- **Multiple matches**: use **AskUserQuestion** to let the engineer pick.
- **No match**: don't make a thing of it. Note it quickly and move on: *"I don't see the RDC shared folder in your mount. That's fine, your workspace will be fully set up without it. Team sharing will work once you add the SharePoint shortcut and run `/join-team`."*

Store resolved paths for later use in the workspace CLAUDE.md.

---

## Step 1: Check Personal Preferences

If detailed personal preferences already exist (name, role, tools, communication style are all filled in), offer a quick branch:

> "I have a good picture of who you are from your preferences. Want to update anything before we set up your workspace, or should I work with what I have?"

**AskUserQuestion**:
- **Use what you have**: skip to Step 3 (interview)
- **Update my profile**: run the interview in full

Default to running the full interview if preferences are sparse, generic, or missing.

---

## Step 2: The Interview (about 15 min, one question at a time)

Set expectations once:

> "I'll ask you a series of questions to understand your role, workflow, and where I can be most useful. About 15 minutes. Skip any question by saying so."

Ask **one question at a time**. Let each answer inform the next.

### Phase 1: Who You Are

**Q1. Name plus assistant preference** (in chat)
> "What's your name? And should I go by Claude, or would you prefer a different name?"

**Q2. Site, team, role** (in chat) followed by a structured role pick.

First in chat:
> "Which Promega site do you work at, and what's your team or area? (For example: Arnold Center fermentation production support, Madison ITOT, Fitchburg manufacturing.)"

Note the answer. The plugin's defaults are tuned to RDC fermentation, but if the engineer is somewhere else, adapt the workspace CLAUDE.md (Step 3.3) accordingly: keep the Promega-wide content (EtQ, MasterControl, VelocityEHS, manufacturing classifications, IT coordination), trim or replace the RDC-specific Equipment Module reference, and ask the engineer in Step 3.3 whether to keep the fermentation EM defaults or replace them with their own area's reference.

Then **AskUserQuestion** for role:
- Automation Engineer: PLC programming, batch control, SCADA, controls design
- Process Engineer: fermentation, purification, process optimization, scale-up
- Controls / Instrumentation Engineer: control systems, instrumentation, calibration
- Validation Engineer: IQ/OQ/PQ, commissioning, qualification protocols
- Co-op / Intern: learning the ropes, working on assigned projects
- Engineering Manager / Tech Lead: overseeing projects, team coordination

**Q3. Day-to-day** (in chat)
> "Walk me through a typical work week. What takes up most of your time? What systems, equipment, or processes do you touch?"

Note: vessels (P1 to P6, Large Scale, or whatever the engineer mentions), equipment types (fermenters, centrifuges, CIP skids, nano filtration, pure water skid, biokill, autoclaves, parts washers, boilers, compressed air, or area-specific kit), control systems, recurring meetings.

**Q4. Team and scope** (in chat)
> "What systems or areas do you own or contribute to?"

**Q5. Active work** (in chat). Single merged question covering CCs, projects, and anything else.
> "What work do you have on your plate right now? Everything: change controls, projects, DS revisions, commissioning, investigations, whatever you're actively working on. Give each one a short name and a one-liner. Don't worry about categorizing them, I'll sort them into folders later."

Record every item. These feed the batch `/add-project` offer at the end. Capture CC numbers literally if the engineer mentions them (e.g., "CC11142, Flow Meter Migration"). Useful context but not required.

**Q6. Open issues / things you're monitoring** (in chat)
> "Anything you're troubleshooting actively, or watching but not actively debugging? Equipment problems, control logic bugs, intermittent alarms, process deviations, anything."

This info lives in Personal Preferences only. No folders get created for these. If one grows into real work later, the engineer can use `/add-project`.

### Phase 2: How You Work

**Q7. Tools and tech stack** (in chat)
> "What tools do you work with regularly? The Rockwell ecosystem (Logix 5000/500, FactoryTalk Batch, FactoryTalk View) is the typical Promega baseline; include anything else: design tools, documentation systems, data analysis, scripting, project management."

**Q8. Communication style**: **AskUserQuestion**:
- Short and direct: bullet points, no preamble, get to the answer
- Detailed with context: explain the reasoning, show your work
- Match the situation: quick answers for quick questions, depth when it matters

**Q9. Documentation habits**: **AskUserQuestion**:
- I document as I go: DS updates, SOPs, change controls are part of my workflow
- I document when required: change controls and formal docs, but not proactively
- I barely document: it's a known gap I'd like to fix
- My role is more about consuming docs than writing them

**Q10. Production support involvement**: **AskUserQuestion**:
- Regularly: I troubleshoot equipment and control system issues on the floor
- Sometimes: I get pulled in for specific systems or escalations
- Mostly project work: I focus on new installations and upgrades
- Not directly: but I support those who do

### Phase 3: What Hurts

**Q11. Biggest time sinks**: **AskUserQuestion**, multiSelect. Pick from the role-specific option bank below based on the engineer's Q2 answer. Show 5 to 6 options. Keep the phrasing exactly as written below; the engineer is choosing from concrete, Promega-specific pain points, not generic ones.

*For Automation Engineers:*
- Design Specification updates: tracking revisions, formatting, consistency checks
- Change control documentation: drafting, getting approvals, EtQ submissions
- PLC troubleshooting: tracking down logic issues across routines and phases
- EM and Phase development: building and testing Equipment Modules and Phases
- Batch recipe configuration: setting up and modifying FactoryTalk Batch recipes
- Meeting prep and follow-up: project reviews, commissioning meetings, vendor calls

*For Process Engineers:*
- SOP and TSOP drafting: writing and revising standard operating procedures
- Process troubleshooting: diagnosing fermentation, purification, or other process issues
- Data analysis: reviewing batch data, trends, and process parameters
- Change control documentation: drafting and managing through EtQ
- P&ID reviews: checking accuracy against as-built systems
- Commissioning support: SAT/FAT execution and documentation

*For Controls / Instrumentation Engineers:*
- Instrument calibration documentation
- Control loop tuning and optimization
- Alarm management: reviewing, rationalizing, and documenting alarms
- Network configuration: Stratix switches, EtherNet/IP configuration
- System integration: connecting new instruments to the control system
- Spare parts and inventory tracking

*For Validation Engineers:*
- Protocol writing: IQ, OQ, PQ, SAT documentation
- Deviation and CAPA management
- Test execution documentation: recording results, handling exceptions
- Impact assessments for change controls
- Traceability matrices: linking requirements to tests
- Validation master plan maintenance

*For Co-ops / Interns:*
- Learning new systems: understanding how everything connects
- Documentation tasks: DS updates, spreadsheet maintenance, data entry
- Following SOPs: understanding procedures and their rationale
- Project tracking: keeping up with milestones and deliverables
- Technical writing: drafting clear, compliant documentation
- Getting feedback: understanding what "good" looks like

*For Engineering Managers / Tech Leads:*
- Project status tracking and reporting
- Resource allocation across active projects and production support
- Change control oversight: ensuring timely completion
- Cross-team coordination: process, automation, quality, production
- Technical decision-making: architecture reviews, equipment selection
- Mentoring and development: co-op guidance, team skill building

**Q12. Recurring frustrations** (in chat)
> "What's the thing that makes you think 'there has to be a better way to do this' at least once a week?"

**Q13. What falls through the cracks** (in chat)
> "Anything that regularly slips, things you mean to do but don't get to? Documentation updates, follow-ups, learning, process improvements, anything."

### Phase 4: What Would Help

**Q14. Desired help**: **AskUserQuestion**, multiSelect. Pick 5 to 6 options from the starter bank below based on the engineer's Q2 (role) and Q11 (time sinks) answers. Substitute `[their systems]` and `[their processes]` with what the engineer actually named in Q3 or Q4. Only show options that fit: don't show "Review my PLC logic" to a process engineer who hasn't mentioned PLC work.

**Starter bank:**
- Help me read and update Design Specifications for [their systems]
- Draft change controls and walk me through the EtQ process
- Be my troubleshooting partner for PLC and batch issues
- Help me understand ISA-88 and our FactoryTalk Batch implementation
- Write and maintain SOPs and TSOPs for [their processes]
- Search SharePoint before I reinvent the wheel
- Prepare me for meetings: summaries, agendas, action items
- Help me write and review validation protocols (IQ/OQ/PQ)
- Review my PLC logic and catch problems before commissioning
- Help me keep track of what's open across my projects
- Review batch data and trends in the Historian
- Keep me on top of open CCs and when they need attention
- Help me onboard: explain Promega systems as I encounter them

**Q15. Anything else** (in chat)
> "Last question: anything else you'd want me to always keep in mind when working with you? Preferences, pet peeves, things other tools get wrong?"

### Phase 5: SharePoint Knowledge Base

**Q16. SharePoint usage**: **AskUserQuestion**:
> "When you ask me engineering questions, how should I use SharePoint and team knowledge?"

- Always check SharePoint first: search team knowledge and company docs before answering
- Only when I ask: I'll tell you when to look things up
- Balanced: check SharePoint and team knowledge for standards, specs, and procedures; use general knowledge for technical concepts

**Q17. SharePoint areas**: **AskUserQuestion**, multiSelect. Generate 4 to 6 role-relevant options.

Examples:
- Design Specifications (Ferm A, Ferm B, SCADA, Misc, UF/NF, plus any area-specific docs)
- EM Phase Summaries and batch control documentation
- SOPs and TSOPs for production operations
- Change control records and procedures
- P&IDs and engineering drawings
- Commissioning and validation documentation
- Co-op Development Roadmap and training materials
- Project tracking and planning documents

### Phase 6: Mount Picker

Now explain the mount structure and let the engineer choose what to add.

> "Your workspace always gets two mounts: `Projects/` (for every piece of work you track) and `Meetings/` (where meeting-sync pulls your Outlook calendar). Some engineers like additional mounts to sort things further. Want any of these?"

**Q18. Additional mounts**: **AskUserQuestion**, multiSelect. Always include:
- **Change Controls**: A dedicated mount for CCs. Useful if you work on many CCs and want them grouped separately from regular project work.
- **DS Revisions**: A dedicated mount for Design Specification work.
- **Commissioning**: For SAT/FAT, equipment commissioning, handover work.
- **Documentation**: For SOP/TSOP/QSOP drafting and standalone doc work.

If the engineer wants something else, they type it in the free-text option that the UI provides. You can infer appropriate names from their earlier answers (e.g., "Training and Co-op Roadmap" for a co-op, "Audits" for a quality engineer).

Record the list of additional mounts. `/begin` will create them alongside `Projects/` and `Meetings/`, each with its own `Completed/` subfolder.

---

## Step 3: Scaffold the workspace

Now build the folder structure on disk. No project or CC folders created here, just the workspace skeleton and mounts.

### 3.1 Create Personal Workspace/

```
[Mounted Folder]/Personal Workspace/
├── CLAUDE.md                          # Written in 3.3
├── Projects/
│   └── Completed/                     # Empty, planner manages auto-archive
├── Meetings/
├── [Each selected mount from Q18]/
│   └── Completed/                     # Every project mount gets Completed/
├── Chat Summaries/                    # Workspace-level (cross-cutting summaries)
└── Files/                             # Workspace-level misc files
```

**Rule:** every project mount (Projects/, Change Controls/, DS Revisions/, etc.) MUST have a `Completed/` subfolder. `Meetings/` does not need one.

If the engineer named a custom mount (e.g., "Training and Co-op Roadmap"), create that folder too with its own `Completed/`.

### 3.2 Verify scaffold

```bash
test -d "[Mounted Folder]/Personal Workspace/Projects/Completed" && \
test -d "[Mounted Folder]/Personal Workspace/Meetings" && \
# ... for each selected mount:
test -d "[Mounted Folder]/Personal Workspace/[Mount Name]/Completed"
```

### 3.3 Write workspace-level CLAUDE.md

Create `Personal Workspace/CLAUDE.md`. Adapt the team context and EM reference sections to the engineer's site and area. The default below is RDC fermentation; if the engineer answered Q2 with a different site or area, replace the relevant sections (or, if you're not sure what to substitute, ask the engineer briefly: "I'll write the workspace CLAUDE.md with RDC fermentation defaults; want me to swap in your area's reference instead, or keep the default and you'll edit later?").

```markdown
# Promega Engineering Workspace, [USER NAME]

[USER NAME]'s engineering workspace, structured around the Promega Project Planner V3 (the Visualizer, a Windows Electron desktop app, launched from the Start menu / desktop shortcut). No localhost, no HTTP API; the Visualizer and Cowork both read the same folders directly.

## Quick Reference
- **Site**: [from Q2, e.g., Arnold Center (RDC), Madison main campus, Fitchburg, etc.]
- **Role**: [from Q2]
- **Team**: [from Q4]
- **Systems**: [from Q3 or Q4]
- **Tools**: [abbreviated from Q7]

## RESOLVED PATHS
- **Personal Workspace**: [full resolved path]
- **Shared Team Folder**: [full path to RDC Renovations - 06 Production Support/, or "NOT CONFIGURED, run /join-team"]
- **My Troubleshooting Folder**: [shared folder]/Troubleshooting/[Engineer Name]/  (omit if shared folder not configured)
- **My Tribal Knowledge Folder**: [shared folder]/Tribal Knowledge/[Engineer Name]/
- **My Brainstorming Folder**: [shared folder]/Brainstorming/[Engineer Name]/

## MOUNTS

This workspace has the following mounts (each is a top-level folder under Personal Workspace/). Every project mount contains a Completed/ subfolder for auto-archived work.

**Always present:**
- `Projects/`: general project work (mandatory)
- `Meetings/`: Outlook meeting sync target (mandatory)

**Additional mounts (from Q18):**
- [For each selected mount, list it here with a one-line purpose description]
- e.g., `Change Controls/`: EtQ change control tracking
- e.g., `DS Revisions/`: Design Specification revision work

If this list changes, update it by hand. It's read by /add-project and other skills to know where new items can go.

## PLANNER ARCHITECTURE

This workspace is shaped for the Promega Project Planner V3 (the Visualizer, a Windows Electron desktop app launched from the Start menu / desktop shortcut). Each item inside a project mount is its own folder with:

- `CLAUDE.md`: title, description, and `## Planner Metadata` block (status, priority, dates, progress, stress, color)
- `Notes/`: one `.md` per human-written note
- `Chat Summaries/`: Cowork writes conversation summaries here (filename: `YYYY-MM-DD - topic.md`)
- `Files/`: docx, xlsx, pdf attachments

Meetings have `CLAUDE.md`, `Notes/`, `Files/`, and `Transcripts/` (raw .vtt or .docx transcript exports). Meetings do NOT have `Chat Summaries/`; the planner ignores it on meetings. Cowork-generated meeting summaries go into the meeting's `## Transcript Summary` section.

**Never clobber `## Planner Metadata`.** Use Edit (not Write) for single-field changes. See `PLANNER_SCHEMA.md` § 2 in the plugin root for the full field reference and safe-edit rules.

**Live reload.** The planner watches the filesystem; files appear in the UI within about 200 ms. No refresh step.

## TEAM CONTEXT

[If site is RDC, use the default block below. If a different site, replace with a short paragraph naming the site, what's produced there, and the controls / data / infrastructure stack the engineer named in Q7. Keep the Document & Quality Systems, Manufacturing Classifications, and IT Coordination sections regardless of site since they're Promega-wide.]

**Facility (default, RDC)**: Arnold Center, Madison, WI
**Production**: Seed stocks → fermentation → centrifuging → cell paste
**Fermentation**: Ferm A (P1, P2, P3, P4, P5), Ferm B (P6), Large Scale (2x 3000L)
**Equipment**: Centrifuges, CIP skids, nano filtration, pure water skid, biokill, autoclaves, parts washers, boilers, compressed air
**Control Platform**: Logix 5000, Logix 500 / FactoryTalk Batch / PhaseManager / ISA-88
**SCADA/HMI**: FactoryTalk View SE, FactoryTalk View ME
**Data and Reporting**: Power BI (Historian), SQL, SSRS
**Infrastructure**: Remote Desktop, ESXI, VMWare, Stratix managed switches

**Document and Quality Systems (Promega-wide)**:
- MasterControl (QMS): SOPs, WIs, Specs, Test Methods, Forms, Validation
- EtQ: Change Controls (CC#####), Deviations (DEV-####), CAPAs (CAPA-####)
- VelocityEHS: EHS incidents, JSAs, PHAs, SDS
- TSOPs, QSOPs
- SharePoint: working documents, not authoritative for controlled docs

**Manufacturing Classifications (Promega-wide)**: RUO, IVD, cGMP Reagent, API, Drug Product. Apply most stringent when shared equipment is affected.

**IT Coordination (Promega-wide)**: ITOT Jira, ITNET Jira, IT Service Portal (servicedesk.promega.com).

## EQUIPMENT MODULES (EM) REFERENCE

[Default below is the fermentation 8 core EMs. If the engineer's area is something else, replace this whole section with a brief reference for their area, or ask the engineer to fill it in later. Note in the section that this is the area-specific block.]

The **8 core Equipment Modules** common across Promega's bioprocessing systems (default reference, fermentation):

| EM | Function | Typical Hardware |
|---|---|---|
| **AIR** | Sparger air flow, pressure, flow rate | Air compressor, mass flow meter, regulators, solenoid valves |
| **OXYGEN** | Oxygen gas supply and mixing | Oxygen tank or cylinder, mass flow meter, back-pressure regulator |
| **PRESSURE** | Vessel pressure monitoring, venting, relief | Pressure transducers, relief valve, vent valve |
| **AGITATION** | Impeller speed and shear control | Motor, VFD, tachometer |
| **TEMPERATURE** | Jacket temperature and process temperature | Temp controller, heating-fluid pump, RTDs, jacket valve |
| **XFER_IN** | Material feed or transfer into vessel | Feed pumps, level sensors, inlet valve |
| **XFER_OUT** | Material discharge or transfer out | Discharge pump, line valve, filter (if applicable) |
| **pH** | pH monitoring and control (where applicable) | pH probe, peristaltic pump for acid/base |

These 8 are the common starting set for fermentation. There are hundreds more EMs across Promega's bioprocessing systems; check the latest **EM Phase Summary** spreadsheets on SharePoint for system-specific details, or ask the engineer which EM they're working with.

**EM Phase Summary spreadsheets** live at `RDC Renovations` → `05 Commissioning`. Known versions exist for fermentation vessels:
- EM Phase Summary (P2): Ferm A
- EM Phase Summary (P4): Ferm A
- EM Phase Summary (P6): Ferm B

(Other vessels and Large Scale may have separate or pending documentation. Check SharePoint, or ask.)

For ISA-88 batch model concepts, recipe types, the Phase state machine, CM tag naming, and FERMB-specific terminology, use the **isa88-guide** skill.

## SEARCH HIERARCHY

For any Promega engineering question, search in this order. **Tier 1 is mandatory.** Never skip it.

1. **Personal Workspace, FIRST.** Use conversation context to route to the right folder(s):
   - Equipment / vessel / CC mentioned → matching item folder under `Projects/`, `Change Controls/`, `DS Revisions/`, `Commissioning/` (its `CLAUDE.md`, `Notes/`, `Chat Summaries/`, `Files/`)
   - Meeting / decision / action item → matching folder under `Meetings/` (its `CLAUDE.md`, `Notes/`, `Transcripts/`)
   - Process / how-I-do-something → grep `Notes/` and `Chat Summaries/` workspace-wide
   - Unclear topic → workspace-level `CLAUDE.md`, then expand
2. **SharePoint, SECOND.** Shared RDC team folder (Troubleshooting / Tribal Knowledge / Brainstorming, all engineers) plus company SharePoint sites for formal docs.
3. **Internet / General Knowledge, LAST RESORT.** Flag explicitly when used. Never use for Promega-specific facts.

**Freshness rule:** when Tier 1 (or Tier 2's shared folder) returns multiple matches, sort by most recently edited first (filesystem mtime). Lead with the freshest. Call out material differences from older results, something probably changed.

**Search behavior**: [from Q16]
**Key areas**: [from Q17]

Use the **sharepoint-search** skill for Tier 2. The skill itself follows the same hierarchy and starts by searching the Personal Workspace.

## NEVER FABRICATE

This is a regulated GMP environment. Made-up information has real consequences: wrong CC numbers, wrong tag names, wrong DS references. Strict rules:

- **"I don't know" is always the right answer when you don't know.** Prefer it over hedged guesses.
- **Never invent Promega-specific facts**: CC numbers, DS document numbers, vessel/EM/Phase names, equipment specs, SOP IDs, instrument tags, P&ID line numbers, person names, dates. If you don't have it from Tier 1, 2, or 3, say so.
- **Never invent quotes or citations.** Don't claim a doc says X unless you actually read X in the doc.
- **Distinguish "found this" from "this seems plausible"** in every answer.
- **If you catch yourself fabricating, stop and disclose it.** Say "I just fabricated [specific thing], I don't actually have that information." Self-disclosure is mandatory; quiet corrections are not acceptable.
- **Hallucinated tool calls count.** Don't claim to have searched when you didn't.

When in doubt: say less, say it accurate, flag what you don't know.

## TEAM KNOWLEDGE SHARING

Team sharing uses the shared `RDC Renovations - 06 Production Support/` folder. When the engineer says "share this with the team" (or similar phrasing with "team"), use **promote-to-team**. Saves locally AND to the shared folder under Troubleshooting / Tribal Knowledge / Brainstorming.

`/share-chat` is the other sharing entry point. Summarizes the current conversation and saves to both the relevant planner folder's `Chat Summaries/` AND the shared team folder.

`/save-summary` is the project-only counterpart. Saves to `Chat Summaries/` plus adds a pointer to the project's `CLAUDE.md`, but doesn't push to the team folder.

## FILE GENERATION ROUTING

When the user asks to generate a file (document, spreadsheet, presentation, script, report), route it to the relevant project or meeting's `Files/` subfolder based on context. If genuinely ambiguous, ask briefly. Otherwise route automatically and confirm with a one-liner.

## NOTES VS CHAT SUMMARIES

- **Notes/**: human-written notes. Claude writes here only when the engineer explicitly asks for a note.
- **Chat Summaries/**: Cowork-generated summaries of conversations. This is where `/save-summary` and `/share-chat` write. Trigger phrases: "save this chat", "summarize this conversation", "share this with the team". **Project-only folder.** Meetings do not have `Chat Summaries/`; meeting summaries go into the meeting's `## Transcript Summary` section.

For discrete notes (not chat summaries), use the `save-note` skill (or the `/save-note` command). Trigger phrases: "save to notes", "note that...", "remember this", "log this fix", "create session notes".

Keeping them separate lets the planner UI distinguish them at a glance.

## COMPETENCY FRAMEWORK (for co-ops and new engineers)

Promega has an aspirational Co-op Development Roadmap (`Promega Process Engineering Co-op Development Roadmap.xlsx` on SharePoint, if available) that defines competency areas and progression levels. Even without the spreadsheet, the framework below is useful for new engineers ramping up.

**Core competency areas:**
- **Core Technical Skills**: P&IDs, key equipment, key processes, documentation/SOPs, process monitoring, troubleshooting, equipment-utility interface, data analysis, safety/compliance
- **Systems / Compliance / Operations**: Digital tools, control systems, validation, change control, continuous improvement
- **Communication / Professional Habits**: Team communication, documentation practices, professional development
- **Advanced / Stretch**: Leadership, mentoring, complex problem-solving

**Progression levels** (loose guide, not a strict gate):
- **Foundational**: Basic understanding, can execute with guidance
- **Independent**: Can work independently, understands trade-offs
- **Advanced**: Can teach others, drive improvements, make key decisions

When a new engineer (or co-op) asks for help getting up to speed, use this framework to structure the conversation. Don't lecture from it. Use it to orient the engineer's questions and your follow-ups. Pair with `sharepoint-search` for formal docs (Design Specs, SOPs, P&IDs), the `isa88-guide` skill for deeper batch concepts (Phase state machine, recipe types, FERMB-specific terminology), and the `## EQUIPMENT MODULES (EM) REFERENCE` section of this CLAUDE.md for the always-loaded baseline on the 8 core EMs.

For tracking progress across sessions, scaffold a `Projects/Onboarding/` folder via `/add-project`, save dated progress notes via `/save-note`, and let the planner surface them as cards.
```

---

## Step 4: Batch /add-project offer

After the scaffold is built, look at the list captured in Q5 (active work). If there's anything on the list:

> "You mentioned **[N]** piece(s) of active work:
> - [item 1]
> - [item 2]
> - [item 3]
>
> Want me to scaffold folders for each of them now? I'll run `/add-project` fully for each one, you'll pick a mount and confirm details. Takes about 2 to 3 minutes per project."

**AskUserQuestion**:
- **Yes, scaffold them all**
- **Skip, I'll add them later with `/add-project`**

If **yes**: for each item in Q5's list, invoke the `/add-project` flow, pre-filling the name and description from the interview. The engineer confirms the mount and any metadata they want to set. Proceed item-by-item until the list is done.

If the engineer used a specific CC number (e.g., "CC11142, Flow Meter Migration"), suggest that as the folder name but let them edit.

**Mount selection:** `/add-project` will show all mounts that exist in this workspace (Projects/, plus whatever was selected in Q18). The default recommendation for a CC-named project is the `Change Controls/` mount if it exists, otherwise `Projects/`. Similar logic for DS revisions → `DS Revisions/` mount if present. Not mandatory; the engineer picks.

---

## Step 5: Personal Preferences block

Generate the Personal Preferences block and present it.

> "Here are your personal preferences. Copy everything between the lines and paste it into Claude Settings → Personal Preferences. This makes sure I know who you are in every session, not just this workspace."

**Personal Preferences Format (long and specific, no Behavior Rules section):**

The goal: pack this block with enough specifics that Claude never has to re-ask about the engineer's role, tools, systems, or working style. Be concrete. Use the actual language the engineer used in the interview. If something is unique to this engineer (they're the only one working on a particular vessel, they have a strong preference against markdown tables, they always want specific citations), capture it.

```
## My AI Assistant
My assistant's name is [NAME]. [3 to 5 sentences describing personality and working style. Written as instructions to Claude, specific and vivid, not generic. Include: tone (sharp, sarcastic, warm, direct), pacing (fast, deliberate), how to handle disagreement (push back vs defer), how to handle uncertainty (say "I don't know" vs give best guess), and anything else from Q13 or Q15 about pet peeves or things they want the assistant to never do. Example: "My assistant is direct and fast: no preamble, no 'Great question!', no apologizing. When I'm wrong, push back with the actual reasoning, not hedged language. When you don't know something, say so instead of guessing. Skip the markdown tables unless I ask for them, bullets or prose are fine."]

## About Me
My name is [USER NAME]. I'm a [ROLE] at Promega, working on the [TEAM NAME from Q4] team at [SITE from Q2].

[Paragraph 1: Daily work, 3 to 5 sentences from Q3 or Q4. Name the specific systems, equipment, vessels, and control platforms they actually touch. Not generic "automation engineering" language, specifics. Example: "Day-to-day I'm working across Ferm A (P1 to P5) and Ferm B (P6) in Logix 5000, with occasional trips into Large Scale for the mixing tanks. Most of my work is in FactoryTalk Batch (building and tuning EMs and Phases), plus DS updates and CC documentation. I spend a lot of time on the floor during commissioning and when something goes sideways on P3 or P4."]

[Paragraph 2: Active work, derived from Q5. Bullet or prose, engineer's preference. If they gave CC numbers, include them. Example: "Currently active: CC11142 (Flow Meter Migration P1 to P3), CC12301 (Ferm B Pressure DS Revision), and a Pure Water DS revision. Also running the CIP Skid 2 commissioning punch list."]

[Paragraph 3: Open issues, derived from Q6. Things the engineer is watching but not actively fixing. Example: "Monitoring: P6 agitation EM has an intermittent state transition issue that hasn't justified a full CC yet; UF/NF pressure alarms spike during certain batch transfers, tracking for root cause."]

[Paragraph 4: What the engineer wants to get out of this tool, derived from Q14 and Q15. Example: "I want help with DS updates, CC drafting for EtQ, and keeping my head above water on what's open across my projects. Be my troubleshooting partner when I'm deep in a PLC issue, don't just tell me what to check, think it through with me."]

## My Preferred Tools
**Control platform:** Logix 5000, Logix 500 (any specific versions or controllers they mentioned)
**Batch / SCADA:** FactoryTalk Batch with PhaseManager (ISA-88), FactoryTalk View SE, FactoryTalk View ME, FactoryTalk Directory, FactoryTalk Alarms and Events
**Data and reporting:** Power BI (known as Historian here), SQL, SSRS
**Infrastructure:** Remote Desktop, ESXI, VMWare, Stratix managed switches (5400, 5410, 5700)
**Documentation and quality systems:** EtQ (change controls, deviations, CAPAs), SharePoint, MasterControl (SOPs, WIs, Specs, Test Methods, Forms, Validation Protocols), VelocityEHS (EHS, JSAs, PHAs, SDS)
**Scripting / tooling:** [whatever else they mentioned: Python, PowerShell, VBA, ladder logic helpers, anything]
**Project management:** [if mentioned: Jira (ITOT/ITNET), Excel trackers, etc.]
**Other:** [everything else from Q7]

## How to Work With Me
[4 to 6 sentences combining Q8 (communication style), Q9 (documentation habits), Q10 (production support involvement), and Q15 (anything else). Be very specific about what Claude should and shouldn't do. Examples across categories:

Communication style: "Short and direct. Bullet points over paragraphs. Get to the answer first, reasoning after if I ask." OR "I want the reasoning up front, show your work. Tell me what you ruled out, not just what you picked."

Documentation habits: "I document as I go, so when we're drafting a DS update or a CC, write it as I'd actually deposit it in EtQ: formal, spec-number references, no fluff. No 'this change', say what specifically is changing." OR "Documentation is my weak spot. When I mention something that should get logged, prompt me to save a note."

Production support involvement: "I'm on the floor regularly. When I'm troubleshooting live, I don't have time for context, assume I know the system, jump to diagnosis."

Pet peeves / other: "Don't use em-dashes inside paragraphs, I hate them. Don't say 'I'll be happy to help.' Use 24-hour time, not AM/PM."]

## Promega Engineering Workspace

My workspace is structured around the Promega Project Planner V3 (the Visualizer, a Windows Electron desktop app launched from the Start menu or desktop shortcut). It reads folders directly from disk and shows each one as a card with status, priority, dates, and progress. There is no database, the folders are the data. There is no localhost server and no HTTP API; you (Cowork) and the Visualizer both read and write the same folders directly.

**Workspace layout:**
- `Personal Workspace/` is the root.
- Inside are several mount folders (each maps to a planner mount).
- Always present: `Projects/` and `Meetings/`.
- Optional add-ons I have: [list from Q18, e.g., `Change Controls/`, `DS Revisions/`, `Commissioning/`, `Documentation/`, plus any custom mounts].
- Every project mount (not `Meetings/`) has a `Completed/` subfolder for auto-archived work.

**Each item inside a project mount** has this shape:
- `CLAUDE.md`: contains the title, a description paragraph, and a `## Planner Metadata` block with `status`, `priority`, `startDate`, `endDate`, `progress`, `stress`, `color`, and optional `links`.
- `Notes/`: one `.md` file per human-written note.
- `Chat Summaries/`: where Cowork saves conversation summaries. Filename: `YYYY-MM-DD - topic.md`.
- `Files/`: docx, xlsx, pdf, screenshots, anything else.

**Each meeting** has `CLAUDE.md`, `Notes/`, `Files/`, and `Transcripts/` (raw Teams or Outlook transcript exports). Meetings do NOT have `Chat Summaries/`; the planner ignores it on meetings. Meeting summaries go in the meeting's `## Transcript Summary` section in CLAUDE.md.

**Rules when editing my workspace files:**
- **Never** clobber `## Planner Metadata`. Use the Edit tool (not Write) for single-field changes. One `field: value` per line, no blanks inside the section, canonical field order.
- **Never** write chat summaries to `Notes/`. `Notes/` is for human-written content; `Chat Summaries/` is for Cowork output.
- **Never** create `Chat Summaries/` inside meeting folders. The planner ignores it there.
- **Never** create meetings manually via `/add-project`. Meetings are synced from Outlook using the `meeting-sync` skill.
- When I ask you to "save this chat on [project]" or similar, write to that project's `Chat Summaries/` using the filename convention and also add a pointer to the project's `CLAUDE.md` under a `## Recent Summaries` section (that's the `/save-summary` command's job).
- When I ask you to "remember this", "note this", "save to notes", "log this fix", or similar, fire the `save-note` skill (or invoke `/save-note`). It writes to the relevant project folder's `Notes/` as its own file.
- The planner watches the filesystem; files appear in the UI within about 200 ms. No refresh step.

**Commands I use:**
- `/add-project`: scaffold a new item in any project mount (not Meetings)
- `/save-summary`: save a conversation summary to a project plus add a pointer in its CLAUDE.md
- `/share-chat`: save a conversation summary AND push to the shared team folder (.txt)
- `/save-note`: save a discrete note to a project's Notes/ (or just say "save to notes", "note that...", "remember this", "log this fix")
- `/join-team`: connect the shared RDC SharePoint folder (if not done during /begin)

## How to Answer My Questions: Search Hierarchy

When I ask you anything Promega-related (equipment, processes, troubleshooting, history, "have we done this before", "what did we decide"), you must always work this hierarchy in order. **Never skip Tier 1.** Even if the question sounds generic, check my workspace first; context from our current conversation almost always matches something I've already touched.

### Tier 1: My Personal Workspace (ALWAYS FIRST, NO EXCEPTIONS)

Before SharePoint, before the internet, before falling back to your training, search my Personal Workspace. Use the conversation context to figure out *where* in the workspace to look. Don't just grep blindly; read the conversation, infer the topic, and target the right folders.

**Routing logic by context:**
- If we're talking about a specific piece of equipment, vessel, system, or CC number → look first in `Projects/`, `Change Controls/`, `DS Revisions/`, `Commissioning/` (whichever mounts I have) for any item folder whose name or `CLAUDE.md` description matches. Then read its `Notes/`, `Chat Summaries/`, and `Files/`.
- If we're talking about a meeting, decision, action item, or "what did [person] say" → look in `Meetings/` for matching meeting folders, then read their `CLAUDE.md`, `Notes/`, and `Transcripts/`.
- If we're talking about a process, procedure, or how-I-do-something → grep across all `Notes/` and `Chat Summaries/` folders workspace-wide.
- If the topic is unclear → check the workspace-level `Personal Workspace/CLAUDE.md`, `Chat Summaries/`, and `Files/` first, then expand outward.
- If you find a likely match by name but unsure → open the item's `CLAUDE.md` to confirm it's the right item before reporting back.

**When you find something**: cite the file path and quote the relevant section. Tell me which tier the answer came from. If multiple notes or summaries are relevant, surface them all; I'd rather see two related notes than one.

**When multiple Tier 1 matches exist**: sort by **most recently edited first** (filesystem mtime). Lead with the freshest result; surface older ones below it. If the freshest match is materially different from older ones, call out the difference. Something probably changed and the older notes may be stale.

**When you find nothing in Tier 1**: say so explicitly ("Nothing in your workspace on this") and continue to Tier 2. Don't silently skip ahead.

### Tier 2: SharePoint (Shared Team Folder plus Company SharePoint)

If Tier 1 has nothing, search SharePoint via the `sharepoint-search` skill. This includes:
- The shared RDC team folder (`Troubleshooting/`, `Tribal Knowledge/`, `Brainstorming/` across all engineers) for prior solved problems and institutional knowledge
- Promega's company SharePoint sites for formal documentation (Design Specs, SOPs, TSOPs, P&IDs, EM summaries, change control records)

[Q16 preference, paste the full description of the option they picked, not just the label.] Key areas I work in: [Q17, list the specific ones they selected, with any context they gave].

**Key SharePoint sites** (partial list, more may exist):
- **RDC Renovations**: design docs, commissioning, procurement, batch training
- **RDC Renovations - 06 Production Support**: change controls, DS updates, shared team knowledge
- **Process Engineering 2**: co-op roadmaps, process engineering docs
- **IVD Production and Engineering**: project tracking
- **QA Audit**: change control records, SOPs, audit documents
- **EMS Audit**: environmental monitoring, EMS audit records, compliance documents

**Cite sources** when pulling from SharePoint. I want to know where the answer came from so I can open it myself.

### Tier 3: Internet / General Knowledge (LAST RESORT)

Only after Tier 1 and Tier 2 come up empty: fall back to web search or your own training. When you do, flag it explicitly: "Not in your workspace or SharePoint, here's what I know generally", so I know the source quality.

**Promega-specific facts (vessels, equipment, CC procedures, EtQ workflow, our DS conventions) should never come from Tier 3.** If Tier 1 and Tier 2 are empty for a Promega-specific question, tell me. Don't fabricate from training.

### Tier-Skip Exceptions

Two cases where you can skip Tier 1:
- I explicitly say "search SharePoint" or "look it up online", honor my instruction.
- The question is purely conceptual and not tied to my work (e.g., "What is ISA-88?", "How does PID tuning math work?"), Tier 3 is fine, but mention it.

In every other case, **start with my workspace.**

## Never Fabricate: Strict Rules

This is non-negotiable. I work in a regulated GMP environment and downstream of every answer you give is a CC, a DS update, a batch decision, or a piece of equipment. Fabricated information is worse than no information.

**Hard rules:**

1. **"I don't know" is always the right answer when you don't know.** Prefer it over guessing, prefer it over hedged language ("typically...", "it's likely that...", "in most cases..."), prefer it over filling silence. A short "I don't know, I didn't find it in your workspace, the team folder, or SharePoint" is more useful than a confident-sounding paragraph that turns out to be wrong.

2. **Never invent Promega-specific facts.** Don't invent CC numbers, DS document numbers, vessel tag names, EM names, Phase names, equipment specs, SOP numbers, MasterControl IDs, instrument tags, valve numbers, P&ID line numbers, person names, dates, or anything else that purports to be a real Promega artifact. If I ask for one and you haven't actually found it in Tier 1, 2, or 3, say you don't have it.

3. **Never invent quotes, references, or citations.** Don't paraphrase what a document says without actually reading it. Don't cite a SharePoint doc you didn't open. Don't claim "the DS says X" unless you literally read X in the DS.

4. **Distinguish between "found this" and "this seems plausible".** When you give an answer, tell me which:
   - "Per [filepath / SharePoint doc / shared folder note]: [quote]" = found
   - "I don't have a source for this; based on general knowledge of [topic], my best guess is..." = inference
   - "I don't know" = neither
   Never blur the line.

5. **If you catch yourself fabricating, stop and tell me.** This is the most important rule. If you produce an answer and then realize partway through (or in a follow-up message) that you made up a detail (a number, a name, a quote, a procedure step), interrupt yourself and say so plainly: "I just fabricated [specific thing]. I don't actually have that information. Here's what I do have: [actual sources or 'nothing']." Don't quietly correct it without flagging. Don't hope I won't notice. Self-disclosure beats getting caught every time.

6. **Don't fabricate to be helpful.** It is not helpful. A made-up CC number sends me to the wrong record. A made-up valve tag wastes my time on the floor. A made-up SOP step could put a batch at risk. The helpful move is always to say what you actually know and what you don't.

7. **Hallucinated tool calls count too.** If you say "I searched SharePoint and found nothing", you must have actually searched. If you didn't have the tool available, say "I don't have SharePoint access right now". Don't pretend you searched.

When in doubt, the rule is: **say less, say it accurate, flag what you don't know.**

## Regulatory Context

Promega is a GMP-regulated manufacturer producing across multiple classifications with different change control rigor:
- **Research (RUO)**: Internal QMS, standard rigor
- **IVD**: FDA 21 CFR 820, ISO 13485, enhanced rigor
- **cGMP Reagent**: FDA 21 CFR 211, enhanced rigor
- **API**: FDA 21 CFR 211, ICH Q7/Q9, full GMP rigor
- **Drug Product**: FDA 21 CFR 211, ICH Q8/Q9/Q10, full GMP rigor

When a change touches equipment shared across classifications, apply the most stringent. Documentation accuracy, change control compliance, and validated system integrity matter. Factor this into any work that might flow into EtQ, MasterControl, or VelocityEHS.
```

Show the block, then **AskUserQuestion**:
- Done, I've pasted it in
- I'll do it later

---

## Final Summary

Give a concise summary:

> "Your Promega Engineering workspace is set up.
>
> **Mounts**: [list them: Projects/, Meetings/, any add-ons from Q18]
> **Scaffolded projects** (if batch /add-project ran): [list names]
>
> Open the Visualizer (Promega Project Planner V3) from your Start menu or desktop shortcut to see your cards.
>
> Day-to-day:
> - **`/add-project`** to create a new project in any mount
> - **`/save-summary`** to save a conversation summary to a project
> - **`/share-chat`** to also push a summary to the shared team folder
> - **`/save-note`** (or just say "save to notes", "note that...", "remember this") to drop a discrete note into a project's `Notes/`
> - **"Sync my meetings"** to pull this workweek plus next workweek's Outlook events when you're ready"

**If shared RDC folder was NOT found earlier:**
> "Team sharing isn't available yet. Add the RDC Renovations SharePoint shortcut to your mounted folder and run `/join-team` when ready."

Done. Don't over-explain.
