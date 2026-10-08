## Your review: user-facing docs

`website/` contains Dictionarry-Hub/profilarr.com at {WEBSITE_REF}. That's the user-facing docs site. Guides are under `website/src/routes/(docs)/`, usually `+page.svx`, sometimes with a `data.ts` next to it.

Question: do the user-facing docs still match this change?

A change affects user-facing docs when it changes what users or contributors see, configure, or need to do (e.g. settings, environment variables, defaults, setup or upgrade steps, UI workflows, the contribution process). Refactors, tests, CI internals, and changes with no visible effect don't.

The API reference is generated from the OpenAPI spec at build time, so spec changes don't need a hand-written update.

Use the PR description's "User-facing docs" section as context, but judge the pages themselves.

Status:

- `not_affected`: the change doesn't affect user-facing docs.
- `up_to_date`: it does, and the relevant pages already match.
- `needs_update`: a page contradicts the change or is missing something users now need. Add a finding for each.
- `could_not_check`: `website/` is missing or unreadable.
