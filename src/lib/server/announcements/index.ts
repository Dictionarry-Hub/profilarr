/**
 * Top-level façade for the announcements subsystem.
 *
 * Internally split into two sources:
 *  - `profilarr/`: bulletin announcements fetched from the Dictionarry-Hub
 *    bulletin repo over HTTPS.
 *  - `database/`: per-PCD announcements parsed from each linked database's
 *    working copy on disk (added in a later step).
 *
 * Plus shared utilities (`shared/`) and an `inbox.ts` orchestrator for the
 * combined `/announcements` view.
 *
 * Consumers (API routes, load functions, job handlers) should import from
 * here whenever possible. Subsystem-specific entry points are also
 * available at `./profilarr` and `./database`.
 */

export * from './profilarr/index.ts';
