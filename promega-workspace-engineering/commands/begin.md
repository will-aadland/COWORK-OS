---
name: begin
description: >
  First-time setup for the CoWork Personal Workspace (Engineering). Orients the engineer
  on how the system works, builds their workspace, outputs a Personal Preferences block
  to paste into Claude Settings, and walks them through meeting sync setup. Trigger:
  "/begin", "set up my workspace", "get started", "initialize my workspace".
---

# /begin — CoWork Personal Workspace Setup (Engineering)

One-time setup. Orients the engineer, builds their Personal Workspace, and gets them fully configured. No interview — just a system walkthrough, one open question, and then everything is built.

**Read `PLANNER_SCHEMA.md` at the plugin root first.** It defines the folder schema, CLAUDE.md format, and Planner Metadata fields used throughout.

## Tone

Professional and efficient. Engineers working with PLCs, batch systems, change controls, and regulated processes. No emojis, no theatrical framing, no fluff — sharp colleague helping them get set up.

---

## Step 1 — Greeting

Open with a short, genuine welcome. Cover these points in your own words — don't recite them as a list:

- Thank them for taking the time to set this up
- Tell them it'll just take a few minutes
- Tell them by the end they'll have a workspace that makes every Claude conversation more useful

---

## Step 2 — Explain the system

Give them a clear picture of how CoWork works. Three short paragraphs, conversational:

**What this is.** CoWork is an organizational tool for both the engineer and Claude. Everything they're working on — projects, change controls, commissioning work, meetings, notes, decisions — lives in a folder on their computer that Claude can read directly. The more they put here, the more Claude can help. Context from active CCs, meeting transcripts, past troubleshooting notes — Claude finds all of it automatically.

**How the Visualizer fits in.** The Promega Project Planner V3 Visualizer is a Windows app that reads their workspace folder in real time. Any folder Claude creates shows up in the Visualizer as a card within a couple of seconds. No database, no server — it reads directly from disk.

**What `/begin` does.** It's going to ask one question, then build everything and leave them with a Personal Preferences block to paste into Claude Settings. After that, Claude will know about their workspace in every conversation automatically — they won't have to explain themselves again.

---

## Step 3 — Explain workspaces

Explain what a workspace is in plain terms:

- A workspace is a top-level folder inside their Personal Workspace — like a drawer in a filing cabinet. Inside each workspace, individual items get their own folders: a specific project, a specific change control, a specific commissioning package.
- **Projects** and **Meetings** are always created. Projects is for anything they're actively working on. Meetings is synced from Outlook automatically — every meeting shows up there, and transcripts land there too.
- Engineers often add workspaces for specific categories of work: Change Controls, DS Revisions, Commissioning, Documentation, Lab Protocols — whatever fits how their team operates.
- They can add more workspaces anytime with `/add-workspace`. No need to figure it all out now.

---

## Step 4 — Collect setup info

Ask one open question in chat (not AskUserQuestion):

> "Before we build your workspace — what's your name, and what kind of engineering work do you do at Promega? And are there any workspaces you'd like besides Projects and Meetings? Think Change Controls, DS Revisions, Commissioning, Documentation — or anything else that fits your work. You can always add more later with `/add-workspace`."

Wait for their response. Parse out:

- **Name** — use as given (first name, full name, whatever they provide)
- **Role / team** — infer from their description (process engineer, automation engineer, validation, etc.); ask once to clarify only if completely unclear
- **Additional workspaces** — any they name; if they say nothing or "just defaults", proceed with Projects + Meetings only

Then ask the path question:

> "What's the full path to your CoWork folder on your Windows machine? For example: `C:\CoWork` or `D:\Users\[your name]\CoWork`"

