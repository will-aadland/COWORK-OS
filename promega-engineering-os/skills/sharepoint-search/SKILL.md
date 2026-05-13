---
name: sharepoint-search
description: >
  Search Promega's shared engineering knowledge base on SharePoint for company-specific documentation,
  design specifications, process documents, control system configurations, and team practices. This skill
  should be used when the user asks about "company standards", "design specs", "where's the TSOP",
  "how do we configure that batch", "check the knowledge base", "what's our process for", "find the
  P&ID for", "look up the equipment module", or any question about Promega-specific process engineering,
  automation controls, or procedures. Also triggers when the user asks Claude to "search SharePoint",
  "check our docs", or "look it up in the knowledge base".
version: 1.0.0
---

# SharePoint Engineering Knowledge Search

Search Promega's engineering SharePoint for company-specific documentation, design specifications, process documents, control system details, and institutional knowledge. This is the primary way to answer questions about how Promega designs, operates, and validates equipment and processes.

**Current state**: SharePoint sites exist and contain engineering documentation, but the SharePoint architecture for a centralized engineering knowledge base is still being built out. The sites listed below are available for searching — use them when relevant, but don't assume every document type will be there. When SharePoint comes up empty, that's expected for some topics.

---

## When to Use This Skill

**Always use when the question is Promega-specific:**
- Design Specifications (DS documents) and change controls
- Process and operation procedures (TSOPs)
- Equipment Module (EM) configurations and phase summaries
- P&IDs, piping, and utility interface documentation
- ISA-88 batch recipes and recipe documentation
- PLC/FactoryTalk Batch configuration standards and examples
- Team-specific processes and workflows
- Equipment behavior and troubleshooting approaches
- "How do we..." or "What's our..." questions about fermentation, centrifugation, controls

**Search hierarchy (always followed by this skill):**
1. **Personal Workspace** — the engineer's own notes, summaries, and project folders (always searched first, routed by conversation context)
2. **Shared RDC team folder** — solved problems and tribal knowledge from all engineers
3. **Company SharePoint** — formal documentation (Design Specs, SOPs, TSOPs, P&IDs, EM summaries)
4. **General knowledge / internet** — last resort, flagged explicitly when used

**The engineer's SharePoint preference (from their CLAUDE.md) controls Tier 3 aggressiveness, not the order:**
- **Always check first**: Search SharePoint aggressively (still after Tiers 1 and 2)
- **On request only**: Only escalate to Tier 3 when the user explicitly asks
- **Balanced**: Hit Tier 3 for standards/processes, fall through to Tier 4 for conceptual how-to

---

## Search Priority Order — Four-Tier Hierarchy

When answering a Promega automation engineering question, search in this order. **Tier 1 is mandatory — never skip it.**

