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

The primary path for Promega-specific engineering questions. Walks the **4-tier search hierarchy** (workspace → shared RDC folder → SharePoint → general knowledge), with **Tier 1 always mandatory**.

> **Current state.** SharePoint contains real engineering documentation, but the centralized knowledge base is still being built out. Empty results for some topics are expected — surface them honestly rather than fabricating.

## When to use

Promega-specific questions: design specs, change controls, TSOPs, EM configurations, P&IDs, ISA-88 batch recipes, FactoryTalk Batch standards, team-specific processes, equipment behavior, "how do we...", "what's our...", etc.

---

## Search hierarchy (in order, Tier 1 mandatory)

1. **Personal Workspace.** Route by conversation context (see Step 0). Almost always has the most relevant prior thinking — the engineer has touched the topic before.
2. **Company SharePoint.** Formal documentation (DSes, SOPs, TSOPs, P&IDs, controlled docs).
3. **General knowledge / internet.** Last resort. **Never use for Promega-specific facts** — if Tiers 1–2 are empty for a Promega-specific question, say so.

**Engineer's SharePoint preference (from their workspace CLAUDE.md) controls Tier 2 aggressiveness, not order:**
- Always check first → search SharePoint aggressively (still after Tier 1).
- On request only → escalate to Tier 2 only when explicitly asked.
- Balanced → Tier 2 for standards/processes, fall through to Tier 3 for conceptual how-to.

**Skip-Tier exceptions** (only Tier 1 → Tier 3 is allowed to skip):
- Engineer says "search SharePoint" or "look it up online" — honor the instruction.
- Question is purely conceptual, not tied to their work ("What is ISA-88?", "How does PID tuning math work?") — Tier 3 fine, mention it.

For everything else, start with the workspace.

**Growth model.** Tier 1 starts sparse; most early searches fall through to SharePoint. As the engineer accumulates notes and summaries, Tier 1 becomes increasingly valuable automatically.

---

## Search procedure

### Step 0 — Workspace (always first)

Locate `Personal Workspace/` in the mounted folder. Read its top-level `CLAUDE.md` to confirm mounts and resolved paths.

Route by context:

| Context cue | Where to look |
|---|---|
| Equipment, vessel (P1–P6, Large Scale), CC number, DS, system, project name | Matching item folder under `Projects/`, `Change Controls/`, `DS Revisions/`, `Commissioning/`. Read `CLAUDE.md`, `Notes/`, `Chat Summaries/`, `Files/`. |
| Meeting, decision, action item, "what did [person] say" | Matching `Meetings/` folder. Read `CLAUDE.md`, `Notes/`, `Transcripts/`. |
| Process, procedure, "how do I", "have I done this before" | Workspace-wide grep across all `Notes/` and `Chat Summaries/`. |
| Unclear | Workspace-level `CLAUDE.md`, then `Chat Summaries/`, expand outward. |

**Match intelligently.** "P6 temperature" without an exact folder → also check "Ferm B" folders (P6 lives there), `Change Controls/CC*temperature*`, etc. Open `CLAUDE.md` to confirm a candidate folder is on-topic before reporting back.

**Search across `.md` and `.txt`** — Notes are `.md`, Chat Summaries are `.md`. Use the Grep tool, not bash grep.

**Freshness rule** — sort matches by mtime (newest first). Lead with the freshest; if it contradicts older results, call out the difference.

**Nothing in Tier 1** — say so explicitly: "Nothing in your workspace on this", then continue.

### Step 1 — Determine search scope

Based on the question:
- **DS docs** — search by number (`[PROJECT#]-DS-PRO-FERMB-001`) or component (`DS TEMPERATURE EM`).
- **Process procedures** — TSOPs for specific equipment.
- **P&IDs/diagrams** — piping diagrams, schematics.
- **Control system docs** — FactoryTalk Batch recipes, Logix 5000 docs, ISA-88 phase definitions.
- **Equipment Modules** — EM Phase Summaries (AIR, OXYGEN, PRESSURE, AGITATION, TEMPERATURE, XFER_IN, XFER_OUT, pH).
- **Change controls and validation** — EtQ records, validation protocols.
- **Team docs** — team-specific sites if known from CLAUDE.md.

### Step 2 — Execute

Start with `sharepoint_search` using the user's question. Filter by file types (docx, pdf, xlsx) and folder names if scope is clear.

**Too broad** → narrow by project number, equipment ID, folder name (`Design Specs`, `Change Controls`, `SOPs`), file type, or date.