Once confirmed, set:
- **Workspace root:** `[CoWork path]\Personal Workspace\`
- **Projects path:** `[Workspace root]\Projects\`
- **Meetings path:** `[Workspace root]\Meetings\`
- **Additional workspace paths:** `[Workspace root]\[Name]\` for each

---

## Step 5 — Check for existing workspace

Before building, check if `[Workspace root]\CLAUDE.md` already exists.

**Exists:** Read it and say: "Looks like you're already set up here. Want me to add a workspace, regenerate your Personal Preferences block, or start fresh?"

**Doesn't exist:** Proceed to Step 6.

---

## Step 6 — Scaffold the workspace

Create all folders:

```bash
mkdir -p "[Workspace root]\Projects\Completed"
mkdir -p "[Workspace root]\Meetings"
mkdir -p "[Workspace root]\Notes"
```

For each additional workspace the engineer named:
```bash
mkdir -p "[Workspace root]\[Name]\Completed"
```

Write `[Workspace root]\CLAUDE.md`:

```markdown
# Personal Workspace

[Name] — [Role] at Promega

## MOUNTS

| Workspace | Path |
|-----------|------|
| Projects | [full Windows path to Projects\] |
| Meetings | [full Windows path to Meetings\] |
| [additional workspace] | [full Windows path] |

## NOTES

[full Windows path to Notes\]

## RESOLVED PATHS

Personal Workspace: [full Windows path to Workspace root\]
```

Verify all folders exist and CLAUDE.md is non-empty after writing.

---

## Step 7 — Folder tour

After scaffolding, give a short tour in your own words:

- Their Personal Workspace folder is the home base. Everything lives inside it.
- Projects/ holds all their work items. Each project gets its own folder with Notes/, Files/, and Chat Summaries/ for Claude to save conversation context.
- Meetings/ is where their Outlook meetings will land automatically once meeting sync is running. Each meeting gets its own folder with the agenda, attendees, and eventually a transcript summary.
- Any additional workspaces they requested (Change Controls, Commissioning, etc.) are ready to use — each item they add will follow the same folder structure.

Then say: **"One strong recommendation: go ahead and pin the CoWork folder to Quick Access in Windows Explorer right now. You'll never have to hunt for it again, and it makes it easy to open things directly from the Visualizer."**

---

## Step 8 — Personal Preferences block

Tell them:

> "Here's your Personal Preferences block. Copy everything between the lines and paste it into the **Personal Preferences** box in your Claude settings (Settings → Personal Preferences or Custom Instructions, depending on your interface). This is what tells Claude about your workspace in every single conversation — you won't have to explain yourself again."

Output this block with their actual details filled in:

---

```
## CoWork Personal Workspace (Engineering)

I use the Promega CoWork Engineering plugin with the Promega Project Planner V3 Visualizer (Windows Electron desktop app). My Personal Workspace is a live folder on my computer — you have direct read/write access to it.

**Workspace:** [full path to Personal Workspace\]
**Name:** [Name] | **Role:** [Role] | **Team:** [Team/Dept]
**Workspaces:** [comma-separated list e.g. Projects, Meetings, Change Controls, Commissioning]

---

### Always do this

- At the start of any work-related conversation, read my workspace CLAUDE.md at [full path to CLAUDE.md] for full context before responding
- Before answering any question about my work, projects, meetings, or Promega processes — check my workspace first. Never rely on memory alone for things that could be in my workspace.
- Route by context: project or engineering task → Projects workspace | change control → Change Controls workspace (if present) | commissioning item → Commissioning workspace (if present) | meeting, decision, action item → Meetings workspace | Promega procedure, SOP, or form → SharePoint first
- Use the 3-tier search for any Promega-specific question: my workspace first → Promega SharePoint → general knowledge. Never skip tiers for Promega questions. If workspace and SharePoint are both empty, say so — don't fabricate.
- Proactively offer `/save-note` when something important comes up (troubleshooting finding, decision, action item, equipment behavior note) — but only once per conversation, don't push
- Offer `/save-summary` at natural stopping points when we've covered something worth keeping long-term

---

### My workspaces

| Workspace | Path | What lives here |
|-----------|------|----------------|
| Projects/ | [full path] | Active engineering work, initiatives, and tasks |
| Meetings/ | [full path] | Outlook meetings synced from calendar — transcripts, notes, decisions |
| [Additional workspace]/ | [full path] | [purpose e.g. Change Controls, DS Revisions, Commissioning] |

---

### Commands available