1. **Personal Workspace (the engineer's own notes, summaries, and projects) — FIRST**
   - Use conversation context to figure out *where* in the workspace to look. Don't grep blindly across the whole workspace if the topic clearly maps to one folder.
   - Equipment / vessel / CC mentioned → matching folder under `Projects/`, `Change Controls/`, `DS Revisions/`, `Commissioning/` (whichever mounts exist). Read its `CLAUDE.md`, `Notes/`, `Chat Summaries/`, `Files/`.
   - Meeting / decision / action item → matching folder under `Meetings/`. Read its `CLAUDE.md`, `Notes/`, `Transcripts/`.
   - Process / how-I-do-something → grep across all `Notes/` and `Chat Summaries/` workspace-wide.
   - Topic unclear → check workspace-level `CLAUDE.md`, `Chat Summaries/`, and `Files/`, then expand outward.
   - This tier almost always has the most relevant context — the engineer has touched the topic before and the prior thinking lives here.

2. **Shared RDC Folder (Team Knowledge) — SECOND**
   - Search ALL engineers' entries across ALL three categories (Troubleshooting, Tribal Knowledge, Brainstorming)
   - Not scoped to the asking engineer — search everyone's contributions
   - Solved problems and institutional knowledge from people working on the same equipment, same systems, same facility

3. **SharePoint (Company Documentation) — THIRD**
   - For formal documentation (design specs, SOPs, TSOPs, P&IDs, controlled documents)
   - Use SharePoint search tools

4. **General Knowledge / Internet — LAST RESORT**
   - Fall back only when Tiers 1–3 have nothing relevant
   - Flag explicitly when used: "Not in your workspace, the team folder, or SharePoint — here's general knowledge"
   - Never use for Promega-specific facts (vessels, CC procedures, EtQ workflow, our DS conventions). If those tiers are empty for a Promega-specific question, say so — don't fabricate from training.

### Smart Routing

The skill should recognize when to skip tiers, but **only Tier 1 → Tier 4 is allowed to skip**, and only in two cases:
- The engineer explicitly says "search SharePoint" or "look it up online" — honor the instruction.
- The question is purely conceptual and not tied to the engineer's work (e.g., "What is ISA-88?", "How does PID tuning math work?") — Tier 4 is fine, but mention it.

For everything else, **start with the Personal Workspace.** Examples:
- "What's the DS for Ferm B?" → Tier 1 (any DS work the engineer has done?), then Tier 3 (SharePoint formal doc)
- "Has anyone had issues with the P6 temperature probe?" → Tier 1 (engineer's own P6 notes/summaries), then Tier 2 (team folder)
- "How do we handle CIP on the weekends?" → Tier 1 (engineer's CIP notes), then Tier 2, then Tier 3
- "What is ISA-88?" → Tier 4 directly (purely conceptual)

### Growth Model

Early on, both the personal workspace and shared folder will be sparse. Most searches will fall through to SharePoint. That's fine. As the engineer accumulates notes, summaries, and project history — and as the team promotes more knowledge — Tiers 1 and 2 become increasingly valuable. The system naturally gets better over time without any configuration changes.

---

## Search Strategy

### Step 0 — Search the Personal Workspace (ALWAYS FIRST)

Before anything else, search the engineer's own Personal Workspace. Use conversation context to target the right folder(s) — don't grep the whole workspace if the topic maps clearly to one item.

1. **Locate the workspace.** Find `Personal Workspace/` inside the engineer's mounted folder. Read its top-level `CLAUDE.md` to confirm the mount layout and resolved paths.

2. **Pick the right folder(s) based on conversation context:**

   | Context cue in the conversation | Where to look |
   |---|---|
   | Equipment, vessel (P1–P6, Large Scale), CC number, DS, system, project name | Matching item folder under `Projects/`, `Change Controls/`, `DS Revisions/`, `Commissioning/` (whichever mounts exist). Read its `CLAUDE.md`, `Notes/`, `Chat Summaries/`, `Files/`. |
   | Meeting, decision, action item, "what did [person] say" | Matching folder under `Meetings/`. Read its `CLAUDE.md`, `Notes/`, `Transcripts/`. |
   | Process, procedure, "how do I", "have I done this before" | Workspace-wide grep across all `Notes/` and `Chat Summaries/`. |
   | Topic genuinely unclear | Workspace-level `CLAUDE.md`, then `Chat Summaries/`, then expand outward. |

3. **Match folders intelligently.** If the conversation mentions "P6 temperature" and there's no exact-match folder, also check folders for "Ferm B" (P6 lives there), `Change Controls/CC*temperature*`, etc. Item folder names won't always be literal — use the `CLAUDE.md` description to confirm a folder is on-topic.

4. **Search across both `.md` and `.txt`** inside the workspace — `Notes/` files are `.md` written by the engineer, `Chat Summaries/` files are `.md` written by Cowork. Use the Grep tool, not bash grep.

5. **Present workspace findings** with: file path, item folder (which project/CC/meeting), section header if applicable, and a quoted relevant excerpt.

6. **Freshness rule — sort by most recently edited.** When multiple files match, use filesystem mtime to order them newest-first. Lead with the freshest match; surface older ones below it. If you have a way to get mtime via your tools (e.g., `ls -lt` or equivalent file metadata), use it. If the freshest match contradicts older ones, call the difference out — something probably changed.

7. **If the workspace has nothing relevant**, say so explicitly ("Nothing in your workspace on this") before continuing to Step 0.5. Don't silently skip — the engineer wants to know Tier 1 was checked.

### Step 0.5 — Search Shared RDC Folder

After the Personal Workspace, before SharePoint:

1. Read `Personal Workspace/CLAUDE.md` to get the resolved path for the Shared Team Folder from the `## RESOLVED PATHS` section.
2. If configured, recursively search the shared RDC folder for relevant content. **Search both `.md` and `.txt` files** — older shared folder entries from before the format change are `.md`; newer entries from `/share-chat` and `promote-to-team` are `.txt` (for SharePoint compatibility). Both formats hold the same kind of content.

   ```bash
   # Find candidate files matching keywords across all engineer folders in all three categories
   find "[Shared RDC]/Troubleshooting" "[Shared RDC]/Tribal Knowledge" "[Shared RDC]/Brainstorming" \
     -type f \( -name "*.md" -o -name "*.txt" \) 2>/dev/null
   ```

   Then use the Grep tool to filter by content. Don't grep with bash directly — Grep handles permissions and index correctly across both extensions.

3. Search across ALL engineer folders in ALL three categories (Troubleshooting, Tribal Knowledge, Brainstorming) — not just the asking engineer's folder.
4. Read and summarize relevant matches. The internal markdown structure is identical between `.md` and `.txt`; you can read either with the same parsing logic.
5. If the shared folder is NOT configured in CLAUDE.md (shows "NOT CONFIGURED"), skip to SharePoint search.
6. Present shared folder findings with attribution: author (engineer name from the path), category (Troubleshooting / Tribal Knowledge / Brainstorming), date (from the filename prefix), and source path.

### Step 1 — Determine Search Scope

Based on the question, determine what to search for:

- **Design Specs**: Search for DS documents by number (e.g., "[PROJECT#]-DS-PRO-FERMB-001") or by component (e.g., "DS TEMPERATURE EM")
- **Process procedures**: Search for TSOPs for specific equipment
- **P&IDs and diagrams**: Search for P&IDs, piping diagrams, equipment schematics
- **Control system docs**: Search for FactoryTalk Batch recipes, Logix 5000 documentation, ISA-88 phase definitions
- **Equipment modules**: Search for EM phase summaries, module configuration guides (AIR, OXYGEN, PRESSURE, AGITATION, TEMPERATURE, XFER_IN, XFER_OUT)
- **Change controls and validation**: Search for EtQ change control records, validation protocols
- **Team docs**: Search within team-specific SharePoint sites if the user's team is known from CLAUDE.md
- **General**: Broad search across all engineering documentation

### Step 2 — Execute Search

Use the SharePoint search tools available in the conversation:

1. **Start with `sharepoint_search`** using the user's question as the query. Filter by relevant file types (docx, pdf, xlsx) and folder names if the scope is clear.

2. **If initial search is too broad**, narrow by:
   - Adding the project number or equipment identifier to the query
   - Filtering by folder name (e.g., "Design Specs", "Change Controls", "SOPs", "Equipment")
   - Filtering by file type
   - Adding date filters for recent docs

3. **If initial search returns nothing**, broaden by:
   - Trying alternative terminology (e.g., "EM Phase Summary" vs "equipment module", "fermentation" vs "Ferm A/B")
   - Searching folder names with `sharepoint_folder_search`
   - Removing file type filters
   - Searching for document structure (e.g., "[PROJECT#]-DS-" to find all design specs for a project number)

4. **If still nothing**, that's okay — tell the user clearly and move on. The SharePoint knowledge base is still being built out, so gaps are expected.

### Step 3 — Search Tips for Promega-Specific Content

**For DS documents**: Search by document number pattern (e.g., "[PROJECT#]-DS-PRO-FERMB-001") or by component name (e.g., "PRESSURE EM" or "TEMPERATURE module"). If you know the equipment, use that (e.g., "P6 fermenter" or "Ferm B").

**For EM Phase Summaries**: Search for "EM Phase Summary" plus the vessel identifier (P1, P2, P3, P4, P5, P6, Ferm A, Ferm B, Large Scale) or the module type (AIR, OXYGEN, TEMPERATURE, AGITATION, XFER_IN, XFER_OUT, PRESSURE).

**For TSOPs**: Search for "TSOP" plus the equipment or process name (e.g., "TSOP Ferm A startup" or "TSOP centrifuge operation").

**For batch/PLC docs**: Search for "batch recipe", "FactoryTalk", "Logix", or ISA-88 phase names.

**For change controls**: Search "EtQ" or "change control" plus the CC number (CC#####) or component affected (e.g., "change control TEMPERATURE EM" or "change control Ferm B").

### Step 4 — Available SharePoint Sites

Known Promega engineering SharePoint sites:

| Site | Typical Content |
|------|----------------|
| **RDC Renovations** | Design docs, commissioning, batch training, procurement |
| **RDC Renovations - 06 Production Support** | Change controls, DS updates, production support docs |
| **Process Engineering 2** | Co-op roadmaps, process engineering documentation |
| **IVD Production and Engineering** | Project tracking |
| **QA Audit** | Change control records, SOPs, audit documents |
| **EMS Audit** | Environmental monitoring, EMS audit records, compliance documents |

**Note**: This is not an exhaustive list. Additional SharePoint sites may be available and will be added as the SharePoint architecture is built out. If a search doesn't find what the user needs, try different sites or broader queries.

### Step 5 — Read and Synthesize

For each relevant result:

1. Use `read_resource` with the document's URI to get full content
2. Extract the relevant sections that answer the user's question
3. Note the document title, document number (if applicable), author, and last modified date for citation

### Step 6 — Present Results

**If relevant docs found (from Personal Workspace, shared folder, or SharePoint):**
- Note which tier the result came from (Personal Workspace, team knowledge, or SharePoint)
- Summarize the answer based on what was found
- Cite the source document(s) — title, document number, location, and last updated date
- If the doc is outdated or incomplete, note that and offer to help update it
- If multiple docs conflict, flag the discrepancy and suggest checking with the relevant team

**If no relevant docs found:**
- Tell the user clearly: "I didn't find anything in your workspace, the team folder, or SharePoint about this."
- Don't make it a big deal — the knowledge base is still growing.
- **Never fabricate a result to fill the gap.** Don't invent a CC number, DS document, tag name, or quote. "I don't know" is the right answer. If you fall through to general knowledge, label it explicitly: "Not in any Promega source — here's general knowledge, treat as unverified for our facility." If you ever catch yourself producing a fabricated detail, stop and disclose it ("I just fabricated [X] — I don't actually have that information.").
- Offer two options:
  1. Answer from general knowledge (with a caveat that it may not match Promega practices).
  2. Suggest capturing what they know:
     - `/save-note` (or "save to notes...") — for a local note in a project's `Notes/`
     - `/share-chat` — to summarize the current chat into a project AND push a `.txt` copy to the shared team folder so the next engineer who searches finds it
     - `promote-to-team` — to push specific knowledge they describe directly into the shared team folder (Troubleshooting / Tribal Knowledge / Brainstorming)

**Always include sources** at the end of responses that pull from SharePoint or the shared folder:
> Sources: [Document Title] (Doc# [if applicable]) — last updated [date]

---

## Controlled vs Uncontrolled Documents

SharePoint contains working copies and reference materials, but Promega's approved, authoritative documents live in controlled systems. When search results include documents that should have controlled versions, flag this distinction.

### Controlled Document Systems (Authoritative)

| Document Type | Controlled System | Identifier Format |
|---|---|---|
| SOPs, Work Instructions, Specs, Test Methods | **MasterControl** | SOP-XXX-##, WI-XXX-##, SPEC-XXX-##, TM-XXX-## |
| Forms/Templates | **MasterControl** | FORM-XXX-## |
| Validation Protocols/Reports | **MasterControl** | VP-XXX, VR-XXX |
| Deviations, CAPAs, Change Controls | **EtQ** | DEV-####, CAPA-####, CC##### |
| EHS Incidents, JSAs, PHAs, SDS | **VelocityEHS** | Incident ID, Assessment ID |
| Batch Manufacturing Records | **MES + EtQ** | Batch number |

### SharePoint Documents (Working/Reference)

SharePoint content is useful for background, context, and planning, but is NOT authoritative for:
- Procedures, specifications, or regulatory documents
- Documents that should exist in MasterControl, EtQ, or VelocityEHS

### When to Flag

If a SharePoint search returns a document with "SOP", "Work Instruction", "Specification", "JSA", "PHA", "Deviation", "CAPA", or "Validation" in the title, add this note:

> This document type typically has an approved version in [MasterControl/VelocityEHS/EtQ]. The SharePoint copy may be a draft or outdated. For formal work (change controls, investigations, audits), reference the controlled system version.

For informal reference, project planning, or general understanding, SharePoint copies are fine — just note the distinction.

---

## Edge Cases

**User asks about something not yet documented**: Offer to help them write it up. Suggest the right path based on what they want:
- `/save-note` if they just want a quick local note on a project
- `/share-chat` if the current conversation already covers it — saves a project summary AND pushes a `.txt` to the shared team folder
- `promote-to-team` if they want to dictate the full content directly into the shared folder under a specific category

**Doc is outdated**: Flag it. Say something like: "I found [doc title] but it was last updated [date] — it might be outdated. Want me to help draft an update?"

**Multiple conflicting docs**: Present both, note the conflict, and suggest the user check with the relevant team (Controls Engineers, Process Engineering, Production Support).

**Equipment behavior differs from DS**: This is common. Flag it: "The design spec says [X], but you're observing [Y]. This might be a known issue or a change that wasn't documented. Want me to search for known workarounds or help document the actual behavior?"

**User doesn't have SharePoint connector enabled**: If SharePoint tools aren't available in the session, tell the user: "I can't access SharePoint right now. You may need to enable the Microsoft connector in your Claude settings. In the meantime, I can answer from general knowledge."

**SharePoint returns no results for a topic that should exist**: Don't panic. The SharePoint architecture is still being built out. Let the user know and offer alternatives.
