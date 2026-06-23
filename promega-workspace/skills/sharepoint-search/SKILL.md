---
name: sharepoint-search
description: >
  Search Promega's knowledge base on SharePoint for company-specific documentation, procedures,
  forms, policies, and team practices. This skill should be used when the user asks about
  "company standards", "where's the procedure", "how do we do this", "check the knowledge base",
  "what's our process for", "find the template for", "look up the form", or any question about
  Promega-specific processes, workflows, or documentation. Also triggers when the user asks
  Claude to "search SharePoint", "check our docs", or "look it up in the knowledge base".
version: 1.0.0
---

# SharePoint Knowledge Search

The primary path for Promega-specific questions. Walks the **3-tier search hierarchy** (workspace → SharePoint → general knowledge), with **Tier 1 always mandatory**.

> **Current state.** SharePoint contains real Promega documentation, but the centralized knowledge base is still being built out. Empty results for some topics are expected — surface them honestly rather than fabricating.

## When to use

Promega-specific questions: procedures, SOPs, forms, policies, team-specific processes, templates, "how do we...", "what's our...", "where's the..." etc.

---

## Search hierarchy (in order, Tier 1 mandatory)

1. **Personal Workspace.** Route by conversation context (see Step 0). Almost always has the most relevant prior thinking — the user has touched the topic before.
2. **Company SharePoint.** Formal documentation (SOPs, work instructions, forms, templates, policies, controlled docs).
3. **General knowledge / internet.** Last resort. **Never use for Promega-specific facts** — if Tiers 1–2 are empty for a Promega-specific question, say so.

**User's SharePoint preference (from their workspace CLAUDE.md) controls Tier 2 aggressiveness, not order:**
- Always check first → search SharePoint aggressively (still after Tier 1).
- On request only → escalate to Tier 2 only when explicitly asked.
- Balanced → Tier 2 for standards/procedures, fall through to Tier 3 for conceptual how-to.

**Skip-Tier exceptions** (only Tier 1 → Tier 3 is allowed to skip):
- User says "search SharePoint" or "look it up online" — honor the instruction.
- Question is purely conceptual, not tied to their work — Tier 3 fine, mention it.

For everything else, start with the workspace.

**Growth model.** Tier 1 starts sparse; most early searches fall through to SharePoint. As the user accumulates notes and summaries, Tier 1 becomes increasingly valuable automatically.

---

## Search procedure

### Step 0 — Workspace (always first)

Locate `Personal Workspace/` in the mounted folder. Read its top-level `CLAUDE.md` to confirm mounts and resolved paths.

Route by context:

| Context cue | Where to look |
|---|---|
| Project name, item reference, any tracked work | Matching item folder under any project mount. Read `CLAUDE.md`, `Notes/`, `Chat Summaries/`, `Files/`. |
| Meeting, decision, action item, "what did [person] say" | Matching `Meetings/` folder. Read `CLAUDE.md`, `Notes/`, `Transcripts/`. |
| Process, procedure, "how do I", "have I done this before" | Workspace-wide grep across all `Notes/` and `Chat Summaries/`. |
| Unclear | Workspace-level `CLAUDE.md`, then `Chat Summaries/`, expand outward. |

**Match intelligently.** Open `CLAUDE.md` to confirm a candidate folder is on-topic before reporting back.

**Search across `.md` and `.txt`** — use the Grep tool, not bash grep.

**Freshness rule** — sort matches by mtime (newest first). Lead with the freshest; if it contradicts older results, call out the difference.

**Nothing in Tier 1** — say so explicitly: "Nothing in your workspace on this", then continue.

### Step 1 — Determine search scope

Based on the question:
- **Procedures / SOPs** — search by procedure name or process area.
- **Forms and templates** — search by form name or use case.
- **Policies** — search by policy area or department.
- **Project or team docs** — search by project name or team SharePoint site.
- **Quality / compliance docs** — search by doc type (SOP, validation protocol, etc.).
- **Training materials** — search by topic or role.

### Step 2 — Execute

Start with `sharepoint_search` using the user's question. Filter by file types (docx, pdf, xlsx) and folder names if scope is clear.

**Too broad** → narrow by department, process area, document type, or date.

**Returns nothing** → broaden: alternative terminology, `sharepoint_folder_search`, remove file type filters.

**Still nothing** → tell the user clearly. SharePoint is still being built out; gaps are expected.

### Step 3 — Known SharePoint areas (partial)

| Area | Content |
|---|---|
| **QA Audit** | SOPs, quality procedures, audit docs |
| **Process Engineering** | Process docs, lab protocols |
| **IVD Production and Engineering** | Project and production docs |
| **EMS Audit** | Environmental monitoring, compliance |
| **HR / Compliance** | Policies, forms, training materials |

Not exhaustive; many other sites may be available.

### Step 4 — Read and synthesize

For each relevant result: `read_resource` with the URI, extract the relevant sections, note title / author / last modified.

### Step 5 — Present

**Results found** — note the tier, summarize the answer, cite sources (title, location, last updated). If outdated/incomplete, flag and offer to help update.

**Nothing found** — say so plainly: "I didn't find anything in your workspace or SharePoint about this." Don't make it a big deal.

**Never fabricate to fill a gap.** Don't invent document IDs, form numbers, or quotes. "I don't know" is the right answer. If you fall through to Tier 3, label it: "Not in any Promega source — here's general knowledge, treat as unverified." If you catch yourself fabricating, stop and disclose: "I just fabricated [X] — I don't actually have that information."

Offer next steps when empty: answer from general knowledge with a caveat, or capture what the user knows via `/save-note` or `/save-summary`.

**Always cite sources** when pulling from SharePoint.

---

## Controlled vs. uncontrolled documents

SharePoint contains working copies and reference materials. Authoritative versions of regulated documents live in controlled systems:

| Document type | Controlled system |
|---|---|
| SOPs, Work Instructions, Specs, Test Methods | MasterControl |
| Forms / Templates | MasterControl |
| Validation Protocols / Reports | MasterControl |
| Deviations, CAPAs, Change Controls | EtQ |
| EHS Incidents, JSAs, PHAs, SDS | VelocityEHS |

If a SharePoint hit is a regulated document type, add:

> This document type typically has an approved version in the relevant controlled system (MasterControl, EtQ, VelocityEHS). The SharePoint copy may be a draft or outdated. For formal work, reference the controlled-system version.

Informal reference / planning / general understanding — SharePoint copies are fine; just note the distinction.

---

## Edge Cases

- **Topic not yet documented.** Offer to help write it up: `/save-note` (local project note), `/save-summary` (current chat → project Chat Summaries/).
- **Outdated doc.** Flag the last-modified date, offer to help draft an update.
- **No SharePoint connector.** "I can't access SharePoint right now. Enable the Microsoft 365 connector in your Claude settings. In the meantime, I can answer from general knowledge."
- **Topic that should exist returns nothing.** Don't panic; SharePoint architecture is still being built out.
