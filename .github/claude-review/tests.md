## Your review: tests

Tests are in `pr-head/tests/` (unit, integration, e2e). CI runs them from `pr-head/.github/workflows/`.

Question: do the existing test suites cover the behavior this PR changes?

Use the PR description's "Testing" section as context, but judge the tests themselves. You can't run tests or see CI results; judge whether the tests exist and exercise the change, not whether they pass.

Status:

- `not_applicable`: the change has no testable behavior (e.g. docs-only, copy, or purely visual changes).
- `covered`: tests exercise the changed behavior. List them in `covered_by`.
- `gaps`: some changed behavior has no test, or a test named in the description doesn't exercise it. Add a finding for each, pointing at the untested code.

Only consider the project's existing suites. Never suggest new frameworks, one-off scripts, or other tools. Contributors aren't required to add tests, so a gap is information for the maintainer, not a failure.

A gap is behavior a user or a caller depends on with no test: a server action, an API response, a data change, a security check, a job. Don't report these as gaps:

- Lint scripts, CI steps and other tooling. They are verified by running them.
- Form-only convenience that mirrors a server check which is tested: required markers, hints, tooltips, disabled buttons, prop wiring.
- Anything whose only possible test would assert UI state in a browser.
- A guard or helper that the integration tests already reach through the code path that uses it. Reaching it through its caller is coverage.
