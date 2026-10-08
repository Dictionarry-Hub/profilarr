## Your review: technical docs

The repo's technical docs are in `pr-head/docs/`, indexed by `pr-head/docs/ARCHITECTURE.md`. The OpenAPI spec in `pr-head/docs/api/v1/` counts too.

Question: do the technical docs still match this change?

A change affects technical docs when it changes something a file in `docs/` describes (e.g. a subsystem's behavior, data flow, schema, API contract, code conventions, or CI and release process).

Use the PR description's "Technical docs" section as context, but judge the docs themselves.

Status:

- `not_affected`: no doc describes what changed.
- `up_to_date`: a doc describes it, and it matches (including docs updated in this PR).
- `needs_update`: a doc contradicts the change, or covers that area but misses something the change adds (e.g. a new job type missing from the jobs doc). Add a finding for each.

Don't ask for new docs for areas no doc covers, and don't treat documented planned work as a requirement.

Docs describe how the system works now. If this PR adds history, investigation notes, or before/after measurements to `docs/`, mark `needs_update` and add a finding; that belongs in the PR body.
