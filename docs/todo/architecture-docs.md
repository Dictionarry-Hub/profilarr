# Architecture Docs Overhaul

**Why:** The current `ARCHITECTURE.md` is a single 1100+ line file covering 23
sections. It's hard to maintain — changes require navigating a massive file, and
sections go stale because updating feels heavy.

**Plan:** Replace with a nested `docs/architecture/` folder. One file per
module, mirroring the `src/lib/server/` structure. Each file is small,
self-contained, and easy to update independently.

## Proposed structure

```
docs/architecture/
├── index.md            — purpose, tech stack, glossary, links to all sections
├── pcd.md              — PCD system (ops, cache, compiler, writer, conflicts)
├── entities.md         — entity CRUD patterns (CF, QP, delay, regex, media mgmt)
├── sync.md             — sync engine, per-entity syncers, mappings
├── jobs.md             — job queue, dispatcher, handlers, scheduling
├── rename.md           — rename processor, logging, settings
├── upgrades.md         — upgrade processor, filters, cooldown, dry-run
├── notifications.md    — notification manager, notifiers, definitions
├── security.md         — auth modes, sessions, OIDC, API keys, security scans
├── database.md         — app DB, migrations, queries
├── frontend.md         — UI components, stores, alerts, theme
├── utils.md            — HTTP client, arr clients, git, TMDB, AI, logger, config
├── api.md              — API v1 routes, contract-first approach
├── parser.md           — C# parser service
└── scripts.md          — dev workflow, type generation, tests, stats
```

## Guidelines

- Loosely coupled — each file should stand alone, link to others only when
  necessary
- Trim aspirational/planned content as we go (decide per-section)
- Don't need all sections for open beta — prioritize what contributors will
  touch
- Can split further later (e.g. `entities.md` → `entities/custom-formats.md`)

## Progress

- [ ] Create `docs/architecture/` folder
- [ ] Write `index.md`
- [ ] pcd.md
- [ ] entities.md
- [ ] sync.md
- [ ] jobs.md
- [ ] rename.md
- [ ] upgrades.md
- [ ] notifications.md
- [ ] security.md
- [ ] database.md
- [ ] frontend.md
- [ ] utils.md
- [ ] api.md
- [ ] parser.md
- [ ] scripts.md
- [ ] Remove old `ARCHITECTURE.md`