**Returns nothing** → broaden: alternative terminology ("EM Phase Summary" vs "equipment module"), `sharepoint_folder_search`, remove file type filters, search by doc structure (`[PROJECT#]-DS-` to find all design specs for a project).

**Still nothing** → tell the user clearly. SharePoint is still being built out; gaps are expected.

### Step 3 — Search tips

- **DS** — doc number pattern or component name; or equipment ("P6 fermenter", "Ferm B").
- **EM Phase Summaries** — "EM Phase Summary" + vessel ID (P1–P6, Ferm A/B, Large Scale) or module type.
- **TSOPs** — "TSOP" + equipment/process name.
- **Batch/PLC** — "batch recipe", "FactoryTalk", "Logix", or ISA-88 phase names.
- **Change controls** — "EtQ" or "change control" + CC number or component.

### Step 4 — Known SharePoint sites

| Site | Content |
|---|---|
| **RDC Renovations** | Design docs, commissioning, batch training, procurement |
| **RDC Renovations - 06 Production Support** | Change controls, DS updates, production support |
| **Process Engineering 2** | Co-op roadmaps, process engineering docs |
| **IVD Production and Engineering** | Project tracking |
| **QA Audit** | Change control records, SOPs, audit docs |
| **EMS Audit** | Environmental monitoring, compliance |

Not exhaustive; more sites may be available.

### Step 5 — Read and synthesize

For each relevant result: `read_resource` with the URI, extract the relevant sections, note title / doc number / author / last modified.

### Step 6 — Present

**Results found** — note the tier, summarize the answer, cite sources (title, doc number, location, last updated). If outdated/incomplete, flag and offer to help update. Conflicting docs: present both and suggest checking with the relevant team.

**Nothing found** — say so plainly: "I didn't find anything in your workspace, the team folder, or SharePoint about this." Don't make it a big deal.

**Never fabricate to fill a gap.** Don't invent CC numbers, DS document IDs, tag names, or quotes. "I don't know" is the right answer. If you fall through to Tier 3, label it: "Not in any Promega source — here's general knowledge, treat as unverified for our facility." If you catch yourself fabricating, stop and disclose: "I just fabricated [X] — I don't actually have that information."

Offer next steps when empty: answer from general knowledge with a caveat, or capture what the engineer knows via `/save-note`, `/share-chat`, or `promote-to-team` so the next search finds it.

**Always cite sources** when pulling from SharePoint or the shared folder.

---

## Controlled vs. uncontrolled documents

SharePoint contains working copies and reference materials. Authoritative versions of regulated documents live in controlled systems:

| Document type | Controlled system | Identifier |
|---|---|---|
| SOPs, Work Instructions, Specs, Test Methods | MasterControl | `SOP-XXX-##`, `WI-XXX-##`, `SPEC-XXX-##`, `TM-XXX-##` |
| Forms / Templates | MasterControl | `FORM-XXX-##` |
| Validation Protocols / Reports | MasterControl | `VP-XXX`, `VR-XXX` |
| Deviations, CAPAs, Change Controls | EtQ | `DEV-####`, `CAPA-####`, `CC#####` |
| EHS Incidents, JSAs, PHAs, SDS | VelocityEHS | Incident ID, Assessment ID |
| Batch Manufacturing Records | MES + EtQ | Batch number |

If a SharePoint hit's title includes "SOP", "Work Instruction", "Specification", "JSA", "PHA", "Deviation", "CAPA", or "Validation", add:

> This document type typically has an approved version in [MasterControl/VelocityEHS/EtQ]. The SharePoint copy may be a draft or outdated. For formal work (change controls, investigations, audits), reference the controlled-system version.

Informal reference / planning / general understanding — SharePoint copies are fine; just note the distinction.

---

## Edge Cases

- **Topic not yet documented.** Offer to help write it up: `/save-note` (local project note), `/save-summary` (current chat → project Chat Summaries/).
- **Outdated doc.** Flag the last-modified date, offer to help draft an update.
- **Conflicting docs.** Present both, note the conflict, suggest checking with the relevant team.
- **Behavior differs from DS.** Common. Flag it; offer to search for workarounds or document actual behavior.
- **No SharePoint connector.** "I can't access SharePoint right now. Enable the Microsoft connector in your Claude settings. In the meantime, I can answer from general knowledge."
- **Topic that should exist returns nothing.** Don't panic; SharePoint architecture is still being built out.
