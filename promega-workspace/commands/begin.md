---
name: begin
description: One-time setup for the Promega Workspace. Builds the planner-shaped folder structure (Projects/, Meetings/, and optional add-on mounts), runs an interview to learn about the user's role and work, and generates a Personal Preferences block for Claude Settings. Does NOT auto-run meeting-sync; the user triggers that manually after onboarding.
---

# /begin — Promega Workspace Setup

One-time onboarding for any Promega employee. Works for scientists, lab technicians, QA, manufacturing, operations, engineering, sales, HR, IT, and every other role at Promega.

Output: a workspace shaped for the **Promega Project Planner V3** (the Visualizer — a Windows Electron desktop app, no localhost, no HTTP API) plus a Personal Preferences block to paste into Claude Settings.

**Runs once.** No update mode. Edit files directly, use `/add-project` for new work, or update Personal Preferences in Claude Settings later. **Does NOT run meeting-sync** — the user triggers that manually after onboarding.

**Read `PLANNER_SCHEMA.md` at the plugin root before running this command.** It defines the on-disk schema every skill follows.

## Tone

Warm and efficient. Adapt to the person in front of you — a scientist, a QA auditor, and an HR professional have different working styles. No emojis, no theatrical framing, no fluff. Think "sharp colleague helping you set up a new tool", not onboarding chatbot.

---

## Step 0 — Architecture explanation

Before any questions, lay out the model in one message. Four short paragraphs:

