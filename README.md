# Cowork OS

A Claude Code plugin marketplace for Promega engineering teams.

## Plugins

| Plugin | Version | Description |
| --- | --- | --- |
| [`promega-engineering-os`](./promega-engineering-os) | 3.0.0 | Engineering workspace shaped for the Promega Project Planner V3 Visualizer. Scaffolds a Personal Workspace, syncs Outlook meetings, supports team knowledge sharing, and includes an ISA-88 / FactoryTalk Batch reference. |

## Install

In Claude Code, add this marketplace and install a plugin from it:

```text
/plugin marketplace add will-aadland/cowork-os
/plugin install promega-engineering-os@cowork-os
```

To update later:

```text
/plugin marketplace update cowork-os
/plugin update promega-engineering-os@cowork-os
```

## Repository layout

```
.
├── .claude-plugin/
│   └── marketplace.json        # Marketplace manifest (lists plugins)
├── promega-engineering-os/     # Plugin source
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── commands/               # Slash commands (/begin, /add-project, …)
│   ├── skills/                 # Skills (meeting-sync, isa88-guide, …)
│   ├── PLANNER_REFERENCE.md
│   └── README.md
└── README.md
```

## Authoring

- Marketplace manifest: `.claude-plugin/marketplace.json`
- Plugin manifest: `<plugin>/.claude-plugin/plugin.json`
- After editing, run `/plugin marketplace update cowork-os` to pick up changes.