| Command | What it does |
|---------|-------------|
| `/meeting-sync` | Pull Outlook meetings for this and next week + yesterday's transcripts |
| `/add-project` | Scaffold a new item (project, CC, commissioning package) inside a workspace |
| `/add-workspace` | Add a new top-level workspace folder to my Personal Workspace |
| `/save-note` | Write a note into a project's Notes/ folder |
| `/save-summary` | Save this conversation into a project's Chat Summaries/ |
| `/sharepoint-search` | Search Promega's SharePoint knowledge base |
| `/isa88-guide` | ISA-88 and FactoryTalk Batch reference for PLC and batch system questions |

---

### Rules — always enforce

- Never answer Promega-specific questions (SOPs, procedures, policies, forms, work instructions) from general knowledge alone — check workspace and SharePoint first; say "not found" if both are empty
- When I mention a project or CC by name, look it up in my workspace before responding
- When I mention a meeting, check my Meetings workspace first
- For ISA-88, FactoryTalk Batch, PhaseManager, or PLC-related questions, use the `/isa88-guide` skill
- Engineering SharePoint areas to check: QA Audit, Process Engineering, IVD Production and Engineering, EMS Audit
- Cite sources when pulling from SharePoint
- If my workspace CLAUDE.md can't be read or doesn't exist, tell me immediately — don't proceed as if everything is fine

---

### Controlled document note

SharePoint contains working copies. Authoritative versions of regulated documents live in controlled systems:
- SOPs, Work Instructions, Specs, Test Methods, Forms → MasterControl
- Deviations, CAPAs, Change Controls → EtQ
- EHS Incidents, JSAs, SDS → VelocityEHS

When a SharePoint result is a regulated document type, note that the controlled-system version is the authoritative one.
```

---

After outputting the block, say where to find the setting: "In Claude.ai it's under your profile → Personal Preferences. In Claude Code it's in your settings file. If you can't find it, let me know which interface you're using and I'll point you to the right spot."

---

## Step 9 — Meeting sync setup

Explain meeting sync in your own words, covering these points:

- **What it does.** `/meeting-sync` pulls all Outlook meetings for this week and next week into the Meetings workspace. Each meeting gets its own folder — title, date, agenda, attendees. The best part: it automatically pulls transcripts from meetings the day before. Every morning, yesterday's meetings are already summarized.
- **On demand too.** They can ask for a transcript from any specific meeting they've been in, at any time — not just the previous day.
- **Setting it up as a scheduled task.** Walk them through this: in Claude Code, go to Settings → Scheduled Tasks (or equivalent). Add a new daily task running `/meeting-sync`. Recommend scheduling it for early morning — 7:00 AM works well — so it's done before they start their day.
- **Which model to use.** Recommend **Sonnet** for the scheduled task. It handles calendar parsing, attendee tables, and transcript summarization efficiently and is well-suited for scheduled background runs.

Say: "Once it's running, you'll open Claude each morning and your meetings are already there — synced, organized, and summarized. You can also just type `/meeting-sync` anytime to run it manually."

---

## Step 10 — Thank and close

Wrap up warmly:

- Tell them their CoWork Personal Workspace is ready.
- Remind them that the more they use it — adding projects, saving notes from troubleshooting sessions, letting meeting sync run each morning — the more useful Claude becomes over time. It compounds.
- Ask: "Any questions about how any of it works?"

---

## Edge Cases

- **CoWork folder doesn't exist yet.** Ask them to create it first, then let you know the path and run `/begin` again. Or offer to continue once they've created it.
- **User skips the workspace question.** Proceed with Projects + Meetings only.
- **User skips the path question.** Ask once more specifically; if still unclear, use a placeholder `[your CoWork path]` in the CLAUDE.md and flag it.
- **User asks to skip the tour.** Skip Step 7, go straight to Step 8.
- **User asks to skip meeting sync setup.** Skip Step 9, go to Step 10.
- **Workspace name conflicts** with reserved subfolder names (`Completed`, `Notes`, `Files`, `Chat Summaries`, `Transcripts`). Suggest an alternative.