> **What we're building.** Your workspace will be a folder called `Personal Workspace/` inside the folder you've mounted. Inside it are subfolders the Promega Project Planner reads, each one a bucket for a kind of work. `Projects/` and `Meetings/` always exist. Optional add-ons: any custom mounts that make sense for your role.
>
> **How items are stored.** Each item is its own folder with `CLAUDE.md` (planner metadata: status, priority, dates, progress), `Notes/`, `Chat Summaries/` (Cowork's conversation-summary target), and `Files/`. Meetings get `CLAUDE.md`, `Notes/`, `Files/`, and `Transcripts/` — no `Chat Summaries/`; meeting summaries go in the meeting's `## Transcript Summary` section.
>
> **The Visualizer.** Windows Electron app launched from the Start menu or desktop shortcut. Reads these folders directly from disk. No database, no localhost server, no API. I (Cowork) write to the same folders, and the Visualizer's file watcher picks up changes within ~200 ms.
>
> **What `/begin` does.** Asks about your role, work, and how you like to operate (~10 minutes). At the end I'll create the folder structure, give you a Personal Preferences block for Claude Settings, and offer to scaffold folders for the work you mentioned. Meeting sync is a separate step you trigger when ready.

Then **AskUserQuestion**:
- **Ready, start the interview**
- **Wait, I have questions first** (answer them, return here)

---

## Step 1 — Check Personal Preferences

If detailed preferences already exist (name, role, tools, communication style all filled in), offer a quick branch:

> "I have a good picture of who you are from your preferences. Want to update anything before we set up your workspace, or work with what I have?"

**AskUserQuestion**:
- **Use what you have** → skip to Step 3.
- **Update my profile** → full interview.

Default to full interview if preferences are sparse or generic.

---

## Step 2 — The Interview (~10 min, one question at a time)

> "I'll ask you a series of questions to understand your role, workflow, and where I can be most useful. About 10 minutes. Skip any question by saying so."

One question at a time. Let each answer inform the next.

### Phase 1: Who You Are

**Q1. Name + assistant preference** (in chat)
> "What's your name? And should I go by Claude, or would you prefer a different name?"

**Q2. Site, team, role** (in chat, then structured pick)

In chat:
> "Which Promega site do you work at, and what's your team or area? (For example: Arnold Center, Madison main campus, Fitchburg, San Luis Obispo, Madison IVD.)"

Then **AskUserQuestion** for role — choose the closest fit:
- Scientist / Researcher: developing or running experiments, research, method development
- Lab Technician / Specialist: running protocols, sample prep, data collection, equipment operation
- QA / Quality / Regulatory: quality systems, audits, compliance, SOPs, change controls
- Manufacturing / Operations: production, batch execution, process support, floor operations
- Engineering: automation, process, controls, validation, IT/OT, commissioning
- Sales / Marketing / Business: customer-facing, product, commercial, communications
- IT / Systems: infrastructure, software, systems, data, integrations
- HR / Finance / Admin: people, planning, organizational, administrative
- Management / Leadership: overseeing teams, projects, strategy, cross-functional coordination
- Co-op / Intern: onboarding, learning, assigned project work

**Q3. Day-to-day** (in chat)
> "Walk me through a typical work week. What takes up most of your time? What systems, equipment, tools, or processes do you regularly work with?"

Capture: systems, equipment, recurring meetings, types of deliverables.

**Q4. Team and scope** (in chat)
> "What areas or projects do you own, contribute to, or support?"

**Q5. Active work** (in chat)
> "What work do you have on your plate right now? Everything you're actively working on — projects, experiments, protocols, tasks, initiatives. Give each a short name and a one-liner. Don't worry about categorizing them, I'll sort them into folders later."

Record every item. Feed the batch `/add-project` offer at the end.

**Q6. Things you're watching** (in chat)
> "Anything you're monitoring but not actively working on — experiments to check in on, approvals you're waiting for, open questions in the background?"

Lives in Personal Preferences only. No folders created.

### Phase 2: How You Work

**Q7. Tools** (in chat)
> "What tools and systems do you use regularly? For example: Microsoft 365, SharePoint, MasterControl, EtQ, SAP, LIMS, Teams, Outlook, Excel — whatever applies to your work."

**Q8. Communication style** — **AskUserQuestion**:
- Short and direct: bullets, no preamble, get to the answer
- Detailed with context: explain the reasoning, show your work
- Match the situation: quick answers for quick questions, depth when it matters

**Q9. Documentation habits** — **AskUserQuestion**:
- I document as I go: notes, SOPs, and records are part of my workflow
- I document when required: I create formal docs when needed, but not proactively
- I barely document: it's a known gap I'd like to fix
- My role is more about consuming docs than writing them

### Phase 3: What Would Help

**Q10. Biggest time sinks** — **AskUserQuestion**, multiSelect. Pick 5–6 options that fit the role and day-to-day. Adapt from the list below based on what came up in Q2–Q4:

*Common options (adapt to role):*
- Protocol and procedure writing: drafting, revising, keeping SOPs current
- Document tracking: finding, organizing, and keeping versions straight
- Meeting prep and follow-up: summaries, agendas, action item tracking
- Data compilation and reporting: gathering results, building reports, slide prep
- Change management: tracking changes, approvals, impact assessments
- Cross-team coordination: keeping multiple stakeholders aligned
- Compliance and regulatory work: audit prep, corrective actions, quality records
- Project tracking: keeping on top of milestones and deliverables across multiple things
- Research and literature review: reading, synthesizing, staying current
- Email and communication management: too much email, hard to keep up

**Q11. What would help most** — **AskUserQuestion**, multiSelect. Pick 5–6 based on Q2 (role) and Q10 (time sinks):

*Common options (adapt to role):*
- Help me draft and revise procedures, SOPs, and protocols
- Be my search partner for finding Promega documents and procedures on SharePoint
- Prepare me for meetings: summaries, agendas, talking points, action items
- Help me track what's open across my projects and what's coming up
- Help me analyze data and communicate results clearly
- Draft emails, communications, and reports from my bullet points
- Help me understand and navigate compliance requirements
- Help me write clearly: turn rough notes into polished documents
- Keep me organized: notes, follow-ups, and open questions don't fall through

**Q12. Anything else** (in chat)
> "Last question: anything else you'd want me to always keep in mind when working with you? Preferences, pet peeves, things other tools get wrong?"

### Phase 4: SharePoint and Mounts

**Q13. SharePoint usage** — **AskUserQuestion**:
> "When you ask me questions about Promega processes and procedures, how should I use SharePoint?"

- Always check SharePoint first: search company docs before answering
- Only when I ask: I'll tell you when to look things up
- Balanced: check SharePoint for procedures and policies; use general knowledge for concepts

**Q14. Additional mounts** — **AskUserQuestion**, multiSelect.

Always present these for consideration. Adapt the descriptions based on role — a QA person hears "Quality Records" differently than a scientist:

- **Experiments / Studies** — for lab users, scientists, and researchers tracking experimental work
- **Protocols** — SOP drafts, method development, protocol revisions
- **Quality Records** — CCs, deviations, CAPAs, audit prep (QA, manufacturing, any regulated role)
- **Documentation** — standalone doc work: drafting procedures, forms, reports
- **Initiatives / Campaigns** — for marketing, sales, strategic projects
- **Training** — onboarding materials, skill development, learning projects
- **Custom** — let them free-text a name

Record the list. `/begin` creates them alongside `Projects/` and `Meetings/`, each with its own `Completed/`.

---

## Step 3 — Scaffold the workspace

### 3.1 Create Personal Workspace/

```
[Mounted Folder]/Personal Workspace/
├── CLAUDE.md                          # Written in 3.3
├── Projects/
│   └── Completed/
├── Meetings/
├── [Each selected mount from Q14]/
│   └── Completed/
├── Chat Summaries/
└── Files/
```

Every project mount has a `Completed/` subfolder. `Meetings/` does not.

### 3.2 Verify scaffold

```bash
test -d "[Mounted Folder]/Personal Workspace/Projects/Completed" && \
test -d "[Mounted Folder]/Personal Workspace/Meetings"
```

### 3.3 Write workspace-level CLAUDE.md

Adapt to the user's site and role from Q2/Q3. For most users, keep the generic Promega-wide context block (document/quality systems, manufacturing classifications, IT). Add role-specific context where useful.

```markdown
# Promega Workspace, [USER NAME]

[USER NAME]'s workspace, structured around the Promega Project Planner V3 (the Visualizer — Windows Electron desktop app from the Start menu/desktop shortcut). No localhost, no HTTP API; Cowork and the Visualizer both read these folders directly.

## Quick Reference
- **Site**: [from Q2]
- **Role**: [from Q2]
- **Team**: [from Q4]
- **Tools**: [abbreviated from Q7]

## RESOLVED PATHS
- **Personal Workspace**: [full resolved path]

## MOUNTS

Top-level folders under Personal Workspace/. Every project mount has a `Completed/` for auto-archive.

**Always present:**
- `Projects/` — general project and task tracking
- `Meetings/` — Outlook meeting sync target

**Additional mounts (from Q14):**
- [List each selected mount with a one-line purpose]

Update by hand if mounts change. Read by `/add-project` and other skills.

## PLANNER ARCHITECTURE

This workspace is shaped for the Promega Project Planner V3 (Windows Electron app, Start menu / desktop shortcut). Each item inside a project mount has:

- `CLAUDE.md` — title, description, `## Planner Metadata` (status, priority, dates, progress, stress, color)
- `Notes/` — one `.md` per human-written note
- `Chat Summaries/` — Cowork-written summaries (`YYYY-MM-DD - topic.md`)
- `Files/` — docx, xlsx, pdf attachments

Meetings have `CLAUDE.md`, `Notes/`, `Files/`, `Transcripts/`. **No `Chat Summaries/` on meetings** — planner ignores it there. Meeting summaries go in the meeting's `## Transcript Summary` section.

**Never clobber `## Planner Metadata`.** Use Edit (not Write) for single-field changes. See `PLANNER_SCHEMA.md` § 2 for the full field reference and safe-edit rules.

**Live reload.** Planner watches the filesystem; files appear in the UI within ~200 ms. No refresh step.

## PROMEGA CONTEXT

[Adapt to site and role. Default below covers Promega-wide systems applicable to most employees.]

**Promega** is a global life science company headquartered in Madison, WI. Sites include Arnold Center (RDC), Madison main campus, Fitchburg, San Luis Obispo (SLO), and international locations.

**Document and Quality Systems (Promega-wide)**:
- MasterControl (QMS): SOPs, Work Instructions, Specs, Test Methods, Forms, Validation
- EtQ: Change Controls (`CC#####`), Deviations (`DEV-####`), CAPAs (`CAPA-####`)
- VelocityEHS: EHS incidents, JSAs, PHAs, SDS
- SharePoint: working documents, team collaboration (not authoritative for controlled docs)

**Manufacturing Classifications (Promega-wide)**: RUO, IVD, cGMP Reagent, API, Drug Product. Apply most stringent when shared equipment or processes are affected.

**IT Coordination (Promega-wide)**: ITOT Jira, ITNET Jira, IT Service Portal (servicedesk.promega.com).

[Add role-specific context here if Q2/Q3 suggests it — e.g., specific systems, products, teams, processes they mentioned.]

## SEARCH HIERARCHY

For any Promega-related question, search in this order. **Never skip Tier 1.**

1. **Personal Workspace.** Route by context:
   - Project or tracked item → matching folder under any project mount. Read `CLAUDE.md`, `Notes/`, `Chat Summaries/`, `Files/`.
   - Meeting/decision/action → matching folder under `Meetings/`. Read `CLAUDE.md`, `Notes/`, `Transcripts/`.
   - Process/how-I-do-something → grep `Notes/` and `Chat Summaries/` workspace-wide.
   - Unclear → workspace-level `CLAUDE.md`, then expand.
2. **SharePoint.** Company SharePoint sites for formal docs, procedures, and team knowledge.
3. **Internet / General Knowledge.** Last resort. Flag explicitly. Never use for Promega-specific facts.

**Search behavior**: [from Q13]

Use the **`sharepoint-search`** skill for Tier 2.

## NEVER FABRICATE

Promega is a regulated environment. Made-up information has real consequences.

- **"I don't know" is always the right answer when you don't know.** Prefer it over hedged guesses.
- **Never invent Promega-specific facts** — document numbers, form IDs, process names, person names, dates, equipment specs. If Tiers 1–3 didn't surface it, say so.
- **Never invent quotes or citations.** Don't claim a doc says X unless you read X in the doc.
- **Distinguish "found this" from "this seems plausible".** Use "Per [path/doc]: [quote]" for found, "Based on general knowledge of [topic]..." for inference.
- **If you catch yourself fabricating, stop and disclose.**

## KNOWLEDGE CAPTURE

- **`/save-summary`** — saves a conversation summary to a project's `Chat Summaries/` plus a pointer in the project's `CLAUDE.md`.
- **`/save-note`** (or "save to notes", "note that...", "remember this") — discrete note in a project's `Notes/` folder.

## FILE GENERATION ROUTING

When the user asks to generate a file (document, spreadsheet, presentation, report), route it to the relevant project's `Files/` based on context. If genuinely ambiguous, ask briefly. Otherwise route automatically and confirm with a one-liner.

## NOTES VS CHAT SUMMARIES

- **`Notes/`** — human-written. Claude writes here only when the user explicitly asks for a note.
- **`Chat Summaries/`** — Cowork-generated. Where `/save-summary` writes. **Project-only.** Meetings don't have `Chat Summaries/`; meeting summaries go in `## Transcript Summary`.
```

---

## Step 4 — Batch `/add-project` offer

After the scaffold is built, look at Q5's list of active work. If anything was captured:

> "You mentioned **[N]** piece(s) of active work:
> - [item 1]
> - [item 2]
>
> Want me to scaffold folders for each now? I'll run `/add-project` fully for each one — you'll pick a mount and confirm details. ~2 minutes per project."

**AskUserQuestion**:
- **Yes, scaffold them all**
- **Skip, I'll add them later with `/add-project`**

If yes, invoke `/add-project` for each item with name and description pre-filled from Q5. Proceed item-by-item.

**Mount selection** — `/add-project` shows all project mounts that exist. Default to `Projects/` unless the item clearly maps to another mount (e.g., an SOP draft → `Protocols/` if that mount exists).

---

## Step 5 — Personal Preferences block

Generate the Personal Preferences block and present it.

> "Here are your personal preferences. Copy everything between the lines and paste it into Claude Settings → Personal Preferences. This makes sure I know who you are in every session, not just this workspace."

Goal: pack the block with enough specifics that Claude never re-asks about role, tools, or working style. Use the actual language the user used in the interview.

```
## My AI Assistant
My assistant's name is [NAME]. [3–5 sentences as instructions to Claude — specific and vivid, not generic. Cover tone, pacing, how to handle uncertainty (say "I don't know" vs. give best guess), plus anything from Q12 about pet peeves. Example: "My assistant is direct and clear: no preamble, no 'Great question!', short answers first with detail on request. When you don't know something, say so instead of guessing."]

## About Me
My name is [USER NAME]. I'm a [ROLE] at Promega, working on the [TEAM from Q4] team at [SITE from Q2].

[Paragraph 1: Day-to-day work, 3–4 sentences from Q3/Q4. Name the specific systems, processes, products, or areas they work with. Example: "Day-to-day I'm developing and running antibody purification protocols in the Fitchburg lab. Most of my time goes into method development, sample prep, and writing up results. I also support the QA team with technical sections of our change controls."]

[Paragraph 2: Active work from Q5. Bullet or prose. Example: "Currently active: Protocol revision for Protein G purification, supporting CC11142 documentation, and preparing a poster for the Q3 internal symposium."]

[Paragraph 3: Things being monitored from Q6. Example: "Monitoring: waiting on QA approval for the revised cleanup protocol; watching for the reagent reorder to come in."]

[Paragraph 4: What they want from this tool, from Q10/Q11/Q12. Example: "I want help drafting protocols and turning rough notes into clean documents. Search SharePoint before answering Promega-specific questions. Be my second pair of eyes for compliance details."]

## My Preferred Tools
[List from Q7, organized loosely by category. Examples:
**Documents and collaboration:** Microsoft 365 (Outlook, Teams, Word, Excel, PowerPoint), SharePoint, OneNote
**Quality and compliance:** MasterControl, EtQ, VelocityEHS
**Lab systems:** [LIMS, instrument software, or whatever they mentioned]
**Other:** [everything else]]

## How to Work With Me
[4–6 sentences combining Q8 (communication style), Q9 (documentation habits), Q12 (anything else). Example fragments:

Communication: "Short and direct. Bullets over paragraphs. Answer first, reasoning after if I ask." OR "I like context — explain the reasoning, don't just give me the answer."

Documentation: "I document as I go. When drafting a protocol or procedure, write it at the level I'd submit to QA — specific, accurate, no filler." OR "Documentation is my weak spot. When something should get logged, prompt me to save a note."

Uncertainty: "If you don't know something, say so. I'd rather hear 'I don't know' than a guess."]

## Promega Workspace

My workspace is shaped for the Promega Project Planner V3 (Visualizer — Windows Electron desktop app from the Start menu / desktop shortcut). It reads folders directly from disk and shows each as a card with status, priority, dates, progress. No database, no localhost, no API; you (Cowork) and the Visualizer both read and write the same folders directly.

**Layout:**
- `Personal Workspace/` is the root.
- Mount folders inside (each maps to a planner mount). Always: `Projects/`, `Meetings/`. Optional add-ons I have: [list from Q14].
- Every project mount has a `Completed/` for auto-archive. `Meetings/` doesn't.

**Each project-mount item:**
- `CLAUDE.md` — title, description, `## Planner Metadata` (`status`, `priority`, `startDate`, `endDate`, `progress`, `stress`, `color`, `links`)
- `Notes/` — one `.md` per human note
- `Chat Summaries/` — Cowork-written summaries (`YYYY-MM-DD - topic.md`)
- `Files/` — docx, xlsx, pdf, etc.

**Each meeting:** `CLAUDE.md`, `Notes/`, `Files/`, `Transcripts/`. **No `Chat Summaries/`** — meeting summaries go in `## Transcript Summary` inside the meeting's `CLAUDE.md`.

**Editing rules:**
- Never clobber `## Planner Metadata`. Use Edit (not Write) for single-field changes.
- Never write chat summaries to `Notes/` (human-only).
- Never create `Chat Summaries/` inside meeting folders (invisible to the planner).
- Never create meetings via `/add-project` — they're synced from Outlook via `meeting-sync`.
- Live reload — the planner picks up changes within ~200 ms; no refresh step.

**Commands I use:**
- `/add-project` — scaffold a new item in any project mount (not Meetings)
- `/save-summary` — save a conversation summary to a project + pointer in its `CLAUDE.md`
- `/save-note` (or trigger phrases) — discrete note in a project's `Notes/`

## How to Answer My Questions: Search Hierarchy

For any Promega-related question, work this in order. **Never skip Tier 1.**

### Tier 1 — My Personal Workspace (always first)

Before SharePoint, before the internet. Use conversation context to figure out where to look:
- Project or tracked item → matching folder under any project mount. Read its `CLAUDE.md`, `Notes/`, `Chat Summaries/`, `Files/`.
- Meeting/decision/action item → matching folder under `Meetings/`. Read `CLAUDE.md`, `Notes/`, `Transcripts/`.
- Process/procedure/"how do I" → grep across all `Notes/` and `Chat Summaries/` workspace-wide.
- Unclear topic → workspace-level `CLAUDE.md`, `Chat Summaries/`, `Files/`; expand outward.

**Nothing in Tier 1** — say so explicitly ("Nothing in your workspace on this") before continuing.

### Tier 2 — SharePoint

If Tier 1 has nothing, use `sharepoint-search`:
- Promega's company SharePoint sites for formal docs, procedures, and team knowledge.

[Q13 preference — full description of the option they picked.]

Cite sources when pulling from SharePoint.

### Tier 3 — Internet / General Knowledge (last resort)

Only after Tiers 1 and 2 come up empty. Flag explicitly: "Not in your workspace or SharePoint — here's what I know generally."

**Promega-specific facts should never come from Tier 3.** If Tiers 1–2 are empty, tell me. Don't fabricate.

## Never Fabricate

Promega is a regulated environment. A wrong document number, made-up procedure, or fabricated specification has real downstream consequences.

1. **"I don't know" is always the right answer when you don't know.**
2. **Never invent Promega-specific facts** — document numbers, form IDs, person names, specifications. If Tiers 1–3 didn't surface it, say so.
3. **Never invent quotes or citations.**
4. **Distinguish "found this" from "this seems plausible".** "Per [path/doc]: [quote]" = found. "Based on general knowledge..." = inference.
5. **If you catch yourself fabricating, stop and tell me.**
```

Show the block, then **AskUserQuestion**:
- Done, I've pasted it in
- I'll do it later

---

## Final Summary

> "Your Promega Workspace is set up.
>
> **Mounts**: [Projects/, Meetings/, any add-ons from Q14]
> **Scaffolded projects** (if batch ran): [names]
>
> Open the Visualizer (Promega Project Planner V3) from your Start menu or desktop shortcut to see your cards.
>
> Day-to-day:
> - **`/add-project`** — new project in any mount
> - **`/save-summary`** — conversation summary to a project
> - **`/save-note`** (or "save to notes", "note that...", "remember this") — discrete note in a project's `Notes/`
> - **"Sync my meetings"** — pull this workweek + next workweek's Outlook events when ready"

Done. Don't over-explain.
