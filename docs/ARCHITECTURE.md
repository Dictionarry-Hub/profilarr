# Profilarr Architecture

This folder is the reference architecture for Profilarr. Each file covers one
subsystem and can be read on its own. Start here, then follow the links below
to whichever part you're interested in. For the contribution workflow (branches,
reviews, releases), see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Table of Contents

- [Purpose](#purpose)
- [Tech Stack](#tech-stack)
- [Glossary](#glossary)
- [Architecture Sections](#architecture-sections)

## Purpose

Profilarr manages configuration for Radarr, Sonarr, and other \*arr apps by
syncing curated configuration databases (PCDs) into live instances. It targets
two audiences: end users who link a PCD and sync it to an Arr instance while
keeping local tweaks, and PCD developers who build, test, and publish the
configuration dataset itself.

The system is DB-first. All configuration changes are stored as append-only
operations in SQLite and replayed into an in-memory cache on every compile. The
cache is the source of truth for reads and sync. Repo files are imported into
the database when a PCD is linked, and exported back when a PCD developer
publishes a release.

## Tech Stack

| Layer          | Choice                            |
| -------------- | --------------------------------- |
| Language       | TypeScript                        |
| Runtime        | Deno 2                            |
| Web framework  | SvelteKit (Svelte 5)              |
| Styling        | Tailwind CSS 4                    |
| Database       | SQLite (WAL)                      |
| Query builder  | Kysely                            |
| Parser service | C# / .NET microservice (optional) |

## Glossary

- **Arr**: Radarr, Sonarr, or another \*arr app that Profilarr syncs
  configuration to.
- **PCD**: Profilarr Compliant Database. A Git repository containing a
  configuration dataset expressed as ops plus a `pcd.json` manifest.
- **Op**: An append-only SQL operation (create, update, or delete) that builds
  part of the configuration state. Ops are immutable once published.
- **Base ops**: Published ops that make up a PCD's canonical state. Owned by
  the PCD repo.
- **Draft base ops**: Unpublished base ops staged locally while a developer
  iterates before exporting.
- **User ops**: Local overrides stored in the user layer. Never exported,
  persist across PCD pulls.
- **Schema layer**: DDL applied first during compile, loaded from files at
  `${pcdPath}/deps/schema/ops` inside each linked PCD.
- **Tweaks layer**: Optional SQL tweaks applied after base ops, loaded from
  files at `${pcdPath}/tweaks` inside a linked PCD.
- **Stable key**: A name or composite key used to identify entities without
  relying on auto-incrementing IDs.
- **Value guard**: Old-value checks in UPDATE and DELETE statements that detect
  upstream changes. A rowcount of 0 means the guard didn't match.
- **Compile**: Replaying all ops in layer order (schema, base, tweaks, user) to
  build an in-memory SQLite cache.
- **Cache**: The in-memory compiled state. Source of truth for reads,
  validation, and sync payloads.
- **Manifest**: `pcd.json` at the root of a PCD repo describing name, version,
  dependencies, and metadata.
- **Parser**: C# microservice that extracts structured metadata from release
  titles for custom format matching and entity testing.
- **Sync**: Pushing compiled configuration from the cache into Arr instances.
- **Entity testing**: Evaluating quality profile scoring against real movies or
  series with TMDB metadata and real or synthetic releases.

## Architecture Sections

**Backend**

- [backend/api.md](./backend/api.md): API v1 routes, contract-first workflow, OpenAPI spec
- [backend/database.md](./backend/database.md): App database, migrations, query layer, schema reference
- [backend/jobs.md](./backend/jobs.md): Job queue, dispatcher, handlers, scheduling
- [backend/logger.md](./backend/logger.md): Logger singleton, log levels, output formats, usage
- [backend/notifications.md](./backend/notifications.md): Notification manager, definitions, notifiers
- [backend/parser.md](./backend/parser.md): C# parser microservice, TS client, caching, integration
- [backend/pcd.md](./backend/pcd.md): PCD system, schema, layers, writer, value guards, conflicts
- [backend/pcd-entities.md](./backend/pcd-entities.md): PCD entity types, CRUD patterns, cascading
- [backend/rename.md](./backend/rename.md): Arr rename pipeline, scheduling, logging, notifications
- [backend/schema-bump.md](./backend/schema-bump.md): PCD schema evolution, safe vs unsafe changes
- [backend/security.md](./backend/security.md): Auth modes, sessions, OIDC, API keys, security scans
- [backend/sync.md](./backend/sync.md): Sync pipeline, transformation, section registry, cleanup
- [backend/upgrades.md](./backend/upgrades.md): Upgrade pipeline, filters, selectors, cooldown, scheduling
- [backend/utilities.md](./backend/utilities.md): HTTP client, config, cache, markdown, Git, TMDB

**Frontend**

- [frontend/ui.md](./frontend/ui.md): UI component library, `no-raw-ui` lint rule, planned theming
- [frontend/alerts.md](./frontend/alerts.md): Toast notifications, settings, form-action error pattern
- [frontend/dirty.md](./frontend/dirty.md): Dirty store, nav guard, form lifecycle, patterns
- [frontend/cutscene.md](./frontend/cutscene.md): Interactive onboarding system
